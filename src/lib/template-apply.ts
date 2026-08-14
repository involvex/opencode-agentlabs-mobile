// Pure, transport-agnostic logic for applying session templates.
// Extracted so it's unit-testable under plain `node --test` without importing
// expo-secure-store or any RN-specific modules.

import type { SessionTemplate } from "../stores/templates";

export interface TemplateApplyResult {
  model?: { providerID: string; modelID: string };
  agent?: string;
  directory?: string;
}

export function applyTemplate(
  template: SessionTemplate | null,
  overrides?: {
    model?: { providerID: string; modelID: string };
    agent?: string;
    directory?: string;
  },
): TemplateApplyResult {
  if (!template) {
    return {
      model: overrides?.model,
      agent: overrides?.agent,
      directory: overrides?.directory,
    };
  }

  return {
    model: overrides?.model ?? template.model,
    agent: overrides?.agent ?? template.agent,
    directory: overrides?.directory ?? template.directory,
  };
}

export function templateMatches(
  template: SessionTemplate,
  query: string,
): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  return (
    template.name.toLowerCase().includes(q) ||
    template.prompt.toLowerCase().includes(q)
  );
}

export function filterTemplates(
  templates: SessionTemplate[],
  query: string,
): SessionTemplate[] {
  if (!query.trim()) return templates;
  return templates.filter((t) => templateMatches(t, query));
}
