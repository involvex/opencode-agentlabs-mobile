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

export function usePtySession(
  client: Client | null,
  directory: string | undefined,
  shell = "auto",
) {
  const [ptyId, setPtyId] = useState<string | null>(null);
  const [status, setStatus] = useState<PtySessionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const retryCount = useRef(0);

  const retry = useCallback(() => {
    retryCount.current += 1;
    setPtyId(null);
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
          setPtyId(running.id);
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

        console.log("[usePtySession] create response", {
          createdType: created?.constructor?.name ?? typeof created,
          hasId: typeof created?.id === "string",
        });

        const createdId =
          created && typeof created.id === "string" ? created.id : null;
        if (!createdId) throw new Error("Server did not return a PTY id.");
        setPtyId(createdId);
        setStatus("ready");
      } catch (caught) {
        if (cancelled || attempt !== retryCount.current) return;
        const message =
          caught instanceof Error
            ? caught.message
            : "Failed to start terminal.";
        console.error("[usePtySession] error", message, caught);
        setPtyId(null);
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
    retry,
    reset: () => {
      setPtyId(null);
      setStatus("idle");
      setError(null);
      retryCount.current += 1;
    },
  };
}
