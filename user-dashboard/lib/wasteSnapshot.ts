import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { classifyItem } from "@/lib/classifier";
import { docClient } from "@/lib/dynamodb";

export type WasteItem = {
  id: string;
  item_name: string;
  volume: number;
  timestamp: string;
};

const FEED_LIMIT = 100;

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    if (!(key in obj)) continue;
    const v = obj[key];
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (s.length > 0) return s;
  }
  return undefined;
}

/** Parse Dynamo / JSON numbers, numeric strings, BigInt, or raw `{ N: "1.2" }` shapes. */
function coerceNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (Array.isArray(value) && value.length === 1) {
    return coerceNumber(value[0]);
  }
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  if (typeof value === "string") {
    const t = value.trim().replace(/,/g, "");
    if (t === "") return undefined;
    const n = Number.parseFloat(t);
    return Number.isFinite(n) ? n : undefined;
  }
  if (typeof value === "object" && value !== null && "N" in (value as object)) {
    return coerceNumber((value as { N?: unknown }).N);
  }
  if (typeof value === "object" && value !== null && "S" in (value as object)) {
    return coerceNumber((value as { S?: unknown }).S);
  }
  return undefined;
}

const MAX_GRAPH_NODES = 400;

/** BFS nested maps + arrays + JSON-in-string blobs (common with S3→Lambda→Dynamo pipelines). */
function collectNestedGraph(root: Record<string, unknown>): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const seen = new WeakSet<object>();
  const queue: Record<string, unknown>[] = [root];
  let count = 0;

  while (queue.length > 0 && count < MAX_GRAPH_NODES) {
    const obj = queue.shift()!;
    if (seen.has(obj)) continue;
    seen.add(obj);
    out.push(obj);
    count++;

    for (const v of Object.values(obj)) {
      if (typeof v === "string") {
        const t = v.trim();
        if (t.startsWith("{") && t.includes(":")) {
          try {
            const parsed = JSON.parse(t) as unknown;
            if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
              queue.push(parsed as Record<string, unknown>);
            }
          } catch {
            /* not JSON */
          }
        }
        continue;
      }
      if (v === null || typeof v !== "object") continue;
      if (Array.isArray(v)) {
        for (const el of v) {
          if (el !== null && typeof el === "object" && !Array.isArray(el)) {
            queue.push(el as Record<string, unknown>);
          }
        }
        continue;
      }
      queue.push(v as Record<string, unknown>);
    }
  }
  return out;
}

/** Generic numeric fields — only if no volume-like key matched. */
const WEAK_VOLUME_KEYS = ["amount", "size", "value", "mass", "Mass"];

function pickFirstDefinedNumber(obj: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    if (!(key in obj)) continue;
    const n = coerceNumber(obj[key]);
    if (n !== undefined) return n;
  }
  return undefined;
}

const STRONG_VOLUME_KEYS = [
  "volume",
  "Volume",
  "VOLUME",
  "vol",
  "Vol",
  "cm3",
  "CM3",
  "size_cm3",
  "volume_cm3",
  "volumeCm3",
  "VolumeCm3",
  "cubic_cm",
  "cubicCm",
  "estimated_volume",
  "estimatedVolume",
  "bin_volume",
  "binVolume",
  "item_volume",
  "itemVolume",
  "object_volume",
  "detection_volume",
  "sizeCm3",
  "SizeCm3",
  "volume_liters",
  "volumeLiters",
];

/** How strongly an attribute name suggests "volume in cm³ / physical size". */
function scoreVolumeKeyName(key: string, custom?: string): number {
  const k = key.trim();
  if (!k) return 0;
  if (custom && k === custom) return 110;
  if (/^volume$/i.test(k)) return 100;
  if (/^vol$/i.test(k)) return 96;
  if (/volume/i.test(k) && !/pervol|revol/i.test(k)) return 90;
  if (/cm³|cm3|mm3|mm³|\bcc\b|cubic|centimet/i.test(k)) return 86;
  if (/size[_]?(cm|mm|3|³)/i.test(k) || /(cm|mm)[_.]?size/i.test(k)) return 80;
  return 0;
}

/**
 * Prefer the best-scoring numeric field anywhere in the item graph so nested / oddly
 * named Dynamo attributes still surface (fixes feed showing 0 while totals pick up scraps).
 */
function pickVolume(raw: Record<string, unknown>): number {
  const custom = process.env.DYNAMODB_VOLUME_ATTR?.trim();
  const graph = collectNestedGraph(raw);

  let bestScore = -1;
  let bestVal = 0;

  for (const obj of graph) {
    for (const [k, v] of Object.entries(obj)) {
      const sc = scoreVolumeKeyName(k, custom);
      if (sc <= 0) continue;
      const n = coerceNumber(v);
      if (n === undefined) continue;
      if (sc > bestScore) {
        bestScore = sc;
        bestVal = n;
      } else if (sc === bestScore) {
        if (bestVal === 0 && n !== 0) bestVal = n;
        else if (bestVal !== 0 && n !== 0) bestVal = Math.max(bestVal, n);
      }
    }
  }

  if (bestScore >= 80) return bestVal;

  // Explicit allow-list (handles keys that do not match regexes, e.g. `V` only — unlikely)
  for (const obj of graph) {
    const hit = pickFirstDefinedNumber(obj, custom ? [custom, ...STRONG_VOLUME_KEYS] : STRONG_VOLUME_KEYS);
    if (hit !== undefined) return hit;
  }

  // Loose: any key that looks volume-adjacent
  for (const obj of graph) {
    for (const [k, v] of Object.entries(obj)) {
      const kl = k.toLowerCase();
      const loose =
        kl === "volume" ||
        kl === "vol" ||
        kl.includes("cm3") ||
        kl.includes("cubic") ||
        kl.endsWith("_volume") ||
        kl.endsWith("_vol") ||
        kl.startsWith("volume_") ||
        kl.startsWith("vol_");
      if (!loose) continue;
      const n = coerceNumber(v);
      if (n !== undefined) return n;
    }
  }

  for (const obj of graph) {
    const weak = pickFirstDefinedNumber(obj, WEAK_VOLUME_KEYS);
    if (weak !== undefined) return weak;
  }
  return 0;
}

function pickTimestamp(obj: Record<string, unknown>): string {
  for (const key of [
    "timestamp",
    "Timestamp",
    "created_at",
    "CreatedAt",
    "time",
    "ts",
    "date",
    "Date",
    "insertedAt",
  ] as const) {
    const v = obj[key];
    if (typeof v === "number" && Number.isFinite(v)) {
      const ms = v > 1e12 ? v : v * 1000;
      return new Date(ms).toISOString();
    }
  }

  const s =
    pickString(obj, [
      "timestamp",
      "Timestamp",
      "created_at",
      "CreatedAt",
      "time",
      "ts",
      "date",
      "Date",
      "insertedAt",
    ]) ?? "";
  if (!s) return new Date(0).toISOString();
  const asNum = Number(s);
  if (Number.isFinite(asNum) && asNum > 1_000_000_000_000) {
    return new Date(asNum).toISOString();
  }
  if (Number.isFinite(asNum) && asNum > 1_000_000_000) {
    return new Date(asNum * 1000).toISOString();
  }
  const t = Date.parse(s);
  if (Number.isFinite(t)) return new Date(t).toISOString();
  return new Date(0).toISOString();
}

/** Map Dynamo / pipeline rows to the shape the UI expects. */
export function normalizeRawItem(raw: Record<string, unknown>, index: number): WasteItem {
  const item_name =
    pickString(raw, [
      "item_name",
      "itemName",
      "name",
      "Name",
      "label",
      "object",
      "detection",
      "trash_type",
      "trashType",
      "item",
      "title",
      "class_name",
      "className",
    ]) ?? "Unknown item";

  const volume = pickVolume(raw);

  const timestamp = pickTimestamp(raw);

  const explicitId = pickString(raw, [
    "id",
    "ID",
    "uuid",
    "UUID",
    "detection_id",
    "detectionId",
    "item_id",
    "itemId",
  ]);
  const pk = pickString(raw, ["pk", "PK"]);
  const sk = pickString(raw, ["sk", "SK"]);
  const composite = [pk, sk].filter(Boolean).join("#");
  const id =
    explicitId ||
    composite ||
    `row-${index}-${String(timestamp)}-${item_name.slice(0, 24)}`;

  return { id, item_name, volume, timestamp };
}

async function scanAllRaw(tableName: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey,
      })
    );
    for (const row of result.Items ?? []) {
      out.push(row as Record<string, unknown>);
    }
    ExclusiveStartKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);
  return out;
}

export type WasteSnapshot = {
  items: WasteItem[];
  totalVolume: string;
  totalItems: number;
  /** Counts over the full table scan (not the feed slice). */
  trashCount: number;
  recycleCount: number;
  compostCount: number;
  specialRecyclingCount: number;
  textileRecycleCount: number;
};

/** One paginated scan — use for dashboard so feed + totals stay in sync. */
export async function getWasteSnapshot(): Promise<WasteSnapshot> {
  const table = process.env.DYNAMODB_TABLE_NAME?.trim();
  if (!table) {
    throw new Error(
      "DYNAMODB_TABLE_NAME is not set. Add it to .env.local (copy from .env.example) and restart `npm run dev`."
    );
  }

  const raw = await scanAllRaw(table);
  const normalized = raw.map((row, i) => normalizeRawItem(row, i));
  const totalVolume = normalized.reduce((sum, x) => sum + x.volume, 0);

  let trashCount = 0;
  let recycleCount = 0;
  let compostCount = 0;
  let specialRecyclingCount = 0;
  let textileRecycleCount = 0;
  for (const row of normalized) {
    const cat = classifyItem(row.item_name).category;
    switch (cat) {
      case "trash":
        trashCount += 1;
        break;
      case "recycle":
        recycleCount += 1;
        break;
      case "compost":
        compostCount += 1;
        break;
      case "special_recycling":
        specialRecyclingCount += 1;
        break;
      case "textile_recycle":
        textileRecycleCount += 1;
        break;
    }
  }

  const totalItems =
    trashCount +
    recycleCount +
    compostCount +
    specialRecyclingCount +
    textileRecycleCount;

  const sorted = [...normalized].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return {
    items: sorted.slice(0, FEED_LIMIT),
    totalVolume: totalVolume.toFixed(2),
    totalItems,
    trashCount,
    recycleCount,
    compostCount,
    specialRecyclingCount,
    textileRecycleCount,
  };
}
