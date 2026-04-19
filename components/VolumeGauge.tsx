"use client";

interface Props {
  totalVolume: number;
  totalItems: number;
  maxVolume?: number;
}

export default function VolumeGauge({ totalVolume, totalItems, maxVolume = 100 }: Props) {
  const vol = Number.isFinite(totalVolume) ? totalVolume : 0;
  const pct = Math.min((vol / maxVolume) * 100, 100);
  const color = pct > 80 ? "bg-red-500" : pct > 50 ? "bg-yellow-400" : "bg-green-500";

  return (
    <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
      <h2 className="text-zinc-400 text-sm uppercase tracking-widest mb-1">Total Bin Volume</h2>
      <div className="flex items-end gap-3 mb-4">
        <span className="text-5xl font-bold text-white">{vol.toFixed(1)}</span>
        <span className="text-zinc-400 mb-1">cm³</span>
      </div>
      <div className="w-full bg-zinc-800 rounded-full h-4 mb-2">
        <div
          className={`h-4 rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-zinc-500">
        <span>{pct.toFixed(0)}% full</span>
        <span>{totalItems} items logged</span>
      </div>
    </div>
  );
}
