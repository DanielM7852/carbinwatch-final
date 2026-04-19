"use client";

import { useState } from "react";
import { classifyItem } from "@/lib/classifier";

export default function WasteClassifier() {
  const [query, setQuery] = useState("");
  const result = query.trim() ? classifyItem(query) : null;

  return (
    <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
      <h2 className="text-zinc-400 text-sm uppercase tracking-widest mb-4">Quick classify</h2>
      <p className="text-zinc-600 text-xs mb-3">
        Type an item name to preview how the rule-based classifier labels it.
      </p>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="e.g. banana peel, plastic bottle"
        className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
      />
      {result && (
        <div className="mt-4 flex items-start gap-3 rounded-xl bg-zinc-800/80 px-4 py-3 border border-zinc-700">
          <span className="text-2xl">{result.emoji}</span>
          <div>
            <p className={`font-semibold uppercase text-sm ${result.color}`}>{result.category}</p>
            <p className="text-zinc-400 text-sm mt-1">{result.tip}</p>
          </div>
        </div>
      )}
    </div>
  );
}
