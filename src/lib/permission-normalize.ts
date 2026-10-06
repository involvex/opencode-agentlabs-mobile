export interface NormalizedPermission {
  id: string;
  sessionID: string;
  permission: string;
  patterns: string[];
  metadata: Record<string, unknown>;
  tool?: { messageID: string; callID: string };
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value))
    return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string") return [value];
  return [];
}

export function normalizePermission(
  raw: Record<string, unknown>,
): NormalizedPermission {
  const r = raw ?? {};
  const source = r.source as
    { type?: string; messageID?: string; id?: string } | undefined;
  const permission =
    (r.permission as string | undefined) ??
    (r.action as string | undefined) ??
    "";
  const patterns = toStringArray(
    (r.patterns as unknown) ?? (r.resources as unknown),
  );
  return {
    id: (r.id as string | undefined) ?? "",
    sessionID: (r.sessionID as string | undefined) ?? "",
    permission,
    patterns,
    metadata: (r.metadata as Record<string, unknown> | undefined) ?? {},
    ...(source?.type === "tool" && source.messageID && source.id
      ? { tool: { messageID: source.messageID, callID: source.id } }
      : {}),
  };
}
