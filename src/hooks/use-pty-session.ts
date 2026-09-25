import { useCallback, useEffect, useRef, useState } from "react";
import type { PtyInfo, Client } from "../lib/sdk";

export type PtySessionStatus = "idle" | "loading" | "ready" | "error";

export type PtySessionItem = {
  id: string;
  title?: string;
  status?: string;
};

function extractPtyArray(raw: unknown): PtyInfo[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.ptys)) return obj.ptys as PtyInfo[];
    if (Array.isArray(obj.items)) return obj.items as PtyInfo[];
    if (Array.isArray(obj.data)) return obj.data as PtyInfo[];
  }
  return [];
}

function extractPtyId(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  if (typeof obj.id === "string" && obj.id) return obj.id;
  if (
    obj.data &&
    typeof obj.data === "object" &&
    typeof (obj.data as Record<string, unknown>).id === "string"
  ) {
    return (obj.data as Record<string, unknown>).id as string;
  }
  if (typeof obj.location === "string") {
    const match = obj.location.match(/\/api\/pty\/([^/]+)/);
    if (match) return match[1];
  }
  return null;
}

function extractTicket(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.ticket === "string" && obj.ticket) return obj.ticket;
  if (obj.data && typeof obj.data === "object") {
    const nested = (obj.data as Record<string, unknown>).ticket;
    if (typeof nested === "string" && nested) return nested;
  }
  return null;
}

function runningSessions(ptys: PtyInfo[]): PtySessionItem[] {
  return ptys
    .filter((p) => p && p.status === "running")
    .map((p) => ({
      id: p.id,
      title: p.title || undefined,
      status: p.status,
    }));
}

export function usePtySession(
  client: Client | null,
  directory: string | undefined,
  shell = "auto",
) {
  const [sessions, setSessions] = useState<PtySessionItem[]>([]);
  const [ptyId, setPtyId] = useState<string | null>(null);
  const [status, setStatus] = useState<PtySessionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<string | null>(null);
  const [bootstrapKey, setBootstrapKey] = useState(0);
  const selectGen = useRef(0);

  const bumpBootstrap = useCallback(() => {
    setBootstrapKey((key) => key + 1);
  }, []);

  const buildCreateBody = useCallback((): Record<string, unknown> => {
    const body: Record<string, unknown> = {
      cwd: directory,
      title: "Terminal",
    };
    if (shell !== "auto") body.command = shell;
    return body;
  }, [directory, shell]);

  const refreshList = useCallback(async (): Promise<PtySessionItem[]> => {
    if (!client?.pty || !directory) return [];
    const raw = await client.pty.list(directory);
    const items = runningSessions(extractPtyArray(raw));
    setSessions(items);
    return items;
  }, [client, directory]);

  const fetchConnectTicket = useCallback(
    async (id: string): Promise<string | null> => {
      if (!client?.pty) return null;
      const tokenResp = await client.pty.connectToken(id);
      return extractTicket(tokenResp);
    },
    [client],
  );

  const select = useCallback(
    async (id: string) => {
      if (!client || !directory) return;
      const gen = selectGen.current + 1;
      selectGen.current = gen;

      setPtyId(id);
      setStatus("loading");
      setError(null);
      setTicket(null);

      try {
        const nextTicket = await fetchConnectTicket(id);
        if (selectGen.current !== gen) return;
        setTicket(nextTicket);
        setStatus("ready");
      } catch (caught) {
        if (selectGen.current !== gen) return;
        const message =
          caught instanceof Error
            ? caught.message
            : "Failed to connect to terminal.";
        setStatus("error");
        setError(message);
      }
    },
    [client, directory, fetchConnectTicket],
  );

  const createPty = useCallback(async (): Promise<string> => {
    if (!client?.pty) {
      throw new Error("PTY create API not available on client");
    }
    if (!directory) throw new Error("No session directory for PTY");

    const created = await client.pty.create(buildCreateBody(), directory);
    const createdId = extractPtyId(created);
    if (!createdId) throw new Error("Server did not return a PTY id.");
    return createdId;
  }, [client, directory, buildCreateBody]);

  const createNew = useCallback(async () => {
    if (!client || !directory) return;

    setStatus("loading");
    setError(null);
    setTicket(null);

    try {
      const createdId = await createPty();
      const listed = await refreshList();
      const known = listed.some((s) => s.id === createdId);
      if (!known) {
        setSessions((prev) => [
          ...prev,
          { id: createdId, title: "Terminal", status: "running" },
        ]);
      }
      await select(createdId);
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Failed to start terminal.";
      setPtyId(null);
      setTicket(null);
      setStatus("error");
      setError(message);
    }
  }, [client, directory, createPty, refreshList, select]);

  const closeSession = useCallback(
    async (id: string) => {
      if (!client?.pty || !directory) return;

      try {
        await client.pty.remove(id, directory);
      } catch (caught) {
        const message =
          caught instanceof Error
            ? caught.message
            : "Failed to close terminal.";
        setError(message);
        setStatus("error");
        return;
      }

      const remaining = (await refreshList()).filter((s) => s.id !== id);
      setSessions(remaining);

      if (ptyId !== id) return;

      setPtyId(null);
      setTicket(null);

      if (remaining.length > 0) {
        await select(remaining[0].id);
        return;
      }

      await createNew();
    },
    [client, directory, ptyId, refreshList, select, createNew],
  );

  const retry = useCallback(() => {
    selectGen.current += 1;
    setPtyId(null);
    setTicket(null);
    setStatus("loading");
    setError(null);
    bumpBootstrap();
  }, [bumpBootstrap]);

  const reset = useCallback(() => {
    selectGen.current += 1;
    setPtyId(null);
    setTicket(null);
    setStatus("idle");
    setError(null);
    bumpBootstrap();
  }, [bumpBootstrap]);

  useEffect(() => {
    if (!client || !directory) return;

    let cancelled = false;

    const bootstrap = async () => {
      setStatus("loading");
      setError(null);
      setTicket(null);

      let listError: Error | null = null;
      let listed: PtySessionItem[] = [];

      try {
        listed = await refreshList();
      } catch (caughtList) {
        listError =
          caughtList instanceof Error
            ? caughtList
            : new Error(String(caughtList));
        console.error("[usePtySession] list failed", listError);
      }

      if (cancelled) return;

      if (listed.length > 0) {
        await select(listed[0].id);
        return;
      }

      try {
        const createdId = await createPty();
        if (cancelled) return;

        await refreshList();
        setSessions((prev) => {
          if (prev.some((s) => s.id === createdId)) return prev;
          return [
            ...prev,
            { id: createdId, title: "Terminal", status: "running" },
          ];
        });

        const nextTicket = await fetchConnectTicket(createdId);
        if (cancelled) return;

        setPtyId(createdId);
        setTicket(nextTicket);
        setStatus("ready");
      } catch (caught) {
        if (cancelled) return;
        const createError =
          caught instanceof Error ? caught : new Error(String(caught));
        const hint = listError
          ? `PTY list failed: ${listError.message}. Create also failed: ${createError.message}`
          : `PTY create failed: ${createError.message}`;
        setPtyId(null);
        setTicket(null);
        setStatus("error");
        setError(hint);
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
      selectGen.current += 1;
    };
  }, [
    client,
    directory,
    bootstrapKey,
    refreshList,
    select,
    createPty,
    fetchConnectTicket,
  ]);

  return {
    sessions,
    ptyId,
    status,
    error,
    ticket,
    select,
    createNew,
    closeSession,
    retry,
    reset,
  };
}
