import { NextResponse } from "next/server";
import { getStockSelection } from "../../../lib/stocks";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const requestedMonths = Number(new URL(request.url).searchParams.get("months") ?? "12");
    const months = requestedMonths === 6 ? 6 : 12;
    const data = await getStockSelection(months);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "無法取得市場資料";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
