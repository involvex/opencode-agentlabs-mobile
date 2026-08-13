import { useSettings, type Density } from "../stores/settings";

const multipliers: Record<
  Density,
  { padding: number; font: number; gap: number }
> = {
  compact: { padding: 0.6, font: 0.85, gap: 0.6 },
  default: { padding: 1.0, font: 1.0, gap: 1.0 },
  comfortable: { padding: 1.4, font: 1.15, gap: 1.3 },
};

export function useDensity() {
  const density = useSettings((s) => s.density);
  return multipliers[density ?? "default"];
}

export type { Density };
