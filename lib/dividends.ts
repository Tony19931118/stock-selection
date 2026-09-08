import { unstable_cache } from "next/cache";

export type Dividend = {
  code: string;
  name: string;
  dividendYear: string;
  cashDividend: number;
  stockDividend: number;
  exDividendDate: string;
  paymentDate: string;
};

export type DividendResponse = {
  results: Dividend[];
  updatedAt: string;
  source: string;
};

export const DIVIDEND_SOURCE_URL = "https://5850web.moneydj.com/z/ze/zeb/zeb.djhtm";
const REQUEST_TIMEOUT = 12_000;

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { Accept: "text/html", "User-Agent": "stock-selection/0.1" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });
  if (!response.ok) throw new Error(`股利資料來源回應 ${response.status}`);
  const buffer = await response.arrayBuffer();
  return new TextDecoder("big5").decode(buffer);
}

function numberValue(value: string) {
  const number = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(number) ? number : 0;
}

function cleanCell(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, "")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDividends(html: string): Dividend[] {
  const currentYear = String(new Date().getFullYear());
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];

  return rows.flatMap(([, rowHtml]) => {
    const cells = [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)]
      .map(([, cell]) => cleanCell(cell));
    const link = rowHtml.match(/Link2Stk\('([^']+)'\)[^>]*>([^<]+)</i)
      ?? rowHtml.match(/GenLink2stk\('AS?([^']+)','([^']+)'\)/i);
    if (!link || cells.length < 10) return [];

    const code = link[1];
    const name = cleanCell(link[2]).replace(new RegExp(`^${code}`), "");
    const datePattern = /^\d{4}\/\d{2}\/\d{2}$/;
    return [{
      code,
      name,
      dividendYear: currentYear,
      cashDividend: numberValue(cells[4]),
      stockDividend: numberValue(cells[9]),
      exDividendDate: datePattern.test(cells[1]) ? cells[1] : "",
      paymentDate: cells[5],
    }];
  });
}

async function fetchDividends(): Promise<DividendResponse> {
  const html = await fetchHtml(DIVIDEND_SOURCE_URL);
  return {
    results: parseDividends(html),
    updatedAt: new Date().toISOString(),
    source: DIVIDEND_SOURCE_URL,
  };
}

export function getDividends() {
  return unstable_cache(fetchDividends, ["current-dividends"], {
    revalidate: 900,
  })();
}
