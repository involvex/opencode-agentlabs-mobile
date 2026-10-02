// Pure V2 payload adapters: translate OpenCode V2 wire shapes
// (https://opencode.ai/v2/openapi.json) back into the legacy types the app
// works with. Dependency-free (no expo/fetch) so the mapping rules are
// unit-testable under plain `node --test` — same pattern as api-error.ts /
// file-roots.ts. Imported by sdk.ts at the transport boundary.
import type {
  Session,
  Message,
  MessageWithParts,
  Part,
  FileEntry,
} from "./sdk";

// V2 response envelopes: {data} or {location, data}. Returns the inner data
// (or null when the envelope holds an explicit null, e.g. default model).
export function unwrapData<T>(body: unknown): T {
  if (body !== null && typeof body === "object" && "data" in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}

// Legacy session shape the app works with. V2 Session.Info has no
// slug/version/share/summary/top-level directory — the gaps are filled here
// (slug/version fall back to "", directory comes from location).
export function adaptSession(
  sessionID: string,
  raw: Record<string, unknown>,
): Session {
  const sid = (raw.id as string) ?? sessionID;
  const time = (raw.time as Session["time"]) ?? { created: 0, updated: 0 };
  const location = (raw.location as { directory?: string } | undefined) ?? {};
  const revert = raw.revert as
    { messageID?: string; partID?: string } | undefined;
  const share = raw.share as { url: string } | undefined;
  const summary = raw.summary as Session["summary"];
  return {
    id: sid,
    slug: (raw.slug as string) ?? sid,
    projectID: (raw.projectID as string) ?? "",
    directory: location.directory ?? (raw.directory as string) ?? "",
    parentID: raw.parentID as string | undefined,
    title: (raw.title as string) ?? "",
    version: (raw.version as string) ?? "",
    ...(share ? { share } : {}),
    time: {
      created: time.created ?? 0,
      updated: time.updated ?? 0,
      ...(time.compacting != null ? { compacting: time.compacting } : {}),
      ...(time.archived != null ? { archived: time.archived } : {}),
    },
    ...(summary ? { summary } : {}),
    ...(revert?.messageID
      ? {
          revert: {
            messageID: revert.messageID,
            ...(revert.partID ? { partID: revert.partID } : {}),
          },
        }
      : {}),
  };
}

export function adaptToolState(
  state: Record<string, unknown> | undefined,
  executed: boolean | undefined,
): Part["state"] {
  if (!state || typeof state !== "object") {
    return { status: executed ? "completed" : "running" };
  }
  const rawStatus = state.status;
  const status =
    rawStatus === "pending" ||
    rawStatus === "running" ||
    rawStatus === "completed" ||
    rawStatus === "error"
      ? rawStatus
      : executed
        ? "completed"
        : "running";
  return {
    status,
    ...(state.input !== undefined ? { input: state.input } : {}),
    ...(state.output !== undefined ? { output: state.output } : {}),
    ...(state.title !== undefined ? { title: state.title as string } : {}),
    ...(state.error !== undefined
      ? { error: state.error as { message: string } }
      : {}),
  };
}

// Convert one V2 Session.Message union member into the legacy {info, parts}
// shape. Returns null for projection markers with no user-visible content
// (idle markers, agent/model/location switch markers) — the app only renders
// user/assistant content.
export function adaptMessage(
  sessionID: string,
  raw: Record<string, unknown>,
): MessageWithParts | null {
  const type = raw.type as string;
  const id = raw.id as string;
  const created = (raw.time as { created?: number } | undefined)?.created ?? 0;

  if (type === "user") {
    const files = Array.isArray(raw.files)
      ? (raw.files as Record<string, unknown>[])
      : [];
    const agents = Array.isArray(raw.agents)
      ? (raw.agents as Record<string, unknown>[])
      : [];
    const parts: Part[] = [];
    if (typeof raw.text === "string" && raw.text) {
      parts.push({
        id: `${id}-text`,
        messageID: id,
        type: "text",
        text: raw.text as string,
      });
    }
    files.forEach((f, i) => {
      parts.push({
        id: `${id}-file-${i}`,
        messageID: id,
        type: "file",
        url: f.uri as string | undefined,
        filename: f.name as string | undefined,
      });
    });
    return {
      info: {
        id,
        sessionID,
        role: "user",
        time: { created },
        ...(typeof agents[0]?.name === "string"
          ? { agent: agents[0].name as string }
          : {}),
      },
      parts,
    };
  }

  if (type === "assistant") {
    const model =
      (raw.model as { id?: string; providerID?: string } | undefined) ?? {};
    const time =
      (raw.time as { created?: number; completed?: number } | undefined) ?? {};
    const tokens = raw.tokens as Message["tokens"];
    const error = raw.error as { message?: string } | undefined;
    const content = Array.isArray(raw.content)
      ? (raw.content as Record<string, unknown>[])
      : [];
    const parts: Part[] = content.map((c, i) => {
      const cid = `${id}-c${i}`;
      if (c.type === "reasoning") {
        const ctime = c.time as
          { created?: number; completed?: number } | undefined;
        return {
          id: cid,
          messageID: id,
          type: "reasoning",
          text: c.text as string | undefined,
          ...(ctime
            ? { time: { start: ctime.created, end: ctime.completed } }
            : {}),
        } satisfies Part;
      }
      if (c.type === "tool") {
        const ctime = c.time as
          { created?: number; completed?: number } | undefined;
        return {
          id: cid,
          messageID: id,
          type: "tool",
          tool: c.name as string | undefined,
          callID: c.id as string | undefined,
          state: adaptToolState(
            c.state as Record<string, unknown> | undefined,
            c.executed as boolean | undefined,
          ),
          ...(ctime
            ? { time: { start: ctime.created, end: ctime.completed } }
            : {}),
        } satisfies Part;
      }
      return {
        id: cid,
        messageID: id,
        type: "text",
        text: (c.text as string | undefined) ?? "",
      } satisfies Part;
    });
    return {
      info: {
        id,
        sessionID,
        role: "assistant",
        time: { created: time.created ?? created, completed: time.completed },
        ...(typeof raw.agent === "string"
          ? { agent: raw.agent as string }
          : {}),
        ...(model.providerID && model.id
          ? {
              model: { providerID: model.providerID, modelID: model.id },
              modelID: model.id,
              providerID: model.providerID,
            }
          : {}),
        ...(typeof raw.cost === "number" ? { cost: raw.cost } : {}),
        ...(tokens ? { tokens } : {}),
        ...(error?.message ? { error: { message: error.message } } : {}),
        ...(typeof raw.finish === "string" ? { finish: raw.finish } : {}),
      },
      parts,
    };
  }

  // Marker messages (idle, agent-switched, model-switched, location-switched)
  // carry no renderable content.
  if (
    type === "idle" ||
    type === "agent-switched" ||
    type === "model-switched" ||
    type === "location-switched"
  ) {
    return null;
  }

  // system / synthetic / skill / shell / compaction: surface as an assistant
  // message with a single text part so the transcript stays complete.
  const text =
    (typeof raw.text === "string" && raw.text) ||
    (typeof raw.description === "string" && raw.description) ||
    (type === "shell" && typeof raw.command === "string"
      ? `$ ${raw.command as string}`
      : "");
  if (!text) return null;
  const completed = (raw.time as { completed?: number } | undefined)?.completed;
  return {
    info: {
      id,
      sessionID,
      role: "assistant",
      time: { created, completed },
    },
    parts: [{ id: `${id}-text`, messageID: id, type: "text", text }],
  };
}

export function baseName(path: string): string {
  const stripped = path.replace(/[/\\]+$/, "");
  const i = Math.max(stripped.lastIndexOf("/"), stripped.lastIndexOf("\\"));
  return i >= 0 ? stripped.slice(i + 1) : stripped;
}

export function joinAbsolute(directory: string, path: string): string {
  if (/^[A-Za-z]:[/\\]/.test(path) || path.startsWith("/")) return path;
  const dir = directory.replace(/[/\\]+$/, "");
  const sep = dir.includes("\\") ? "\\" : "/";
  return `${dir}${sep}${path}`;
}

// V2 FileSystem.Entry ({path, type}) has no name/absolute/ignored —
// name is the basename, absolute resolves against the response's location.
export function adaptFileEntry(
  directory: string,
  raw: Record<string, unknown>,
): FileEntry {
  const path = (raw.path as string) ?? "";
  return {
    name: baseName(path),
    path,
    absolute: joinAbsolute(directory, path),
    type: raw.type === "directory" ? "directory" : "file",
    ignored: false,
  };
}
