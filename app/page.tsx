"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import VolumeGauge from "@/components/VolumeGauge";
import ItemFeed from "@/components/ItemFeed";
import WasteClassifier from "@/components/WasteClassifier";
import { classifyItem } from "@/lib/classifier";
import type { WasteItem } from "@/lib/wasteSnapshot";

const LIVE_POLL_MS = 1000;

/** Avoid SyntaxError when the dev server returns an HTML error page instead of JSON. */
async function readJsonBody(
  res: Response,
  label: string
): Promise<{ ok: true; data: unknown } | { ok: false; message: string }> {
  const text = await res.text();
  const trimmed = text.trimStart();
  if (trimmed.startsWith("<")) {
    return {
      ok: false,
      message: `${label}: server returned HTML (${res.status}) instead of JSON — open ${label} in the browser or check the terminal for compile/runtime errors on that route.`,
    };
  }
  try {
    return { ok: true, data: JSON.parse(text) as unknown };
  } catch {
    return {
      ok: false,
      message: `${label}: invalid JSON (${res.status}): ${text.slice(0, 160)}${text.length > 160 ? "…" : ""}`,
    };
  }
}

export default function Dashboard() {
  const [items, setItems] = useState<WasteItem[]>([]);
  const [totalVolume, setTotalVolume] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLive, setIsLive] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const prevCountRef = useRef(0);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      const body = await readJsonBody(res, "/api/dashboard");
      if (!body.ok) {
        setFetchError(body.message);
        setLastUpdated(new Date());
        return;
      }

      const data = body.data as {
        items?: WasteItem[];
        totalVolume?: string;
        totalItems?: number;
        error?: string;
      };

      if (!res.ok) {
        setFetchError(data.error ?? `API error (${res.status})`);
        setLastUpdated(new Date());
        return;
      }

      setFetchError(null);
      const newItems = data.items;
      const vol = data.totalVolume;
      const count = data.totalItems;
      const countNum = typeof count === "number" ? count : 0;

      if (countNum > prevCountRef.current) {
        prevCountRef.current = countNum;
      }

      setItems(Array.isArray(newItems) ? newItems : []);
      setTotalVolume(Number.parseFloat(String(vol ?? "0")) || 0);
      setTotalItems(countNum);
      setLastUpdated(new Date());
    } catch (e) {
      console.error(e);
      setFetchError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void fetchData();
    const interval = setInterval(() => {
      if (isLive) void fetchData();
    }, LIVE_POLL_MS);
    return () => clearInterval(interval);
  }, [isLive, fetchData]);

  const trashCount = items.filter((i) => classifyItem(i.item_name).category === "trash").length;
  const recycleCount = items.filter((i) => classifyItem(i.item_name).category === "recycle").length;
  const compostCount = items.filter((i) => classifyItem(i.item_name).category === "compost").length;

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-6 md:p-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">🗑️ CarbinWatcher</h1>
          <p className="text-zinc-500 text-sm mt-1">Real-time household waste intelligence</p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`w-2 h-2 rounded-full ${isLive ? "bg-green-400 animate-pulse" : "bg-zinc-600"}`}
          />
          <button
            type="button"
            onClick={() => setIsLive((v) => !v)}
            className="text-xs text-zinc-400 hover:text-white transition"
          >
            {isLive ? "Live" : "Paused"}
          </button>
          {lastUpdated && (
            <span className="text-xs text-zinc-600">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {fetchError && (
        <div
          className="mb-6 rounded-xl border border-red-900/80 bg-red-950/40 px-4 py-3 text-sm text-red-200"
          role="alert"
        >
          <span className="font-medium text-red-100">Could not load DynamoDB data.</span>{" "}
          <span className="text-red-200/90">{fetchError}</span>
        </div>
      )}

      <div className="mb-6">
        <VolumeGauge totalVolume={totalVolume} totalItems={totalItems} maxVolume={500} />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          {
            label: "Trash",
            count: trashCount,
            color: "text-red-400",
            bg: "bg-red-950",
            emoji: "🗑️",
          },
          {
            label: "Recycle",
            count: recycleCount,
            color: "text-blue-400",
            bg: "bg-blue-950",
            emoji: "♻️",
          },
          {
            label: "Compost",
            count: compostCount,
            color: "text-green-400",
            bg: "bg-green-950",
            emoji: "🌱",
          },
        ].map(({ label, count, color, bg, emoji }) => (
          <div key={label} className={`${bg} rounded-2xl p-5 border border-zinc-800`}>
            <div className="text-2xl mb-1">{emoji}</div>
            <div className={`text-3xl font-bold ${color}`}>{count}</div>
            <div className="text-zinc-400 text-sm mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ItemFeed items={items} />
        <WasteClassifier />
      </div>
    </main>
  );
}
