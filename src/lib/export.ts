import { Share } from "react-native";
import type { Message, Part, Session } from "./sdk";

export function exportSessionToMarkdown(
  session: Session | null,
  messages: Message[],
  parts: Record<string, Part[]>,
): string {
  const title = session?.title || "Untitled Session";
  const created = session?.time.created;
  const updated = session?.time.updated;
  const directory = session?.directory;
  const model =
    messages.find((m) => m.role === "assistant")?.modelID || "unknown";

  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push("");
  if (created) {
    lines.push(`Created: ${new Date(created).toISOString()}`);
  }
  if (updated && updated !== created) {
    lines.push(`Updated: ${new Date(updated).toISOString()}`);
  }
  if (directory) {
    lines.push(`Directory: \`${directory}\``);
  }
  lines.push(`Model: ${model}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  for (const msg of messages) {
    const roleLabel = msg.role === "user" ? "User" : "Assistant";
    lines.push(`## ${roleLabel}`);
    lines.push("");

    if (msg.time.created) {
      lines.push(`_${new Date(msg.time.created).toISOString()}_`);
      lines.push("");
    }

    const msgParts = parts[msg.id] || [];
    for (const part of msgParts) {
      if (part.type === "text" && part.text) {
        lines.push(part.text);
        lines.push("");
      } else if (part.type === "tool" && part.tool) {
        lines.push(`### 🔧 Tool: ${part.tool}`);
        lines.push("");
        if (part.state?.input) {
          lines.push("**Input:**");
          lines.push("```");
          lines.push(
            typeof part.state.input === "string"
              ? part.state.input
              : JSON.stringify(part.state.input, null, 2),
          );
          lines.push("```");
          lines.push("");
        }
        if (part.state?.output) {
          lines.push("**Output:**");
          lines.push("```");
          lines.push(
            typeof part.state.output === "string"
              ? part.state.output
              : JSON.stringify(part.state.output, null, 2),
          );
          lines.push("```");
          lines.push("");
        }
      } else if (part.type === "reasoning" && part.text) {
        lines.push(`### 💭 Reasoning`);
        lines.push("");
        lines.push(part.text);
        lines.push("");
      } else if (part.type === "file" && part.filename) {
        lines.push(`📎 ${part.filename}`);
        lines.push("");
      }
    }

    if (msg.role === "assistant" && msg.tokens) {
      const t = msg.tokens;
      lines.push(
        `<small>Tokens: ${t.input} in / ${t.output} out` +
          (t.reasoning ? ` / ${t.reasoning} reasoning` : "") +
          (t.cache?.read ? ` / ${t.cache.read} cache-r` : "") +
          (t.cache?.write ? ` / ${t.cache.write} cache-w` : "") +
          (msg.cost ? ` | Cost: $${msg.cost.toFixed(4)}` : "") +
          `</small>`,
      );
      lines.push("");
    }

    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

export async function shareSession(
  session: Session | null,
  messages: Message[],
  parts: Record<string, Part[]>,
): Promise<void> {
  const markdown = exportSessionToMarkdown(session, messages, parts);
  const title = session?.title || "session";
  await Share.share({
    message: markdown,
    title,
  });
}
