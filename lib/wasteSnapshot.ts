import { ScanCommand } from "@aws-sdk/lib-dynamodb";
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
  return undefined;
}

/** Records that often wrap IoT / Lambda payloads (plus any object-valued attribute). */
function nestedObjects(raw: Record<string, unknown>): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [raw];
  for (const key of [
    "data",
    "payload",
    "body",
    "item",
    "attributes",
    "message",
    "record",
    "detail",
    "metadata",
    "properties",
    "measurements",
    "readings",
    "values",
  ]) {
    const v = raw[key];
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      out.push(v as Record<string, unknown>);
    }
  }
  for (const v of Object.values(raw)) {
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      out.push(v as Record<string, unknown>);
    }
  }
  return out;
}

const VOLUME_KEYS = [
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
  "amount",
  "size",
  "value",
  "mass",
  "Mass",
];

/** Last resort: attribute names that plausibly mean volume (cm³). */
function pickVolumeLoose(obj: Record<string, unknown>): number | undefined {
  for (const [k, v] of Object.entries(obj)) {
    const kl = k.toLowerCase();
    const looksVolume =
      kl === "volume" ||
      kl === "vol" ||
      kl.includes("cm3") ||
      kl.includes("cubic") ||
      kl.endsWith("_volume") ||
      kl.endsWith("_vol") ||
      kl.startsWith("volume_") ||
      kl.startsWith("vol_");
    if (!looksVolume) continue;
    const n = coerceNumber(v);
    if (n !== undefined) return n;
  }
  return undefined;
}

function pickFirstDefinedNumber(obj: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    if (!(key in obj)) continue;
    const n = coerceNumber(obj[key]);
    if (n !== undefined) return n;
  }
  return undefined;
}

function pickVolume(raw: Record<string, unknown>): number {
  const custom = process.env.DYNAMODB_VOLUME_ATTR?.trim();
  const keys = custom ? [custom, ...VOLUME_KEYS.filter((k) => k !== custom)] : VOLUME_KEYS;

  for (const obj of nestedObjects(raw)) {
    const hit = pickFirstDefinedNumber(obj, keys);
    if (hit !== undefined) return hit;
    const loose = pickVolumeLoose(obj);
    if (loose !== undefined) return loose;
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
};

/** One paginated scan — use for dashboard so feed + totals stay in sync. */
export async function getWasteSnapshot(): Promise<WasteSnapshot> {
  const table = process.env.DYNAMODB_TABLE_NAME;
  if (!table) {
    throw new Error("DYNAMODB_TABLE_NAME is not set");
  }

  const raw = await scanAllRaw(table);
  const normalized = raw.map((row, i) => normalizeRawItem(row, i));
  const totalVolume = normalized.reduce((sum, x) => sum + x.volume, 0);
  const totalItems = normalized.length;
  const sorted = [...normalized].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return {
    items: sorted.slice(0, FEED_LIMIT),
    totalVolume: totalVolume.toFixed(2),
    totalItems,
  };
}
