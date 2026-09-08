import { NextResponse } from "next/server";
import { getSubscriptions } from "../../../lib/subscriptions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await getSubscriptions();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate=60" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "無法取得申購資料";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
