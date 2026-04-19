"use client";

import { classifyItem } from "@/lib/classifier";
import type { WasteItem } from "@/lib/wasteSnapshot";

export default function ItemFeed({ items }: { items: WasteItem[] }) {
  return (
    <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
      <h2 className="text-zinc-400 text-sm uppercase tracking-widest mb-4">Live Item Feed</h2>
      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
        {items.length === 0 && (
          <p className="text-zinc-600 text-sm">Waiting for items...</p>
        )}
        {items.map((item, index) => {
          const { category, color, emoji, tip } = classifyItem(item.item_name);
          return (
            <div
              key={`${item.id}::${index}`}
              className="flex items-center justify-between bg-zinc-800 rounded-xl px-4 py-3 animate-fadeIn"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{emoji}</span>
                <div>
                  <p className="text-white font-medium capitalize">{item.item_name}</p>
                  <p className={`text-xs ${color} font-semibold uppercase`}>
                    {category} — {tip}
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
