"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Stock = {
  code: string;
  name: string;
  market: "上市" | "上櫃";
  price: number;
  high: number;
  low: number;
  midpoint: number;
  difference: number;
  quoteTime: string;
  status?: "處置" | "暫停交易";
};

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="icon" aria-hidden="true">{children}</span>;
}

export default function Home() {
  const [market, setMarket] = useState<"全部市場" | "上市" | "上櫃">("全部市場");
  const [query, setQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [processed, setProcessed] = useState(0);
  const [failed, setFailed] = useState(0);
  const [updatedAt, setUpdatedAt] = useState("");
  const [error, setError] = useState("");

  const loadStocks = useCallback(async () => {
    setIsRefreshing(true);
    setError("");
    try {
      const response = await fetch("/api/stocks", { cache: "no-store" });
      const data = await response.json() as { results?: Stock[]; processed?: number; failed?: number; updatedAt?: string; error?: string };
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
  }, []);

  useEffect(() => { void loadStocks(); }, [loadStocks]);

  const results = useMemo(() => stocks
    .filter((stock) => market === "全部市場" || stock.market === market)
    .filter((stock) => `${stock.code}${stock.name}`.includes(query.trim()))
    .filter((stock) => stock.difference > 0)
    .sort((a, b) => b.difference - a.difference), [market, query]);

  const exportExcel = () => {
    const header = "股票代號,股票名稱,市場,即時價格,半年最高價,半年最低價,中間值,差異百分比,報價時間\n";
    const rows = results.map((stock) =>
      [stock.code, stock.name, stock.market, stock.price, stock.high, stock.low, stock.midpoint, `${stock.difference.toFixed(2)}%`, stock.quoteTime].join(","),
    ).join("\n");
    const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `台股選股結果-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">S</div><div><strong>StockScope</strong><span>台股選股工具</span></div></div>
        <nav className="nav">
          <a className="active" href="#results"><Icon>⌁</Icon>中間值選股</a>
          <a href="#data"><Icon>◫</Icon>市場資料</a>
          <a href="#settings"><Icon>⚙</Icon>設定</a>
        </nav>
        <div className="sidebar-bottom"><div className="status-dot"><i />{error ? "資料來源異常" : "資料來源正常"}</div><small>TWSE / TPEx<br />最後同步 {updatedAt ? new Date(updatedAt).toLocaleTimeString("zh-TW") : "載入中"}</small></div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><div className="eyebrow">MARKET SCREENER</div><h1>台股中間值選股</h1><p>找出目前成交價低於近半年高低點中間值的股票</p></div>
          <div className="top-actions"><span className="market-open"><i />交易中</span><span className="date-label">{updatedAt ? new Date(updatedAt).toLocaleDateString("zh-TW") : "載入中"}</span><button className="refresh-button" onClick={() => void loadStocks()} disabled={isRefreshing}><Icon>↻</Icon>{isRefreshing ? "更新中" : "重新整理"}</button></div>
        </header>

        <div className="notice"><Icon>ⓘ</Icon><span>資料區間：最近六個月交易日資料</span><span className="notice-source">最新成交價 · {updatedAt ? new Date(updatedAt).toLocaleTimeString("zh-TW") : "載入中"}</span></div>

        <section className="metrics">
          <div className="metric-card"><span className="metric-label">符合條件</span><strong>{results.length}<small> 檔</small></strong><span className="metric-trend positive">↑ 12.5% <em>較昨日</em></span></div>
          <div className="metric-card"><span className="metric-label">處理股票</span><strong>{processed.toLocaleString()}<small> 檔</small></strong><span className="metric-sub">上市／上櫃普通股</span></div>
          <div className="metric-card"><span className="metric-label">平均差異幅度</span><strong>{results.length ? (results.reduce((sum, stock) => sum + stock.difference, 0) / results.length).toFixed(2) : "0.00"}<small>%</small></strong><span className="metric-sub">符合條件股票平均</span></div>
          <div className="metric-card"><span className="metric-label">資料完整度</span><strong>{processed ? (((processed - failed) / processed) * 100).toFixed(1) : "0.0"}<small>%</small></strong><span className="metric-sub">{failed} 檔資料取得失敗</span></div>
        </section>

        <section className="results-panel" id="results">
          {(error || (processed > 0 && failed === processed)) && <div className="error-banner"><Icon>!</Icon>{error ?? "所有股票行情資料皆無法取得"}，請稍後重試。</div>}
          <div className="panel-heading"><div><h2>符合條件的股票</h2><p>依差異百分比由高至低排序</p></div><button className="export-button" onClick={exportExcel}><Icon>⇩</Icon>匯出 Excel</button></div>
          <div className="filters"><div className="segmented">{(["全部市場", "上市", "上櫃"] as const).map((item) => <button className={market === item ? "selected" : ""} key={item} onClick={() => setMarket(item)}>{item}</button>)}</div><label className="search"><Icon>⌕</Icon><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋代號或名稱" /></label><span className="result-count">顯示 {results.length} 筆</span></div>
          <div className="table-wrap"><table><thead><tr><th>股票</th><th>市場</th><th>即時成交價</th><th>半年高點</th><th>半年低點</th><th>中間值</th><th>差異百分比 <span className="sort-arrow">↓</span></th><th>報價時間</th></tr></thead><tbody>{results.map((stock) => <tr key={stock.code}><td><div className="stock-name"><strong>{stock.code}</strong><span>{stock.name}</span>{stock.status && <em className="status-tag">{stock.status}</em>}</div></td><td><span className="market-tag">{stock.market}</span></td><td className="price">{stock.price.toLocaleString("zh-TW")}</td><td>{stock.high.toLocaleString("zh-TW")}</td><td>{stock.low.toLocaleString("zh-TW")}</td><td>{stock.midpoint.toLocaleString("zh-TW")}</td><td><span className="difference">-{stock.difference.toFixed(2)}%</span></td><td className="quote-time"><i />{stock.quoteTime}</td></tr>)}</tbody></table>{results.length === 0 && <div className="empty-state">查無符合條件的股票</div>}</div>
          <div className="table-footer"><span>顯示符合條件且資料完整的股票</span><span>資料來源：TWSE / TPEx</span></div>
        </section>
        <footer>本工具僅提供市場資料整理與條件篩選，不構成投資建議。</footer>
      </section>
    </main>
  );
}
