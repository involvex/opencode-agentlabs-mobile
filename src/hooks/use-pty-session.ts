import { useCallback, useEffect, useRef, useState } from "react";
import type { PtyInfo, Client } from "../lib/sdk";

export type PtySessionStatus = "idle" | "loading" | "ready" | "error";

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

export function usePtySession(
  client: Client | null,
  directory: string | undefined,
  shell = "auto",
) {
  const [ptyId, setPtyId] = useState<string | null>(null);
  const [status, setStatus] = useState<PtySessionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<string | null>(null);
  const retryCount = useRef(0);

  const retry = useCallback(() => {
    retryCount.current += 1;
    setPtyId(null);
    setTicket(null);
    setStatus("loading");
    setError(null);
  }, []);

  useEffect(() => {
    if (!client || !directory) return;

    let cancelled = false;
    const attempt = retryCount.current;

    console.log("[usePtySession] effect run", {
      hasClient: !!client,
      clientKeys: client ? Object.keys(client) : [],
      hasPty: !!client?.pty,
      ptyKeys: client?.pty ? Object.keys(client.pty) : [],
      directory,
      status,
      ptyId,
    });

    const ensurePty = async () => {
      if (attempt !== retryCount.current) return;
      if (status === "ready" && ptyId) return;

      setStatus("loading");
      setError(null);
      setTicket(null);

      try {
        let listError: Error | null = null;
        let existing: PtyInfo[] = [];

        if (client.pty?.list) {
          try {
            const raw = await client.pty.list(directory);
            if (cancelled || attempt !== retryCount.current) return;

            existing = extractPtyArray(raw);
            console.log("[usePtySession] list response", {
              rawType: raw?.constructor?.name ?? typeof raw,
              rawKeys: raw && typeof raw === "object" ? Object.keys(raw) : [],
              count: existing.length,
            });
          } catch (caughtList) {
            listError =
              caughtList instanceof Error
                ? caughtList
                : new Error(String(caughtList));
            console.error("[usePtySession] list failed", listError);
          }
        }

        const running = existing.find(
          (p: PtyInfo) =>
            p && typeof p.status === "string" && p.status === "running",
        );
        if (running) {
          // Fetch ticket for existing PTY
          let ticket: string | null = null;
          if (client.pty?.connectToken) {
            try {
              const tokenResp = await client.pty.connectToken(running.id);
              console.log(
                "[usePtySession] connectToken raw response for existing",
                tokenResp,
              );
              ticket =
                (tokenResp as { data?: { ticket?: string } }).data?.ticket ??
                null;
              console.log("[usePtySession] got connect token for existing", {
                ptyId: running.id,
                hasTicket: !!ticket,
              });
            } catch (e) {
              console.error(
                "[usePtySession] connectToken failed for existing",
                e,
              );
            }
          }
          setPtyId(running.id);
          setTicket(ticket);
          setStatus("ready");
          return;
        }

        const body: Record<string, unknown> = {
          cwd: directory,
          title: "Terminal",
        };
        if (shell !== "auto") body.command = shell;

        if (!client.pty?.create) {
          console.error("[usePtySession] client.pty.create missing", client);
          throw new Error("PTY create API not available on client");
        }

        let created: PtyInfo | null = null;
        try {
          created = (await client.pty.create(body, directory)) as PtyInfo;
        } catch (caughtCreate) {
          const createError =
            caughtCreate instanceof Error
              ? caughtCreate
              : new Error(String(caughtCreate));
          console.error("[usePtySession] create failed", createError);
          const hint = listError
            ? `PTY list failed: ${listError.message}. Create also failed: ${createError.message}`
            : `PTY create failed: ${createError.message}`;
          throw new Error(hint);
        }
        if (cancelled || attempt !== retryCount.current) return;

        const createdId = extractPtyId(created);
        console.log("[usePtySession] create response", {
          createdType: created?.constructor?.name ?? typeof created,
          createdKeys:
            created && typeof created === "object" ? Object.keys(created) : [],
          hasId: !!createdId,
        });

        if (!createdId) throw new Error("Server did not return a PTY id.");

        // Fetch connection ticket for WebSocket auth
        let ticket: string | null = null;
        if (client.pty?.connectToken) {
          try {
            const tokenResp = await client.pty.connectToken(createdId);
            console.log("[usePtySession] connectToken raw response", tokenResp);
            ticket =
              (tokenResp as { data?: { ticket?: string } }).data?.ticket ??
              null;
            console.log("[usePtySession] got connect token", {
              ptyId: createdId,
              hasTicket: !!ticket,
            });
          } catch (e) {
            console.error("[usePtySession] connectToken failed", e);
          }
        }

        setPtyId(createdId);
        setTicket(ticket);
        setStatus("ready");
      } catch (caught) {
        if (cancelled || attempt !== retryCount.current) return;
        const message =
          caught instanceof Error
            ? caught.message
            : "Failed to start terminal.";
        console.error("[usePtySession] error", message, caught);
        setPtyId(null);
        setTicket(null);
        setStatus("error");
        setError(message);
      }
    };

    void ensurePty();

    return () => {
      cancelled = true;
    };
  }, [client, directory, shell, ptyId, status]);

  return {
    ptyId,
    status,
    error,
    ticket,
    retry,
    reset: () => {
      setPtyId(null);
      setTicket(null);
      setStatus("idle");
      setError(null);
      retryCount.current += 1;
    },
  };
}
