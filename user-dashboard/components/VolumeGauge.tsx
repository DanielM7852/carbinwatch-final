"use client";

import { wasteVolumeToCo2Kg } from "@/lib/co2Impact";

interface Props {
  totalVolume: number;
  totalItems: number;
}

export default function VolumeGauge({ totalVolume, totalItems }: Props) {
  const vol = Number.isFinite(totalVolume) ? totalVolume : 0;
  const co2Kg = wasteVolumeToCo2Kg(vol);

  return (
    <section
      className="rounded-2xl border border-emerald-900/40 bg-gradient-to-b from-zinc-900 via-zinc-900/95 to-zinc-950 px-6 py-8 sm:px-10 sm:py-10 shadow-[0_0_0_1px_rgba(16,185,129,0.08)]"
      aria-label="Session totals"
    >
      <div className="flex flex-col items-center justify-center gap-8 sm:flex-row sm:gap-10 md:gap-14">
        <div className="flex min-w-0 flex-col items-center text-center">
          <span className="text-zinc-500 text-[11px] font-medium uppercase tracking-[0.2em]">
            Items logged
          </span>
          <span className="mt-1 text-5xl font-bold tabular-nums leading-none tracking-tight text-white sm:text-6xl md:text-7xl">
            {totalItems}
          </span>
        </div>

        <div
          className="hidden h-24 w-px shrink-0 bg-gradient-to-b from-transparent via-zinc-700 to-transparent sm:block"
          aria-hidden
        />

        <div className="flex min-w-0 flex-col items-center text-center">
          <span className="text-zinc-500 text-[11px] font-medium uppercase tracking-[0.2em]">
            Total waste saved
          </span>
          <div className="mt-1 flex items-baseline justify-center gap-2">
            <span className="text-5xl font-bold tabular-nums leading-none tracking-tight text-white sm:text-6xl md:text-7xl">
              {vol.toFixed(1)}
            </span>
            <span className="text-base font-medium text-zinc-500 sm:text-lg">cm³</span>
          </div>
        </div>

        <div
          className="hidden h-24 w-px shrink-0 bg-gradient-to-b from-transparent via-zinc-700 to-transparent sm:block"
          aria-hidden
        />

        <div className="flex min-w-0 flex-col items-center text-center">
          <span className="text-zinc-500 text-[11px] font-medium uppercase tracking-[0.2em]">
            Total CO₂ saved
          </span>
          <div className="mt-1 flex items-baseline justify-center gap-2">
            <span className="text-5xl font-bold tabular-nums leading-none tracking-tight text-white sm:text-6xl md:text-7xl">
              {co2Kg.toFixed(2)}
            </span>
            <span className="text-base font-medium text-zinc-500 sm:text-lg">kg</span>
          </div>
        </div>
      </div>
    </section>
  );
}
