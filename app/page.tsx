"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Stock = {
  code: string;
  name: string;
  price: number;
  high: number;
  low: number;
  midpoint: number;
  difference: number;
  volume: number;
  quoteTime: string;
  status?: "處置" | "暫停交易";
};

type SortKey = "difference" | "volume";
type SortDirection = "asc" | "desc";
const PAGE_SIZES = [10, 25, 50] as const;
const PERIODS = [
  { months: 6, label: "半年" },
  { months: 12, label: "一年" },
] as const;

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <span className="icon" aria-hidden="true">
      {children}
    </span>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [processed, setProcessed] = useState(0);
  const [failed, setFailed] = useState(0);
  const [updatedAt, setUpdatedAt] = useState("");
  const [error, setError] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("difference");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [months, setMonths] = useState<6 | 12>(12);
  const [maxPrice, setMaxPrice] = useState<"all" | "100">("all");
  const [minDifference, setMinDifference] = useState<"all" | "50">("all");
  const [isFiltering, setIsFiltering] = useState(false);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(10);
  const [page, setPage] = useState(1);

  const loadStocks = useCallback(async () => {
    setIsRefreshing(true);
    setError("");
    try {
      const response = await fetch(`/api/stocks?months=${months}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as {
        results?: Stock[];
        processed?: number;
        failed?: number;
        updatedAt?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "無法取得市場資料");
      setStocks(data.results ?? []);
      setProcessed(data.processed ?? 0);
      setFailed(data.failed ?? 0);
      setUpdatedAt(data.updatedAt ?? "");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法取得市場資料");
    } finally {
      setIsRefreshing(false);
    }
  }, [months]);

  useEffect(() => {
    void loadStocks();
  }, [loadStocks]);

  const results = useMemo(
    () =>
      stocks
        .filter((stock) => `${stock.code}${stock.name}`.includes(query.trim()))
        .filter((stock) => stock.difference > 0)
        .filter((stock) => maxPrice === "all" || stock.price <= Number(maxPrice))
        .filter((stock) => minDifference === "all" || stock.difference >= Number(minDifference))
        .sort((a, b) => {
          const aValue = a[sortKey];
          const bValue = b[sortKey];
          const difference = aValue - bValue;
          return (
            (sortDirection === "asc" ? difference : -difference) ||
            a.code.localeCompare(b.code)
          );
        }),
    [maxPrice, minDifference, query, sortDirection, sortKey, stocks],
  );

  const totalPages = Math.max(1, Math.ceil(results.length / pageSize));
  const paginatedResults = results.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  useEffect(() => {
    setPage(1);
    setIsFiltering(true);
    const timer = window.setTimeout(() => setIsFiltering(false), 250);
    return () => window.clearTimeout(timer);
  }, [query, pageSize, months, maxPrice, minDifference, sortKey, sortDirection]);
  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, totalPages));
  }, [totalPages]);

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortDirection === "asc" ? "↑" : "↓") : "↕";

  return (
    <main className="shell">
      <section className="content">
        <header className="topbar">
          <div>
            <h1>台股中間值選股</h1>
          </div>
          <div className="top-actions">
            <span className="market-open">
              <i />
              交易中
            </span>
            <span className="date-label">
              {updatedAt
                ? new Date(updatedAt).toLocaleDateString("zh-TW")
                : "載入中"}
            </span>
            <button
              className="refresh-button"
              onClick={() => void loadStocks()}
              disabled={isRefreshing}
            >
              <Icon>↻</Icon>
              {isRefreshing ? "更新中" : "重新整理"}
            </button>
          </div>
        </header>

        <section className="metrics">
          <div className="metric-card">
            <span className="metric-label">符合條件</span>
            <strong>
              {results.length}
              <small> 檔</small>
            </strong>
            <span className="metric-trend positive">
              ↑ 12.5% <em>較昨日</em>
            </span>
          </div>
          <div className="metric-card">
            <span className="metric-label">處理股票</span>
            <strong>
              {processed.toLocaleString()}
              <small> 檔</small>
            </strong>
            <span className="metric-sub">上市普通股</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">平均差異幅度</span>
            <strong>
              {results.length
                ? (
                    results.reduce((sum, stock) => sum + stock.difference, 0) /
                    results.length
                  ).toFixed(2)
                : "0.00"}
              <small>%</small>
            </strong>
            <span className="metric-sub">符合條件股票平均</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">資料完整度</span>
            <strong>
              {processed
                ? (((processed - failed) / processed) * 100).toFixed(1)
                : "0.0"}
              <small>%</small>
            </strong>
            <span className="metric-sub">{failed} 檔資料取得失敗</span>
          </div>
        </section>

        <section className="results-panel" id="results">
          {(error || (processed > 0 && failed === processed)) && (
            <div className="error-banner">
              <Icon>!</Icon>
              {error ?? "所有股票行情資料皆無法取得"}，請稍後重試。
            </div>
          )}
          <div className="filters">
            <div className="filter-row filter-row-primary">
              <label className="search">
                <Icon>⌕</Icon>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋股票代號或名稱" />
              </label>
              <label className="filter-select">
                資料區間
                <select className="period-select" value={months} onChange={(event) => setMonths(Number(event.target.value) as 6 | 12)} disabled={isRefreshing}>
                  {PERIODS.map((period) => <option key={period.months} value={period.months}>{period.label}</option>)}
                </select>
              </label>
            </div>
            <div className="filter-row filter-row-secondary">
              <label className="filter-select">
                即時價格
                <select value={maxPrice} onChange={(event) => setMaxPrice(event.target.value as "all" | "100")}>
                  <option value="all">不限</option>
                  <option value="100">100 元以下</option>
                </select>
              </label>
              <label className="filter-select">
                差異百分比
                <select value={minDifference} onChange={(event) => setMinDifference(event.target.value as "all" | "50")}>
                  <option value="all">不限</option>
                  <option value="50">50% 以上</option>
                </select>
              </label>
              <span className="result-count">符合 {results.length} 筆</span>
            </div>
          </div>
          <div className={`table-wrap ${isRefreshing || isFiltering ? "is-loading" : ""}`}>
            {(isRefreshing || isFiltering) && (
              <div className="loading-overlay" role="status" aria-live="polite">
                <span className="loading-spinner" />
                <span>{isRefreshing ? "正在取得市場資料…" : "正在套用查詢條件…"}</span>
              </div>
            )}
            <table>
              <thead>
                <tr>
                  <th>股票代號</th>
                  <th>股票名稱</th>
                  <th>即時成交價</th>
                  <th>
                    <button
                      className="sort-button"
                      onClick={() => {
                        if (sortKey === "volume")
                          setSortDirection((direction) =>
                            direction === "asc" ? "desc" : "asc",
                          );
                        else {
                          setSortKey("volume");
                          setSortDirection("desc");
                        }
                      }}
                    >
                      即時成交量{" "}
                      <span className="sort-arrow">
                        {sortIndicator("volume")}
                      </span>
                    </button>
                  </th>
                  <th>{months === 12 ? "一年" : "半年"}高點</th>
                  <th>{months === 12 ? "一年" : "半年"}低點</th>
                  <th>中間值</th>
                  <th>
                    <button
                      className="sort-button"
                      onClick={() => {
                        if (sortKey === "difference")
                          setSortDirection((direction) =>
                            direction === "asc" ? "desc" : "asc",
                          );
                        else {
                          setSortKey("difference");
                          setSortDirection("desc");
                        }
                      }}
                    >
                      差異百分比{" "}
                      <span className="sort-arrow">
                        {sortIndicator("difference")}
                      </span>
                    </button>
                  </th>
                  <th>報價時間</th>
                </tr>
              </thead>
              <tbody>
                {paginatedResults.map((stock) => (
                  <tr key={stock.code}>
                    <td className="stock-code">{stock.code}</td>
                    <td className="stock-name">{stock.name}</td>
                    <td className="price">
                      {stock.price.toLocaleString("zh-TW")}
                    </td>
                    <td>{stock.volume.toLocaleString("zh-TW")}</td>
                    <td>{stock.high.toLocaleString("zh-TW")}</td>
                    <td>{stock.low.toLocaleString("zh-TW")}</td>
                    <td>{stock.midpoint.toLocaleString("zh-TW")}</td>
                    <td>
                      <span className="difference">
                        -{stock.difference.toFixed(2)}%
                      </span>
                    </td>
                    <td className="quote-time">
                      <i />
                      {stock.quoteTime}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {results.length === 0 && (
              <div className="empty-state">查無符合條件的股票</div>
            )}
          </div>
          <div className="table-footer">
            <div className="pagination">
              <label>
                每頁{" "}
                <select
                  value={pageSize}
                  onChange={(event) =>
                    setPageSize(
                      Number(event.target.value) as (typeof PAGE_SIZES)[number],
                    )
                  }
                >
                  {PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size} 筆
                    </option>
                  ))}
                </select>
              </label>
              <button
                onClick={() =>
                  setPage((currentPage) => Math.max(1, currentPage - 1))
                }
                disabled={page === 1}
              >
                上一頁
              </button>
              <span>
                第 {page} / {totalPages} 頁
              </span>
              <button
                onClick={() =>
                  setPage((currentPage) =>
                    Math.min(totalPages, currentPage + 1),
                  )
                }
                disabled={page === totalPages}
              >
                下一頁
              </button>
            </div>
          </div>
        </section>
        <footer>本工具僅提供市場資料整理與條件篩選，不構成投資建議。</footer>
      </section>
    </main>
  );
}
