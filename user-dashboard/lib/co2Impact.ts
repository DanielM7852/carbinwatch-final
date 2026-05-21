/**
 * Volume → CO₂ → impact (trees, cars) conversions.
 *
 * Constants are blended/educational estimates, not a methodology. Tune for
 * EPA / DEFRA / etc. as needed. The `NEXT_PUBLIC_CO2_IMPACT_MULTIPLIER`
 * env var scales the CO₂ readout (and all derived metrics) for demos.
 */

/** ~500 kg/m³ loose mixed waste — order-of-magnitude for volume → mass. */
const WASTE_DENSITY_KG_PER_CM3 = 500 / 1_000_000;

/** Rough avoided CO₂e per kg waste diverted (blended materials). */
const CO2E_KG_PER_KG_WASTE = 1;

/** Default scale for the CO₂ readout; override with NEXT_PUBLIC_CO2_IMPACT_MULTIPLIER. */
const DEFAULT_CO2_IMPACT_MULTIPLIER = 10;

/** Annual CO₂ sequestered by one mature urban tree (US EPA). */
const KG_CO2_PER_TREE_PER_YEAR = 21.77;

/** Daily CO₂ emitted by one average passenger car (US EPA ~4.6 t/yr ÷ 365). */
const KG_CO2_PER_CAR_PER_DAY = 4600 / 365;

/** Demo-time amplification on trees/cars so small kitchen-scale numbers read better. */
const TREES_DEMO_MULTIPLIER = 10;
const CARS_DEMO_MULTIPLIER = 10;

function resolveCo2ImpactMultiplier(): number {
  const raw = process.env.NEXT_PUBLIC_CO2_IMPACT_MULTIPLIER;
  if (raw === undefined) return DEFAULT_CO2_IMPACT_MULTIPLIER;
  const n = Number.parseFloat(String(raw).trim());
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CO2_IMPACT_MULTIPLIER;
}

const CO2_IMPACT_MULTIPLIER = resolveCo2ImpactMultiplier();

export function wasteVolumeToCo2Kg(volumeCm3: number): number {
  const v = Number.isFinite(volumeCm3) && volumeCm3 > 0 ? volumeCm3 : 0;
  const massKg = v * WASTE_DENSITY_KG_PER_CM3;
  return massKg * CO2E_KG_PER_KG_WASTE * CO2_IMPACT_MULTIPLIER;
}

export function co2KgToTrees(kgCo2: number): number {
  if (!Number.isFinite(kgCo2) || kgCo2 <= 0) return 0;
  return (kgCo2 / KG_CO2_PER_TREE_PER_YEAR) * TREES_DEMO_MULTIPLIER;
}

export function co2KgToCars(kgCo2: number): number {
  if (!Number.isFinite(kgCo2) || kgCo2 <= 0) return 0;
  return (kgCo2 / KG_CO2_PER_CAR_PER_DAY) * CARS_DEMO_MULTIPLIER;
}
