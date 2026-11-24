import React, { useState, useRef } from 'react';
import {
  Wallet,
  Sparkles,
  Scale,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Coins,
  Download,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  ArrowUpRight
} from 'lucide-react';
import {
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Bar,
  Legend,
  ReferenceLine,
  ComposedChart,
  Line
} from 'recharts';
import NumberSliderInput from './NumberSliderInput';
import MobileStickySummary from './MobileStickySummary';
import { formatCurrency, formatShortCurrency } from '../utils/finance';

const RETURN_SCENARIOS = [
  { label: '市值成長 7+1.5%', growth: 7.0, div: 1.5 },
  { label: '高股息 2+6%', growth: 2.0, div: 6.0 },
  { label: '平衡配置 4.5+4%', growth: 4.5, div: 4.0 },
  { label: '壓力測試 2+2%', growth: 2.0, div: 2.0 }
];

export default function ArbitrageTab({
  loanAmount,
  setLoanAmount,
  loanMonths,
  setLoanMonths,
  graceMonths,
  setGraceMonths,
  effectiveRateMode,
  effectiveSingleRate,
  isRateMode,
  setRateMode,
  setLoanCalcMode,
  setSingleRate,
  stage1Months,
  stage1Rate,
  stage2Rate,
  repaymentSource,
  setRepaymentSource,
  cashBufferMonths,
  setCashBufferMonths,
  annualRefillReserve,
  setAnnualRefillReserve,
  arbExtraCapital,
  setArbExtraCapital,
  arbMonthlyDCA,
  setArbMonthlyDCA,
  arbGrowthRate,
  setArbGrowthRate,
  arbDividendRate,
  setArbDividendRate,
  reinvestDividends,
  setReinvestDividends,
  deductFeeFromLoan,
  setDeductFeeFromLoan,
  arbCalc,
  arbChartType,
  setArbChartType,
  arbTableFilterYear,
  setArbTableFilterYear,
  yearOptions,
  onGoToLoanTab,
  onExportCSV,
  onOpenGuide
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const heroRef = useRef(null);

  const filteredDetails = arbCalc.monthlyDetails.filter(
    (r) => arbTableFilterYear === 'all' || String(r.year) === arbTableFilterYear
  );

  const periodReturn = filteredDetails.reduce((sum, r) => sum + r.monthTotalReturn, 0);
  const periodLoanPaid = filteredDetails.reduce((sum, r) => sum + r.loanPayment, 0);
  const periodOutOfPocket = filteredDetails.reduce((sum, r) => sum + r.outOfPocketThisMonth, 0);
  const periodEndNetWorth =
    filteredDetails.length > 0 ? filteredDetails[filteredDetails.length - 1].currentNetWorth : 0;

  const stockRatio =
    arbCalc.totalAvailablePool > 0
      ? (arbCalc.initialStockInvestedA / arbCalc.totalAvailablePool) * 100
      : 0;
  const reserveRatio = Math.max(0, 100 - stockRatio);

  return (
    <div className="space-y-5">
      <MobileStickySummary
        targetRef={heroRef}
        items={[
          {
            label: `期滿淨賺(${loanMonths}期)`,
            value: `${arbCalc.activeNetProfit >= 0 ? '+' : ''}${formatCurrency(arbCalc.activeNetProfit)}`,
            tone: arbCalc.activeNetProfit >= 0 ? 'positive' : 'negative'
          },
          {
            label: '期末資產',
            value: formatShortCurrency(arbCalc.activeFinalAsset),
            tone: 'accent'
          },
          {
            label: '年化利差',
            value: `${arbCalc.spreadRate >= 0 ? '+' : ''}${arbCalc.spreadRate.toFixed(2)}%`
          }
        ]}
      />
      {/* Compact Top Mode Switcher Strip */}
      <div className="bg-[#FFFDFB] border border-[#EADCD3] rounded-2xl p-2 sm:p-2.5 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 flex-1">
          <button
            id="arb-mode-portfolio"
            type="button"
            onClick={() => setRepaymentSource('portfolio')}
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-left transition-all ${
              repaymentSource === 'portfolio'
                ? 'bg-[#D95D39] text-white shadow-sm'
                : 'bg-[#FAF5F0] text-[#4B3227] hover:bg-[#F4EAE3]'
            }`}
          >
            <Wallet className="w-4 h-4 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-extrabold">
                模式 A｜投資部位自給自足
              </div>
              <div
                className={`text-[11px] ${
                  repaymentSource === 'portfolio' ? 'text-white/85' : 'text-[#8B6B5C]'
                }`}
              >
                不動用薪資・預留現金水庫扣款
              </div>
            </div>
          </button>

          <button
            id="arb-mode-salary"
            type="button"
            onClick={() => setRepaymentSource('salary')}
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-left transition-all ${
              repaymentSource === 'salary'
                ? 'bg-[#2C1A12] text-[#FFFDFB] shadow-sm'
                : 'bg-[#FAF5F0] text-[#4B3227] hover:bg-[#F4EAE3]'
            }`}
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-extrabold">
                模式 B｜薪資現金流還款
              </div>
              <div
                className={`text-[11px] ${
                  repaymentSource === 'salary' ? 'text-[#E6D5CB]' : 'text-[#8B6B5C]'
                }`}
              >
                不賣股・本金 100% 留存市場複利
              </div>
            </div>
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenGuide}
          className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-[#6D4E40] hover:text-[#2C1A12] px-3 py-2 rounded-xl hover:bg-[#F4EAE3] transition-colors shrink-0 whitespace-nowrap"
        >
          <HelpCircle className="w-3.5 h-3.5 text-[#D95D39]" />
          <span>比較兩模式差異</span>
        </button>
      </div>

      {/* Main 12-Col Decision Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Rail: Clean Grouped Parameters */}
        <div className="lg:col-span-5 order-2 lg:order-1 space-y-4">
          {/* Group 1: Loan Parameters */}
          <section className="bg-[#FFFDFB] border border-[#EADCD3] rounded-2xl p-4 sm:p-5 shadow-card">
            <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-[#EFE3DC]">
              <h2 className="text-sm font-extrabold text-[#2C1A12] flex items-center gap-2">
                <Scale className="w-4 h-4 text-[#D95D39]" />
                借貸基礎條件
              </h2>
              <button
                type="button"
                onClick={onGoToLoanTab}
                className="text-xs font-bold text-[#D95D39] hover:text-[#B54B2E] inline-flex items-center gap-0.5 transition-colors"
              >
                <span>進階信貸設定</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div>
              <NumberSliderInput
                id="arb-loan-amount"
                label="信貸借出本金"
                value={loanAmount}
                onChange={setLoanAmount}
                min={100000}
                max={8000000}
                step={50000}
                prefix="NT$"
                quickPresets={[
                  { label: '100萬', value: 1000000 },
                  { label: '150萬', value: 1500000 },
                  { label: '250萬', value: 2500000 },
                  { label: '400萬', value: 4000000 }
                ]}
              />

              <NumberSliderInput
                id="arb-loan-months"
                label="貸款期數"
                value={loanMonths}
                onChange={(val) => {
                  setLoanMonths(val);
                  if (graceMonths >= val) setGraceMonths(Math.max(0, val - 1));
                }}
                min={12}
                max={120}
                step={12}
                unit="期"
                helperText={`約 ${(loanMonths / 12).toFixed(1)} 年`}
                quickPresets={[
                  { label: '5年(60期)', value: 60 },
                  { label: '7年(84期)', value: 84 },
                  { label: '10年(120期)', value: 120 }
                ]}
              />

              <NumberSliderInput
                id="arb-grace-months"
                label="寬限期 (只繳息不還本)"
                value={graceMonths}
                onChange={setGraceMonths}
                min={0}
                max={Math.min(36, Math.max(0, loanMonths - 1))}
                step={3}
                unit="個月"
                strictMax
                quickPresets={[
                  { label: '無寬限', value: 0 },
                  { label: '12個月', value: 12 },
                  { label: '24個月', value: 24 }
                ]}
              />

              {effectiveRateMode === 'single' ? (
                <NumberSliderInput
                  id="arb-single-rate"
                  label={isRateMode ? '信貸年利率 (由月付逆推)' : '信貸年利率 (一段式)'}
                  value={Number(effectiveSingleRate.toFixed(2))}
                  onChange={(val) => {
                    if (isRateMode) {
                      setRateMode('single');
                      setLoanCalcMode('by-amount');
                    }
                    setSingleRate(val);
                  }}
                  min={1.5}
                  max={10.0}
                  step={0.01}
                  unit="%"
                  helperText={`實質 APR ${arbCalc.apr.toFixed(2)}%`}
                  quickPresets={[
                    { label: '2.08%', value: 2.08 },
                    { label: '2.25%', value: 2.25 },
                    { label: '2.68%', value: 2.68 }
                  ]}
                />
              ) : (
                <div className="pt-3 flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-[#4B3227]">
                    兩段式利率：前 {stage1Months} 期 {stage1Rate}% → {stage2Rate}%
                  </span>
                  <button
                    type="button"
                    onClick={onGoToLoanTab}
                    className="text-[#D95D39] font-bold hover:underline shrink-0"
                  >
                    編輯
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Group 2: Expected Market Return */}
          <section className="bg-[#FFFDFB] border border-[#EADCD3] rounded-2xl p-4 sm:p-5 shadow-card">
            <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-[#EFE3DC]">
              <h2 className="text-sm font-extrabold text-[#2C1A12]">投資報酬假設</h2>
              <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-[#EAF6F1] text-[#1F7A5C] tabular-nums">
                合計年化 {arbCalc.totalExpectedAnnualReturn.toFixed(2)}%
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-3">
              {RETURN_SCENARIOS.map((sc) => {
                const active =
                  Math.abs(arbGrowthRate - sc.growth) < 0.05 &&
                  Math.abs(arbDividendRate - sc.div) < 0.05;
                return (
                  <button
                    key={sc.label}
                    type="button"
                    onClick={() => {
                      setArbGrowthRate(sc.growth);
                      setArbDividendRate(sc.div);
                    }}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all active:scale-95 ${
                      active
                        ? 'bg-[#2C1A12] text-white border-[#2C1A12]'
                        : 'bg-[#FAF5F0] text-[#6D4E40] border-[#EADCD3] hover:bg-[#F4EAE3] hover:text-[#2C1A12]'
                    }`}
                  >
                    {sc.label}
                  </button>
                );
              })}
            </div>

            <div>
              <NumberSliderInput
                id="arb-growth-rate"
                label="預期年化資本利得 (價差成長)"
                value={arbGrowthRate}
                onChange={setArbGrowthRate}
                min={0}
                max={18}
                step={0.1}
                unit="%"
                quickPresets={[
                  { label: '0%', value: 0 },
                  { label: '3.5%', value: 3.5 },
                  { label: '6.0%', value: 6.0 },
                  { label: '8.0%', value: 8.0 }
                ]}
              />

              <NumberSliderInput
                id="arb-dividend-rate"
                label="預期年化現金配息率 (股息/債息)"
                value={arbDividendRate}
                onChange={setArbDividendRate}
                min={0}
                max={15}
                step={0.1}
                unit="%"
                quickPresets={[
                  { label: '0%', value: 0 },
                  { label: '4.5%', value: 4.5 },
                  { label: '6.5%', value: 6.5 },
                  { label: '8.0%', value: 8.0 }
                ]}
              />
            </div>
          </section>

          {/* Group 3: Contextual Strategy Execution */}
          <section className="bg-[#FFFDFB] border border-[#EADCD3] rounded-2xl p-4 sm:p-5 shadow-card space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#EFE3DC]">
              <h2 className="text-sm font-extrabold text-[#2C1A12]">
                {repaymentSource === 'portfolio' ? '模式 A｜還款水庫設定' : '模式 B｜配息處理策略'}
              </h2>
              {repaymentSource === 'portfolio' && (
                <span className="text-[11px] font-bold text-[#8B6B5C]">
                  全期預計賣股 {arbCalc.sellStockCountA} 次
                </span>
              )}
            </div>

            {repaymentSource === 'portfolio' ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-[#4B3227] mb-2">
                    期初預留還款現金準備金（避免每月零碎賣股）
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[
                      { m: 0, label: '0期' },
                      { m: 6, label: '6期' },
                      { m: 12, label: '12期' },
                      { m: 18, label: '18期' },
                      { m: 24, label: '24期' }
                    ].map((opt) => (
                      <button
                        key={opt.m}
                        type="button"
                        onClick={() => setCashBufferMonths(opt.m)}
                        className={`py-1.5 rounded-xl text-xs font-bold transition-all ${
                          cashBufferMonths === opt.m
                            ? 'bg-[#D95D39] text-white shadow-xs'
                            : 'bg-[#FAF5F0] text-[#6D4E40] border border-[#EADCD3] hover:bg-[#F4EAE3]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Initial Pool Allocation Bar */}
                <div className="bg-[#FAF5F0] rounded-xl p-3 border border-[#EFE3DC] space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-[#1F7A5C]">
                      買股本金 {formatShortCurrency(arbCalc.initialStockInvestedA)} ({stockRatio.toFixed(0)}%)
                    </span>
                    <span className="font-bold text-[#D95D39]">
                      預留準備金 {formatShortCurrency(arbCalc.initialCashReserveA)} ({reserveRatio.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#EADCD3] overflow-hidden flex">
                    <div
                      className="bg-[#1F7A5C] h-full transition-all duration-300"
                      style={{ width: `${stockRatio}%` }}
                    />
                    <div
                      className="bg-[#D95D39] h-full transition-all duration-300"
                      style={{ width: `${reserveRatio}%` }}
                    />
                  </div>
                </div>

                {cashBufferMonths > 0 && (
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#2C1A12]">準備金用罄補水方式</p>
                      <p className="text-[11px] text-[#8B6B5C]">
                        {annualRefillReserve
                          ? '一次賣股補滿下一週期準備金'
                          : '用罄後改為按月賣股補足差額'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAnnualRefillReserve(!annualRefillReserve)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                        annualRefillReserve
                          ? 'bg-[#2C1A12] text-white'
                          : 'bg-[#F4EAE3] text-[#4B3227]'
                      }`}
                    >
                      {annualRefillReserve ? '整批補水' : '按月補差額'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#2C1A12]">
                    {reinvestDividends ? '配息滾入再投資' : '領取配息貼補月付金'}
                  </p>
                  <p className="text-[11px] text-[#8B6B5C]">
                    {reinvestDividends
                      ? '最大化期末總資產複利效果'
                      : '每月現金流減輕薪資還款壓力'}
                  </p>
                </div>
                <div className="flex bg-[#F4EAE3] p-0.5 rounded-xl shrink-0">
                  <button
                    type="button"
                    onClick={() => setReinvestDividends(false)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      !reinvestDividends ? 'bg-[#2C1A12] text-white' : 'text-[#6D4E40]'
                    }`}
                  >
                    領息抵付
                  </button>
                  <button
                    type="button"
                    onClick={() => setReinvestDividends(true)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      reinvestDividends ? 'bg-[#D95D39] text-white' : 'text-[#6D4E40]'
                    }`}
                  >
                    再投入
                  </button>
                </div>
              </div>
            )}

            {/* Collapsible Advanced Options */}
            <div className="pt-2 border-t border-[#EFE3DC]">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between text-xs font-bold text-[#6D4E40] hover:text-[#2C1A12] py-1"
              >
                <span>進階資金選項（自備本金・額外月投・開辦費）</span>
                {showAdvanced ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {showAdvanced && (
                <div className="pt-3 space-y-1">
                  <NumberSliderInput
                    id="arb-extra-capital"
                    label="額外自備本金一併投入"
                    value={arbExtraCapital}
                    onChange={setArbExtraCapital}
                    min={0}
                    max={5000000}
                    step={50000}
                    prefix="NT$"
                    quickPresets={[
                      { label: '$0', value: 0 },
                      { label: '+50萬', value: 500000 },
                      { label: '+100萬', value: 1000000 }
                    ]}
                  />

                  <NumberSliderInput
                    id="arb-monthly-dca"
                    label="每月額外定期定額加碼"
                    value={arbMonthlyDCA}
                    onChange={setArbMonthlyDCA}
                    min={0}
                    max={100000}
                    step={1000}
                    prefix="NT$"
                    quickPresets={[
                      { label: '$0', value: 0 },
                      { label: '$5,000', value: 5000 },
                      { label: '$10,000', value: 10000 }
                    ]}
                  />

                  <div className="pt-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#4B3227]">
                      開辦費從撥款金額中扣除
                    </span>
                    <button
                      type="button"
                      onClick={() => setDeductFeeFromLoan(!deductFeeFromLoan)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        deductFeeFromLoan
                          ? 'bg-[#D95D39] text-white'
                          : 'bg-[#F4EAE3] text-[#6D4E40]'
                      }`}
                    >
                      {deductFeeFromLoan ? '是 (內扣)' : '否 (另計)'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right Canvas: Decision KPIs + Charts + Mode Comparison */}
        <div className="lg:col-span-7 order-1 lg:order-2 space-y-5 min-w-0">
          {/* Executive Hero Summary */}
          <div
            ref={heroRef}
            className="bg-gradient-to-br from-[#2C1A12] via-[#3A2319] to-[#4F3124] rounded-2xl p-5 sm:p-6 text-[#FFFDFB] shadow-elevated"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#D95D39] text-white">
                  {repaymentSource === 'portfolio'
                    ? '模式 A｜投資自給自足'
                    : '模式 B｜薪資現金流還款'}
                </span>
                <span
                  className={`text-xs font-bold px-3 py-1 rounded-full inline-flex items-center gap-1 ${
                    arbCalc.spreadRate > 0
                      ? 'bg-[#1F7A5C]/30 text-[#86EFAC] border border-[#86EFAC]/25'
                      : 'bg-[#C04832]/40 text-[#FECACA] border border-[#FECACA]/25'
                  }`}
                >
                  {arbCalc.spreadRate > 0 ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  )}
                  年化利差 {arbCalc.spreadRate >= 0 ? '+' : ''}
                  {arbCalc.spreadRate.toFixed(2)}%
                </span>
              </div>
              <span className="text-xs text-[#DFCBC1]">
                損益兩平報酬率 (APR)：<strong className="text-white">{arbCalc.apr.toFixed(2)}%</strong>
              </span>
            </div>

            {/* Primary Spotlight Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-5 border-b border-white/10">
              <div>
                <p className="text-xs text-[#DFCBC1] mb-1">
                  期滿扣除所有成本後淨賺 ({loanMonths}期)
                </p>
                <p
                  className={`text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums ${
                    arbCalc.activeNetProfit >= 0 ? 'text-[#7CE0B3]' : 'text-[#FF9E88]'
                  }`}
                >
                  {arbCalc.activeNetProfit >= 0 ? '+' : ''}
                  {formatCurrency(arbCalc.activeNetProfit)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#DFCBC1] mb-1">期滿投資總資產終值</p>
                <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#FFA48D] tabular-nums">
                  {formatCurrency(arbCalc.activeFinalAsset)}
                </p>
              </div>
            </div>

            {/* Secondary Metrics Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 pt-4">
              <div className="min-w-0">
                <p className="text-[11px] text-[#CEB6AA] truncate">首期信貸月付</p>
                <p className="text-sm sm:text-base font-extrabold tabular-nums whitespace-nowrap mt-0.5">
                  {formatCurrency(arbCalc.monthlyDetails[0]?.loanPayment || 0)}
                </p>
                <p className="text-[11px] text-[#B89D90] truncate">
                  首月收益 {formatShortCurrency(arbCalc.monthlyDetails[0]?.monthTotalReturn || 0)}
                </p>
              </div>

              <div className="min-w-0">
                <p className="text-[11px] text-[#CEB6AA] truncate">貸款總繳本息</p>
                <p className="text-sm sm:text-base font-extrabold tabular-nums whitespace-nowrap mt-0.5">
                  {formatCurrency(arbCalc.totalLoanPaid)}
                </p>
                <p className="text-[11px] text-[#B89D90] truncate">
                  含利息 {formatShortCurrency(arbCalc.totalInterestPaid)}
                </p>
              </div>

              <div className="col-span-2 sm:col-span-1 min-w-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10 flex sm:block items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] text-[#CEB6AA] truncate">
                    {repaymentSource === 'portfolio' ? '若改模式 B 淨賺' : '若改模式 A 淨賺'}
                  </p>
                  <p className="text-sm sm:text-base font-extrabold tabular-nums whitespace-nowrap mt-0.5">
                    {formatCurrency(
                      repaymentSource === 'portfolio'
                        ? arbCalc.finalNetProfitB
                        : arbCalc.finalNetProfitA
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setRepaymentSource(repaymentSource === 'portfolio' ? 'salary' : 'portfolio')
                  }
                  className="text-[11px] font-bold text-[#FFA48D] hover:underline shrink-0"
                >
                  切換檢視 →
                </button>
              </div>
            </div>

            {repaymentSource === 'portfolio' && arbCalc.depletedMonthA && (
              <div className="mt-4 bg-[#C04832]/30 border border-[#FFA48D]/40 rounded-xl p-3 flex items-start gap-2 text-xs text-[#FFEBE6]">
                <ShieldAlert className="w-4 h-4 text-[#FFA48D] shrink-0 mt-0.5" />
                <span>
                  在目前報酬率假設下，投資部位將於第 <strong>{arbCalc.depletedMonthA} 期</strong>
                  提領完畢，後續期數需由自有資金貼補月付金。
                </span>
              </div>
            )}
          </div>

          {/* Chart Visualization Card */}
          <div className="bg-[#FFFDFB] border border-[#EADCD3] rounded-2xl p-4 sm:p-5 shadow-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-[#2C1A12]">
                  資產與現金流趨勢模擬
                </h3>
                <p className="text-xs text-[#8B6B5C]">
                  切換檢視資產負債消長、每月收支或雙模式終值差距
                </p>
              </div>

              <div className="inline-flex bg-[#F4EAE3] p-1 rounded-xl border border-[#EADCD3] self-start">
                {[
                  { id: 'balance', label: '資產 vs 貸款' },
                  { id: 'cashflow', label: '每月金流' },
                  { id: 'compare', label: 'A/B 雙模式' }
                ].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setArbChartType(c.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                      arbChartType === c.id
                        ? 'bg-[#FFFDFB] text-[#2C1A12] shadow-xs'
                        : 'text-[#6D4E40] hover:text-[#2C1A12]'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative h-72 sm:h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {arbChartType === 'balance' ? (
                  <ComposedChart
                    data={arbCalc.monthlyDetails}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="arbAssetGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#D95D39" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="#D95D39" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EFE3DC" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: '#6D4E40' }}
                      tickFormatter={(m) => `M${m}`}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#6D4E40' }}
                      tickFormatter={formatShortCurrency}
                      width={52}
                    />
                    <Tooltip
                      formatter={(val, name) => [formatCurrency(val), name]}
                      labelFormatter={(m) => `第 ${m} 期 (第 ${Math.ceil(m / 12)} 年)`}
                      contentStyle={{
                        backgroundColor: '#FFFDFB',
                        borderColor: '#E5D2C7',
                        borderRadius: '12px',
                        color: '#2C1A12',
                        fontSize: '12px',
                        boxShadow: '0 8px 24px rgba(44,26,18,0.1)'
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Area
                      isAnimationActive={false}
                      type="monotone"
                      dataKey="endAsset"
                      name="期末投資部位資產"
                      stroke="#D95D39"
                      strokeWidth={2.5}
                      fill="url(#arbAssetGrad)"
                    />
                    <Line
                      isAnimationActive={false}
                      type="monotone"
                      dataKey="remainingDebt"
                      name="剩餘貸款本金"
                      stroke="#2C1A12"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      isAnimationActive={false}
                      type="monotone"
                      dataKey="currentNetWorth"
                      name="帳面淨值 (資產-負債)"
                      stroke="#1F7A5C"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                    />
                  </ComposedChart>
                ) : arbChartType === 'cashflow' ? (
                  <ComposedChart
                    data={arbCalc.monthlyDetails}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#EFE3DC" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: '#6D4E40' }}
                      tickFormatter={(m) => `M${m}`}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#6D4E40' }}
                      tickFormatter={formatShortCurrency}
                      width={52}
                    />
                    <Tooltip
                      formatter={(val, name) => [formatCurrency(val), name]}
                      labelFormatter={(m) => `第 ${m} 期`}
                      contentStyle={{
                        backgroundColor: '#FFFDFB',
                        borderColor: '#E5D2C7',
                        borderRadius: '12px',
                        color: '#2C1A12',
                        fontSize: '12px'
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <ReferenceLine y={0} stroke="#8B6B5C" />
                    <Bar
                      isAnimationActive={false}
                      dataKey="monthTotalReturn"
                      name="當月投資總收益 (價差+配息)"
                      fill="#D95D39"
                      radius={[3, 3, 0, 0]}
                    />
                    <Line
                      isAnimationActive={false}
                      type="monotone"
                      dataKey="loanPayment"
                      name="當月信貸應繳月付金"
                      stroke="#2C1A12"
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </ComposedChart>
                ) : (
                  <ComposedChart
                    data={arbCalc.monthlyDetails}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#EFE3DC" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: '#6D4E40' }}
                      tickFormatter={(m) => `M${m}`}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#6D4E40' }}
                      tickFormatter={formatShortCurrency}
                      width={52}
                    />
                    <Tooltip
                      formatter={(val, name) => [formatCurrency(val), name]}
                      labelFormatter={(m) => `第 ${m} 期`}
                      contentStyle={{
                        backgroundColor: '#FFFDFB',
                        borderColor: '#E5D2C7',
                        borderRadius: '12px',
                        color: '#2C1A12',
                        fontSize: '12px'
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Line
                      isAnimationActive={false}
                      type="monotone"
                      dataKey="endPortfolioA"
                      name="模式A：投資提領還款資產"
                      stroke="#D95D39"
                      strokeWidth={2.5}
                      dot={false}
                    />
                    <Line
                      isAnimationActive={false}
                      type="monotone"
                      dataKey="endPortfolioB"
                      name="模式B：薪資還款投資資產"
                      stroke="#2C1A12"
                      strokeWidth={2.5}
                      dot={false}
                    />
                    <Line
                      isAnimationActive={false}
                      type="monotone"
                      dataKey="remainingDebtRounded"
                      name="剩餘貸款餘額"
                      stroke="#9A7B6D"
                      strokeWidth={1.75}
                      strokeDasharray="4 4"
                      dot={false}
                    />
                  </ComposedChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Side-by-Side Mode A vs B Comparison */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <button
              type="button"
              onClick={() => setRepaymentSource('portfolio')}
              className={`text-left rounded-2xl p-4 border transition-all ${
                repaymentSource === 'portfolio'
                  ? 'bg-[#FFF6F2] border-[#D95D39] ring-1 ring-[#D95D39]/25 shadow-card'
                  : 'bg-[#FFFDFB] border-[#EADCD3] hover:border-[#D6BBAE]'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-extrabold text-[#D95D39]">
                  模式 A｜投資自給自足
                </span>
                {repaymentSource === 'portfolio' && (
                  <span className="text-[10px] font-bold bg-[#D95D39] text-white px-2 py-0.5 rounded-full">
                    檢視中
                  </span>
                )}
              </div>
              <p className="text-base font-extrabold text-[#2C1A12] tabular-nums">
                期末資產 {formatCurrency(arbCalc.finalAssetA)}
              </p>
              <p className="text-xs text-[#6D4E40] mt-0.5 tabular-nums">
                淨賺 {formatCurrency(arbCalc.finalNetProfitA)}・免掏薪水
              </p>
            </button>

            <button
              type="button"
              onClick={() => setRepaymentSource('salary')}
              className={`text-left rounded-2xl p-4 border transition-all ${
                repaymentSource === 'salary'
                  ? 'bg-[#FAF5F0] border-[#2C1A12] ring-1 ring-[#2C1A12]/20 shadow-card'
                  : 'bg-[#FFFDFB] border-[#EADCD3] hover:border-[#D6BBAE]'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-extrabold text-[#2C1A12]">
                  模式 B｜薪資現金流還款
                </span>
                {repaymentSource === 'salary' && (
                  <span className="text-[10px] font-bold bg-[#2C1A12] text-white px-2 py-0.5 rounded-full">
                    檢視中
                  </span>
                )}
              </div>
              <p className="text-base font-extrabold text-[#2C1A12] tabular-nums">
                期末資產 {formatCurrency(arbCalc.finalAssetB)}
              </p>
              <p className="text-xs text-[#6D4E40] mt-0.5 tabular-nums">
                扣還款淨賺 {formatCurrency(arbCalc.finalNetProfitB)}・本金全留存
              </p>
            </button>
          </div>
        </div>
      </div>

      {/* Monthly Cashflow & Debt Ledger */}
      <section className="bg-[#FFFDFB] border border-[#EADCD3] rounded-2xl p-4 sm:p-5 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-[#2C1A12] flex items-center gap-2">
              <Coins className="w-4 h-4 text-[#D95D39]" />
              每月金流暨剩餘貸款追蹤表（
              {repaymentSource === 'portfolio' ? '模式 A' : '模式 B'}）
            </h3>
            <p className="text-xs text-[#8B6B5C] mt-0.5">
              逐月追蹤投資報酬、信貸本息扣款、準備金水庫異動與期末帳面淨資產
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={arbTableFilterYear}
              onChange={(e) => setArbTableFilterYear(e.target.value)}
              aria-label="篩選年度"
              className="text-xs font-bold bg-[#FAF5F0] border border-[#E5D2C7] text-[#2C1A12] rounded-xl px-3 py-2 focus:outline-none focus:border-[#D95D39]"
            >
              <option value="all">全部期數 ({loanMonths} 個月)</option>
              {yearOptions.map((y) => (
                <option key={y} value={String(y)}>
                  第 {y} 年 (M{(y - 1) * 12 + 1}~M{Math.min(loanMonths, y * 12)})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => onExportCSV('arbitrage')}
              className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl bg-[#2C1A12] text-[#FFFDFB] hover:bg-[#3F261B] transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>匯出 CSV</span>
            </button>
          </div>
        </div>

        {/* Filtered Period Subtotal Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 bg-[#FAF5F0] border border-[#EFE3DC] rounded-xl p-3">
          <div>
            <span className="text-[11px] text-[#8B6B5C] block">期間投資總收益</span>
            <span className="text-xs sm:text-sm font-extrabold text-[#1F7A5C] tabular-nums">
              +{formatCurrency(periodReturn)}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-[#8B6B5C] block">期間信貸應繳總額</span>
            <span className="text-xs sm:text-sm font-extrabold text-[#C04832] tabular-nums">
              -{formatCurrency(periodLoanPaid)}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-[#8B6B5C] block">
              {periodOutOfPocket < -0.5 ? '期間配息抵月付淨結餘' : '期間自掏薪水合計'}
            </span>
            <span
              className={`text-xs sm:text-sm font-extrabold tabular-nums ${
                periodOutOfPocket < -0.5 ? 'text-[#1F7A5C]' : 'text-[#2C1A12]'
              }`}
            >
              {Math.abs(periodOutOfPocket) < 0.5
                ? 'NT$ 0'
                : periodOutOfPocket < 0
                ? `+${formatCurrency(Math.abs(periodOutOfPocket))}`
                : formatCurrency(periodOutOfPocket)}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-[#8B6B5C] block">期末帳面淨資產</span>
            <span className="text-xs sm:text-sm font-extrabold text-[#D95D39] tabular-nums">
              {formatCurrency(periodEndNetWorth)}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[460px] warm-scroll rounded-xl border border-[#EFE3DC]">
          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
            <thead className="bg-[#F4EAE3] text-[#4B3227] sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-3 font-bold">期數</th>
                {repaymentSource === 'portfolio' ? (
                  <>
                    <th className="py-2.5 px-3 font-bold text-right">期末股票市值</th>
                    <th className="py-2.5 px-3 font-bold text-right">現金準備金餘額</th>
                  </>
                ) : (
                  <th className="py-2.5 px-3 font-bold text-right">期初投資資產</th>
                )}
                <th className="py-2.5 px-3 font-bold text-right">當月總收益</th>
                <th className="py-2.5 px-3 font-bold text-right">信貸月付 (本/息)</th>
                {repaymentSource === 'portfolio' && (
                  <th className="py-2.5 px-3 font-bold text-right">準備金補水動作</th>
                )}
                <th className="py-2.5 px-3 font-bold text-right">自掏薪水 / 淨結餘</th>
                <th className="py-2.5 px-3 font-bold text-right">期末總資產</th>
                <th className="py-2.5 px-3 font-bold text-right">期末剩餘貸款</th>
                <th className="py-2.5 px-3 font-bold text-right">期末帳面淨值</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F4EAE3] tabular-nums">
              {filteredDetails.map((row) => {
                const isZeroPocket = Math.abs(row.outOfPocketThisMonth) < 0.5;
                const isSurplus = row.outOfPocketThisMonth <= -0.5;
                return (
                  <tr key={row.month} className="hover:bg-[#FAF5F0] transition-colors">
                    <td className="py-2.5 px-3 font-bold text-[#2C1A12]">
                      M{row.month}
                      <span className="ml-1 text-[10px] font-normal text-[#8B6B5C]">
                        Y{row.year}
                      </span>
                    </td>
                    {repaymentSource === 'portfolio' ? (
                      <>
                        <td className="py-2.5 px-3 text-right font-semibold text-[#2C1A12]">
                          {formatCurrency(row.endStockA)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-[#B54B2E]">
                          {formatCurrency(row.endCashA)}
                        </td>
                      </>
                    ) : (
                      <td className="py-2.5 px-3 text-right text-[#6D4E40]">
                        {formatCurrency(row.startAsset)}
                      </td>
                    )}
                    <td className="py-2.5 px-3 text-right text-[#1F7A5C] font-semibold">
                      +{formatCurrency(row.monthTotalReturn)}
                      <span className="ml-1 text-[10px] font-normal text-[#8B6B5C]">
                        (息 {formatShortCurrency(row.monthDividend)})
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="font-bold text-[#C04832]">
                        -{formatCurrency(row.loanPayment)}
                      </span>
                      <span className="block text-[10px] text-[#8B6B5C]">
                        本 {formatShortCurrency(row.loanPrincipal)} / 息{' '}
                        {formatShortCurrency(row.loanInterest)}
                      </span>
                    </td>
                    {repaymentSource === 'portfolio' && (
                      <td className="py-2.5 px-3 text-right">
                        {row.principalSoldFromPortfolioA > 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded-md bg-[#FDF0ED] text-[#C04832] font-bold">
                            賣股補水 {formatCurrency(row.principalSoldFromPortfolioA)}
                          </span>
                        ) : (
                          <span className="text-[#8B6B5C]">水庫扣款</span>
                        )}
                      </td>
                    )}
                    <td
                      className={`py-2.5 px-3 text-right font-bold ${
                        isZeroPocket || isSurplus ? 'text-[#1F7A5C]' : 'text-[#C04832]'
                      }`}
                    >
                      {isZeroPocket
                        ? 'NT$ 0'
                        : isSurplus
                        ? `+${formatCurrency(Math.abs(row.outOfPocketThisMonth))}`
                        : `-${formatCurrency(row.outOfPocketThisMonth)}`}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-[#D95D39]">
                      {formatCurrency(row.endAsset)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-[#2C1A12]">
                      {formatCurrency(row.remainingDebt)}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-extrabold ${
                        row.currentNetWorth >= 0 ? 'text-[#1F7A5C]' : 'text-[#C04832]'
                      }`}
                    >
                      {formatCurrency(row.currentNetWorth)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
