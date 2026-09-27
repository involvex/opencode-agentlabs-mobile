export interface ModelListItem {
  providerID: string;
  providerName: string;
  modelID: string;
  modelName: string;
}

export interface ModelListProvider {
  id: string;
  name: string;
  models: { id: string; name: string }[];
}

export interface ModelListSection {
  title: string;
  isFavorites?: boolean;
  data: ModelListItem[];
}

export function modelFavKey(providerID: string, modelID: string): string {
  return `${providerID}/${modelID}`.toLowerCase();
}

function matchesQuery(
  providerName: string,
  m: { id: string; name: string },
  q: string,
): boolean {
  if (!q) return true;
  return (
    m.id.toLowerCase().includes(q) ||
    m.name.toLowerCase().includes(q) ||
    providerName.toLowerCase().includes(q)
  );
}

/**
 * Builds sectioned model list with favorites pinned on top.
 *
 * Favorites are ALWAYS pinned: they appear in the leading Favorites section
 * regardless of the search query, and are excluded from provider sections
 * to avoid duplicate rows. Stale favorite keys (model no longer available)
 * are ignored.
 */
export function buildModelSections(
  providers: ModelListProvider[],
  opts: {
    search: string;
    selected: { providerID: string; modelID: string } | null;
    favorites: string[];
    favoritesTitle: string;
  },
): ModelListSection[] {
  const list = Array.isArray(providers) ? providers : [];
  const q = (opts.search || "").toLowerCase();
  const favSet = new Set((opts.favorites || []).map((f) => f.toLowerCase()));
  const byKey = new Map<string, ModelListItem>();

  for (const p of list) {
    const providerName = p.name || p.id;
    for (const m of p.models || []) {
      byKey.set(modelFavKey(p.id, m.id), {
        providerID: p.id,
        providerName,
        modelID: m.id,
        modelName: m.name || m.id,
      });
    }
  }

  // Favorites first, in the user's favorited order. Always shown.
  const favItems: ModelListItem[] = [];
  for (const key of favSet) {
    const item = byKey.get(key);
    if (item) favItems.push(item);
  }

  const result: ModelListSection[] = [];
  if (favItems.length > 0) {
    result.push({
      title: opts.favoritesTitle,
      isFavorites: true,
      data: favItems,
    });
  }

  const sections: ModelListSection[] = list
    .map((p) => {
      const providerName = p.name || p.id;
      const models = (p.models || [])
        .filter((m) => !favSet.has(modelFavKey(p.id, m.id)))
        .filter((m) => matchesQuery(providerName, m, q))
        .map((m): ModelListItem => ({
          providerID: p.id,
          providerName,
          modelID: m.id,
          modelName: m.name || m.id,
        }));
      if (opts.selected) {
        const sel = opts.selected;
        models.sort((a, b) => {
          const aActive =
            a.providerID === sel.providerID && a.modelID === sel.modelID;
          const bActive =
            b.providerID === sel.providerID && b.modelID === sel.modelID;
          if (aActive !== bActive) return aActive ? -1 : 1;
          return a.modelName.localeCompare(b.modelName);
        });
      } else {
        models.sort((a, b) => a.modelName.localeCompare(b.modelName));
      }
      return { title: providerName, data: models };
    })
    .filter((s) => s.data.length > 0);

  if (opts.selected) {
    const sel = opts.selected;
    sections.sort((a, b) => {
      const aHas = a.data.some(
        (m) => m.providerID === sel.providerID && m.modelID === sel.modelID,
      );
      const bHas = b.data.some(
        (m) => m.providerID === sel.providerID && m.modelID === sel.modelID,
      );
      return aHas === bHas ? 0 : aHas ? -1 : 1;
    });
  }
  result.push(...sections);
  return result;
}
