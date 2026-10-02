// SDK client wrapper for React Native
// Hand-rolled lightweight client against the native OpenCode V2 HTTP API
// (https://opencode.ai/v2/docs/, OpenAPI at https://opencode.ai/v2/openapi.json).
// expo/fetch provides WinterCG-compliant fetch with ReadableStream support for SSE
//
// V2 notes (verified against the live 2.0.20 server + openapi.json):
// - Every route lives under /api/*. V1 routes (/global/*, /session, /permission,
//   /question, /file, /path, /project/current, ...) are gone.
// - Most JSON responses are wrapped: {data} or {location, data}. Unwrapped
//   bare objects/arrays remain for /api/info and /api/project.
// - The directory scope still travels in the x-opencode-directory header
//   (see ./headers), verified live: the server resolves ?location[directory]
//   from it. POST /api/session additionally takes a `location` body field,
//   which we send because the header alone did not scope session creation.
// - Messages are a discriminated union with inline content (no separate
//   {info, parts} envelope). This module adapts V2 messages back into the
//   legacy MessageWithParts shape so the stores/renderers keep working.
// - The SSE stream emits one V2 envelope per data: frame,
//   {"id","type","data",...}, plus `: heartbeat` comments. V2 emits granular
//   session.* events (session.step.streamed, session.usage.updated, ...) —
//   the V1 message.updated / message.part.updated / session.status events no
//   longer exist. TODO(events.ts): subscribe to the granular V2 events for
//   live updates (refresh on step.streamed/usage.updated, derive busy/idle).
import { fetch as expoFetch } from "expo/fetch";
import { buildRequestHeaders } from "./headers";
import { SSEParser } from "./sse";
import { apiErrorFor } from "./api-error";
import { loadSessionList } from "./session-list";
import {
  unwrapData,
  adaptSession,
  adaptMessage,
  adaptFileEntry,
  baseName,
} from "./v2-adapters";
import type { FileRoot } from "./file-roots";

export interface PtyInfo {
  id: string;
  title: string;
  command: string;
  args: string[];
  cwd: string;
  status: "running" | "exited";
  pid: number;
  exitCode?: number;
}

export { ApiAuthError, isAuthError } from "./api-error";

export interface ClientConfig {
  baseUrl: string;
  directory?: string;
  auth?: {
    username: string;
    password: string;
  };
  // Custom HTTP headers to send with every request (e.g. bearer tokens,
  // API keys for reverse proxies). Merged on top of auto-generated headers.
  extraHeaders?: Record<string, string>;
}

// Legacy session shape the app works with. V2 Session.Info has no
// slug/version/share/summary/top-level directory — adaptSession() fills the
// gaps (slug/version fall back to "", directory comes from location).
export interface Session {
  id: string;
  slug: string;
  projectID: string;
  directory: string;
  parentID?: string;
  title: string;
  version: string;
  share?: { url: string };
  time: {
    created: number;
    updated: number;
    compacting?: number;
    archived?: number;
  };
  summary?: {
    additions: number;
    deletions: number;
    files: number;
  };
  // Present while a message (and everything after it) is pending revert —
  // the server keeps the underlying messages until the next prompt/summarize
  // call runs cleanup (or the revert is undone via session.unrevert).
  revert?: {
    messageID: string;
    partID?: string;
  };
}

export interface Message {
  id: string;
  sessionID: string;
  role: "user" | "assistant";
  parentID?: string;
  time: {
    created: number;
    completed?: number;
  };
  // User message fields
  agent?: string;
  model?: { providerID: string; modelID: string };
  // Assistant message fields
  modelID?: string;
  providerID?: string;
  cost?: number;
  tokens?: {
    input: number;
    output: number;
    reasoning?: number;
    cache?: { read: number; write: number };
  };
  error?: { message: string };
  finish?: string;
}

// API returns messages with parts embedded
export interface MessageWithParts {
  info: Message;
  parts: Part[];
}

export interface Part {
  id: string;
  sessionID?: string;
  messageID: string;
  type:
    | "text"
    | "reasoning"
    | "tool"
    | "file"
    | "snapshot"
    | "patch"
    | "step-start"
    | "step-finish"
    | "subtask"
    | "retry"
    | "compaction"
    | "agent";
  // Text / reasoning part
  text?: string;
  // Tool part
  tool?: string;
  callID?: string;
  // Step-finish part (matches the server's StepFinishPart schema — step
  // parts carry no `text`; the outcome lives in these fields)
  reason?: string;
  cost?: number;
  tokens?: {
    total?: number;
    input: number;
    output: number;
    reasoning?: number;
    cache?: { read: number; write: number };
  };
  // Compaction part (matches the server's CompactionPart schema — also no
  // `text`/`state`; the summary arrives as a separate text part)
  auto?: boolean;
  overflow?: boolean;
  tail_start_id?: string;
  state?: {
    status: "pending" | "running" | "completed" | "error";
    input?: unknown;
    output?: unknown;
    title?: string;
    error?: { message: string };
    time?: { start?: number; end?: number };
  };
  // Timing
  time?: { start?: number; end?: number };
  // File part
  mime?: string;
  url?: string;
  filename?: string;
}

export interface Agent {
  name: string;
  description?: string;
  mode: "subagent" | "primary" | "all";
  native?: boolean;
  hidden?: boolean;
  topP?: number;
  temperature?: number;
  color?: string;
  model?: { modelID: string; providerID: string };
  prompt?: string;
  options: Record<string, unknown>;
  steps?: number;
}

export interface Command {
  name: string;
  description?: string;
  agent?: string;
  model?: string;
  mcp?: boolean;
  template: string;
  subtask?: boolean;
  hints: string[];
}

export interface Project {
  id: string;
  name?: string;
  path: {
    cwd: string;
    root: string;
    absolute: string;
  };
}

export interface FileEntry {
  name: string;
  path: string;
  absolute: string;
  type: "file" | "directory";
  ignored: boolean;
}

export interface FileStatusEntry {
  path: string;
  status?: string;
}

// Pending permission request in the shape the app's events store and
// PermissionPrompt consume. V2 Permission.Request carries {action, resources,
// source} instead of {tool/permission, input/patterns} — adapted in
// permission.list().
export interface PermissionItem {
  id: string;
  sessionID: string;
  permission: string;
  patterns: string[];
  metadata: Record<string, unknown>;
  tool?: { messageID: string; callID: string };
}

// Pending question in the shape the app consumes. V2 replaced questions with
// forms (GET /api/form); question.list() adapts Form.Info best-effort.
// formKeys parallels questions[] and holds the V2 field keys needed to build
// the {answer} map on reply.
export interface QuestionItem {
  id: string;
  sessionID: string;
  questions: {
    question: string;
    header: string;
    options: { label: string; description: string }[];
    multiple?: boolean;
    custom?: boolean;
  }[];
  formKeys?: string[];
}

export interface Event {
  type: string;
  properties: Record<string, unknown>;
}

export interface HealthResponse {
  healthy: boolean;
  version: string;
}

const REQUEST_TIMEOUT_MS = 30_000;

// Thrown by request() on a non-2xx response. Carries the HTTP status so
// callers can distinguish e.g. 404 (older server, endpoint missing) from
// other failures without parsing the message string.
export class ApiError extends Error {
  status: number;
  constructor(status: number, body: string) {
    super(`API Error: ${status} - ${body}`);
    this.name = "ApiError";
    this.status = status;
  }
}

function createHeaders(config: ClientConfig): HeadersInit {
  const base = buildRequestHeaders(config);
  if (config.extraHeaders) {
    return { ...base, ...config.extraHeaders };
  }
  return base;
}

// `timeoutMs` lets specific callers (e.g. the onboarding health-check) fail
// faster than the general REQUEST_TIMEOUT_MS used by real session calls.
// Leave it unset to get the default.
async function request<T>(
  config: ClientConfig,
  path: string,
  options: RequestInit = {},
  timeoutMs?: number,
): Promise<T> {
  const url = `${config.baseUrl}${path}`;
  const headers = { ...createHeaders(config), ...options.headers };
  const response = await fetchWithTimeout(
    url,
    {
      ...options,
      headers,
    },
    timeoutMs,
  );

  if (!response.ok) {
    const error = await response.text();
    throw apiErrorFor(
      response.status,
      `API Error: ${response.status} - ${error}`,
    );
  }

  // V2 uses 204 No Content for DELETE/PATCH/command/reply endpoints —
  // response.json() throws on an empty body, so return undefined instead.
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const parentSignal = options.signal;
  if (parentSignal?.aborted) throw new Error("Request aborted");

  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onParentAbort = () => controller.abort();
  parentSignal?.addEventListener("abort", onParentAbort);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (timedOut) {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    parentSignal?.removeEventListener("abort", onParentAbort);
  }
}

export function createClient(config: ClientConfig) {
  // Normalize once: a trailing slash on baseUrl (e.g. pasted into Advanced
  // mode or the Edit screen) would otherwise survive into every
  // `${config.baseUrl}${path}` concatenation below as a double slash, which
  // every request then fails against (while the diagnostics probe, which
  // reconstructs a clean URL, reports "works now"). A bare URL with no
  // trailing slash is untouched.
  config = { ...config, baseUrl: config.baseUrl.replace(/\/+$/, "") };
  return {
    global: {
      // V2 server identity. The old /global/health {healthy, version} shape
      // is synthesized — /api/info returns {version, pid, urls, paths}.
      // `timeoutMs` overrides the default REQUEST_TIMEOUT_MS — used by the
      // onboarding connection test to fail fast on a bad/unreachable IP
      // instead of hanging for the full 30s (issue: first-run bounce).
      health: async (timeoutMs?: number): Promise<HealthResponse> => {
        const info = await request<{ version?: string }>(
          config,
          "/api/info",
          {},
          timeoutMs,
        );
        return { healthy: true, version: info?.version ?? "unknown" };
      },
      // SSE event stream - returns async iterator
      // Pass an AbortSignal to cancel the connection
      //
      // V2 framing re-verified live (2.0.20): one JSON envelope per data:
      // frame — {"id","type","data",...} — interleaved with `: heartbeat`
      // comment lines (which SSEParser already ignores). Each envelope is
      // unwrapped to the legacy {type, properties} event: properties is the
      // envelope's `data` when it's an object, else {value}.
      async *events(signal?: AbortSignal): AsyncGenerator<Event> {
        const url = `${config.baseUrl}/api/event`;
        const headers = createHeaders(config);
        // Remove Content-Type for SSE (it's text/event-stream)
        delete (headers as Record<string, string>)["Content-Type"];

        // Must use expo/fetch for ReadableStream support on native
        const response = await expoFetch(url, { headers, signal });
        if (!response.ok || !response.body) {
          throw apiErrorFor(
            response.status,
            `Failed to connect to event stream: ${response.status}`,
          );
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const parser = new SSEParser();

        let receivedFirstByte = false;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              console.log("[SSE] stream ended");
              break;
            }

            if (!receivedFirstByte) {
              receivedFirstByte = true;
              console.log(
                `[SSE] first byte received (${value?.byteLength ?? 0} bytes)`,
              );
            }

            for (const data of parser.push(
              decoder.decode(value, { stream: true }),
            )) {
              let envelope: Record<string, unknown>;
              try {
                envelope = JSON.parse(data);
              } catch (err) {
                console.warn("[SSE] Failed to parse event", {
                  length: data.length,
                  error: err instanceof Error ? err.message : String(err),
                });
                continue;
              }
              const type =
                (envelope.type as string) ??
                (envelope.event as string) ??
                "unknown";
              const rawData = envelope.data;
              const properties =
                rawData !== null && typeof rawData === "object"
                  ? (rawData as Record<string, unknown>)
                  : { value: rawData };
              yield { type, properties };
            }
          }
        } finally {
          reader.releaseLock();
        }
      },
    },

    project: {
      // V2 GET /api/project returns a BARE array (no {data} envelope) of
      // {id, canonical, vcs, name?, ...} — mapped to the legacy Project shape.
      list: async (): Promise<Project[]> => {
        const raw = await request<Record<string, unknown>[]>(
          config,
          "/api/project",
        );
        return (Array.isArray(raw) ? raw : []).map((p) => {
          const canonical = (p.canonical as string) ?? "";
          return {
            id: (p.id as string) ?? "",
            name: (p.name as string) || baseName(canonical) || undefined,
            path: { cwd: canonical, root: canonical, absolute: canonical },
          };
        });
      },
      // V2 has no /project/current. GET /api/location resolves the CURRENT
      // location including its project ({directory, project:{id, directory,
      // canonical}}). Falls back to matching /api/project by this client's
      // directory; throws 404 when nothing matches (callers .catch() to null,
      // preserving the old 404-tolerant pattern).
      current: async (): Promise<Project> => {
        const location = await request<{
          directory?: string;
          project?: { id?: string; directory?: string; canonical?: string };
        }>(config, "/api/location");
        if (location?.project) {
          const canonical =
            location.project.canonical ?? location.project.directory ?? "";
          const cwd = location.directory ?? canonical;
          return {
            id: location.project.id ?? "",
            name: baseName(canonical) || undefined,
            path: { cwd, root: canonical, absolute: cwd },
          };
        }
        if (config.directory) {
          const projects = await request<Record<string, unknown>[]>(
            config,
            "/api/project",
          );
          const match = (Array.isArray(projects) ? projects : []).find(
            (p) =>
              p.canonical === config.directory ||
              (p as { directory?: string }).directory === config.directory,
          );
          if (match) {
            const canonical = (match.canonical as string) ?? "";
            return {
              id: (match.id as string) ?? "",
              name: (match.name as string) || baseName(canonical) || undefined,
              path: { cwd: canonical, root: canonical, absolute: canonical },
            };
          }
        }
        throw new ApiError(404, "No current project for this location");
      },
    },

    // Server-side filesystem browsing, scoped to this client's directory
    // (see ClientConfig.directory / x-opencode-directory header). Use
    // clientForDirectory(dir) to get a client rooted at a specific folder,
    // then list("." ) to enumerate its immediate children.
    file: {
      // V2 GET /api/fs/list?path= returns {location, data: [{path, type}]}.
      // Entries carry no name/absolute/ignored — derived client-side from
      // the response's location.directory.
      list: async (params: { path?: string } = {}): Promise<FileEntry[]> => {
        const query = new URLSearchParams({ path: params.path ?? "." });
        const body = await request<{
          location?: { directory?: string };
          data?: Record<string, unknown>[];
        }>(config, `/api/fs/list?${query.toString()}`);
        const directory = body?.location?.directory ?? config.directory ?? "";
        const entries = Array.isArray(body?.data) ? body.data : [];
        return entries.map((e) => adaptFileEntry(directory, e));
      },
      // V2 has no filesystem-roots endpoint. Resolves to null so callers
      // fall back to manual path entry instead of crashing (same contract
      // as the old 404 path on older V1 servers).
      // TODO: re-check future V2 openapi versions for a roots equivalent.
      roots: async (): Promise<FileRoot[] | null> => null,
      // V2 moved git status to GET /api/vcs/status
      // ({location, data: [{file, additions, deletions, status}]}).
      // Returns [] on failure, mirroring the old 404-tolerant behavior.
      status: async (): Promise<FileStatusEntry[]> => {
        try {
          const body = await request<{
            data?: Record<string, unknown>[];
          }>(config, "/api/vcs/status");
          const data = Array.isArray(body?.data) ? body.data : [];
          return data.map((e) => ({
            path: (e.file as string) ?? "",
            status: e.status as string | undefined,
          }));
        } catch (err) {
          if (err instanceof ApiError && err.status === 404) return [];
          throw err;
        }
      },
      // V2 serves raw file bytes at GET /api/fs/read/* (absolute or
      // location-relative path, backslashes normalized). There is no
      // per-file content+diff endpoint — diffs live at /api/vcs/diff (whole
      // location) and GET /api/session/{id}/diff (per turn) — so diff stays
      // undefined; callers already handle that ("No diff available").
      // Returns null on 404, preserving the old 404-tolerant pattern.
      // TODO: attach the matching hunk from /api/vcs/diff when the
      // workspace panel needs per-file diffs without a session.
      read: async (params: {
        path: string;
      }): Promise<{ content?: string; diff?: string } | null> => {
        const normalized = params.path.replace(/\\/g, "/").replace(/^\/+/, "");
        try {
          const url = `${config.baseUrl}/api/fs/read/${normalized
            .split("/")
            .map(encodeURIComponent)
            .join("/")}`;
          const response = await fetchWithTimeout(url, {
            headers: createHeaders(config),
          });
          if (!response.ok) {
            const body = await response.text();
            throw apiErrorFor(
              response.status,
              `API Error: ${response.status} - ${body}`,
            );
          }
          return { content: await response.text() };
        } catch (err) {
          if (err instanceof ApiError && err.status === 404) return null;
          throw err;
        }
      },
    },

    path: {
      // V2 has no /path endpoint. GET /api/location resolves the requested
      // (header-scoped) location but exposes no home/state/config paths, so
      // those stay "" — callers treat a falsy home as "unknown" (placeholder
      // fallback). TODO: re-check future V2 openapi versions.
      get: async () => {
        const location = await request<{ directory?: string }>(
          config,
          "/api/location",
        );
        const directory = location?.directory ?? config.directory ?? "";
        return {
          home: "",
          state: "",
          config: "",
          worktree: directory,
          directory,
        };
      },
    },

    session: {
      // V2 GET /api/session is global (all directories) and paginated
      // ({data, cursor}); roots:true maps to ?parentID=null ("only root
      // sessions"). Search/sort/limit shaping stays client-side in
      // loadSessionList so the visible page matches the list UI's intent.
      list: (params?: {
        roots?: boolean;
        limit?: number;
        search?: string;
      }): Promise<Session[]> =>
        loadSessionList(
          {
            getPage: async (cursor?: string) => {
              const query = new URLSearchParams();
              // Large pages keep the pool complete for client-side shaping.
              query.set("limit", "200");
              query.set("order", "desc");
              if (params?.roots) query.set("parentID", "null");
              if (cursor) query.set("cursor", cursor);
              const body = await request<{
                data?: Record<string, unknown>[];
                cursor?: { next?: string | null };
              }>(config, `/api/session?${query.toString()}`);
              const data = Array.isArray(body?.data) ? body.data : [];
              return {
                sessions: data.map((s) => adaptSession("", s)),
                next: body?.cursor?.next ?? null,
              };
            },
          },
          params,
        ),

      get: async (sessionID: string): Promise<Session> => {
        const body = await request<{ data?: Record<string, unknown> }>(
          config,
          `/api/session/${sessionID}`,
        );
        return adaptSession(sessionID, unwrapData(body) ?? {});
      },

      // V2 create takes {title, agent?, model?, location?} and returns
      // {data}. The header alone did not scope creation live, so the
      // client's directory is also sent as location.directory.
      create: async (params?: { title?: string }): Promise<Session> => {
        const body = await request<{ data?: Record<string, unknown> }>(
          config,
          "/api/session",
          {
            method: "POST",
            body: JSON.stringify({
              ...(params?.title ? { title: params.title } : {}),
              ...(config.directory
                ? { location: { directory: config.directory } }
                : {}),
            }),
          },
        );
        return adaptSession("", unwrapData(body) ?? {});
      },

      delete: (sessionID: string) =>
        request<void>(config, `/api/session/${sessionID}`, {
          method: "DELETE",
        }),

      // V2 PATCH returns 204 (no body) and only accepts
      // {title, metadata, permissions} — server-side archiving via
      // time.archived is not supported (archiving stays client-side-only in
      // the app). Re-reads the session so callers keep getting a Session.
      update: async (
        sessionID: string,
        params: { title?: string; time?: { archived?: number } },
      ): Promise<Session> => {
        await request<void>(config, `/api/session/${sessionID}`, {
          method: "PATCH",
          body: JSON.stringify(
            params.title !== undefined ? { title: params.title } : {},
          ),
        });
        const body = await request<{ data?: Record<string, unknown> }>(
          config,
          `/api/session/${sessionID}`,
        );
        return adaptSession(sessionID, unwrapData(body) ?? {});
      },

      // V2 GET /api/session/{id}/message returns {data: Session.Message[],
      // cursor} where each message is a discriminated union with INLINE
      // content (no {info, parts} envelope). Adapted back to MessageWithParts
      // (markers without renderable content are skipped). order=asc keeps the
      // chronological order the transcript UI expects. Without a limit the
      // full history is fetched across pages (capped) for loadOlderMessages.
      messages: async (
        sessionID: string,
        params?: { limit?: number },
      ): Promise<MessageWithParts[]> => {
        const out: MessageWithParts[] = [];
        let cursor: string | undefined;
        const pageLimit = params?.limit ?? 200;
        for (let page = 0; page < 25; page++) {
          const query = new URLSearchParams();
          query.set("limit", String(pageLimit));
          query.set("order", "asc");
          if (cursor) query.set("cursor", cursor);
          const body = await request<{
            data?: Record<string, unknown>[];
            cursor?: { next?: string | null };
          }>(config, `/api/session/${sessionID}/message?${query.toString()}`);
          const data = Array.isArray(body?.data) ? body.data : [];
          for (const m of data) {
            const adapted = adaptMessage(sessionID, m);
            if (adapted) {
              adapted.info.sessionID = sessionID;
              adapted.parts.forEach((p) => {
                p.sessionID = sessionID;
              });
              out.push(adapted);
            }
          }
          // A bounded request is satisfied by its first page; an unbounded
          // one follows cursors until exhausted.
          if (params?.limit != null) break;
          cursor = body?.cursor?.next ?? undefined;
          if (!cursor) break;
        }
        return out;
      },

      // V2 POST /api/session/{id}/prompt takes {text, files, ...} (no parts
      // array, no per-prompt model/agent). Text parts are joined; file parts
      // map to {uri, name}. A requested model/agent/variant is applied first
      // via the switch endpoints (V2 session-scoped state, replaces the V1
      // per-prompt fields).
      prompt: async (
        sessionID: string,
        params: {
          parts: (
            | { type: "text"; text: string }
            | { type: "file"; mime: string; url: string; filename?: string }
          )[];
          model?: { providerID: string; modelID: string };
          agent?: string;
          variant?: string;
        },
      ): Promise<void> => {
        if (params.agent) {
          await request<void>(config, `/api/session/${sessionID}/agent`, {
            method: "POST",
            body: JSON.stringify({ agent: params.agent }),
          });
        }
        if (params.model) {
          await request<void>(config, `/api/session/${sessionID}/model`, {
            method: "POST",
            body: JSON.stringify({
              model: {
                id: params.model.modelID,
                providerID: params.model.providerID,
                ...(params.variant ? { variant: params.variant } : {}),
              },
            }),
          });
        }
        const text = params.parts
          .filter((p): p is { type: "text"; text: string } => p.type === "text")
          .map((p) => p.text)
          .join("\n");
        const files = params.parts
          .filter(
            (
              p,
            ): p is {
              type: "file";
              mime: string;
              url: string;
              filename?: string;
            } => p.type === "file",
          )
          .map((p) => ({
            uri: p.url,
            ...(p.filename ? { name: p.filename } : {}),
          }));
        await request<unknown>(config, `/api/session/${sessionID}/prompt`, {
          method: "POST",
          body: JSON.stringify({ text, files }),
        });
      },

      // V2 POST /api/session/{id}/command takes {name, text, files} and
      // returns 204. The V1 {command, arguments, agent, model, variant,
      // parts, sessionID} shape is mapped; agent/model are switched first
      // when provided.
      command: async (
        sessionID: string,
        params: {
          command: string;
          arguments: string;
          agent?: string;
          model?: string;
          variant?: string;
          parts?: {
            type: "file";
            mime: string;
            url: string;
            filename?: string;
          }[];
        },
      ): Promise<void> => {
        if (params.agent) {
          await request<void>(config, `/api/session/${sessionID}/agent`, {
            method: "POST",
            body: JSON.stringify({ agent: params.agent }),
          });
        }
        const files = (params.parts ?? []).map((p) => ({
          uri: p.url,
          ...(p.filename ? { name: p.filename } : {}),
        }));
        await request<void>(config, `/api/session/${sessionID}/command`, {
          method: "POST",
          body: JSON.stringify({
            name: params.command,
            text: params.arguments,
            files,
          }),
        });
      },

      // V2 POST /api/session/{id}/interrupt returns {interrupted} (false for
      // the idle no-op) instead of the V1 bare boolean.
      abort: async (sessionID: string): Promise<boolean> => {
        const body = await request<{ interrupted?: boolean }>(
          config,
          `/api/session/${sessionID}/interrupt`,
          { method: "POST" },
        );
        return body?.interrupted ?? true;
      },

      // V2 GET /api/session/{id}/diff?from=&to= returns {data: FileDiff[]}
      // ({file, patch, additions, deletions, status}). The workspace panel
      // already reads row.file || row.path and row.patch || row.diff.
      diff: async (sessionID: string, messageID?: string) => {
        const query = new URLSearchParams();
        if (messageID) query.set("from", messageID);
        const qs = query.toString();
        const body = await request<{ data?: unknown[] }>(
          config,
          `/api/session/${sessionID}/diff${qs ? `?${qs}` : ""}`,
        );
        return unwrapData<unknown[]>(body) ?? [];
      },

      // V2 revert is a stage/commit flow: POST .../revert/stage {messageID}
      // stages the boundary (partID has no equivalent — V2 reverts whole
      // messages), POST .../revert/commit finalizes, DELETE .../revert
      // clears. Mirroring the V1 pending-revert UX (stage now, undo via
      // unrevert), revert() stages and re-reads; unrevert() clears and
      // re-reads.
      revert: async (
        sessionID: string,
        messageID: string,
      ): Promise<Session> => {
        await request<unknown>(
          config,
          `/api/session/${sessionID}/revert/stage`,
          {
            method: "POST",
            body: JSON.stringify({ messageID }),
          },
        );
        const body = await request<{ data?: Record<string, unknown> }>(
          config,
          `/api/session/${sessionID}`,
        );
        return adaptSession(sessionID, unwrapData(body) ?? {});
      },

      unrevert: async (sessionID: string): Promise<Session> => {
        await request<void>(config, `/api/session/${sessionID}/revert`, {
          method: "DELETE",
        });
        const body = await request<{ data?: Record<string, unknown> }>(
          config,
          `/api/session/${sessionID}`,
        );
        return adaptSession(sessionID, unwrapData(body) ?? {});
      },
    },

    permission: {
      // V2 GET /api/permission/request returns {location, data:
      // Permission.Request[]} (each carries sessionID, so per-session
      // filtering in refreshPending keeps working). Adapted to the legacy
      // store shape PermissionPrompt consumes.
      list: async (): Promise<PermissionItem[]> => {
        const body = await request<{
          data?: Record<string, unknown>[];
        }>(config, "/api/permission/request");
        const data = Array.isArray(body?.data) ? body.data : [];
        return data.map((r) => {
          const source = r.source as
            { type?: string; messageID?: string; id?: string } | undefined;
          return {
            id: (r.id as string) ?? "",
            sessionID: (r.sessionID as string) ?? "",
            permission: (r.action as string) ?? "",
            patterns: Array.isArray(r.resources)
              ? (r.resources as string[])
              : [],
            metadata: (r.metadata as Record<string, unknown>) ?? {},
            ...(source?.type === "tool" && source.messageID && source.id
              ? {
                  tool: { messageID: source.messageID, callID: source.id },
                }
              : {}),
          };
        });
      },

      // V2 replies are session-scoped: POST
      // /api/session/{id}/permission/{requestID}/reply {decision, message?}
      // (204). The sessionID is required — callers pass the owning session.
      reply: (
        sessionID: string,
        requestID: string,
        reply: "once" | "always" | "reject",
      ): Promise<void> =>
        request<void>(
          config,
          `/api/session/${sessionID}/permission/${requestID}/reply`,
          {
            method: "POST",
            body: JSON.stringify({ decision: reply }),
          },
        ),
    },

    question: {
      // V2 replaced questions with FORMS. GET /api/form lists global pending
      // forms ({location, data: Form.Info[]}); each form's fields map onto
      // the legacy questions[] so QuestionPrompt keeps rendering (options
      // from field options, free-text fallback via the custom-answer input).
      list: async (): Promise<QuestionItem[]> => {
        const body = await request<{
          data?: Record<string, unknown>[];
        }>(config, "/api/form");
        const data = Array.isArray(body?.data) ? body.data : [];
        return data.map((f) => {
          const fields = Array.isArray(f.fields)
            ? (f.fields as Record<string, unknown>[])
            : [];
          const title =
            (f.title as string) ?? (f.id as string) ?? "Input needed";
          return {
            id: (f.id as string) ?? "",
            sessionID: (f.sessionID as string) ?? "",
            questions: fields.map((field) => {
              const options = Array.isArray(field.options)
                ? (field.options as Record<string, unknown>[]).map((o) => ({
                    label: (o.label as string) ?? (o.value as string) ?? "",
                    description: (o.description as string) ?? "",
                  }))
                : [];
              return {
                question:
                  (field.description as string) ||
                  (field.title as string) ||
                  title,
                header: (field.title as string) || title,
                options,
                multiple: field.type === "multiselect",
                custom: (field.custom as boolean | undefined) ?? true,
              };
            }),
            formKeys: fields.map((field) => (field.key as string) ?? ""),
          };
        });
      },

      // V2 POST /api/session/{id}/form/{formID}/reply {answer: Form.Answer}
      // where Form.Answer maps field key -> value. Legacy answers string[][]
      // map by field index (single answer -> string, multiple -> string[],
      // boolean fields coerce "true"/"false"). Field keys resolve via a
      // fresh GET of the session's forms.
      reply: async (
        sessionID: string,
        requestID: string,
        answers: string[][],
      ): Promise<void> => {
        const body = await request<{ data?: Record<string, unknown>[] }>(
          config,
          `/api/session/${sessionID}/form`,
        );
        const forms = Array.isArray(body?.data) ? body.data : [];
        const form = forms.find((f) => f.id === requestID);
        if (!form) {
          throw new Error(`Form not found: ${requestID}`);
        }
        const fields = Array.isArray(form.fields)
          ? (form.fields as Record<string, unknown>[])
          : [];
        const answer: Record<string, string | number | boolean | string[]> = {};
        fields.forEach((field, i) => {
          const key = field.key as string | undefined;
          if (!key) return;
          const values = answers[i] ?? [];
          if (field.type === "boolean") {
            answer[key] = values[0]?.toLowerCase() === "true";
          } else if (field.type === "multiselect" || values.length > 1) {
            answer[key] = values;
          } else {
            answer[key] = values[0] ?? "";
          }
        });
        await request<void>(
          config,
          `/api/session/${sessionID}/form/${requestID}/reply`,
          {
            method: "POST",
            body: JSON.stringify({ answer }),
          },
        );
      },

      // V2 has no form-reject/cancel endpoint.
      // TODO(forms): check future V2 openapi versions for a dismiss
      // equivalent; until then rejecting surfaces this explicit error (the
      // caller rolls back its optimistic removal).
      reject: async (): Promise<void> => {
        throw new Error(
          "Rejecting a form is not supported by the V2 API (no endpoint)",
        );
      },
    },

    agent: {
      // V2 GET /api/agent returns {location, data: Agent.Info[]}.
      list: async (): Promise<Agent[]> => {
        const body = await request<{
          data?: Record<string, unknown>[];
        }>(config, "/api/agent");
        const data = Array.isArray(body?.data) ? body.data : [];
        return data.map((a) => {
          const model = a.model as
            { id?: string; providerID?: string } | undefined;
          return {
            name: (a.name as string) ?? (a.id as string) ?? "",
            description: a.description as string | undefined,
            mode: (a.mode as Agent["mode"]) ?? "all",
            hidden: (a.hidden as boolean | undefined) ?? false,
            color:
              typeof a.color === "string"
                ? a.color
                : (a.color as { value?: string } | undefined)?.value,
            ...(model?.id && model?.providerID
              ? {
                  model: {
                    modelID: model.id,
                    providerID: model.providerID,
                  },
                }
              : {}),
            options: {},
            ...(typeof a.steps === "number" ? { steps: a.steps } : {}),
          };
        });
      },
    },

    command: {
      // V2 GET /api/command returns {location, data: [{name, description?}]}.
      // template/hints have no V2 equivalent — defaulted (template is
      // required by the legacy type but unused by the app's command chips).
      list: async (): Promise<Command[]> => {
        const body = await request<{
          data?: Record<string, unknown>[];
        }>(config, "/api/command");
        const data = Array.isArray(body?.data) ? body.data : [];
        return data.map((c) => ({
          name: (c.name as string) ?? "",
          description: c.description as string | undefined,
          template: "",
          hints: [],
        }));
      },
    },

    provider: {
      // V2 split the old nested registry: GET /api/provider lists providers
      // ({location, data: Provider.Info[]}, no models), GET /api/model lists
      // models ({location, data: Model.Info[]}), GET /api/model/default is
      // the default model. Composed back into the legacy
      // {all, default, connected} shape the catalog store consumes. Every
      // listed (non-disabled) provider counts as connected; providers left
      // without models are filtered downstream by the catalog.
      list: async (): Promise<{
        all: {
          id: string;
          name: string;
          models: Record<
            string,
            {
              id: string;
              name: string;
              attachment: boolean;
              reasoning: boolean;
              tool_call: boolean;
              cost?: { input: number; output: number };
              limit: { context: number; output: number };
              status?: "alpha" | "beta" | "deprecated" | "active";
              variants?: Record<string, { reasoningEffort?: string }>;
            }
          >;
        }[];
        default: Record<string, string>;
        connected: string[];
      }> => {
        const [providerBody, modelBody, defaultBody] = await Promise.all([
          request<{ data?: Record<string, unknown>[] }>(
            config,
            "/api/provider",
          ),
          request<{ data?: Record<string, unknown>[] }>(config, "/api/model"),
          request<{ data?: Record<string, unknown> | null }>(
            config,
            "/api/model/default",
          ).catch(() => null),
        ]);
        const providers = Array.isArray(providerBody?.data)
          ? providerBody.data
          : [];
        const models = Array.isArray(modelBody?.data) ? modelBody.data : [];
        const defaultModel = defaultBody
          ? unwrapData<Record<string, unknown> | null>(defaultBody)
          : null;

        const byProvider = new Map<string, Record<string, unknown>[]>();
        for (const m of models) {
          const pid = m.providerID as string | undefined;
          if (!pid) continue;
          const list = byProvider.get(pid) ?? [];
          list.push(m);
          byProvider.set(pid, list);
        }

        const all = providers.map((p) => {
          const pid = (p.id as string) ?? "";
          const entries: Record<
            string,
            {
              id: string;
              name: string;
              attachment: boolean;
              reasoning: boolean;
              tool_call: boolean;
              cost?: { input: number; output: number };
              limit: { context: number; output: number };
              status?: "alpha" | "beta" | "deprecated" | "active";
              variants?: Record<string, { reasoningEffort?: string }>;
            }
          > = {};
          for (const m of byProvider.get(pid) ?? []) {
            const mid = (m.modelID as string) ?? (m.id as string) ?? "";
            if (!mid) continue;
            const capabilities =
              (m.capabilities as
                { tools?: boolean; input?: string[] } | undefined) ?? {};
            const input = Array.isArray(capabilities.input)
              ? capabilities.input
              : [];
            const costs = Array.isArray(m.cost)
              ? (m.cost as Record<string, unknown>[])
              : [];
            const firstCost = costs[0] as
              { input?: number; output?: number } | undefined;
            const limit =
              (m.limit as { context?: number; output?: number } | undefined) ??
              {};
            const variants = Array.isArray(m.variants)
              ? (m.variants as Record<string, unknown>[])
              : [];
            const variantRecord: Record<string, { reasoningEffort?: string }> =
              {};
            for (const v of variants) {
              const vid = v.id as string | undefined;
              if (!vid) continue;
              const settings =
                (v.settings as { reasoningEffort?: string } | undefined) ?? {};
              variantRecord[vid] = settings.reasoningEffort
                ? { reasoningEffort: settings.reasoningEffort }
                : {};
            }
            entries[mid] = {
              id: mid,
              name: (m.name as string) || mid,
              attachment:
                input.includes("image") ||
                input.includes("pdf") ||
                input.includes("audio"),
              reasoning: variants.length > 0,
              tool_call: capabilities.tools ?? true,
              ...(firstCost?.input != null && firstCost?.output != null
                ? {
                    cost: {
                      input: firstCost.input,
                      output: firstCost.output,
                    },
                  }
                : {}),
              limit: {
                context: limit.context ?? 0,
                output: limit.output ?? 0,
              },
              ...((m.status as string | undefined)
                ? {
                    status: m.status as
                      "alpha" | "beta" | "deprecated" | "active",
                  }
                : {}),
              ...(variants.length > 0 ? { variants: variantRecord } : {}),
            };
          }
          return {
            id: pid,
            name: (p.name as string) || pid,
            models: entries,
          };
        });

        const connected = providers
          .filter((p) => (p.activation as string | undefined) !== "disabled")
          .map((p) => (p.id as string) ?? "")
          .filter(Boolean);
        const defaults: Record<string, string> = {};
        if (defaultModel && typeof defaultModel === "object") {
          const pid = defaultModel.providerID as string | undefined;
          const mid =
            (defaultModel.modelID as string | undefined) ??
            (defaultModel.id as string | undefined);
          if (pid && mid) defaults[pid] = mid;
        }
        return { all, default: defaults, connected };
      },
    },

    config: {
      // V2 GET /api/config returns configuration documents (array of
      // Config.Entry), not a single object — passed through as unknown.
      get: () => request<unknown>(config, "/api/config"),
    },

    pty: {
      list: (directory?: string) => {
        const qs = directory
          ? `?location[directory]=${encodeURIComponent(directory)}`
          : "";
        return request<PtyInfo[]>(config, `/api/pty${qs}`);
      },
      create: (
        params: {
          command?: string;
          args?: string[];
          cwd?: string;
          title?: string;
        },
        directory?: string,
      ) => {
        const qs = new URLSearchParams();
        if (directory) qs.set("location[directory]", directory);
        const suffix = qs.toString() ? `?${qs.toString()}` : "";
        return request<PtyInfo>(config, `/api/pty${suffix}`, {
          method: "POST",
          body: JSON.stringify(params || {}),
        });
      },
      get: (ptyID: string, directory?: string) => {
        const qs = directory
          ? `?location[directory]=${encodeURIComponent(directory)}`
          : "";
        return request<PtyInfo>(config, `/api/pty/${ptyID}${qs}`);
      },
      update: (
        ptyID: string,
        params: {
          title?: string;
          size?: { cols: number; rows: number };
        },
        directory?: string,
      ) => {
        const qs = directory
          ? `?location[directory]=${encodeURIComponent(directory)}`
          : "";
        return request<PtyInfo>(config, `/api/pty/${ptyID}${qs}`, {
          method: "PATCH",
          body: JSON.stringify(params),
        });
      },
      remove: (ptyID: string, directory?: string) =>
        request<void>(
          config,
          `/api/pty/${ptyID}${directory ? "?location[directory]=" + encodeURIComponent(directory) : ""}`,
          { method: "DELETE" },
        ),
      connectToken: (ptyID: string) =>
        request<{ ticket: string; expires_in: number }>(
          config,
          `/api/pty/${ptyID}/connect-token`,
          { method: "POST", headers: { "x-opencode-ticket": "1" } },
        ),
    },
  };
}

export type Client = ReturnType<typeof createClient>;
