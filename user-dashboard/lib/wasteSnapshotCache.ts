import type { WasteSnapshot } from "@/lib/wasteSnapshot";
import { getWasteSnapshot } from "@/lib/wasteSnapshot";

/** How long to reuse a snapshot before scanning DynamoDB again. */
const TTL_MS = 3000;

let cached: { at: number; data: WasteSnapshot } | null = null;
let inflight: Promise<WasteSnapshot> | null = null;

/**
 * One full-table scan can take several seconds and block the Node server. Without this,
 * overlapping polls cause connection resets and the browser shows "Failed to fetch".
 * We return fresh cache within TTL and coalesce concurrent callers onto one scan.
 */
export async function getWasteSnapshotCached(): Promise<WasteSnapshot> {
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) {
    return cached.data;
  }
  if (inflight) {
    return inflight;
  }
  inflight = getWasteSnapshot()
    .then((data) => {
      cached = { at: Date.now(), data };
      return data;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
