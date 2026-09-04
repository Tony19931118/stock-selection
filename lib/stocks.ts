import { unstable_cache } from "next/cache";

export type StockResult = {
  code: string;
  name: string;
  price: number;
  high: number;
  low: number;
  midpoint: number;
  difference: number;
  quoteTime: string;
  peRatio: number | null;
  dividendYield: number | null;
};

type UniverseStock = { code: string; name: string };
type Valuation = { peRatio: number | null; dividendYield: number | null };

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
  const listed = await fetchJson<Array<Record<string, string>>>("https://openapi.twse.com.tw/v1/opendata/t187ap03_L");
  const normalize = (rows: Array<Record<string, string>>) => rows
    .map((row) => ({
      code: row["公司代號"] ?? row["SecuritiesCompanyCode"] ?? row["代號"],
      name: row["公司簡稱"] ?? row["公司名稱"] ?? row["CompanyAbbreviation"] ?? row["名稱"],
    }))
    .filter((stock): stock is UniverseStock => /^\d{4,6}$/.test(stock.code) && !stock.code.startsWith("0") && Boolean(stock.name));

  return normalize(listed)
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

async function getStockResult(stock: UniverseStock, period1: number, period2: number, valuations: Map<string, Valuation>): Promise<StockResult | null> {
  const symbol = `${stock.code}.TW`;
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
  const valuation = valuations.get(stock.code);
  const peRatio = valuation?.peRatio ?? null;
  const dividendYield = valuation?.dividendYield ?? null;
  return { ...stock, price, high, low, midpoint, difference: ((midpoint - price) / midpoint) * 100, quoteTime, peRatio, dividendYield };
}

async function calculateStocks(): Promise<{ results: StockResult[]; processed: number; failed: number; updatedAt: string }> {
  const universe = await getUniverse();
  const valuationRows = await fetchJson<Array<Record<string, string>>>("https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_d");
  const valuations = new Map(valuationRows.map((row) => [row.Code, {
    peRatio: Number.isFinite(Number(row.PEratio)) && row.PEratio !== "" ? Number(row.PEratio) : null,
    dividendYield: Number.isFinite(Number(row.DividendYield)) && row.DividendYield !== "" ? Number(row.DividendYield) : null,
  }]));
  const period2 = Math.floor(Date.now() / 1000);
  const period1 = Math.floor(new Date(new Date().setFullYear(new Date().getFullYear() - 1)).getTime() / 1000);
  const results: StockResult[] = [];
  let failed = 0;

  for (let index = 0; index < universe.length; index += 12) {
    const batch = universe.slice(index, index + 12);
    const batchResults = await Promise.all(batch.map(async (stock) => {
      try { return await getStockResult(stock, period1, period2, valuations); } catch { failed += 1; return null; }
    }));
    results.push(...batchResults.filter((stock): stock is StockResult => stock !== null));
  }

  results.sort((a, b) => b.difference - a.difference || a.code.localeCompare(b.code));
  return { results, processed: universe.length, failed, updatedAt: new Date().toISOString() };
}

export const getStockSelection = unstable_cache(calculateStocks, ["stock-selection-one-year"], {
  revalidate: 300,
});
