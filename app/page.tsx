"use client";

import { useMemo, useState } from "react";

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

const stocks: Stock[] = [
  { code: "2330", name: "台積電", market: "上市", price: 952, high: 1080, low: 780, midpoint: 930, difference: -2.37, quoteTime: "09:58:42" },
  { code: "2317", name: "鴻海", market: "上市", price: 178.5, high: 235, low: 150, midpoint: 192.5, difference: 7.27, quoteTime: "09:58:39" },
  { code: "2454", name: "聯發科", market: "上市", price: 1_185, high: 1_490, low: 905, midpoint: 1_197.5, difference: 1.04, quoteTime: "09:58:35" },
  { code: "2303", name: "聯電", market: "上市", price: 48.2, high: 65.8, low: 42.1, midpoint: 53.95, difference: 10.66, quoteTime: "09:58:28", status: "處置" },
  { code: "3711", name: "日月光投控", market: "上市", price: 142, high: 178, low: 116, midpoint: 147, difference: 3.4, quoteTime: "09:58:21" },
  { code: "3443", name: "創意", market: "上市", price: 1_290, high: 1_760, low: 1_020, midpoint: 1_390, difference: 7.19, quoteTime: "09:58:16" },
  { code: "6415", name: "矽力*-KY", market: "上市", price: 272, high: 405, low: 230, midpoint: 317.5, difference: 14.33, quoteTime: "09:57:59", status: "暫停交易" },
  { code: "5371", name: "中光電", market: "上櫃", price: 76.4, high: 112, low: 68, midpoint: 90, difference: 15.11, quoteTime: "09:57:42" },
];

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="icon" aria-hidden="true">{children}</span>;
}

export default function Home() {
  const [market, setMarket] = useState<"全部市場" | "上市" | "上櫃">("全部市場");
  const [query, setQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const results = useMemo(() => stocks
    .filter((stock) => market === "全部市場" || stock.market === market)
    .filter((stock) => `${stock.code}${stock.name}`.includes(query.trim()))
    .filter((stock) => stock.difference > 0)
    .sort((a, b) => b.difference - a.difference), [market, query]);

  const refresh = () => {
    setIsRefreshing(true);
    window.setTimeout(() => setIsRefreshing(false), 700);
  };

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
        <div className="sidebar-bottom"><div className="status-dot"><i />資料來源正常</div><small>TWSE / TPEx<br />最後同步 09:58:42</small></div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><div className="eyebrow">MARKET SCREENER</div><h1>台股中間值選股</h1><p>找出目前成交價低於近半年高低點中間值的股票</p></div>
          <div className="top-actions"><span className="market-open"><i />交易中</span><span className="date-label">2026 / 09 / 04</span><button className="refresh-button" onClick={refresh} disabled={isRefreshing}><Icon>↻</Icon>{isRefreshing ? "更新中" : "重新整理"}</button></div>
        </header>

        <div className="notice"><Icon>ⓘ</Icon><span>資料區間：2026/03/04 – 2026/09/04（共 122 個交易日）</span><span className="notice-source">即時成交價 · 09:58:42 更新</span></div>

        <section className="metrics">
          <div className="metric-card"><span className="metric-label">符合條件</span><strong>{results.length}<small> 檔</small></strong><span className="metric-trend positive">↑ 12.5% <em>較昨日</em></span></div>
          <div className="metric-card"><span className="metric-label">處理股票</span><strong>1,842<small> 檔</small></strong><span className="metric-sub">上市 1,036 · 上櫃 806</span></div>
          <div className="metric-card"><span className="metric-label">平均差異幅度</span><strong>9.87<small>%</small></strong><span className="metric-trend positive">↑ 0.8% <em>較昨日</em></span></div>
          <div className="metric-card"><span className="metric-label">資料完整度</span><strong>98.4<small>%</small></strong><span className="metric-sub">1,813 檔成功取得</span></div>
        </section>

        <section className="results-panel" id="results">
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
