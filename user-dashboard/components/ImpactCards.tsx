"use client";

import { wasteVolumeToCo2Kg, co2KgToTrees, co2KgToCars } from "@/lib/co2Impact";
// CO₂ kg is now shown in the volume gauge — these cards focus on the
// equivalence metrics (trees + cars) that complement it.

interface Props {
  totalVolume: number;
}

function formatNumber(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export default function ImpactCards({ totalVolume }: Props) {
  const co2Kg = wasteVolumeToCo2Kg(totalVolume);
  const trees = co2KgToTrees(co2Kg);
  const cars = co2KgToCars(co2Kg);

  const cards = [
    {
      key: "trees",
      emoji: "🌳",
      value: formatNumber(trees, trees >= 10 ? 0 : 1),
      unit: "trees/yr",
      label: "Equivalent trees",
      color: "text-green-300",
      bg: "bg-green-950/60",
    },
    {
      key: "cars",
      emoji: "🚗",
      value: formatNumber(cars, cars >= 10 ? 0 : 1),
      unit: "cars/day",
      label: "Cars off the road",
      color: "text-sky-300",
      bg: "bg-sky-950/60",
    },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3">
      {cards.map(({ key, emoji, value, unit, label, color, bg }) => (
        <div
          key={key}
          className={`${bg} flex flex-col items-center justify-center rounded-xl border border-zinc-800/80 px-2 py-3 text-center sm:rounded-2xl sm:py-4`}
          title={label}
        >
          <span className="text-lg sm:text-xl md:text-2xl" aria-hidden>
            {emoji}
          </span>
          <div className="mt-1 flex items-baseline justify-center gap-1">
            <span className={`text-xl font-bold tabular-nums sm:text-2xl md:text-3xl ${color}`}>
              {value}
            </span>
            <span className="text-[10px] font-medium text-zinc-500 sm:text-xs">{unit}</span>
          </div>
          <span className="mt-0.5 text-[10px] leading-tight text-zinc-500 sm:text-xs">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
