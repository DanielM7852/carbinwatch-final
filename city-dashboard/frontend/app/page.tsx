"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type CategoryTotal = { items: number; volume_ml: number };

type LiveData = {
  user_id: string;
  item_count: number;
  totals_by_category: Record<string, CategoryTotal>;
  recent_items: {
    ts: string;
    item: string;
    category: string;
    volume_ml: number;
    confidence: number;
  }[];
};

type TestWeightRow = {
  ts: string;
  item: string;
  category: string;
  volume_ml: number;
  co2_kg: number;
  ocean_heat_j: number;
  seawater_warm_l: number;
  temp_reduce_f: number;
};

type AggregateScope = {
  scope: "device_sample" | "household_annual" | "sandiego_annual";
  label: string;
  events: number;
  co2_kg: number;
  co2_tons: number;
  ocean_heat_gj: number;
  seawater_warm_l: number;
  trees_equiv: number;
  cars_off_road_equiv: number;
  households: number;
  days: number;
};

type AggregateData = {
  available: boolean;
  scopes: AggregateScope[];
  error?: string;
};

type TestWeightData = {
  available: boolean;
  user_id?: string;
  count?: number;
  rows: TestWeightRow[];
  error?: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const COLORS: Record<string, string> = {
  compost: "#4ade80",
  recycling: "#60a5fa",
  landfill: "#f87171",
  food_waste: "#facc15",
};

export default function Dashboard() {
  const [data, setData] = useState<LiveData | null>(null);
  const [testW, setTestW] = useState<TestWeightData | null>(null);
  const [agg, setAgg] = useState<AggregateData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadLive = async () => {
      try {
        const res = await fetch(`${API_URL}/live?user_id=u1`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: LiveData = await res.json();
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    };

    const loadTestW = async () => {
      try {
        const res = await fetch(`${API_URL}/test-weight?user_id=u1&limit=10`);
        if (!res.ok) return;
        const json: TestWeightData = await res.json();
        if (!cancelled) setTestW(json);
      } catch {
        // silent — test transform is non-critical
      }
    };

    const loadAgg = async () => {
      try {
        const res = await fetch(`${API_URL}/aggregates`);
        if (!res.ok) return;
        const json: AggregateData = await res.json();
        if (!cancelled) setAgg(json);
      } catch {
        // silent
      }
    };

    loadLive();
    loadTestW();
    loadAgg();
    const liveId = setInterval(loadLive, 3000);
    const testWId = setInterval(loadTestW, 5000);
    const aggId = setInterval(loadAgg, 15000);
    return () => {
      cancelled = true;
      clearInterval(liveId);
      clearInterval(testWId);
      clearInterval(aggId);
    };
  }, []);

  const chartData = data
    ? Object.entries(data.totals_by_category).map(([category, v]) => ({
        category,
        ...v,
        fill: COLORS[category] || "#a1a1aa",
      }))
    : [];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-8">
      <header className="max-w-5xl mx-auto mb-8">
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
          CarbinWatcher — Live Kitchen
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mt-1">
          Real-time classifications from{" "}
          <code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded">
            carbinwatcher-kitchen-01
          </code>
          . Polls every 3 s.
        </p>
      </header>

      <main className="max-w-5xl mx-auto space-y-6">
        {error && (
          <div className="p-4 rounded bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-200">
            Couldn&apos;t reach backend at {API_URL}: {error}
          </div>
        )}

        <section className="rounded-lg shadow-lg overflow-hidden">
          <div className="p-6 bg-gradient-to-br from-sky-600 via-cyan-600 to-teal-700 dark:from-sky-800 dark:via-cyan-800 dark:to-teal-900 text-white">
            <div className="flex items-baseline justify-between mb-1">
              <h2 className="text-sm font-medium uppercase tracking-wider text-sky-100">
                San Diego impact projection
              </h2>
              <span className="text-xs text-sky-100">Databricks · workspace.default.sandiego_aggregates</span>
            </div>
            <p className="text-sky-100/90 text-sm mt-1">
              Linear extrapolation from live sample → 1 household/year → San Diego with 10% adoption and 25% behavior change.
            </p>
          </div>

          {agg?.available && agg.scopes.length === 3 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-200 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
              {agg.scopes.map((s) => {
                const isHero = s.scope === "sandiego_annual";
                return (
                  <div
                    key={s.scope}
                    className={`p-6 ${isHero ? "bg-gradient-to-b from-cyan-50 to-white dark:from-cyan-950/40 dark:to-zinc-900" : ""}`}
                  >
                    <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">
                      {s.scope === "device_sample" && "🔬 Device sample"}
                      {s.scope === "household_annual" && "🏠 Per household / year"}
                      {s.scope === "sandiego_annual" && "🌆 San Diego / year"}
                    </div>
                    <div className="text-xs text-zinc-400 mb-4">{s.label}</div>

                    <div className="flex items-baseline gap-1 mb-4">
                      <span className={`tabular-nums font-bold ${isHero ? "text-4xl text-cyan-700 dark:text-cyan-300" : "text-3xl text-zinc-900 dark:text-zinc-50"}`}>
                        {s.co2_tons >= 0.01 ? s.co2_tons.toFixed(2) : s.co2_kg.toFixed(2)}
                      </span>
                      <span className="text-sm text-zinc-500">
                        {s.co2_tons >= 0.01 ? "tons CO₂" : "kg CO₂"}
                      </span>
                    </div>

                    <dl className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-zinc-500">Events</dt>
                        <dd className="font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">
                          {s.events.toLocaleString()}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-zinc-500">Trees equivalent</dt>
                        <dd className="font-medium text-emerald-700 dark:text-emerald-400 tabular-nums">
                          {s.trees_equiv >= 1 ? s.trees_equiv.toLocaleString(undefined, { maximumFractionDigits: 0 }) : s.trees_equiv.toFixed(2)} 🌳
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-zinc-500">Cars off road</dt>
                        <dd className="font-medium text-amber-700 dark:text-amber-400 tabular-nums">
                          {s.cars_off_road_equiv >= 1 ? s.cars_off_road_equiv.toLocaleString(undefined, { maximumFractionDigits: 0 }) : s.cars_off_road_equiv.toFixed(3)} 🚗
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-zinc-500">Ocean heat avoided</dt>
                        <dd className="font-medium text-sky-700 dark:text-sky-400 tabular-nums">
                          {s.ocean_heat_gj.toFixed(s.ocean_heat_gj >= 1 ? 1 : 3)} GJ
                        </dd>
                      </div>
                      {s.households > 1 && (
                        <div className="flex justify-between pt-2 mt-2 border-t border-zinc-200 dark:border-zinc-800">
                          <dt className="text-zinc-500">Households</dt>
                          <dd className="font-medium text-zinc-700 dark:text-zinc-300 tabular-nums">
                            {s.households.toLocaleString()}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 bg-white dark:bg-zinc-900 text-zinc-500 italic text-sm">
              {agg?.error ? `Databricks error: ${agg.error}` : "Waiting for aggregate table…"}
            </div>
          )}
        </section>

        {agg?.available && agg.scopes.length === 3 && (
          <section className="p-6 bg-white dark:bg-zinc-900 rounded-lg shadow">
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                Scaling to city size
              </h2>
              <span className="text-sm text-zinc-500">
                CO₂ tons · log scale
              </span>
            </div>
            <p className="text-xs text-zinc-500 mb-4">
              Each gridline is 10× — makes it obvious how a single device&apos;s footprint compounds at household and city scale.
            </p>

            <div className="w-full h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={agg.scopes.map((s) => ({
                    name:
                      s.scope === "device_sample"    ? "🔬 Device" :
                      s.scope === "household_annual" ? "🏠 Household / yr" :
                                                      "🌆 San Diego / yr",
                    co2_tons: Math.max(s.co2_tons, 0.0001),
                    trees:    Math.max(s.trees_equiv, 0.0001),
                    cars:     Math.max(s.cars_off_road_equiv, 0.0001),
                    fill:
                      s.scope === "device_sample"    ? "#94a3b8" :
                      s.scope === "household_annual" ? "#0891b2" :
                                                      "#0e7490",
                  }))}
                  margin={{ top: 20, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis dataKey="name" stroke="#71717a" tick={{ fontSize: 12 }} />
                  <YAxis
                    scale="log"
                    domain={[0.01, "dataMax"]}
                    stroke="#71717a"
                    tickFormatter={(v: number) =>
                      v >= 1000
                        ? `${(v / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}k`
                        : v.toLocaleString(undefined, { maximumFractionDigits: 2 })
                    }
                  />
                  <Tooltip
                    contentStyle={{ background: "#18181b", border: "none", borderRadius: 4 }}
                    labelStyle={{ color: "#fafafa" }}
                    formatter={(value, name) => {
                      const labels: Record<string, string> = {
                        co2_tons: "tons CO₂",
                        trees: "trees",
                        cars: "cars off road",
                      };
                      const num = typeof value === "number" ? value : Number(value ?? 0);
                      return [
                        num.toLocaleString(undefined, { maximumFractionDigits: 2 }),
                        labels[String(name)] || String(name),
                      ];
                    }}
                  />
                  <Bar dataKey="co2_tons" isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 text-sm">
              {agg.scopes.map((s) => (
                <div key={s.scope} className="text-center">
                  <div className="text-xs uppercase tracking-wider text-zinc-500">
                    {s.scope === "device_sample" && "Device"}
                    {s.scope === "household_annual" && "Household"}
                    {s.scope === "sandiego_annual" && "San Diego"}
                  </div>
                  <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums mt-1">
                    {s.co2_tons >= 1000
                      ? `${(s.co2_tons / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}k`
                      : s.co2_tons >= 1
                      ? s.co2_tons.toLocaleString(undefined, { maximumFractionDigits: 1 })
                      : s.co2_tons.toFixed(3)}
                    <span className="text-xs text-zinc-500 ml-1">tCO₂</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="p-6 bg-white dark:bg-zinc-900 rounded-lg shadow">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Scripps Oceanography Projections
            </h2>
            <span className="text-xs text-zinc-500">
              Databricks notebook <code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded">test_transform</code> · refreshes every 5 s
            </span>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            S3 raw event → Spark + Scripps environmental model → Delta table.
          </p>

          {testW?.available ? (
            <div className="overflow-hidden rounded border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                  <tr>
                    <th className="text-left p-2">Time</th>
                    <th className="text-left p-2">Item</th>
                    <th className="text-left p-2">Bin</th>
                    <th className="text-right p-2">Volume (mL)</th>
                    <th className="text-right p-2">CO₂ (kg)</th>
                    <th className="text-right p-2">Ocean heat (MJ)</th>
                    <th className="text-right p-2">Seawater warmed (L)</th>
                  </tr>
                </thead>
                <tbody>
                  {testW.rows.slice(0, 10).map((r, i) => (
                    <tr key={r.ts + i} className="border-t border-zinc-200 dark:border-zinc-800">
                      <td className="p-2 text-zinc-500 font-mono text-xs">{r.ts.slice(11, 19)}</td>
                      <td className="p-2 text-zinc-900 dark:text-zinc-100">{r.item}</td>
                      <td className="p-2">
                        <span
                          className="inline-block px-2 py-0.5 rounded text-xs font-medium text-white"
                          style={{ background: COLORS[r.category] || "#a1a1aa" }}
                        >
                          {r.category}
                        </span>
                      </td>
                      <td className="p-2 text-right text-zinc-700 dark:text-zinc-300 tabular-nums">
                        {r.volume_ml.toFixed(0)}
                      </td>
                      <td className="p-2 text-right font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {r.co2_kg.toFixed(3)}
                      </td>
                      <td className="p-2 text-right text-zinc-700 dark:text-zinc-300 tabular-nums">
                        {(r.ocean_heat_j / 1e6).toFixed(2)}
                      </td>
                      <td className="p-2 text-right text-zinc-700 dark:text-zinc-300 tabular-nums">
                        {r.seawater_warm_l.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-2 py-1 bg-zinc-50 dark:bg-zinc-900/50 text-xs text-zinc-500 border-t border-zinc-200 dark:border-zinc-800">
                {testW.count} rows in <code>workspace.default.test_transformed</code>
              </div>
            </div>
          ) : (
            <div className="text-zinc-500 italic text-sm py-4">
              {testW?.error ? `Databricks error: ${testW.error}` : "Loading from Databricks…"}
            </div>
          )}
        </section>

        <section className="p-6 bg-white dark:bg-zinc-900 rounded-lg shadow">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Waste by category (mL)
            </h2>
            <span className="text-sm text-zinc-500">
              {data ? `${data.item_count} items` : "loading…"}
            </span>
          </div>

          <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="category" stroke="#71717a" />
                <YAxis stroke="#71717a" />
                <Tooltip
                  contentStyle={{ background: "#18181b", border: "none" }}
                  labelStyle={{ color: "#fafafa" }}
                />
                <Bar dataKey="volume_ml" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="p-6 bg-white dark:bg-zinc-900 rounded-lg shadow">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
            Recent items
          </h2>
          <div className="overflow-hidden rounded border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                <tr>
                  <th className="text-left p-2">Time (UTC)</th>
                  <th className="text-left p-2">Item</th>
                  <th className="text-left p-2">Category</th>
                  <th className="text-right p-2">Volume (mL)</th>
                  <th className="text-right p-2">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {data?.recent_items.slice(0, 10).map((it) => (
                  <tr key={it.ts + it.item} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="p-2 text-zinc-500 font-mono text-xs">
                      {it.ts.slice(11, 19)}
                    </td>
                    <td className="p-2 text-zinc-900 dark:text-zinc-100">{it.item}</td>
                    <td className="p-2">
                      <span
                        className="inline-block px-2 py-0.5 rounded text-xs font-medium text-white"
                        style={{ background: COLORS[it.category] || "#a1a1aa" }}
                      >
                        {it.category}
                      </span>
                    </td>
                    <td className="p-2 text-right text-zinc-700 dark:text-zinc-300">
                      {it.volume_ml?.toFixed(0)}
                    </td>
                    <td className="p-2 text-right text-zinc-500">
                      {(it.confidence * 100).toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
