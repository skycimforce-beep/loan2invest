import React, { useState, useMemo } from 'react';
import HeaderNav from './components/HeaderNav';
import GuideModal from './components/GuideModal';
import LoanTab from './components/LoanTab';
import CompoundTab from './components/CompoundTab';
import ArbitrageTab from './components/ArbitrageTab';
import {
  formatCurrency,
  solveMaxPrincipalFromMonthlyPayment,
  solveAnnualRateFromPayment,
  generateLoanSchedule,
  generateCompoundSchedule,
  generateArbitrageSimulation
} from './utils/finance';

export default function App() {
  const [activeTab, setActiveTab] = useState('arbitrage');
  const [copiedToast, setCopiedToast] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // ------------------------------------------
  // 1. 信貸試算狀態
  // ------------------------------------------
  const [loanCalcMode, setLoanCalcMode] = useState('by-amount');
  const [targetMonthlyPayment, setTargetMonthlyPayment] = useState(20000);
  const [loanAmount, setLoanAmount] = useState(1500000);
  const [loanMonths, setLoanMonths] = useState(84);
  const [repaymentMethod, setRepaymentMethod] = useState('equal-pi');
  const [graceMonths, setGraceMonths] = useState(0);
  const [rateMode, setRateMode] = useState('single');
  const [singleRate, setSingleRate] = useState(2.25);
  const [stage1Months, setStage1Months] = useState(6);
  const [stage1Rate, setStage1Rate] = useState(1.68);
  const [stage2Rate, setStage2Rate] = useState(2.58);
  const [loanFee, setLoanFee] = useState(3000);

  // ------------------------------------------
  // 2. 投資複利試算狀態
  // ------------------------------------------
  const [compInitial, setCompInitial] = useState(1500000);
  const [compMonthlyDCA, setCompMonthlyDCA] = useState(15000);
  const [compYears, setCompYears] = useState(7);
  const [compReturnRate, setCompReturnRate] = useState(8.0);
  const [compFreq, setCompFreq] = useState('monthly');
  const [compInflation, setCompInflation] = useState(2.0);

  // ------------------------------------------
  // 3. 信貸投資試算狀態
  // ------------------------------------------
  const [repaymentSource, setRepaymentSource] = useState('portfolio');
  const [cashBufferMonths, setCashBufferMonths] = useState(12);
  const [annualRefillReserve, setAnnualRefillReserve] = useState(true);
  const [arbExtraCapital, setArbExtraCapital] = useState(0);
  const [arbMonthlyDCA, setArbMonthlyDCA] = useState(0);
  const [arbGrowthRate, setArbGrowthRate] = useState(4.5);
  const [arbDividendRate, setArbDividendRate] = useState(4.0);
  const [reinvestDividends, setReinvestDividends] = useState(false);
  const [deductFeeFromLoan, setDeductFeeFromLoan] = useState(false);

  // 檢視與篩選狀態
  const [loanTableFilterYear, setLoanTableFilterYear] = useState('all');
  const [compTableViewMode, setCompTableViewMode] = useState('yearly');
  const [arbTableFilterYear, setArbTableFilterYear] = useState('all');
  const [arbChartType, setArbChartType] = useState('balance');

  // ------------------------------------------
  // 即時衍生計算
  // ------------------------------------------
  const reverseCalculatedLoanAmount = useMemo(
    () =>
      solveMaxPrincipalFromMonthlyPayment({
        targetMonthlyPayment,
        totalMonths: loanMonths,
        repaymentMethod,
        graceMonths,
        rateMode,
        singleRate,
        stage1Rate
      }),
    [
      targetMonthlyPayment,
      loanMonths,
      repaymentMethod,
      graceMonths,
      rateMode,
      singleRate,
      stage1Rate
    ]
  );

  const effectiveLoanAmount =
    loanCalcMode === 'by-payment' ? reverseCalculatedLoanAmount : loanAmount;

  const reverseRateResult = useMemo(
    () =>
      solveAnnualRateFromPayment({
        loanAmount,
        targetMonthlyPayment,
        totalMonths: loanMonths,
        repaymentMethod,
        graceMonths
      }),
    [loanAmount, targetMonthlyPayment, loanMonths, repaymentMethod, graceMonths]
  );

  const isRateMode = loanCalcMode === 'by-rate';
  const effectiveRateMode = isRateMode ? 'single' : rateMode;
  const effectiveSingleRate = isRateMode
    ? Number(reverseRateResult.rate.toFixed(4))
    : singleRate;

  const loanConfig = useMemo(
    () => ({
      loanAmount: effectiveLoanAmount,
      totalMonths: loanMonths,
      repaymentMethod,
      graceMonths,
      rateMode: effectiveRateMode,
      singleRate: effectiveSingleRate,
      stage1Months,
      stage1Rate,
      stage2Rate,
      fee: loanFee
    }),
    [
      effectiveLoanAmount,
      loanMonths,
      repaymentMethod,
      graceMonths,
      effectiveRateMode,
      effectiveSingleRate,
      stage1Months,
      stage1Rate,
      stage2Rate,
      loanFee
    ]
  );

  const loanCalc = useMemo(() => generateLoanSchedule(loanConfig), [loanConfig]);

  const compCalc = useMemo(
    () =>
      generateCompoundSchedule({
        initialPrincipal: compInitial,
        monthlyContribution: compMonthlyDCA,
        years: compYears,
        annualReturnRate: compReturnRate,
        compoundingFrequency: compFreq,
        inflationRate: compInflation
      }),
    [compInitial, compMonthlyDCA, compYears, compReturnRate, compFreq, compInflation]
  );

  const arbCalc = useMemo(
    () =>
      generateArbitrageSimulation({
        loanConfig,
        repaymentSource,
        cashBufferMonths,
        annualRefillReserve,
        extraOwnCapital: arbExtraCapital,
        extraMonthlyDCA: arbMonthlyDCA,
        annualGrowthRate: arbGrowthRate,
        annualDividendRate: arbDividendRate,
        reinvestDividends,
        deductFeeFromLoan
      }),
    [
      loanConfig,
      repaymentSource,
      cashBufferMonths,
      annualRefillReserve,
      arbExtraCapital,
      arbMonthlyDCA,
      arbGrowthRate,
      arbDividendRate,
      reinvestDividends,
      deductFeeFromLoan
    ]
  );

  const handleExportCSV = (type) => {
    let headers = [];
    let rows = [];
    let filename = 'calculation.csv';

    if (type === 'loan') {
      filename = `信貸每期詳細還款明細_${effectiveLoanAmount}元_${loanMonths}期.csv`;
      headers = [
        '期數(月)',
        '年度',
        '適用年利率(%)',
        '期初本金餘額',
        '單月應繳本息總額',
        '當期償還本金',
        '當期償還利息',
        '本金佔月付比例(%)',
        '累積已還本金',
        '累積已繳利息',
        '累積已繳本息總額',
        '期末剩餘貸款本金'
      ];
      rows = loanCalc.schedule.map((r) => [
        r.month,
        r.year,
        r.annualRate.toFixed(2),
        Math.round(r.beginningBalance),
        Math.round(r.payment),
        Math.round(r.principal),
        Math.round(r.interest),
        r.principalRatio.toFixed(1),
        Math.round(r.cumulativePrincipal),
        Math.round(r.cumulativeInterest),
        Math.round(r.cumulativePayment),
        Math.round(r.remainingBalance)
      ]);
    } else if (type === 'compound') {
      filename = `投資複利明細_${compYears}年.csv`;
      headers = [
        '期數(月)',
        '年度',
        '期初資產',
        '當月定期投入',
        '當月投資收益',
        '累積投入本金',
        '期末總資產',
        '累積總獲利',
        '通膨折現實質資產'
      ];
      rows = compCalc.monthlySchedule.map((r) => [
        r.month,
        r.year,
        Math.round(r.startVal),
        Math.round(r.contribution),
        Math.round(r.monthlyReturn),
        Math.round(r.cumulativePrincipal),
        Math.round(r.portfolioValue),
        Math.round(r.totalProfit),
        Math.round(r.realValue)
      ]);
    } else {
      filename = `信貸投資每月金流與剩餘貸款明細_${
        repaymentSource === 'portfolio' ? '投資提領還款' : '薪資現金流還款'
      }.csv`;
      headers = [
        '期數(月)',
        '年度',
        '期初投資資產',
        '當月資本利得',
        '當月配息金額',
        '當月信貸應繳總額',
        '信貸還本',
        '信貸繳息',
        '單月淨現金流(收益減月付)',
        '期末投資資產',
        '期末剩餘貸款本金',
        '期末帳面淨資產'
      ];
      rows = arbCalc.monthlyDetails.map((r) => [
        r.month,
        r.year,
        Math.round(r.startAsset),
        Math.round(r.monthGrowth),
        Math.round(r.monthDividend),
        Math.round(r.loanPayment),
        Math.round(r.loanPrincipal),
        Math.round(r.loanInterest),
        Math.round(r.monthlyNetCashFlow),
        Math.round(r.endAsset),
        Math.round(r.remainingDebt),
        Math.round(r.currentNetWorth)
      ]);
    }

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopySummary = () => {
    const modeName =
      repaymentSource === 'portfolio'
        ? '模式A：由投資部位提領還款（零額外月付負擔）'
        : '模式B：由薪資現金流還款（本金完整留存市場複利）';
    const summaryText = `【WarmRoast｜信貸投資試算摘要】
・貸款金額：${formatCurrency(effectiveLoanAmount)}（共 ${loanMonths} 期 / 寬限期 ${graceMonths} 個月）
・實質年百分率 (APR)：${arbCalc.apr.toFixed(2)}%
・預期年化總報酬率：${arbCalc.totalExpectedAnnualReturn.toFixed(2)}%（成長 ${arbGrowthRate}% + 配息 ${arbDividendRate}%）
・年化利差空間：${arbCalc.spreadRate >= 0 ? '+' : ''}${arbCalc.spreadRate.toFixed(2)}%
・還款模式：${modeName}
・期滿投資總資產：${formatCurrency(arbCalc.activeFinalAsset)}
・期滿扣除所有成本後淨賺：${formatCurrency(arbCalc.activeNetProfit)}`;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(summaryText);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = summaryText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
    } finally {
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    }
  };

  const totalLoanYears = Math.ceil(loanMonths / 12);
  const yearOptions = Array.from({ length: totalLoanYears }, (_, idx) => idx + 1);

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#FAF5F0] text-[#2C1A12] font-sans pb-24 md:pb-12 selection:bg-[#D95D39] selection:text-white">
      <HeaderNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onCopySummary={handleCopySummary}
        copiedToast={copiedToast}
        onOpenGuide={() => setIsGuideOpen(true)}
      />

      <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-5 sm:pt-6">
        {activeTab === 'loan' && (
          <LoanTab
            loanCalcMode={loanCalcMode}
            setLoanCalcMode={setLoanCalcMode}
            targetMonthlyPayment={targetMonthlyPayment}
            setTargetMonthlyPayment={setTargetMonthlyPayment}
            loanAmount={loanAmount}
            setLoanAmount={setLoanAmount}
            effectiveLoanAmount={effectiveLoanAmount}
            loanMonths={loanMonths}
            setLoanMonths={setLoanMonths}
            repaymentMethod={repaymentMethod}
            setRepaymentMethod={setRepaymentMethod}
            graceMonths={graceMonths}
            setGraceMonths={setGraceMonths}
            rateMode={rateMode}
            setRateMode={setRateMode}
            singleRate={singleRate}
            setSingleRate={setSingleRate}
            stage1Months={stage1Months}
            setStage1Months={setStage1Months}
            stage1Rate={stage1Rate}
            setStage1Rate={setStage1Rate}
            stage2Rate={stage2Rate}
            setStage2Rate={setStage2Rate}
            loanFee={loanFee}
            setLoanFee={setLoanFee}
            isRateMode={isRateMode}
            effectiveSingleRate={effectiveSingleRate}
            reverseRateResult={reverseRateResult}
            loanCalc={loanCalc}
            loanTableFilterYear={loanTableFilterYear}
            setLoanTableFilterYear={setLoanTableFilterYear}
            yearOptions={yearOptions}
            onSyncToArbitrage={() => {
              setLoanAmount(effectiveLoanAmount);
              setCompInitial(effectiveLoanAmount);
              setCompYears(Math.max(1, Math.round(loanMonths / 12)));
              setActiveTab('arbitrage');
            }}
            onExportCSV={handleExportCSV}
          />
        )}

        {activeTab === 'compound' && (
          <CompoundTab
            compInitial={compInitial}
            setCompInitial={setCompInitial}
            compMonthlyDCA={compMonthlyDCA}
            setCompMonthlyDCA={setCompMonthlyDCA}
            compYears={compYears}
            setCompYears={setCompYears}
            compReturnRate={compReturnRate}
            setCompReturnRate={setCompReturnRate}
            compFreq={compFreq}
            setCompFreq={setCompFreq}
            compInflation={compInflation}
            setCompInflation={setCompInflation}
            compCalc={compCalc}
            compTableViewMode={compTableViewMode}
            setCompTableViewMode={setCompTableViewMode}
            onSyncToArbitrage={() => {
              setArbGrowthRate(Number((compReturnRate * 0.6).toFixed(1)));
              setArbDividendRate(Number((compReturnRate * 0.4).toFixed(1)));
              setActiveTab('arbitrage');
            }}
            onExportCSV={handleExportCSV}
          />
        )}

        {activeTab === 'arbitrage' && (
          <ArbitrageTab
            loanAmount={effectiveLoanAmount}
            setLoanAmount={(val) => {
              if (loanCalcMode === 'by-payment') setLoanCalcMode('by-amount');
              setLoanAmount(val);
            }}
            loanMonths={loanMonths}
            setLoanMonths={setLoanMonths}
            graceMonths={graceMonths}
            setGraceMonths={setGraceMonths}
            effectiveRateMode={effectiveRateMode}
            effectiveSingleRate={effectiveSingleRate}
            isRateMode={isRateMode}
            setRateMode={setRateMode}
            setLoanCalcMode={setLoanCalcMode}
            setSingleRate={setSingleRate}
            stage1Months={stage1Months}
            stage1Rate={stage1Rate}
            stage2Rate={stage2Rate}
            repaymentSource={repaymentSource}
            setRepaymentSource={setRepaymentSource}
            cashBufferMonths={cashBufferMonths}
            setCashBufferMonths={setCashBufferMonths}
            annualRefillReserve={annualRefillReserve}
            setAnnualRefillReserve={setAnnualRefillReserve}
            arbExtraCapital={arbExtraCapital}
            setArbExtraCapital={setArbExtraCapital}
            arbMonthlyDCA={arbMonthlyDCA}
            setArbMonthlyDCA={setArbMonthlyDCA}
            arbGrowthRate={arbGrowthRate}
            setArbGrowthRate={setArbGrowthRate}
            arbDividendRate={arbDividendRate}
            setArbDividendRate={setArbDividendRate}
            reinvestDividends={reinvestDividends}
            setReinvestDividends={setReinvestDividends}
            deductFeeFromLoan={deductFeeFromLoan}
            setDeductFeeFromLoan={setDeductFeeFromLoan}
            arbCalc={arbCalc}
            arbChartType={arbChartType}
            setArbChartType={setArbChartType}
            arbTableFilterYear={arbTableFilterYear}
            setArbTableFilterYear={setArbTableFilterYear}
            yearOptions={yearOptions}
            onGoToLoanTab={() => setActiveTab('loan')}
            onExportCSV={handleExportCSV}
            onOpenGuide={() => setIsGuideOpen(true)}
          />
        )}
      </main>

      <GuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        loanAmount={effectiveLoanAmount}
        loanMonths={loanMonths}
        cashBufferMonths={cashBufferMonths}
        arbCalc={arbCalc}
      />
    </div>
  );
}