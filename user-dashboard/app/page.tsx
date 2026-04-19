"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import VolumeGauge from "@/components/VolumeGauge";
import LiveWebcam from "@/components/LiveWebcam";
import ItemFeed from "@/components/ItemFeed";
import type { WasteItem } from "@/lib/wasteSnapshot";

/** Align with server snapshot cache (~3s) so we are not hammering DynamoDB. */
const LIVE_POLL_MS = 3000;

/** API / proxies sometimes stringify numbers; coercing avoids wrong 0s on Vercel. */
function asCount(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string") {
    const n = Number.parseInt(String(v).trim(), 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

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

const CATEGORY_CARDS = [
  {
    key: "special",
    label: "Special",
    long: "Special Recycling",
    countKey: "specialRecyclingCount" as const,
    color: "text-amber-400",
    bg: "bg-amber-950/60",
    emoji: "♻️",
  },
  {
    key: "compost",
    label: "Compost",
    long: "Compost",
    countKey: "compostCount" as const,
    color: "text-green-400",
    bg: "bg-green-950",
    emoji: "🌱",
  },
  {
    key: "recycle",
    label: "Recycle",
    long: "Recycle",
    countKey: "recycleCount" as const,
    color: "text-blue-400",
    bg: "bg-blue-950",
    emoji: "♻️",
  },
  {
    key: "textile",
    label: "Textile",
    long: "Donate / Textile",
    countKey: "textileRecycleCount" as const,
    color: "text-cyan-400",
    bg: "bg-cyan-950/50",
    emoji: "♻️",
  },
  {
    key: "trash",
    label: "Trash",
    long: "Trash",
    countKey: "trashCount" as const,
    color: "text-red-400",
    bg: "bg-red-950",
    emoji: "🗑️",
  },
] as const;

export default function Dashboard() {
  const [items, setItems] = useState<WasteItem[]>([]);
  const [totalVolume, setTotalVolume] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [trashCount, setTrashCount] = useState(0);
  const [recycleCount, setRecycleCount] = useState(0);
  const [compostCount, setCompostCount] = useState(0);
  const [specialRecyclingCount, setSpecialRecyclingCount] = useState(0);
  const [textileRecycleCount, setTextileRecycleCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLive, setIsLive] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const prevCountRef = useRef(0);
  const inFlightRef = useRef(false);

  const counts = {
    trashCount,
    recycleCount,
    compostCount,
    specialRecyclingCount,
    textileRecycleCount,
  };

  const fetchData = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const res = await fetch("/api/dashboard", {
        cache: "no-store",
        credentials: "same-origin",
      });
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
        trashCount?: number;
        recycleCount?: number;
        compostCount?: number;
        specialRecyclingCount?: number;
        textileRecycleCount?: number;
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

      const t = asCount(data.trashCount);
      const r = asCount(data.recycleCount);
      const c = asCount(data.compostCount);
      const s = asCount(data.specialRecyclingCount);
      const x = asCount(data.textileRecycleCount);
      const sumCategories = t + r + c + s + x;
      const totalFromApi = asCount(data.totalItems);
      const itemsLogged = sumCategories > 0 ? sumCategories : totalFromApi;

      if (itemsLogged > prevCountRef.current) {
        prevCountRef.current = itemsLogged;
      }

      setItems(Array.isArray(newItems) ? newItems : []);
      setTotalVolume(Number.parseFloat(String(vol ?? "0")) || 0);
      setTotalItems(itemsLogged);
      setTrashCount(t);
      setRecycleCount(r);
      setCompostCount(c);
      setSpecialRecyclingCount(s);
      setTextileRecycleCount(x);
      setLastUpdated(new Date());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setFetchError(
        msg === "Failed to fetch" || msg.includes("NetworkError") || msg.includes("Load failed")
          ? "Could not reach this app (network error). The server may still be busy with a DynamoDB scan — wait a few seconds. If this repeats, slow polling or check that npm run dev is running."
          : msg
      );
      setLastUpdated(new Date());
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    void fetchData();
    const interval = setInterval(() => {
      if (isLive) void fetchData();
    }, LIVE_POLL_MS);
    return () => clearInterval(interval);
  }, [isLive, fetchData]);

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-5 sm:py-5 md:px-6 md:py-6">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3 md:mb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">🗑️ CarbinWatcher</h1>
            <p className="mt-0.5 text-xs text-zinc-500 sm:text-sm">Household waste intelligence</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span
              className={`mt-1.5 h-2 w-2 rounded-full ${isLive ? "animate-pulse bg-green-400" : "bg-zinc-600"}`}
            />
            <button
              type="button"
              onClick={() => setIsLive((v) => !v)}
              className="text-xs text-zinc-400 transition hover:text-white"
            >
              {isLive ? "Live" : "Paused"}
            </button>
            {lastUpdated && (
              <span className="text-[11px] text-zinc-600 sm:text-xs">
                {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
        </header>

        {fetchError && (
          <div
            className="mb-4 rounded-xl border border-red-900/80 bg-red-950/40 px-3 py-2.5 text-sm text-red-200 md:mb-5"
            role="alert"
          >
            <span className="font-medium text-red-100">Could not load DynamoDB data.</span>{" "}
            <span className="text-red-200/90">{fetchError}</span>
          </div>
        )}

        <div className="mb-4 md:mb-5">
          <VolumeGauge totalVolume={totalVolume} totalItems={totalItems} />
        </div>

        <div className="mb-4 grid grid-cols-5 gap-1.5 sm:gap-2 md:mb-5 md:gap-3">
          {CATEGORY_CARDS.map(({ key, label, long, countKey, color, bg, emoji }) => (
            <div
              key={key}
              title={long}
              className={`${bg} flex flex-col items-center justify-center rounded-xl border border-zinc-800/80 px-1 py-2.5 sm:rounded-2xl sm:py-3 md:py-3.5`}
            >
              <span className="text-base sm:text-lg md:text-xl" aria-hidden>
                {emoji}
              </span>
              <span className={`mt-0.5 text-lg font-bold tabular-nums sm:text-xl md:text-2xl ${color}`}>
                {counts[countKey]}
              </span>
              <span className="mt-0.5 max-w-[4.5rem] truncate text-center text-[9px] leading-tight text-zinc-500 sm:max-w-none sm:text-[10px] md:text-xs">
                {label}
              </span>
            </div>
          ))}
        </div>

        <div className="grid min-h-0 gap-4 lg:grid-cols-2 lg:gap-5 lg:items-stretch">
          <div className="min-h-0 flex flex-col lg:min-h-[min(50vh,420px)]">
            <LiveWebcam compact />
          </div>
          <div className="min-h-0 flex flex-col lg:min-h-[min(50vh,420px)]">
            <ItemFeed items={items} />
          </div>
        </div>
      </div>
    </main>
  );
}
