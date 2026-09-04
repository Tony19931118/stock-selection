import { unstable_cache } from "next/cache";

export type Market = "上市" | "上櫃";

export type StockResult = {
  code: string;
  name: string;
  market: Market;
  price: number;
  high: number;
  low: number;
  midpoint: number;
  difference: number;
  quoteTime: string;
};

type UniverseStock = { code: string; name: string; market: Market };

const REQUEST_TIMEOUT = 12_000;
const MAX_SYMBOLS = 2_000;

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "stock-selection/0.1" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });
  if (!response.ok) throw new Error(`資料來源回應 ${response.status}`);
  return response.json() as Promise<T>;
}

async function getUniverse(): Promise<UniverseStock[]> {
  const [listed, otc] = await Promise.all([
    fetchJson<Array<Record<string, string>>>("https://openapi.twse.com.tw/v1/opendata/t187ap03_L"),
    fetchJson<Array<Record<string, string>>>("https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes"),
  ]);

  const normalize = (rows: Array<Record<string, string>>, market: Market) => rows
    .map((row) => ({
      code: row["公司代號"] ?? row["SecuritiesCompanyCode"] ?? row["代號"],
      name: row["公司簡稱"] ?? row["公司名稱"] ?? row["CompanyAbbreviation"] ?? row["名稱"],
      market,
    }))
    .filter((stock): stock is UniverseStock => /^\d{4,6}$/.test(stock.code) && !stock.code.startsWith("0") && Boolean(stock.name));

  return [...normalize(listed, "上市"), ...normalize(otc, "上櫃")]
    .filter((stock, index, all) => all.findIndex((item) => item.code === stock.code) === index)
    .slice(0, MAX_SYMBOLS);
}

type YahooChart = {
  chart?: {
    result?: Array<{
      meta?: { regularMarketPrice?: number; regularMarketTime?: number };
      timestamp?: number[];
      indicators?: { quote?: Array<{ high?: Array<number | null>; low?: Array<number | null> }> };
    }>;
  };
};

async function getStockResult(stock: UniverseStock, period1: number, period2: number): Promise<StockResult | null> {
  const symbol = `${stock.code}.${stock.market === "上市" ? "TW" : "TWO"}`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${period1}&period2=${period2}&interval=1d&events=history`;
  const payload = await fetchJson<YahooChart>(url);
  const result = payload.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const highs = quote?.high?.filter((value): value is number => typeof value === "number") ?? [];
  const lows = quote?.low?.filter((value): value is number => typeof value === "number") ?? [];
  const price = result?.meta?.regularMarketPrice;
  if (!result || !quote || !highs.length || !lows.length || typeof price !== "number") return null;

  const high = Math.max(...highs);
  const low = Math.min(...lows);
  const midpoint = (high + low) / 2;
  if (!(midpoint > 0) || price >= midpoint) return null;

  const quoteTime = result.meta?.regularMarketTime
    ? new Date(result.meta.regularMarketTime * 1000).toLocaleTimeString("zh-TW", { hour12: false })
    : "未知";
  return { ...stock, price, high, low, midpoint, difference: ((midpoint - price) / midpoint) * 100, quoteTime };
}

async function calculateStocks(): Promise<{ results: StockResult[]; processed: number; failed: number; updatedAt: string }> {
  const universe = await getUniverse();
  const period2 = Math.floor(Date.now() / 1000);
  const period1 = Math.floor(new Date(new Date().setMonth(new Date().getMonth() - 6)).getTime() / 1000);
  const results: StockResult[] = [];
  let failed = 0;

  for (let index = 0; index < universe.length; index += 12) {
    const batch = universe.slice(index, index + 12);
    const batchResults = await Promise.all(batch.map(async (stock) => {
      try { return await getStockResult(stock, period1, period2); } catch { failed += 1; return null; }
    }));
    results.push(...batchResults.filter((stock): stock is StockResult => stock !== null));
  }

  results.sort((a, b) => b.difference - a.difference || a.code.localeCompare(b.code));
  return { results, processed: universe.length, failed, updatedAt: new Date().toISOString() };
}

export const getStockSelection = unstable_cache(calculateStocks, ["stock-selection-six-months"], {
  revalidate: 300,
});
