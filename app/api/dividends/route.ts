import { NextResponse } from "next/server";
import { getDividends } from "../../../lib/dividends";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(await getDividends(), {
      headers: { "Cache-Control": "s-maxage=900, stale-while-revalidate=60" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "無法取得股利資料";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
