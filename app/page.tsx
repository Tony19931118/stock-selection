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
type View = "stocks" | "subscriptions" | "dividends";
type Subscription = {
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
type SubscriptionColumnKey =
  | "lotteryDate"
  | "stock"
  | "market"
  | "subscriptionPeriod"
  | "allocationDate"
  | "underwritingShares"
  | "subscriptionPrice"
  | "marketPrice"
  | "profit"
  | "returnRate"
  | "shares"
  | "qualifiedApplications"
  | "lotteryRate"
  | "expectedValue"
  | "status";

const SUBSCRIPTION_COLUMNS: { key: SubscriptionColumnKey; label: string }[] = [
  { key: "lotteryDate", label: "抽籤日期" },
  { key: "stock", label: "股票代號名稱" },
  { key: "market", label: "市場" },
  { key: "subscriptionPeriod", label: "申購期間" },
  { key: "allocationDate", label: "撥券日" },
  { key: "underwritingShares", label: "承銷張數" },
  { key: "subscriptionPrice", label: "承銷價" },
  { key: "marketPrice", label: "市價" },
  { key: "profit", label: "獲利" },
  { key: "returnRate", label: "報酬率" },
  { key: "shares", label: "申購張數" },
  { key: "qualifiedApplications", label: "總合格件" },
  { key: "lotteryRate", label: "中籤率" },
  { key: "expectedValue", label: "目前期望值" },
  { key: "status", label: "狀態" },
];
const DEFAULT_SUBSCRIPTION_COLUMNS: SubscriptionColumnKey[] = [
  "lotteryDate", "stock", "subscriptionPeriod", "allocationDate",
  "subscriptionPrice", "marketPrice", "profit", "returnRate", "shares",
  "lotteryRate", "expectedValue", "status",
];
type Dividend = {
  code: string;
  name: string;
  dividendYear: string;
  cashDividend: number;
  stockDividend: number;
  exDividendDate: string;
  paymentDate: string;
};
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

function formatDividendDate(value: string) {
  const match = value.match(/^\d{2,4}\/(\d{2})\/(\d{2})$/);
  return match ? `${match[1]}/${match[2]}` : value;
}

function dividendDateValue(value: string) {
  const match = value.match(/^(\d{2,4})\/(\d{2})\/(\d{2})$/);
  if (!match) return Number.POSITIVE_INFINITY;
  const year = Number(match[1]) < 1911 ? Number(match[1]) + 1911 : Number(match[1]);
  return new Date(year, Number(match[2]) - 1, Number(match[3])).getTime();
}

function hasNoPastDividendDate(item: Dividend) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exDividendDate = item.exDividendDate ? dividendDateValue(item.exDividendDate) : null;
  const paymentDate = item.paymentDate ? dividendDateValue(item.paymentDate) : null;
  return (exDividendDate === null || exDividendDate > today.getTime())
    && (paymentDate === null || paymentDate >= today.getTime());
}

function SidePanel({
  activeView,
  onChange,
}: {
  activeView: View;
  onChange: (view: View) => void;
}) {
  const items: { view: View; icon: string; label: string }[] = [
    { view: "stocks", icon: "⌕", label: "智慧選股" },
    { view: "subscriptions", icon: "▣", label: "申購資訊" },
    { view: "dividends", icon: "▤", label: "股利資訊" },
  ];

  return (
    <aside className="side-panel">
      <div className="brand">
        <div>
          <strong>台股資料站</strong>
          <span>MARKET DESK</span>
        </div>
      </div>
      <nav aria-label="主要功能">
        <span className="side-panel-title">功能選單</span>
        {items.map((item) => (
          <button
            key={item.view}
            className={`side-nav-item ${activeView === item.view ? "active" : ""}`}
            onClick={() => onChange(item.view)}
            aria-current={activeView === item.view ? "page" : undefined}
          >
            <span className="side-nav-icon" aria-hidden="true">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
      <p className="side-panel-note">資料僅供參考，不構成投資建議。</p>
    </aside>
  );
}

function SubscriptionsView() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [updatedAt, setUpdatedAt] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "申購中" | "截止日" | "已截止" | "尚未開始">("all");
  const [visibleColumns, setVisibleColumns] = useState<SubscriptionColumnKey[]>(
    DEFAULT_SUBSCRIPTION_COLUMNS,
  );

  const loadSubscriptions = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/subscriptions", { cache: "no-store" });
      const data = (await response.json()) as {
        results?: Subscription[];
        updatedAt?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "無法取得申購資料");
      setSubscriptions(data.results ?? []);
      setUpdatedAt(data.updatedAt ?? "");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法取得申購資料");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSubscriptions();
  }, [loadSubscriptions]);

  const renderCell = (item: Subscription, key: SubscriptionColumnKey) => {
    switch (key) {
      case "stock": return <><strong>{item.code}</strong> {item.name}</>;
      case "underwritingShares": return item.underwritingShares?.toLocaleString("zh-TW") ?? "-";
      case "subscriptionPrice": return item.subscriptionPrice?.toLocaleString("zh-TW") ?? "-";
      case "marketPrice": return item.marketPrice?.toLocaleString("zh-TW") ?? "-";
      case "profit": return item.profit?.toLocaleString("zh-TW") ?? "-";
      case "returnRate": return item.returnRate === null ? "-" : `${item.returnRate.toFixed(1)}%`;
      case "shares": return item.shares?.toLocaleString("zh-TW") ?? "-";
      case "qualifiedApplications": return item.qualifiedApplications?.toLocaleString("zh-TW") ?? "-";
      case "lotteryRate": return item.lotteryRate === null ? "-" : `${item.lotteryRate.toFixed(2)}%`;
      case "expectedValue":
        return item.expectedValue === null ? "-" : (
          <span className={item.expectedValue >= 0 ? "expected-positive" : "expected-negative"}>
            {item.expectedValue.toLocaleString("zh-TW", { maximumFractionDigits: 2 })}
          </span>
        );
      case "status":
        if (!item.status) return null;
        return (
          <span className={`panel-badge subscription-status ${
            item.status === "申購中" ? "is-open" : item.status === "截止日" ? "is-closing" : item.status === "已截止" ? "is-closed" : ""
          }`}>{item.status}</span>
        );
      case "lotteryDate": return item.lotteryDate;
      case "market": return item.market;
      case "subscriptionPeriod": return item.subscriptionPeriod;
      case "allocationDate": return item.allocationDate;
    }
  };

  const filteredSubscriptions = subscriptions.filter((item) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "尚未開始") return item.status === "";
    return item.status === statusFilter;
  });

  return (
    <>
      <header className="topbar">
        <div>
          <span className="eyebrow">MARKET CALENDAR</span>
          <h1>申購資訊</h1>
          <p>掌握近期公開申購與抽籤時程</p>
        </div>
        <div className="top-actions">
          <span className="date-label">
            {updatedAt ? `更新於 ${new Date(updatedAt).toLocaleString("zh-TW")}` : "資料載入中"}
          </span>
          <button className="refresh-button" onClick={() => void loadSubscriptions()} disabled={isLoading}>
            <Icon>↻</Icon>
            {isLoading ? "更新中" : "重新整理"}
          </button>
        </div>
      </header>
      <section className="info-panel">
        <div className="panel-heading">
          <div>
            <h2>近期申購</h2>
            <p>依申購截止日排序，協助掌握市場申購機會。</p>
          </div>
          <div className="panel-heading-actions">
            <details className="column-settings">
              <summary>欄位設定</summary>
              <div className="column-menu">
                {SUBSCRIPTION_COLUMNS.map((column) => (
                  <label key={column.key}>
                    <input
                      type="checkbox"
                      checked={visibleColumns.includes(column.key)}
                      onChange={() => setVisibleColumns((current) =>
                        current.includes(column.key)
                          ? current.filter((key) => key !== column.key)
                          : [...current, column.key],
                      )}
                    />
                    {column.label}
                  </label>
                ))}
              </div>
            </details>
            <div className="panel-heading-actions">
              <label className="subscription-filter">
                狀態
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
                  <option value="all">全部</option>
                  <option value="尚未開始">尚未開始</option>
                  <option value="申購中">申購中</option>
                  <option value="截止日">截止日</option>
                  <option value="已截止">已截止</option>
                </select>
              </label>
              <span className="panel-badge">{filteredSubscriptions.length} 筆</span>
            </div>
          </div>
        </div>
        {error && <div className="error-banner">{error}，請稍後重試。</div>}
        <div className="info-table-wrap">
          {isLoading ? (
            <div className="info-empty compact"><span className="loading-spinner" /><strong>正在取得申購資料…</strong></div>
          ) : filteredSubscriptions.length === 0 && !error ? (
            <div className="info-empty compact"><span className="info-empty-icon">▣</span><strong>目前沒有申購資料</strong></div>
          ) : (
            <table className="info-table subscription-table">
              <thead>
                <tr>{visibleColumns.map((key) => <th key={key}>{SUBSCRIPTION_COLUMNS.find((column) => column.key === key)?.label}</th>)}</tr>
              </thead>
              <tbody>
                {filteredSubscriptions.map((item) => (
                  <tr key={`${item.code}-${item.lotteryDate}`}>
                    {visibleColumns.map((key) => <td key={key}>{renderCell(item, key)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="data-source-note">資料來源：HiStock 公開申購／股票抽籤日程表，伺服器每 10 分鐘更新一次。</p>
      </section>
    </>
  );
}

function DividendsView() {
  const [dividends, setDividends] = useState<Dividend[]>([]);
  const [query, setQuery] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [source, setSource] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDividends = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/dividends", { cache: "no-store" });
      const data = (await response.json()) as { results?: Dividend[]; updatedAt?: string; source?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "無法取得股利資料");
      setDividends(data.results ?? []);
      setUpdatedAt(data.updatedAt ?? "");
      setSource(data.source ?? "");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法取得股利資料");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDividends();
  }, [loadDividends]);

  const filteredDividends = [...dividends]
    .sort((a, b) =>
      (b.cashDividend + b.stockDividend) - (a.cashDividend + a.stockDividend)
      || b.cashDividend - a.cashDividend
      || b.stockDividend - a.stockDividend
      || dividendDateValue(a.paymentDate) - dividendDateValue(b.paymentDate),
    )
    .filter(hasNoPastDividendDate)
    .filter((item) =>
    `${item.code}${item.name}`.includes(query.trim()),
    );

  return (
    <>
      <header className="topbar">
        <div>
          <span className="eyebrow">DIVIDEND OVERVIEW</span>
          <h1>股利資訊</h1>
          <p>查看上市公司今年度除權息與股利發放資訊</p>
        </div>
        <div className="top-actions">
          <span className="date-label">
            {updatedAt ? `更新於 ${new Date(updatedAt).toLocaleString("zh-TW")}` : "資料載入中"}
          </span>
          <button className="refresh-button" onClick={() => void loadDividends()} disabled={isLoading}>
            <Icon>↻</Icon>{isLoading ? "更新中" : "重新整理"}
          </button>
        </div>
      </header>
      <section className="info-panel">
        <div className="panel-heading">
          <div>
            <h2>2026 年股利資訊</h2>
            <p>可依股票代號或名稱搜尋，並查看現金股利與除息日期。</p>
          </div>
          <span className="panel-badge">{filteredDividends.length} 筆</span>
        </div>
        <div className="dividend-toolbar">
          <label className="search">
            <Icon>⌕</Icon>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋股票代號或名稱" />
          </label>
        </div>
        {error && <div className="error-banner">{error}，請稍後重試。</div>}
        <div className="info-table-wrap">
          {isLoading ? (
            <div className="info-empty compact"><span className="loading-spinner" /><strong>正在取得股利資料…</strong></div>
          ) : filteredDividends.length === 0 && !error ? (
            <div className="info-empty compact"><span className="info-empty-icon">▤</span><strong>查無股利資料</strong></div>
          ) : (
            <table className="info-table dividend-table">
              <thead><tr><th>股票代號</th><th>股票名稱</th><th>現金股利</th><th>股票股利</th><th>除息日</th><th>發放日</th></tr></thead>
              <tbody>{filteredDividends.map((item) => (
                <tr key={`${item.code}-${item.dividendYear}`}>
                  <td>{item.code}</td><td><strong>{item.name}</strong></td>
                  <td className={item.cashDividend >= 2 ? "dividend-highlight" : undefined}>{item.cashDividend.toFixed(2)}</td>
                  <td className={item.stockDividend >= 1 ? "dividend-red" : undefined}>{item.stockDividend.toFixed(2)}</td>
                  <td>{formatDividendDate(item.exDividendDate || "-")}</td>
                  <td>{formatDividendDate(item.paymentDate || "-")}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
        <p className="data-source-note">
          資料來源：<a href={source} target="_blank" rel="noreferrer">{source || "MoneyDJ"}</a>
          ，伺服器每 15 分鐘更新一次。發放日若官方資料未提供則顯示「-」。
        </p>
      </section>
    </>
  );
}

export default function Home() {
  const [activeView, setActiveView] = useState<View>("stocks");
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
      <SidePanel activeView={activeView} onChange={setActiveView} />
      <section className="content">
        {activeView === "subscriptions" ? (
          <SubscriptionsView />
        ) : activeView === "dividends" ? (
          <DividendsView />
        ) : (
          <>
        <header className="topbar">
          <div>
            <h1>智慧選股</h1>
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
          </>
        )}
      </section>
    </main>
  );
}
