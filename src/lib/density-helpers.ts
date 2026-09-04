/** Scale a base value by a density multiplier. */
export const scaled = (base: number, multiplier: number) => base * multiplier;

type DensityScale = { padding: number; font: number; gap: number };

/** Apply density multipliers to a style object.
 *  padding/margin/gap → density.padding, fontSize → density.font */
export function ds<T extends Record<string, number | string | undefined>>(
  style: T,
  d: DensityScale,
): T {
  const out = { ...style };
  for (const key of Object.keys(out)) {
    const v = out[key];
    if (typeof v !== "number") continue;
    if (key === "fontSize" || key.startsWith("fontSize")) {
      (out as Record<string, unknown>)[key] = v * d.font;
    } else if (key === "gap" || key.startsWith("gap")) {
      (out as Record<string, unknown>)[key] = v * d.gap;
    } else if (
      key === "padding" ||
      key.startsWith("padding") ||
      key === "margin" ||
      key.startsWith("margin")
    ) {
      (out as Record<string, unknown>)[key] = v * d.padding;
    }
  }
  return out;
}
