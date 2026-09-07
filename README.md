# 台股低於一年高低點中間值選股

以台灣證券交易所（TWSE）上市普通股為範圍，取得歷史行情與最新成交價，找出即時價格低於所選期間高低點中間值的股票。

完整需求規格請參閱 [Spec.md](./Spec.md)。

## 技術架構

- React
- Next.js 14 App Router
- TypeScript
- TWSE 上市股票清單
- Yahoo Finance Chart API 行情資料

## 環境需求

- Node.js 18.17 以上
- npm

## 安裝

```bash
npm install
```

## 開發

啟動本機開發伺服器：

```bash
npm run dev
```

開啟 <http://localhost:3000> 使用應用程式。

## 生產環境

建立正式版本：

```bash
npm run build
```

啟動正式伺服器：

```bash
npm run start
```

## 檢查與 API

執行專案 lint：

```bash
npm run lint
```

股票資料 API 支援六個月或十二個月的查詢期間：

```text
GET /api/stocks?months=6
GET /api/stocks?months=12
```

API 由伺服器端取得上市普通股清單，再取得歷史最高價、最低價、最新成交價與成交量，並回傳低於中間值的股票。單檔資料失敗不會使全部結果失敗；伺服器結果快取 5 分鐘。

## 目前功能

- 查詢期間可選擇 6 個月或 12 個月。
- 結果支援搜尋、差異百分比排序與每頁 10、25、50 筆切換。
- 即時成交量可依升冪或降冪排序。
- 可依即時成交價 100 元以下及差異百分比 50% 以上篩選。
- 目前未實作自動更新、通知或歷史查詢紀錄。
