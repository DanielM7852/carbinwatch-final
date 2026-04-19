import { NextResponse } from "next/server";
import { getWasteSnapshotCached } from "@/lib/wasteSnapshotCache";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { totalVolume, totalItems } = await getWasteSnapshotCached();
    return NextResponse.json(
      { totalVolume, totalItems },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
