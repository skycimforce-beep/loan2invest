import React, { useState, useRef } from 'react';
import {
  Calculator,
  ArrowRightLeft,
  Percent,
  AlertTriangle,
  Download,
  Table as TableIcon
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import NumberSliderInput from './NumberSliderInput';
import MobileStickySummary from './MobileStickySummary';
import {
  formatCurrency,
  formatShortCurrency,
  MAX_REVERSE_ANNUAL_RATE
} from '../utils/finance';

export default function LoanTab({
  loanCalcMode,
  setLoanCalcMode,
  targetMonthlyPayment,
  setTargetMonthlyPayment,
  loanAmount,
  setLoanAmount,
  effectiveLoanAmount,
  loanMonths,
  setLoanMonths,
  repaymentMethod,
  setRepaymentMethod,
  graceMonths,
  setGraceMonths,
  rateMode,
  setRateMode,
  singleRate,
  setSingleRate,
  stage1Months,
  setStage1Months,
  stage1Rate,
  setStage1Rate,
  stage2Rate,
  setStage2Rate,
  loanFee,
  setLoanFee,
  isRateMode,
  effectiveSingleRate,
  reverseRateResult,
  loanCalc,
  loanTableFilterYear,
  setLoanTableFilterYear,
  yearOptions,
  onSyncToArbitrage,
  onExportCSV
}) {
  const [loanChartView, setLoanChartView] = useState('balance'); // 'balance' | 'structure'
  const heroRef = useRef(null);

  const filteredSchedule = loanCalc.schedule.filter(
    (r) => loanTableFilterYear === 'all' || String(r.year) === loanTableFilterYear
  );
  const sumPayment = filteredSchedule.reduce((a, b) => a + b.payment, 0);
  const sumPrincipal = filteredSchedule.reduce((a, b) => a + b.principal, 0);
  const sumInterest = filteredSchedule.reduce((a, b) => a + b.interest, 0);
  const endRemain =
    filteredSchedule.length > 0 ? filteredSchedule[filteredSchedule.length - 1].remainingBalance : 0;

  const totalOutlay = effectiveLoanAmount + loanCalc.totalInterest + loanFee;
  const principalShare = totalOutlay > 0 ? (effectiveLoanAmount / totalOutlay) * 100 : 100;
  const interestShare = totalOutlay > 0 ? (loanCalc.totalInterest / totalOutlay) * 100 : 0;
  const feeShare = Math.max(0, 100 - principalShare - interestShare);

  const stickyPrimary =
    loanCalcMode === 'by-rate'
      ? {
          label: '逆推年利率',
          value:
            reverseRateResult.error === 'insufficient'
              ? '無解'
              : `${reverseRateResult.error === 'too-high' ? '>' : ''}${reverseRateResult.rate.toFixed(2)}%`,
          tone: 'accent'
        }
      : loanCalcMode === 'by-payment'
      ? {
          label: '可貸總額',
          value: formatCurrency(effectiveLoanAmount),
          tone: 'accent'
        }
      : {
          label: '應繳月付',
          value: formatCurrency(loanCalc.postGracePayment),
          tone: 'accent'
        };

  return (
    <div className="space-y-5">
      <MobileStickySummary
        targetRef={heroRef}
        items={[
          stickyPrimary,
          { label: 'APR', value: `${loanCalc.apr.toFixed(2)}%` },
          { label: '總利息', value: formatShortCurrency(loanCalc.totalInterest) }
        ]}
      />
      {/* 2-Col Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Control Rail */}
        <div className="lg:col-span-5 order-2 lg:order-1 bg-[#FFFDFB] border border-[#EADCD3] rounded-2xl p-4 sm:p-5 shadow-card space-y-4">
          <div className="flex items-center justify-between pb-2.5 border-b border-[#EFE3DC]">
            <h2 className="text-sm font-extrabold text-[#2C1A12] flex items-center gap-2">
              <Calculator className="w-4 h-4 text-[#D95D39]" />
              信貸條件設定
            </h2>
            <span className="text-[11px] font-semibold text-[#8B6B5C]">自動同步至信貸投資</span>
          </div>

          {/* 3-Way Mode Switcher */}
          <div>
            <label className="block text-xs font-bold text-[#4B3227] mb-1.5">試算方向</label>
            <div className="grid grid-cols-3 gap-1 bg-[#F4EAE3] p-1 rounded-xl border border-[#EADCD3]">
              <button
                type="button"
                onClick={() => setLoanCalcMode('by-amount')}
                className={`py-2 px-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  loanCalcMode === 'by-amount'
                    ? 'bg-[#FFFDFB] text-[#2C1A12] shadow-xs'
                    : 'text-[#6D4E40] hover:text-[#2C1A12]'
                }`}
              >
                算月付金
              </button>
              <button
                type="button"
                onClick={() => {
                  if (loanCalcMode === 'by-amount') {
                    setTargetMonthlyPayment(
                      Math.max(1000, Math.round(loanCalc.postGracePayment || 20000))
                    );
                  }
                  setLoanCalcMode('by-payment');
                }}
                className={`py-2 px-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  loanCalcMode === 'by-payment'
                    ? 'bg-[#FFFDFB] text-[#2C1A12] shadow-xs'
                    : 'text-[#6D4E40] hover:text-[#2C1A12]'
                }`}
              >
                逆推可貸額
              </button>
              <button
                type="button"
                onClick={() => {
                  if (loanCalcMode === 'by-payment') {
                    setLoanAmount(effectiveLoanAmount);
                  } else if (loanCalcMode === 'by-amount') {
                    setTargetMonthlyPayment(
                      Math.max(1000, Math.round(loanCalc.postGracePayment || 20000))
                    );
                  }
                  setLoanCalcMode('by-rate');
                }}
                className={`py-2 px-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  loanCalcMode === 'by-rate'
                    ? 'bg-[#FFFDFB] text-[#2C1A12] shadow-xs'
                    : 'text-[#6D4E40] hover:text-[#2C1A12]'
                }`}
              >
                逆推年利率
              </button>
            </div>
          </div>

          {/* Repayment Method */}
          <div>
            <label className="block text-xs font-bold text-[#4B3227] mb-1.5">攤還方式</label>
            <div className="grid grid-cols-2 gap-1.5 bg-[#F4EAE3] p-1 rounded-xl border border-[#EADCD3]">
              <button
                type="button"
                onClick={() => setRepaymentMethod('equal-pi')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                  repaymentMethod === 'equal-pi'
                    ? 'bg-[#2C1A12] text-white shadow-xs'
                    : 'text-[#6D4E40] hover:text-[#2C1A12]'
                }`}
              >
                本息均攤 (固定)
              </button>
              <button
                type="button"
                onClick={() => setRepaymentMethod('equal-principal')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                  repaymentMethod === 'equal-principal'
                    ? 'bg-[#2C1A12] text-white shadow-xs'
                    : 'text-[#6D4E40] hover:text-[#2C1A12]'
                }`}
              >
                本金均攤 (遞減)
              </button>
            </div>
          </div>

          {/* Contextual Core Inputs */}
          <div>
            {loanCalcMode === 'by-rate' ? (
              <>
                <NumberSliderInput
                  id="loan-amount-rate"
                  label="貸款總金額"
                  value={loanAmount}
                  onChange={setLoanAmount}
                  min={100000}
                  max={8000000}
                  step={50000}
                  prefix="NT$"
                  quickPresets={[
                    { label: '80萬', value: 800000 },
                    { label: '150萬', value: 1500000 },
                    { label: '250萬', value: 2500000 },
                    { label: '500萬', value: 5000000 }
                  ]}
                />
                <NumberSliderInput
                  id="loan-pmt-rate"
                  label={
                    repaymentMethod === 'equal-pi'
                      ? graceMonths > 0
                        ? '寬限期後每月還款金額'
                        : '每月還款金額'
                      : '首期攤還最高月付金'
                  }
                  value={targetMonthlyPayment}
                  onChange={setTargetMonthlyPayment}
                  min={3000}
                  max={150000}
                  step={100}
                  prefix="NT$"
                  helperText={
                    reverseRateResult.error === 'insufficient'
                      ? '月付不足以還清本金'
                      : `逆推年利率約 ${reverseRateResult.rate.toFixed(2)}%`
                  }
                />

                <div className="my-2 bg-[#FFF6F2] border border-[#F0D5C9] rounded-xl p-3">
                  {reverseRateResult.error === 'insufficient' ? (
                    <div className="flex items-start gap-2 text-[#C04832] text-xs font-bold">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        月付金不足以在 {Math.max(1, loanMonths - graceMonths)} 期內還清本金，請提高月付或延長期數。
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[11px] font-bold text-[#B54B2E]">
                          名目利率 {reverseRateResult.error === 'too-high' ? '>' : ''}
                          {reverseRateResult.rate.toFixed(2)}% / APR {loanCalc.apr.toFixed(2)}%
                        </p>
                        {reverseRateResult.error === 'too-high' && (
                          <p className="text-[11px] text-[#C04832]">
                            已達上限 {MAX_REVERSE_ANNUAL_RATE}%
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={!!reverseRateResult.error}
                        onClick={() => {
                          setSingleRate(Number(reverseRateResult.rate.toFixed(2)));
                          setRateMode('single');
                          setLoanCalcMode('by-amount');
                        }}
                        className="text-xs font-bold bg-[#2C1A12] text-white px-3 py-1.5 rounded-lg hover:bg-[#3F261B] disabled:opacity-40"
                      >
                        鎖定此利率
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : loanCalcMode === 'by-amount' ? (
              <NumberSliderInput
                id="loan-amount-main"
                label="貸款總金額"
                value={loanAmount}
                onChange={setLoanAmount}
                min={100000}
                max={8000000}
                step={50000}
                prefix="NT$"
                helperText={`月付約 ${formatCurrency(loanCalc.postGracePayment)}`}
                quickPresets={[
                  { label: '80萬', value: 800000 },
                  { label: '150萬', value: 1500000 },
                  { label: '250萬', value: 2500000 },
                  { label: '350萬', value: 3500000 },
                  { label: '500萬', value: 5000000 }
                ]}
              />
            ) : (
              <>
                <NumberSliderInput
                  id="loan-target-pmt"
                  label={
                    repaymentMethod === 'equal-pi'
                      ? '預期每月還款金額'
                      : '預期最高月付金 (首期攤還)'
                  }
                  value={targetMonthlyPayment}
                  onChange={setTargetMonthlyPayment}
                  min={3000}
                  max={150000}
                  step={1000}
                  prefix="NT$"
                  helperText={`可貸約 ${formatShortCurrency(effectiveLoanAmount)}`}
                  quickPresets={[
                    { label: '1萬/月', value: 10000 },
                    { label: '1.5萬/月', value: 15000 },
                    { label: '2萬/月', value: 20000 },
                    { label: '3萬/月', value: 30000 },
                    { label: '5萬/月', value: 50000 }
                  ]}
                />

                <div className="my-2 bg-[#FFF6F2] border border-[#F0D5C9] rounded-xl p-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-bold text-[#B54B2E]">
                      依 {loanMonths} 期逆推可貸總額
                    </p>
                    <p className="text-base font-extrabold text-[#2C1A12] tabular-nums">
                      {formatCurrency(effectiveLoanAmount)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setLoanAmount(effectiveLoanAmount);
                      setLoanCalcMode('by-amount');
                    }}
                    className="text-xs font-bold bg-[#2C1A12] text-white px-3 py-1.5 rounded-lg hover:bg-[#3F261B] shrink-0"
                  >
                    鎖定此貸款額
                  </button>
                </div>
              </>
            )}

            <NumberSliderInput
              id="loan-months"
              label="貸款總期數"
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
                { label: '3年(36)', value: 36 },
                { label: '5年(60)', value: 60 },
                { label: '7年(84)', value: 84 },
                { label: '10年(120)', value: 120 }
              ]}
            />

            <NumberSliderInput
              id="loan-grace"
              label="寬限期 (只繳息不還本)"
              value={graceMonths}
              onChange={setGraceMonths}
              min={0}
              max={Math.min(36, Math.max(0, loanMonths - 1))}
              step={1}
              unit="個月"
              strictMax
              quickPresets={[
                { label: '無寬限', value: 0 },
                { label: '6個月', value: 6 },
                { label: '12個月', value: 12 },
                { label: '24個月', value: 24 }
              ]}
            />
          </div>

          {/* Rate Structure */}
          {isRateMode ? (
            <div className="p-3 rounded-xl bg-[#FAF5F0] border border-[#EFE3DC] flex items-center gap-2 text-xs">
              <Percent className="w-3.5 h-3.5 text-[#D95D39] shrink-0" />
              <span className="font-bold text-[#4B3227]">
                計息結構：一段式固定利率 {effectiveSingleRate.toFixed(2)}% (由月付逆推)
              </span>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-[#4B3227] mb-1.5">計息結構</label>
                <div className="grid grid-cols-2 gap-1.5 bg-[#F4EAE3] p-1 rounded-xl border border-[#EADCD3]">
                  <button
                    type="button"
                    onClick={() => setRateMode('single')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                      rateMode === 'single'
                        ? 'bg-[#D95D39] text-white shadow-xs'
                        : 'text-[#6D4E40] hover:text-[#2C1A12]'
                    }`}
                  >
                    一段式利率
                  </button>
                  <button
                    type="button"
                    onClick={() => setRateMode('staged')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                      rateMode === 'staged'
                        ? 'bg-[#D95D39] text-white shadow-xs'
                        : 'text-[#6D4E40] hover:text-[#2C1A12]'
                    }`}
                  >
                    兩段式階梯
                  </button>
                </div>
              </div>

              {rateMode === 'single' ? (
                <NumberSliderInput
                  id="loan-single-rate"
                  label="貸款年利率"
                  value={singleRate}
                  onChange={setSingleRate}
                  min={1.5}
                  max={12.0}
                  step={0.01}
                  unit="%"
                  quickPresets={[
                    { label: '2.08%', value: 2.08 },
                    { label: '2.25%', value: 2.25 },
                    { label: '2.50%', value: 2.5 },
                    { label: '3.00%', value: 3.0 }
                  ]}
                />
              ) : (
                <div className="bg-[#FAF5F0] border border-[#EFE3DC] rounded-xl p-3">
                  <NumberSliderInput
                    id="loan-s1-months"
                    label="第 1 段優惠期數"
                    value={stage1Months}
                    onChange={setStage1Months}
                    min={1}
                    max={Math.max(1, loanMonths - 1)}
                    step={1}
                    unit="個月"
                    strictMax
                    quickPresets={[
                      { label: '前3期', value: 3 },
                      { label: '前6期', value: 6 },
                      { label: '前12期', value: 12 }
                    ]}
                  />
                  <NumberSliderInput
                    id="loan-s1-rate"
                    label="第 1 段年利率"
                    value={stage1Rate}
                    onChange={setStage1Rate}
                    min={0.01}
                    max={10.0}
                    step={0.01}
                    unit="%"
                    quickPresets={[
                      { label: '0.88%', value: 0.88 },
                      { label: '1.68%', value: 1.68 },
                      { label: '1.88%', value: 1.88 }
                    ]}
                  />
                  <NumberSliderInput
                    id="loan-s2-rate"
                    label={`第 2 段年利率 (M${stage1Months + 1}起)`}
                    value={stage2Rate}
                    onChange={setStage2Rate}
                    min={1.5}
                    max={14.0}
                    step={0.01}
                    unit="%"
                    quickPresets={[
                      { label: '2.38%', value: 2.38 },
                      { label: '2.58%', value: 2.58 },
                      { label: '3.20%', value: 3.2 }
                    ]}
                  />
                </div>
              )}
            </div>
          )}

          <NumberSliderInput
            id="loan-fee"
            label="銀行開辦費 / 手續費"
            value={loanFee}
            onChange={setLoanFee}
            min={0}
            max={15000}
            step={500}
            prefix="NT$"
            quickPresets={[
              { label: '免開辦費', value: 0 },
              { label: '$3,000', value: 3000 },
              { label: '$6,000', value: 6000 },
              { label: '$9,000', value: 9000 }
            ]}
          />
        </div>

        {/* Right Canvas: Hero + Visual Cost Breakdown + Interactive Chart */}
        <div className="lg:col-span-7 order-1 lg:order-2 space-y-5 min-w-0">
          {/* Hero KPI Card */}
          <div
            ref={heroRef}
            className="bg-gradient-to-br from-[#D95D39] via-[#CB502D] to-[#A63D1F] rounded-2xl p-5 sm:p-6 text-white shadow-elevated"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs">
                {loanCalcMode === 'by-payment'
                  ? '由預期月付金逆推可貸總額'
                  : loanCalcMode === 'by-rate'
                  ? '由月付金與總額逆推利率'
                  : '由貸款總額試算月付金'}
              </span>

              <div className="flex items-center gap-2">
                <a
                  href="#loan-detail-schedule"
                  className="text-xs font-bold bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-xl inline-flex items-center gap-1 transition-colors"
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span>明細表</span>
                </a>
                <button
                  type="button"
                  onClick={onSyncToArbitrage}
                  className="text-xs font-bold bg-[#2C1A12] hover:bg-[#1E110B] text-white px-3.5 py-1.5 rounded-xl inline-flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <span>帶入信貸投資</span>
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Primary + Secondary Grid */}
            <div className="grid grid-cols-2 gap-4 sm:gap-5">
              <div className="min-w-0">
                <p className="text-xs text-white/80 mb-1 truncate">
                  {loanCalcMode === 'by-rate'
                    ? '逆推名目年利率'
                    : loanCalcMode === 'by-payment'
                    ? '逆推可貸最高總額'
                    : graceMonths > 0
                    ? `寬限後月付 (M${graceMonths + 1}+)`
                    : '首期應繳月付金'}
                </p>
                <p className="text-xl sm:text-2xl font-extrabold tracking-tight tabular-nums whitespace-nowrap">
                  {loanCalcMode === 'by-rate'
                    ? reverseRateResult.error === 'insufficient'
                      ? '無解'
                      : `${reverseRateResult.error === 'too-high' ? '>' : ''}${reverseRateResult.rate.toFixed(2)}%`
                    : loanCalcMode === 'by-payment'
                    ? formatCurrency(effectiveLoanAmount)
                    : formatCurrency(loanCalc.postGracePayment)}
                </p>
                <p className="text-[11px] text-white/80 mt-0.5 truncate">
                  {graceMonths > 0 && loanCalcMode === 'by-amount'
                    ? `寬限期月繳 ${formatCurrency(loanCalc.firstMonthPayment)}`
                    : `貸款 ${formatShortCurrency(effectiveLoanAmount)}`}
                </p>
              </div>

              <div className="min-w-0">
                <p className="text-xs text-white/80 mb-1 truncate">總費用年百分率 (APR)</p>
                <p className="text-xl sm:text-2xl font-extrabold tabular-nums whitespace-nowrap">
                  {loanCalc.apr.toFixed(2)}%
                </p>
                <p className="text-[11px] text-white/80 mt-0.5 truncate">
                  含開辦費 {formatCurrency(loanFee)}
                </p>
              </div>

              <div className="min-w-0 pt-3 border-t border-white/15">
                <p className="text-xs text-white/80 mb-1 truncate">總利息支出</p>
                <p className="text-lg sm:text-xl font-extrabold tabular-nums whitespace-nowrap">
                  {formatCurrency(loanCalc.totalInterest)}
                </p>
                <p className="text-[11px] text-white/80 mt-0.5 truncate">
                  佔本金{' '}
                  {effectiveLoanAmount > 0
                    ? ((loanCalc.totalInterest / effectiveLoanAmount) * 100).toFixed(1)
                    : 0}
                  %
                </p>
              </div>

              <div className="min-w-0 pt-3 border-t border-white/15">
                <p className="text-xs text-white/80 mb-1 truncate">本息＋費用總支出</p>
                <p className="text-lg sm:text-xl font-extrabold tabular-nums whitespace-nowrap">
                  {formatCurrency(loanCalc.totalPayment + loanFee)}
                </p>
                <p className="text-[11px] text-white/80 mt-0.5 truncate">
                  實拿 {formatCurrency(Math.max(0, effectiveLoanAmount - loanFee))}
                </p>
              </div>
            </div>
          </div>

          {/* Total Cost Breakdown Visual Strip */}
          <div className="bg-[#FFFDFB] border border-[#EADCD3] rounded-2xl p-4 shadow-card space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-extrabold text-[#2C1A12]">全期總還款結構佔比</span>
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold">
                <span className="flex items-center gap-1.5 text-[#2C1A12]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#D95D39]" />
                  本金 {principalShare.toFixed(1)}%
                </span>
                <span className="flex items-center gap-1.5 text-[#6D4E40]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#4B3227]" />
                  利息 {interestShare.toFixed(1)}%
                </span>
                {loanFee > 0 && (
                  <span className="flex items-center gap-1.5 text-[#8B6B5C]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#C8A898]" />
                    開辦費 {feeShare.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
            <div className="w-full h-2.5 rounded-full bg-[#F4EAE3] overflow-hidden flex">
              <div className="bg-[#D95D39] h-full" style={{ width: `${principalShare}%` }} />
              <div className="bg-[#4B3227] h-full" style={{ width: `${interestShare}%` }} />
              <div className="bg-[#C8A898] h-full" style={{ width: `${feeShare}%` }} />
            </div>
          </div>

          {/* Unified Chart Card with Switcher */}
          <div className="bg-[#FFFDFB] border border-[#EADCD3] rounded-2xl p-4 sm:p-5 shadow-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-[#2C1A12]">
                  {loanChartView === 'balance'
                    ? '剩餘貸款本金與累積利息走勢'
                    : '每月月付金結構拆解 (還本 vs 利息)'}
                </h3>
                <p className="text-xs text-[#8B6B5C]">
                  {loanChartView === 'balance'
                    ? '觀察隨著期數推進，剩餘本金下降速度與累積利息變化'
                    : '深焙色為利息支出，珊瑚色為實質償還的負債本金'}
                </p>
              </div>

              <div className="inline-flex bg-[#F4EAE3] p-1 rounded-xl border border-[#EADCD3] self-start">
                <button
                  type="button"
                  onClick={() => setLoanChartView('balance')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    loanChartView === 'balance'
                      ? 'bg-[#FFFDFB] text-[#2C1A12] shadow-xs'
                      : 'text-[#6D4E40] hover:text-[#2C1A12]'
                  }`}
                >
                  餘額與利息走勢
                </button>
                <button
                  type="button"
                  onClick={() => setLoanChartView('structure')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    loanChartView === 'structure'
                      ? 'bg-[#FFFDFB] text-[#2C1A12] shadow-xs'
                      : 'text-[#6D4E40] hover:text-[#2C1A12]'
                  }`}
                >
                  每期本息結構
                </button>
              </div>
            </div>

            <div className="relative h-72 sm:h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {loanChartView === 'balance' ? (
                  <AreaChart
                    data={loanCalc.schedule}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="loanRemainGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#D95D39" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#D95D39" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="loanIntGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4B3227" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="#4B3227" stopOpacity={0.03} />
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
                        fontSize: '12px'
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Area
                      isAnimationActive={false}
                      type="monotone"
                      dataKey="remainingBalance"
                      name="剩餘貸款本金"
                      stroke="#D95D39"
                      strokeWidth={2.5}
                      fill="url(#loanRemainGrad)"
                    />
                    <Area
                      isAnimationActive={false}
                      type="monotone"
                      dataKey="cumulativeInterest"
                      name="累積已繳利息"
                      stroke="#4B3227"
                      strokeWidth={2}
                      fill="url(#loanIntGrad)"
                    />
                  </AreaChart>
                ) : (
                  <BarChart
                    data={loanCalc.schedule.filter(
                      (_, idx) => loanMonths <= 48 || idx % 2 === 0 || idx === loanMonths - 1
                    )}
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
                    <Bar isAnimationActive={false} dataKey="interest" name="當月利息" stackId="a" fill="#4B3227" />
                    <Bar
                      isAnimationActive={false}
                      dataKey="principal"
                      name="當月還本"
                      stackId="a"
                      fill="#D95D39"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Amortization Schedule Table */}
      <section
        id="loan-detail-schedule"
        className="bg-[#FFFDFB] border border-[#EADCD3] rounded-2xl p-4 sm:p-5 shadow-card"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-[#2C1A12] flex items-center gap-2">
              <TableIcon className="w-4 h-4 text-[#D95D39]" />
              信貸每期詳細還款明細表（共 {loanMonths} 期）
            </h3>
            <p className="text-xs text-[#8B6B5C] mt-0.5">
              詳列每期期初本金、當期月付、還本、利息、本息比例與期末剩餘貸款
            </p>
          </div>

          <button
            type="button"
            onClick={() => onExportCSV('loan')}
            className="flex items-center justify-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl bg-[#2C1A12] text-[#FFFDFB] hover:bg-[#3F261B] transition-colors shrink-0 self-start sm:self-auto"
          >
            <Download className="w-3.5 h-3.5" />
            <span>匯出完整明細 CSV</span>
          </button>
        </div>

        {/* Year Filter Pills */}
        <div className="w-full overflow-x-auto warm-scroll pb-1 mb-3">
          <div className="inline-flex items-center gap-1 bg-[#F4EAE3] p-1 rounded-xl border border-[#EADCD3]">
            <button
              type="button"
              onClick={() => setLoanTableFilterYear('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                loanTableFilterYear === 'all'
                  ? 'bg-[#D95D39] text-white shadow-2xs'
                  : 'text-[#6D4E40] hover:text-[#2C1A12]'
              }`}
            >
              全部 ({loanMonths}期)
            </button>
            {yearOptions.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setLoanTableFilterYear(String(y))}
                className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  loanTableFilterYear === String(y)
                    ? 'bg-[#D95D39] text-white shadow-2xs'
                    : 'text-[#6D4E40] hover:text-[#2C1A12]'
                }`}
              >
                第{y}年
              </button>
            ))}
          </div>
        </div>

        {/* Period Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 bg-[#FAF5F0] border border-[#EFE3DC] rounded-xl p-3">
          <div>
            <span className="text-[11px] text-[#8B6B5C] block">
              {loanTableFilterYear === 'all'
                ? '全期應繳本息總計'
                : `第 ${loanTableFilterYear} 年應繳小計`}
            </span>
            <span className="text-xs sm:text-sm font-extrabold text-[#2C1A12] tabular-nums">
              {formatCurrency(sumPayment)}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-[#8B6B5C] block">期間償還本金合計</span>
            <span className="text-xs sm:text-sm font-extrabold text-[#1F7A5C] tabular-nums">
              {formatCurrency(sumPrincipal)}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-[#8B6B5C] block">期間利息支出合計</span>
            <span className="text-xs sm:text-sm font-extrabold text-[#C04832] tabular-nums">
              {formatCurrency(sumInterest)}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-[#8B6B5C] block">期末剩餘貸款本金</span>
            <span className="text-xs sm:text-sm font-extrabold text-[#D95D39] tabular-nums">
              {formatCurrency(endRemain)}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[480px] warm-scroll rounded-xl border border-[#EFE3DC]">
          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
            <thead className="bg-[#F4EAE3] text-[#4B3227] sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-3 font-bold">期數</th>
                <th className="py-2.5 px-3 font-bold">年利率</th>
                <th className="py-2.5 px-3 font-bold text-right">期初本金</th>
                <th className="py-2.5 px-3 font-bold text-right">當期應繳月付</th>
                <th className="py-2.5 px-3 font-bold text-right">償還本金</th>
                <th className="py-2.5 px-3 font-bold text-right">償還利息</th>
                <th className="py-2.5 px-3 font-bold text-center">本息結構</th>
                <th className="py-2.5 px-3 font-bold text-right">累積已還本金</th>
                <th className="py-2.5 px-3 font-bold text-right">累積已繳利息</th>
                <th className="py-2.5 px-3 font-bold text-right">期末剩餘貸款</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F4EAE3] tabular-nums">
              {filteredSchedule.map((row) => (
                <tr key={row.month} className="hover:bg-[#FAF5F0] transition-colors">
                  <td className="py-2.5 px-3 font-bold text-[#2C1A12]">
                    第 {row.month} 期
                    <span className="ml-1 text-[10px] font-normal text-[#8B6B5C]">
                      Y{row.year}M{((row.month - 1) % 12) + 1}
                    </span>
                    {row.isGracePeriod && (
                      <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#FDF0ED] text-[#C04832]">
                        寬限期
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-[#6D4E40]">{row.annualRate.toFixed(2)}%</td>
                  <td className="py-2.5 px-3 text-right text-[#6D4E40]">
                    {formatCurrency(row.beginningBalance)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-extrabold text-[#2C1A12]">
                    {formatCurrency(row.payment)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-[#1F7A5C] font-bold">
                    {formatCurrency(row.principal)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-[#C04832] font-semibold">
                    {formatCurrency(row.interest)}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="w-24 mx-auto">
                      <div className="flex justify-between text-[10px] text-[#6D4E40] mb-0.5">
                        <span>本 {row.principalRatio.toFixed(0)}%</span>
                        <span>息 {(100 - row.principalRatio).toFixed(0)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#EADCD3] rounded-full overflow-hidden flex">
                        <div
                          className="bg-[#1F7A5C] h-full"
                          style={{ width: `${Math.min(100, Math.max(0, row.principalRatio))}%` }}
                        />
                        <div
                          className="bg-[#D95D39] h-full"
                          style={{
                            width: `${Math.min(100, Math.max(0, 100 - row.principalRatio))}%`
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right text-[#1F7A5C]">
                    {formatCurrency(row.cumulativePrincipal)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-[#8B6B5C]">
                    {formatCurrency(row.cumulativeInterest)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-extrabold text-[#2C1A12]">
                    {formatCurrency(row.remainingBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
