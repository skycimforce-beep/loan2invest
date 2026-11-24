# SIM 工程交接與避坑日誌

> 記錄專案核心決策、防呆前提與已驗證的成敗經驗（最新紀錄置頂，單筆限 150 字內，已被取代的舊防呆直接覆寫刪除，純失敗避坑紀錄保留）。

—

### [2026-11-24] 新增報酬率敏感度對照與桌面明細表滿版適配
* **根因 (Root Cause)**：信貸投資頁右欄高度低於左欄造成留白失衡，且 10 欄金流明細表於 1440px 桌面寬度末欄被裁切需橫向捲動；切換分頁未回到頂部影響動線。
* **改動與防呆前提 (Rationale & Condition)**：`ArbitrageTab` 新增 `±2%` 報酬率敏感度矩陣平衡左右欄並即時評估利差與耗盡風險；精簡表頭與雙行微標籤使 10 欄完整納入桌面視窗；`App.jsx` 切換分頁自動平滑回頂。
* **預期 vs 實測 (Predicted vs Observed)**：左右欄底線對齊且桌面免橫捲 / [成功] `vite build` 與 Playwright 全頁截圖實測 10 欄無裁切、雙端無溢位與錯誤。
* **環境 (Context)**：React 18.3.1, Vite 5.4.21, Recharts 2.13.3, Tailwind CSS 3.4.15

### [2026-11-24] 操作手感升級與潛在 Bug 修復
* **根因 (Root Cause)**：兩段式逆推可貸額未計入第二段利率；模式 B 領息抵月付若配息大於月付時表格出現 `--NT$` 雙負號；縮短期數時年份篩選器可能殘留失效年份；Tailwind 預設無 `z-25` 導致浮動列層級失效。
* **改動與防呆前提 (Rationale & Condition)**：於 `finance.js` 改以單位本金線性比例求峰值月付逆推本金；`NumberSliderInput` 加入千分位顯示、聚焦全選、字元過濾與微調步進鈕；新增 `MobileStickySummary`（須用 `z-20` 實底色避免遮罩透出）；`handleLoanMonthsChange` 同步重設過期年份篩選。
* **預期 vs 實測 (Predicted vs Observed)**：修正計算與顯示邊界並強化雙端手感 / [成功] 驗證兩段式逆推峰值誤差 <0.01 元，Playwright E2E 全數通過且無溢位與錯誤。
* **環境 (Context)**：React 18.3.1, Vite 5.4.21, Recharts 2.13.3, Tailwind CSS 3.4.15

### [2026-11-23] 初始化 SIM 系統並重構產品級 UI
* **根因 (Root Cause)**：原 `src/App.jsx` 達 3,417 行單檔結構，且桌面與行動端同時渲染重複導覽列、大量巢狀邊框與靜態寫死範例金額文字，導致資訊層級混亂。
* **改動與防呆前提 (Rationale & Condition)**：拆分為 `src/utils/finance.js` 與 `src/components/*`，保留全數財務數學公式、雙模式水庫與逆推計算邏輯；Recharts 停用 1.5s 動畫延遲確保拖曳即時性。後續重構須維持 `finance.js` 計算等價性。
* **預期 vs 實測 (Predicted vs Observed)**：完成雙端響應式去重複與結果優先排版 / [成功] `vite build` 與 Playwright 實測桌面(1440px)・行動端(390px)皆無水平溢位與 Console 錯誤。
* **環境 (Context)**：React 18.3.1, Vite 5.4.21, Recharts 2.13.3, Tailwind CSS 3.4.15
