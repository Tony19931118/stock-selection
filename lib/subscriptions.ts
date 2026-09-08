import { unstable_cache } from "next/cache";

export type Subscription = {
  lotteryDate: string;
  code: string;
  name: string;
  market: string;
  subscriptionPeriod: string;
  allocationDate: string;
  shares: number | null;
  underwritingShares: number | null;
  qualifiedApplications: number | null;
  subscriptionPrice: number | null;
  marketPrice: number | null;
  profit: number | null;
  returnRate: number | null;
  lotteryRate: number | null;
  expectedValue: number | null;
  status: string;
};

export type SubscriptionResponse = {
  results: Subscription[];
  updatedAt: string;
  source: string;
};

const SOURCE_URL = "https://histock.tw/stock/public.aspx";
const REQUEST_TIMEOUT = 12_000;

function decodeHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(value: string) {
  const normalized = value.replace(/,/g, "").replace(/%/g, "").trim();
  if (!normalized || normalized === "-" || normalized === "—") return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function getSubscriptionStatus(period: string, fallback: string, referenceDate = new Date()) {
  const match = period.match(/^(\d{2})\/(\d{2})~(\d{2})\/(\d{2})$/);
  if (!match) return fallback;

  const [, startMonth, startDay, endMonth, endDay] = match;
  const year = referenceDate.getFullYear();
  const start = new Date(year, Number(startMonth) - 1, Number(startDay));
  const end = new Date(year, Number(endMonth) - 1, Number(endDay));
  const today = new Date(year, referenceDate.getMonth(), referenceDate.getDate());

  if (start > today) return "";
  if (today > end) return "已截止";
  if (today.getTime() === end.getTime()) return "截止日";
  return "申購中";
}

function parseRows(html: string): Subscription[] {
  const table = html.match(/<table[^>]*\bid=["']CPHB1_gv["'][^>]*>([\s\S]*?)<\/table>/i)?.[1];
  if (!table) throw new Error("申購資料表格格式異常");

  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match) => [...match[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((cell) => decodeHtml(cell[1])));

  const dataRows = rows.filter((row) => row.length >= 14 && /^\d{4}\/\d{2}\/\d{2}$/.test(row[0]));
  if (!dataRows.length) throw new Error("申購資料目前沒有可解析的項目");

  return dataRows.map((row) => {
    const stock = row[1].match(/^(\d{4,6})\s+(.+)$/);
    const profit = parseNumber(row[8]);
    const lotteryRate = parseNumber(row[12]);
    const expectedValue =
      profit !== null && lotteryRate !== null
        ? (profit * lotteryRate) / 100 - 20
        : null;

    return {
      lotteryDate: row[0],
      code: stock?.[1] ?? row[1],
      name: stock?.[2] ?? "",
      market: row[2],
      subscriptionPeriod: row[3],
      allocationDate: row[4],
      underwritingShares: parseNumber(row[5]),
      subscriptionPrice: parseNumber(row[6]),
      marketPrice: parseNumber(row[7]),
      profit,
      returnRate: parseNumber(row[9]),
      shares: parseNumber(row[10]),
      qualifiedApplications: parseNumber(row[11]),
      lotteryRate,
      expectedValue,
      status: getSubscriptionStatus(row[3], row[13] || "已截止"),
    };
  });
}

async function fetchSubscriptions(): Promise<SubscriptionResponse> {
  const response = await fetch(SOURCE_URL, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "stock-selection/0.1 (subscription calendar)",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });
  if (!response.ok) throw new Error(`申購資料來源回應 ${response.status}`);

  const html = await response.text();
  return {
    results: parseRows(html),
    updatedAt: new Date().toISOString(),
    source: SOURCE_URL,
  };
}

export function getSubscriptions() {
  return unstable_cache(fetchSubscriptions, ["public-subscriptions"], {
    revalidate: 600,
  })();
}
