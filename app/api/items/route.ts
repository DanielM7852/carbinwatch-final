import { NextResponse } from "next/server";
import { getWasteSnapshot } from "@/lib/wasteSnapshot";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { items } = await getWasteSnapshot();
    return NextResponse.json(
      { items },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
