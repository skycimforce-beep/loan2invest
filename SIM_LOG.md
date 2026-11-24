# SIM 工程交接與避坑日誌

> 記錄專案核心決策、防呆前提與已驗證的成敗經驗（最新紀錄置頂，單筆限 150 字內，已被取代的舊防呆直接覆寫刪除，純失敗避坑紀錄保留）。

—

### [2026-11-23] 初始化 SIM 系統並重構產品級 UI
* **根因 (Root Cause)**：原 `src/App.jsx` 達 3,417 行單檔結構，且桌面與行動端同時渲染重複導覽列、大量巢狀邊框與靜態寫死範例金額文字，導致資訊層級混亂。
* **改動與防呆前提 (Rationale & Condition)**：拆分為 `src/utils/finance.js` 與 `src/components/*`，保留全數財務數學公式、雙模式水庫與逆推計算邏輯；Recharts 停用 1.5s 動畫延遲確保拖曳即時性。後續重構須維持 `finance.js` 計算等價性。
* **預期 vs 實測 (Predicted vs Observed)**：完成雙端響應式去重複與結果優先排版 / [成功] `vite build` 與 Playwright 實測桌面(1440px)・行動端(390px)皆無水平溢位與 Console 錯誤。
* **環境 (Context)**：React 18.3.1, Vite 5.4.21, Recharts 2.13.3, Tailwind CSS 3.4.15
