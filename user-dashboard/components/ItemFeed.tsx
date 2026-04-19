"use client";

import { classifyItem } from "@/lib/classifier";
import type { WasteItem } from "@/lib/wasteSnapshot";

export default function ItemFeed({ items }: { items: WasteItem[] }) {
  return (
    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 flex flex-col min-h-0 h-full p-4 md:p-5">
      <h2 className="text-zinc-400 text-[11px] uppercase tracking-widest mb-3 shrink-0">
        Live item feed
      </h2>
      <div className="space-y-2 min-h-0 flex-1 max-h-[min(52vh,420px)] md:max-h-[min(48vh,380px)] overflow-y-auto pr-1 -mr-1">
        {items.length === 0 && (
          <p className="text-zinc-600 text-sm py-2">Waiting for items...</p>
        )}
        {items.map((item, index) => {
          const { label, color, emoji, tip } = classifyItem(item.item_name);
          return (
            <div
              key={`${item.id}::${index}`}
              className="flex items-center justify-between bg-zinc-800 rounded-xl px-4 py-3 animate-fadeIn"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl shrink-0">{emoji}</span>
                <div>
                  <p className="text-white text-sm font-medium capitalize leading-snug line-clamp-2">
                    {item.item_name}
                  </p>
                  <p className={`text-[11px] leading-snug ${color} font-semibold line-clamp-2`}>
                    {label} — {tip}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white text-sm font-mono">
                  {Number.isInteger(item.volume)
                    ? item.volume
                    : item.volume.toFixed(2)}{" "}
                  cm³
                </p>
                <p className="text-zinc-500 text-xs">
                  {item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : "—"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
