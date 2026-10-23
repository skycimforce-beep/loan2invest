import React, { useState, useEffect, useMemo } from 'react';
import {
  Calculator,
  TrendingUp,
  Scale,
  Wallet,
  Percent,
  Calendar,
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  Download,
  Copy,
  Check,
  Info,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Coins,
  ShieldAlert,
  Layers,
  Table as TableIcon,
  BarChart3
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
  Legend,
  ReferenceLine,
  ComposedChart,
  Line
} from 'recharts';

// ==========================================
// 財務數學核心計算函式 (Financial Math Engine)
// ==========================================

// 格式化台幣金額
const formatCurrency = (val) => {
  if (val === undefined || val === null || isNaN(val)) return 'NT$ 0';
  const rounded = Math.round(val);
  const prefix = rounded < 0 ? '-NT$ ' : 'NT$ ';
  return prefix + Math.abs(rounded).toLocaleString('zh-TW');
};

const formatShortCurrency = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '$0';
  const absVal = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (absVal >= 100000000) {
    return `${sign}${(absVal / 100000000).toFixed(2)}億`;
  }
  if (absVal >= 10000) {
    return `${sign}${(absVal / 10000).toFixed(1)}萬`;
  }
  return `${sign}$${Math.round(absVal).toLocaleString('zh-TW')}`;
};

// 計算本息平均攤還之單月應繳金額 (PMT)
const calcPMT = (principal, monthlyRate, months) => {
  if (months <= 0 || principal <= 0) return 0;
  if (monthlyRate <= 0) return principal / months;
  const factor = Math.pow(1 + monthlyRate, months);
  return (principal * monthlyRate * factor) / (factor - 1);
};

// 由預期每月還款金額逆推可貸總本金 (支援本息均攤/本金均攤、寬限期、一段式/兩段式利率)
const solveMaxPrincipalFromMonthlyPayment = ({
  targetMonthlyPayment,
  totalMonths,
  repaymentMethod,
  graceMonths,
  rateMode,
  singleRate,
  stage1Rate
}) => {
  const pmt = Math.max(0, Number(targetMonthlyPayment) || 0);
  if (pmt <= 0) return 0;
  const N = Math.max(1, Math.min(360, Math.round(Number(totalMonths) || 84)));
  const G = Math.max(0, Math.min(N - 1, Math.round(Number(graceMonths) || 0)));
  const amortizingMonths = Math.max(1, N - G);

  // 以開始攤還本金時（第 G+1 期）適用的年利率作為逆推基準
  const annualRate =
    rateMode === 'single'
      ? Number(singleRate) || 0
      : Number(stage1Rate) || 0;
  const r = annualRate / 100 / 12;

  if (repaymentMethod === 'equal-pi') {
    if (r <= 0) return Math.round(pmt * amortizingMonths);
    const factor = Math.pow(1 + r, amortizingMonths);
    return Math.round((pmt * (factor - 1)) / (r * factor));
  } else {
    // 本金平均攤還：以最高月付金（第 G+1 期：P / amortizingMonths + P * r）逆推本金
    const denom = 1 / amortizingMonths + r;
    return denom > 0 ? Math.round(pmt / denom) : 0;
  }
};

// 使用牛頓法求解總費用年百分率 (APR / IRR)
const calculateAPR = (loanAmount, fee, monthlyPayments) => {
  const netProceeds = loanAmount - fee;
  if (netProceeds <= 0 || !monthlyPayments.length) return 0;
  let guess = 0.05 / 12; // 初始猜測月利率
  for (let iter = 0; iter < 100; iter++) {
    let npv = -netProceeds;
    let dNpv = 0;
    for (let t = 0; t < monthlyPayments.length; t++) {
      const m = t + 1;
      const pmt = monthlyPayments[t];
      const denom = Math.pow(1 + guess, m);
      npv += pmt / denom;
      dNpv -= (m * pmt) / Math.pow(1 + guess, m + 1);
    }
    if (Math.abs(npv) < 1e-6) break;
    if (Math.abs(dNpv) < 1e-10) break;
    const nextGuess = guess - npv / dNpv;
    if (nextGuess <= -0.99) {
      guess = 0.0001;
    } else {
      guess = nextGuess;
    }
  }
  return Math.max(0, guess * 12 * 100);
};

// 產生完整信貸還款明細表 (支援：本息均攤/本金均攤、寬限期、一段式/兩段式階梯利率、開辦費)
const generateLoanSchedule = ({
  loanAmount,
  totalMonths,
  repaymentMethod, // 'equal-pi' | 'equal-principal'
  graceMonths,
  rateMode, // 'single' | 'staged'
  singleRate,
  stage1Months,
  stage1Rate,
  stage2Rate,
  fee
}) => {
  const P = Math.max(0, Number(loanAmount) || 0);
  const N = Math.max(1, Math.min(360, Math.round(Number(totalMonths) || 84)));
  const G = Math.max(0, Math.min(N - 1, Math.round(Number(graceMonths) || 0)));
  const S1 = Math.max(1, Math.min(N, Math.round(Number(stage1Months) || 6)));
  const upfrontFee = Math.max(0, Number(fee) || 0);

  let remainingBalance = P;
  const schedule = [];
  const monthlyPayments = [];

  let currentPMT = 0;
  let prevMonthlyRate = -1;

  for (let m = 1; m <= N; m++) {
    const annualRate =
      rateMode === 'single'
        ? Number(singleRate) || 0
        : m <= S1
        ? Number(stage1Rate) || 0
        : Number(stage2Rate) || 0;
    const monthlyRate = annualRate / 100 / 12;

    const interestPayment = remainingBalance * monthlyRate;
    let principalPayment = 0;
    let totalPayment = 0;

    if (m <= G) {
      // 寬限期內：只繳息不還本
      principalPayment = 0;
      totalPayment = interestPayment;
    } else {
      const remainingMonths = N - m + 1;
      if (repaymentMethod === 'equal-pi') {
        // 若剛離開寬限期，或利率發生階梯變化，重新根據剩餘本金與剩餘期數計算 PMT
        if (m === G + 1 || Math.abs(monthlyRate - prevMonthlyRate) > 1e-9) {
          currentPMT = calcPMT(remainingBalance, monthlyRate, remainingMonths);
        }
        totalPayment = currentPMT;
        principalPayment = Math.max(0, totalPayment - interestPayment);
        if (m === N || principalPayment > remainingBalance) {
          principalPayment = remainingBalance;
          totalPayment = principalPayment + interestPayment;
        }
      } else {
        // 本金平均攤還 (寬限期結束後平均攤還本金)
        const amortizingMonths = N - G;
        principalPayment = P / amortizingMonths;
        if (m === N || principalPayment > remainingBalance) {
          principalPayment = remainingBalance;
        }
        totalPayment = principalPayment + interestPayment;
      }
    }

    prevMonthlyRate = monthlyRate;
    const beginningBalance = remainingBalance;
    remainingBalance = Math.max(0, remainingBalance - principalPayment);

    monthlyPayments.push(totalPayment);

    const cumulativePrincipal =
      (schedule.length > 0 ? schedule[schedule.length - 1].cumulativePrincipal : 0) +
      principalPayment;
    const cumulativeInterest =
      (schedule.length > 0 ? schedule[schedule.length - 1].cumulativeInterest : 0) +
      interestPayment;
    const cumulativePayment =
      (schedule.length > 0 ? schedule[schedule.length - 1].cumulativePayment : 0) +
      totalPayment;

    schedule.push({
      month: m,
      year: Math.ceil(m / 12),
      isGracePeriod: m <= G,
      annualRate,
      beginningBalance,
      payment: totalPayment,
      principal: principalPayment,
      interest: interestPayment,
      principalRatio: totalPayment > 0 ? (principalPayment / totalPayment) * 100 : 0,
      remainingBalance,
      cumulativePrincipal,
      cumulativeInterest,
      cumulativePayment
    });
  }

  const totalPayment = schedule.reduce((acc, r) => acc + r.payment, 0);
  const totalInterest = schedule.reduce((acc, r) => acc + r.interest, 0);
  const apr = calculateAPR(P, upfrontFee, monthlyPayments);

  // 第一期與寬限期後月付金參考
  const firstMonthPayment = schedule[0]?.payment || 0;
  const postGracePayment = schedule[G]?.payment || firstMonthPayment;
  const stage2Payment =
    rateMode === 'staged' && S1 < N ? schedule[S1]?.payment || postGracePayment : postGracePayment;

  return {
    schedule,
    totalPayment,
    totalInterest,
    totalCostWithFee: totalInterest + upfrontFee,
    apr,
    firstMonthPayment,
    postGracePayment,
    stage2Payment
  };
};

// 產生投資複利試算明細表 (支援：單筆投入、每月定期定額、按月/按年複利、通膨率折現)
const generateCompoundSchedule = ({
  initialPrincipal,
  monthlyContribution,
  years,
  annualReturnRate,
  compoundingFrequency, // 'monthly' | 'annual'
  inflationRate,
  dividendRatio // 選填：配息佔總報酬比例 (0~100%)
}) => {
  const P0 = Math.max(0, Number(initialPrincipal) || 0);
  const PMT = Math.max(0, Number(monthlyContribution) || 0);
  const totalMonths = Math.max(1, Math.min(600, Math.round((Number(years) || 10) * 12)));
  const rAnnual = (Number(annualReturnRate) || 0) / 100;
  const infAnnual = (Number(inflationRate) || 0) / 100;

  let portfolioValue = P0;
  let cumulativePrincipal = P0;
  let accruedAnnualGain = 0;

  const monthlySchedule = [];
  const yearlySchedule = [];

  for (let m = 1; m <= totalMonths; m++) {
    const startVal = portfolioValue;
    let monthlyReturn = 0;

    if (compoundingFrequency === 'monthly') {
      const rMonth = rAnnual / 12;
      monthlyReturn = startVal * rMonth;
      portfolioValue = startVal + monthlyReturn + PMT;
    } else {
      // 按年複利：平時累積本金，每滿12個月或最後一個月結算一次年度複利
      accruedAnnualGain += startVal * (rAnnual / 12);
      if (m % 12 === 0 || m === totalMonths) {
        monthlyReturn = accruedAnnualGain;
        portfolioValue = startVal + accruedAnnualGain + PMT;
        accruedAnnualGain = 0;
      } else {
        monthlyReturn = 0;
        portfolioValue = startVal + PMT;
      }
    }

    cumulativePrincipal += PMT;
    const totalProfit = portfolioValue - cumulativePrincipal;
    const realDiscount = Math.pow(1 + infAnnual / 12, m);
    const realValue = portfolioValue / realDiscount;

    const row = {
      month: m,
      year: Math.ceil(m / 12),
      startVal,
      contribution: PMT,
      monthlyReturn,
      cumulativePrincipal,
      portfolioValue,
      totalProfit,
      realValue
    };
    monthlySchedule.push(row);

    if (m % 12 === 0 || m === totalMonths) {
      yearlySchedule.push({
        label: `第 ${Math.ceil(m / 12)} 年`,
        year: Math.ceil(m / 12),
        month: m,
        cumulativePrincipal: Math.round(cumulativePrincipal),
        portfolioValue: Math.round(portfolioValue),
        totalProfit: Math.round(totalProfit),
        realValue: Math.round(realValue)
      });
    }
  }

  const finalRow = monthlySchedule[monthlySchedule.length - 1] || {
    cumulativePrincipal: P0,
    portfolioValue: P0,
    totalProfit: 0,
    realValue: P0
  };

  return {
    monthlySchedule,
    yearlySchedule,
    finalValue: finalRow.portfolioValue,
    totalPrincipal: finalRow.cumulativePrincipal,
    totalProfit: finalRow.totalProfit,
    realFinalValue: finalRow.realValue,
    roiPercent:
      finalRow.cumulativePrincipal > 0
        ? (finalRow.totalProfit / finalRow.cumulativePrincipal) * 100
        : 0
  };
};

// 產生信貸投資套利明細表 (支援雙模式切換 + 預留還款現金準備金池 + 配息率/資本利得拆解 + 詳盡每月金流與剩餘貸款)
const generateArbitrageSimulation = ({
  loanConfig,
  repaymentSource, // 'portfolio' (模式A：由借貸資金池/投資部位自給自足還款) | 'salary' (模式B：由薪資/自有現金流還款，本金留在市場複利)
  cashBufferMonths = 12, // 模式 A 期初從貸款中預留幾個月的還款準備金於現金池 (0 / 6 / 12 / 18 / 24 個月)
  annualRefillReserve = true, // 模式 A 當現金池不足時，是否以「整批補足一週期」方式賣股補水（避免每月零碎賣股）
  cashBufferInterestRate = 1.5, // 預留還款準備金放高利活存之年利率 (%)
  extraOwnCapital, // 額外投入自有資金
  extraMonthlyDCA, // 除還款外每月額外定期定額
  annualGrowthRate, // 預期年化資本利得率 (%)
  annualDividendRate, // 預期年化配息率 (%)
  reinvestDividends, // 配息是否再投入 (若為 salary 模式可選擇領現衝抵月付金或再投入)
  deductFeeFromLoan // 開辦費是否直接從貸款撥款金額中扣除
}) => {
  const loanResult = generateLoanSchedule(loanConfig);
  const { schedule: loanRows, apr } = loanResult;

  const P_loan = Math.max(0, Number(loanConfig.loanAmount) || 0);
  const P_own = Math.max(0, Number(extraOwnCapital) || 0);
  const fee = Math.max(0, Number(loanConfig.fee) || 0);
  const monthlyDCA = Math.max(0, Number(extraMonthlyDCA) || 0);
  const bufMonths = Math.max(0, Math.min(60, Math.round(Number(cashBufferMonths) || 0)));

  const totalAvailablePool =
    (deductFeeFromLoan ? Math.max(0, P_loan - fee) : P_loan) + P_own;

  // 計算期初應預留在「還款現金準備金帳戶」的金額（前 bufMonths 個月的應繳月付金總和）
  const initialCashReserveA =
    bufMonths > 0
      ? loanRows
          .slice(0, Math.min(bufMonths, loanRows.length))
          .reduce((sum, r) => sum + r.payment, 0)
      : 0;
  const clampedInitialReserveA = Math.min(totalAvailablePool, initialCashReserveA);
  const initialStockInvestedA = Math.max(0, totalAvailablePool - clampedInitialReserveA);

  // 模式 B 因為由薪水繳款，可 100% 投入股市
  const initialInvestedB = totalAvailablePool;

  const rGrowthMonth = (Number(annualGrowthRate) || 0) / 100 / 12;
  const rDivMonth = (Number(annualDividendRate) || 0) / 100 / 12;
  const rCashMonth = (Number(cashBufferInterestRate) || 0) / 100 / 12;
  const totalExpectedAnnualReturn =
    (Number(annualGrowthRate) || 0) + (Number(annualDividendRate) || 0);

  let stockPortfolioA = initialStockInvestedA; // 模式A：實際投入市場的股票部位
  let cashReserveA = clampedInitialReserveA; // 模式A：留在銀行準備扣款的現金準備金池
  let portfolioB = initialInvestedB; // 模式B：薪資還款 (不動用投資本金)

  let cumulativeOutOfPocketA = P_own + (deductFeeFromLoan ? 0 : fee);
  let cumulativeOutOfPocketB = P_own + (deductFeeFromLoan ? 0 : fee);
  let cumulativeCashDivReceivedB = 0;

  let depletedMonthA = null;
  let sellStockCountA = 0;
  const monthlyDetails = [];

  for (let i = 0; i < loanRows.length; i++) {
    const lr = loanRows[i];
    const m = lr.month;
    const loanPayment = lr.payment;

    // --- 計算模式 A：雙資金池運作（股票投資部位 + 還款現金準備金帳戶） ---
    const startStockA = stockPortfolioA;
    const startCashA = cashReserveA;
    const startTotalAssetA = startStockA + startCashA;

    const capitalGainA = startStockA > 0 ? startStockA * rGrowthMonth : 0;
    const dividendA = startStockA > 0 ? startStockA * rDivMonth : 0;
    const cashInterestA = startCashA > 0 ? startCashA * rCashMonth : 0;
    const totalReturnA = capitalGainA + dividendA + cashInterestA;

    let endStockA = startStockA + capitalGainA + monthlyDCA;
    let endCashA = startCashA + cashInterestA;
    let principalSoldFromPortfolioA = 0;
    let pocketSupplementA = monthlyDCA;

    if (bufMonths === 0) {
      // 理想理論模式（0 個月預留現金）：配息與價差留在帳戶，每月底直接從投資部位扣繳月付金
      endStockA += dividendA - loanPayment;
      principalSoldFromPortfolioA = Math.max(
        0,
        Math.min(startStockA + totalReturnA, loanPayment - totalReturnA)
      );
      if (principalSoldFromPortfolioA > 0) sellStockCountA += 1;
      if (endStockA < 0) {
        if (depletedMonthA === null) depletedMonthA = m;
        pocketSupplementA += Math.abs(endStockA);
        endStockA = 0;
      }
    } else {
      // 實務預留準備金模式（例如預留 6 個月或 12 個月還款金於現金池）：
      // 1. 當月配息直接匯入「還款現金準備金池」自動幫補水位！
      endCashA += dividendA;

      // 2. 檢查當月準備金池是否足夠扣繳銀行月付金
      if (endCashA >= loanPayment) {
        endCashA -= loanPayment;
      } else {
        // 準備金池水位不足以支付本月信貸，需從股票部位提領補水
        if (annualRefillReserve) {
          // 定期整批補水：一次從股票部位賣出「補足未來 bufMonths 期（或剩餘期數）所需月付金差額」，避免每個月零碎賣股
          const refillWindow = Math.max(1, Math.min(bufMonths, loanRows.length - i));
          const neededForWindow = loanRows
            .slice(i, i + refillWindow)
            .reduce((sum, r) => sum + r.payment, 0);
          const targetSell = Math.max(loanPayment - endCashA, neededForWindow - endCashA);
          const actualSell = Math.min(Math.max(0, endStockA), targetSell);
          if (actualSell > 0) sellStockCountA += 1;
          principalSoldFromPortfolioA = actualSell;
          endStockA -= actualSell;
          endCashA += actualSell;
        } else {
          // 僅賣出當月不足的差額
          const deficit = loanPayment - endCashA;
          const actualSell = Math.min(Math.max(0, endStockA), deficit);
          if (actualSell > 0) sellStockCountA += 1;
          principalSoldFromPortfolioA = actualSell;
          endStockA -= actualSell;
          endCashA += actualSell;
        }

        // 扣繳本月月付金
        endCashA -= loanPayment;
        if (endCashA < -0.5) {
          if (depletedMonthA === null) depletedMonthA = m;
          pocketSupplementA += Math.abs(endCashA);
          endCashA = 0;
        } else {
          endCashA = Math.max(0, endCashA);
        }
      }
    }

    stockPortfolioA = endStockA;
    cashReserveA = endCashA;
    const endPortfolioA = endStockA + endCashA; // 模式 A 總資產 = 期末股票市值 + 期末剩餘準備金現金
    cumulativeOutOfPocketA += pocketSupplementA;

    // --- 計算模式 B：每月由薪資/自有現金流繳款，投資部位完整複利 ---
    const startPortfolioB = portfolioB;
    const capitalGainB = startPortfolioB * rGrowthMonth;
    const dividendB = startPortfolioB * rDivMonth;
    const totalReturnB = capitalGainB + dividendB;

    let endPortfolioB = startPortfolioB + capitalGainB + monthlyDCA;

    if (reinvestDividends) {
      endPortfolioB += dividendB;
    } else {
      // 配息領現用來貼補信貸月付金
      cumulativeCashDivReceivedB += dividendB;
    }

    portfolioB = endPortfolioB;
    cumulativeOutOfPocketB += loanPayment + monthlyDCA;

    // 依據使用者目前選擇的主模式整理顯示欄位
    const isPortfolioMode = repaymentSource === 'portfolio';

    const startAsset = isPortfolioMode ? startTotalAssetA : startPortfolioB;
    const monthGrowth = isPortfolioMode ? capitalGainA : capitalGainB;
    const monthDividend = isPortfolioMode ? dividendA + cashInterestA : dividendB;
    const monthTotalReturn = isPortfolioMode ? totalReturnA : totalReturnB;
    const endAsset = isPortfolioMode ? endPortfolioA : endPortfolioB;
    const remainingDebt = lr.remainingBalance;

    // 淨資產 (投資部位價值 + 準備金現金 + 已領現配息 - 剩餘未還貸款本金)
    const netWorthA = endPortfolioA - remainingDebt;
    const netWorthB =
      endPortfolioB + (reinvestDividends ? 0 : cumulativeCashDivReceivedB) - remainingDebt;
    const currentNetWorth = isPortfolioMode ? netWorthA : netWorthB;

    const monthlyNetCashFlow = isPortfolioMode
      ? totalReturnA - loanPayment
      : dividendB - loanPayment;

    const outOfPocketThisMonth = isPortfolioMode
      ? pocketSupplementA
      : reinvestDividends
      ? loanPayment + monthlyDCA
      : loanPayment - dividendB + monthlyDCA;

    monthlyDetails.push({
      month: m,
      year: lr.year,
      annualLoanRate: lr.annualRate,
      // 投資與現金準備池端
      startAsset,
      startStockA: Math.round(startStockA),
      startCashA: Math.round(startCashA),
      monthGrowth,
      monthDividend,
      monthTotalReturn,
      endStockA: Math.round(endStockA),
      endCashA: Math.round(endCashA),
      endAsset,
      // 貸款端
      loanPayment,
      loanPrincipal: lr.principal,
      loanInterest: lr.interest,
      remainingDebt,
      // 綜合指標
      monthlyNetCashFlow,
      principalSoldFromPortfolioA,
      outOfPocketThisMonth,
      currentNetWorth,
      // 雙模式對照數據 (供圖表與比較卡片使用)
      endPortfolioA: Math.round(endPortfolioA),
      endPortfolioB: Math.round(endPortfolioB),
      netWorthA: Math.round(netWorthA),
      netWorthB: Math.round(netWorthB),
      remainingDebtRounded: Math.round(remainingDebt)
    });
  }

  const lastRow = monthlyDetails[monthlyDetails.length - 1] || {};
  const totalLoanPaid = loanResult.totalPayment;
  const totalInterestPaid = loanResult.totalInterest;

  // 模式 A 最終淨利：期末總資產(股票+剩餘準備金現金) - 自有投入總成本
  const finalNetProfitA = (lastRow.endPortfolioA || 0) - cumulativeOutOfPocketA;

  // 模式 B 最終淨利：期末投資總價值 + 累積領現配息 - 總繳貸款金額 - 開辦費 - 自有本金與DCA
  const finalNetProfitB =
    (lastRow.endPortfolioB || 0) +
    (reinvestDividends ? 0 : cumulativeCashDivReceivedB) -
    cumulativeOutOfPocketB;

  const activeFinalAsset =
    repaymentSource === 'portfolio' ? lastRow.endPortfolioA || 0 : lastRow.endPortfolioB || 0;
  const activeNetProfit =
    repaymentSource === 'portfolio' ? finalNetProfitA : finalNetProfitB;
  const activeOutOfPocket =
    repaymentSource === 'portfolio' ? cumulativeOutOfPocketA : cumulativeOutOfPocketB;

  const spreadRate = totalExpectedAnnualReturn - apr;

  return {
    loanResult,
    monthlyDetails,
    initialInvested:
      repaymentSource === 'portfolio' ? initialStockInvestedA : initialInvestedB,
    initialStockInvestedA,
    initialCashReserveA: clampedInitialReserveA,
    totalAvailablePool,
    sellStockCountA,
    totalExpectedAnnualReturn,
    apr,
    spreadRate,
    activeFinalAsset,
    activeNetProfit,
    activeOutOfPocket,
    finalNetProfitA,
    finalNetProfitB,
    finalAssetA: lastRow.endPortfolioA || 0,
    finalAssetB: lastRow.endPortfolioB || 0,
    depletedMonthA,
    totalLoanPaid,
    totalInterestPaid
  };
};

// ==========================================
// 通用暖色系 UI 元件 (Warm Coral & Dark Roast UI)
// ==========================================

const NumberSliderInput = ({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  prefix = '',
  helperText = '',
  quickPresets = []
}) => {
  const [inputStr, setInputStr] = useState(String(value ?? ''));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setInputStr(String(value ?? 0));
    }
  }, [value, isFocused]);

  const handleTextChange = (e) => {
    const raw = e.target.value;
    // 允許使用者完全清空輸入框，或輸入小數點與數字，並自動消去多餘的前導 0 (例如 "0720000" -> "720000")
    if (raw === '') {
      setInputStr('');
      onChange(0);
      return;
    }
    const cleaned = raw.replace(/^0+(?=\d)/, '');
    setInputStr(cleaned);
    const parsed = Number(cleaned);
    if (!isNaN(parsed)) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (inputStr === '' || isNaN(Number(inputStr))) {
      setInputStr(String(min));
      onChange(min);
    } else {
      const num = Number(inputStr);
      setInputStr(String(num));
      onChange(num);
    }
  };

  return (
    <div className="bg-[#FFF9F6] border border-[#F2DCD2] rounded-2xl p-3.5 shadow-sm transition-all focus-within:border-[#E06D53] focus-within:ring-2 focus-within:ring-[#E06D53]/15 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 min-w-0">
        <label className="text-xs font-bold text-[#5C3D31] tracking-wide flex items-center gap-1 leading-snug">
          {label}
        </label>
        <div className="flex items-center bg-[#FDF1EB] border border-[#EBCBC0] rounded-xl px-2.5 py-1 shrink-0 ml-auto">
          {prefix && (
            <span className="text-xs font-bold text-[#8A6253] mr-1 whitespace-nowrap">
              {prefix}
            </span>
          )}
          <input
            type="text"
            inputMode="decimal"
            value={isFocused ? inputStr : String(value ?? 0)}
            onFocus={() => {
              setIsFocused(true);
              setInputStr(String(value ?? ''));
            }}
            onChange={handleTextChange}
            onBlur={handleBlur}
            placeholder="0"
            className="w-24 sm:w-28 text-right font-extrabold text-sm text-[#382218] bg-transparent focus:outline-none tabular-nums"
          />
          {unit && (
            <span className="text-xs font-semibold text-[#8A6253] ml-1 whitespace-nowrap">
              {unit}
            </span>
          )}
        </div>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={Math.min(max, Math.max(min, Number(value) || 0))}
        onChange={(e) => {
          const num = Number(e.target.value);
          setInputStr(String(num));
          onChange(num);
        }}
        className="w-full h-2 bg-[#F4DDD3] rounded-lg appearance-none cursor-pointer accent-[#E06D53]"
      />

      <div className="flex flex-wrap items-center justify-between gap-1.5 mt-2">
        {quickPresets.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {quickPresets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => onChange(preset.value)}
                className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold whitespace-nowrap transition-all ${
                  Number(value) === preset.value
                    ? 'bg-[#E06D53] text-white shadow-xs'
                    : 'bg-[#F7E7DF] text-[#6E4B3E] hover:bg-[#EED3C7]'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-[11px] text-[#9A7465] whitespace-nowrap">
            範圍：{prefix}
            {min.toLocaleString()} ~ {prefix}
            {max.toLocaleString()} {unit}
          </span>
        )}
        {helperText && (
          <span className="text-[11px] font-bold text-[#B85741] whitespace-nowrap ml-auto">
            {helperText}
          </span>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 主應用程式元件 (Main App Component)
// ==========================================

export default function App() {
  // 當前分頁：'loan' (信貸試算) | 'compound' (投資複利試算) | 'arbitrage' (信貸投資試算)
  const [activeTab, setActiveTab] = useState('arbitrage');
  const [copiedToast, setCopiedToast] = useState(false);

  // ------------------------------------------
  // 1. 信貸試算狀態 (與第3頁共用核心參數或可一鍵同步)
  // ------------------------------------------
  // 試算模式：'by-amount' (輸入貸款總額算月付金) | 'by-payment' (輸入預期月付金額逆推可貸總額)
  const [loanCalcMode, setLoanCalcMode] = useState('by-amount');
  const [targetMonthlyPayment, setTargetMonthlyPayment] = useState(20000); // 預期每月還款金額
  const [loanAmount, setLoanAmount] = useState(1500000); // 150 萬
  const [loanMonths, setLoanMonths] = useState(84); // 84 期 (7年)
  const [repaymentMethod, setRepaymentMethod] = useState('equal-pi'); // 'equal-pi' | 'equal-principal'
  const [graceMonths, setGraceMonths] = useState(0); // 寬限期月數
  const [rateMode, setRateMode] = useState('single'); // 'single' | 'staged'
  const [singleRate, setSingleRate] = useState(2.25); // 一段式年利率 (%)
  const [stage1Months, setStage1Months] = useState(6); // 第一段期數
  const [stage1Rate, setStage1Rate] = useState(1.68); // 第一段利率 (%)
  const [stage2Rate, setStage2Rate] = useState(2.58); // 第二段利率 (%)
  const [loanFee, setLoanFee] = useState(3000); // 開辦費

  // ------------------------------------------
  // 2. 投資複利試算狀態
  // ------------------------------------------
  const [compInitial, setCompInitial] = useState(1500000);
  const [compMonthlyDCA, setCompMonthlyDCA] = useState(15000);
  const [compYears, setCompYears] = useState(7);
  const [compReturnRate, setCompReturnRate] = useState(8.0);
  const [compFreq, setCompFreq] = useState('monthly'); // 'monthly' | 'annual'
  const [compInflation, setCompInflation] = useState(2.0);

  // ------------------------------------------
  // 3. 信貸投資試算 (套利與每月金流) 狀態
  // ------------------------------------------
  // 還款資金來源切換開關：'portfolio' (從投資部位提領還款) vs 'salary' (從薪資現金流還款，本金完整複利)
  const [repaymentSource, setRepaymentSource] = useState('portfolio');
  const [cashBufferMonths, setCashBufferMonths] = useState(12); // 模式A期初預留還款現金月數 (預設預留12個月=1年份月付金)
  const [annualRefillReserve, setAnnualRefillReserve] = useState(true); // 準備金用罄時是否一次賣股補足下一週期準備金
  const [arbExtraCapital, setArbExtraCapital] = useState(0); // 額外自有資金併入投資
  const [arbMonthlyDCA, setArbMonthlyDCA] = useState(0); // 額外每月定期定額
  const [arbGrowthRate, setArbGrowthRate] = useState(4.5); // 預期年化資本利得 (%)
  const [arbDividendRate, setArbDividendRate] = useState(4.0); // 預期年化配息率 (%)
  const [reinvestDividends, setReinvestDividends] = useState(false); // 薪資還款模式下，配息是否再投入
  const [deductFeeFromLoan, setDeductFeeFromLoan] = useState(false);

  // 明細表展開/篩選狀態
  const [loanTableFilterYear, setLoanTableFilterYear] = useState('all');
  const [compTableViewMode, setCompTableViewMode] = useState('yearly'); // 'yearly' | 'monthly'
  const [arbTableFilterYear, setArbTableFilterYear] = useState('all');
  const [arbChartType, setArbChartType] = useState('balance'); // 'balance' | 'cashflow' | 'compare'

  // ------------------------------------------
  // 即時衍生試算結果 (Memoized Calculations)
  // ------------------------------------------
  // 當選擇「由預期月付金逆推可貸總額」時，即時動態計算可貸本金
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

  const loanConfig = useMemo(
    () => ({
      loanAmount: effectiveLoanAmount,
      totalMonths: loanMonths,
      repaymentMethod,
      graceMonths,
      rateMode,
      singleRate,
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
      rateMode,
      singleRate,
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

  // 匯出 CSV 功能
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
      filename = `信貸投資每月金流與剩餘貸款明細_${repaymentSource === 'portfolio' ? '投資提領還款' : '薪資現金流還款'}.csv`;
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

  // 複製摘要報告到剪貼簿
  const handleCopySummary = () => {
    const modeName =
      repaymentSource === 'portfolio'
        ? '模式A：由投資部位提領還款（零額外月付負擔）'
        : '模式B：由薪資現金流還款（本金完整留存市場複利）';
    const summaryText = `【暖心理財｜信貸投資試算摘要】
・貸款金額：${formatCurrency(loanAmount)}（共 ${loanMonths} 期 / 寬限期 ${graceMonths} 個月）
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
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    } catch (err) {
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    }
  };

  // 年份清單供下拉篩選
  const totalLoanYears = Math.ceil(loanMonths / 12);
  const yearOptions = Array.from({ length: totalLoanYears }, (_, idx) => idx + 1);

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#FAF2ED] text-[#382218] font-sans pb-28 selection:bg-[#E06D53] selection:text-white">
      {/* 頂部暖珊瑚粉 App 導覽列 */}
      <header className="sticky top-0 z-30 bg-[#FFF9F6]/95 backdrop-blur-md border-b border-[#F0D9CE] px-3.5 sm:px-4 py-2.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-[#E06D53] to-[#C8533B] flex items-center justify-center text-white shadow-md shadow-[#E06D53]/25 shrink-0">
              <Scale className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <h1 className="text-sm sm:text-lg font-extrabold tracking-tight text-[#382218] truncate">
                  WarmRoast 借貸投資試算
                </h1>
                <span className="hidden sm:inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#FDE6DF] text-[#C8533B] whitespace-nowrap">
                  手機產品級 UI
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-[#8A6253] truncate">
                信貸攤還・定期定額複利・槓桿金流模擬
              </p>
            </div>
          </div>

          {/* 桌面與平板頂部快速分頁切換 */}
          <div className="hidden md:flex items-center bg-[#F4E3DA] p-1 rounded-2xl border border-[#EBCBC0] shrink-0">
            {[
              { id: 'loan', label: '信貸試算', icon: Calculator },
              { id: 'compound', label: '投資複利試算', icon: TrendingUp },
              { id: 'arbitrage', label: '信貸投資試算', icon: ArrowRightLeft }
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    active
                      ? 'bg-[#E06D53] text-white shadow-sm'
                      : 'text-[#6E4B3E] hover:text-[#382218]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleCopySummary}
            className="flex items-center gap-1 text-xs font-bold px-2.5 sm:px-3 py-2 rounded-xl bg-[#FDF1EB] hover:bg-[#F7E0D4] text-[#5C3D31] border border-[#EBCBC0] transition-all shrink-0 whitespace-nowrap"
          >
            {copiedToast ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#2E7D5B] shrink-0" />
                <span className="text-[#2E7D5B]">已複製</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#E06D53] shrink-0" />
                <span className="sm:hidden">複製報告</span>
                <span className="hidden sm:inline">複製試算報告</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* 手機版頂部膠囊切換器 (方便單手在頂部或底部切換) */}
      <div className="md:hidden px-3.5 pt-3">
        <div className="grid grid-cols-3 bg-[#F3E1D8] p-1 rounded-2xl border border-[#EBCBC0]">
          {[
            { id: 'loan', label: '1. 信貸試算' },
            { id: 'compound', label: '2. 投資複利' },
            { id: 'arbitrage', label: '3. 信貸投資' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-[#E06D53] text-white shadow-sm'
                  : 'text-[#6E4B3E]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 主內容區 */}
      <main className="max-w-5xl w-full mx-auto px-3.5 sm:px-4 pt-3.5 sm:pt-4 space-y-5 sm:space-y-6 overflow-x-hidden">
        {/* ====================================================
            PAGE 1: 信貸試算 (Personal Loan Calculator)
           ==================================================== */}
        {activeTab === 'loan' && (
          <div className="space-y-6">
            {/* 核心結果 Hero Card */}
            <div className="bg-gradient-to-br from-[#E06D53] via-[#D86047] to-[#B84730] rounded-3xl p-4 sm:p-6 text-white shadow-lg shadow-[#E06D53]/20 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4">
                <div className="flex items-center">
                  <span className="text-[11px] sm:text-xs font-semibold tracking-wide bg-white/20 backdrop-blur-xs px-3 py-1 rounded-full whitespace-nowrap">
                    {loanCalcMode === 'by-payment'
                      ? '由預期月付金逆推可貸總額模式'
                      : '由貸款總額試算月付金模式'}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:flex items-center gap-2">
                  <a
                    href="#loan-detail-schedule"
                    className="text-xs font-bold bg-white/20 hover:bg-white/30 text-white px-3 py-2 sm:py-1.5 rounded-full flex items-center justify-center gap-1 transition-all whitespace-nowrap"
                  >
                    <TableIcon className="w-3.5 h-3.5 shrink-0" />
                    <span>每期還款明細</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setLoanAmount(effectiveLoanAmount);
                      setCompInitial(effectiveLoanAmount);
                      setCompYears(Math.max(1, Math.round(loanMonths / 12)));
                      setActiveTab('arbitrage');
                    }}
                    className="text-xs font-bold bg-[#382218] hover:bg-[#271710] text-[#FFF9F6] px-3 py-2 sm:py-1.5 rounded-full flex items-center justify-center gap-1 transition-all shadow-xs whitespace-nowrap"
                  >
                    <span>帶入信貸投資</span>
                    <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                {loanCalcMode === 'by-payment' ? (
                  <div className="bg-[#382218]/40 border border-white/30 backdrop-blur-xs rounded-2xl p-3 sm:p-3.5 min-w-0">
                    <p className="text-[11px] sm:text-xs text-[#FFE5DC] font-semibold mb-1 truncate">
                      逆推可貸最高總額
                    </p>
                    <p className="text-base sm:text-xl md:text-2xl font-extrabold text-[#FFF9F6] whitespace-nowrap tracking-tight tabular-nums">
                      {formatCurrency(effectiveLoanAmount)}
                    </p>
                    <p className="text-[11px] text-white/85 mt-1 truncate">
                      月付 {formatCurrency(targetMonthlyPayment)} 逆推
                    </p>
                  </div>
                ) : (
                  <div className="bg-white/12 backdrop-blur-xs rounded-2xl p-3 sm:p-3.5 min-w-0">
                    <p className="text-[11px] sm:text-xs text-white/80 mb-1 truncate">
                      {graceMonths > 0
                        ? `寬限期後月付 (M${graceMonths + 1}起)`
                        : '首期應繳月付金'}
                    </p>
                    <p className="text-base sm:text-xl md:text-2xl font-extrabold whitespace-nowrap tracking-tight tabular-nums">
                      {formatCurrency(loanCalc.postGracePayment)}
                    </p>
                    {graceMonths > 0 ? (
                      <p className="text-[11px] text-white/85 mt-1 truncate">
                        寬限期月繳：{formatCurrency(loanCalc.firstMonthPayment)}
                      </p>
                    ) : (
                      <p className="text-[11px] text-white/85 mt-1 truncate">
                        貸款：{formatCurrency(effectiveLoanAmount)}
                      </p>
                    )}
                  </div>
                )}

                <div className="bg-white/12 backdrop-blur-xs rounded-2xl p-3 sm:p-3.5 min-w-0">
                  <p className="text-[11px] sm:text-xs text-white/80 mb-1 truncate">
                    總費用年百分率 (APR)
                  </p>
                  <p className="text-base sm:text-xl md:text-2xl font-extrabold whitespace-nowrap tracking-tight tabular-nums">
                    {loanCalc.apr.toFixed(2)}%
                  </p>
                  <p className="text-[11px] text-white/85 mt-1 truncate">
                    含開辦費 {formatCurrency(loanFee)}
                  </p>
                </div>

                <div className="bg-white/12 backdrop-blur-xs rounded-2xl p-3 sm:p-3.5 min-w-0">
                  <p className="text-[11px] sm:text-xs text-white/80 mb-1 truncate">總利息支出</p>
                  <p className="text-base sm:text-xl md:text-2xl font-extrabold whitespace-nowrap tracking-tight tabular-nums">
                    {formatCurrency(loanCalc.totalInterest)}
                  </p>
                  <p className="text-[11px] text-white/85 mt-1 truncate">
                    利息佔本金{' '}
                    {effectiveLoanAmount > 0
                      ? ((loanCalc.totalInterest / effectiveLoanAmount) * 100).toFixed(1)
                      : 0}
                    %
                  </p>
                </div>

                <div className="bg-white/12 backdrop-blur-xs rounded-2xl p-3 sm:p-3.5 min-w-0">
                  <p className="text-[11px] sm:text-xs text-white/80 mb-1 truncate">
                    本息＋費用總支出
                  </p>
                  <p className="text-base sm:text-xl md:text-2xl font-extrabold whitespace-nowrap tracking-tight tabular-nums">
                    {formatCurrency(loanCalc.totalPayment + loanFee)}
                  </p>
                  <p className="text-[11px] text-white/85 mt-1 truncate">
                    實拿 {formatCurrency(Math.max(0, effectiveLoanAmount - loanFee))}
                  </p>
                </div>
              </div>
            </div>

            {/* 參數輸入與視覺化圖表雙欄佈局 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-w-0">
              {/* 左側：信貸條件設定 */}
              <div className="lg:col-span-5 space-y-4 bg-[#FFF9F6] border border-[#F0D9CE] rounded-3xl p-4 sm:p-5 shadow-xs min-w-0">
                <div className="flex items-center justify-between border-b border-[#F2E2DA] pb-3">
                  <h2 className="text-base font-extrabold text-[#382218] flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-[#E06D53]" />
                    信貸條件設定
                  </h2>
                  <span className="text-xs text-[#8A6253] whitespace-nowrap">即時聯動第 3 頁</span>
                </div>

                {/* 新增：試算方向切換（輸入貸款總額算月付 vs 輸入預期月付逆推可貸總額） */}
                <div className="bg-[#FDF1EB] border border-[#EBCBC0] rounded-2xl p-2.5">
                  <label className="block text-xs font-extrabold text-[#382218] mb-2 flex items-center gap-1.5">
                    <ArrowRightLeft className="w-3.5 h-3.5 text-[#E06D53]" />
                    選擇試算方式
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 bg-[#F4DDD3] p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setLoanCalcMode('by-amount')}
                      className={`py-2 px-1.5 rounded-lg text-[11px] sm:text-xs font-extrabold whitespace-nowrap transition-all ${
                        loanCalcMode === 'by-amount'
                          ? 'bg-[#E06D53] text-white shadow-xs'
                          : 'text-[#6E4B3E] hover:text-[#382218]'
                      }`}
                    >
                      輸入「貸款總額」算月付
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetMonthlyPayment(
                          Math.max(1000, Math.round(loanCalc.postGracePayment || 20000))
                        );
                        setLoanCalcMode('by-payment');
                      }}
                      className={`py-2 px-1.5 rounded-lg text-[11px] sm:text-xs font-extrabold whitespace-nowrap transition-all ${
                        loanCalcMode === 'by-payment'
                          ? 'bg-[#E06D53] text-white shadow-xs'
                          : 'text-[#6E4B3E] hover:text-[#382218]'
                      }`}
                    >
                      輸入「預期月付」逆推總額
                    </button>
                  </div>
                </div>

                {/* 還款方式切換：本息均攤 vs 本金均攤 */}
                <div>
                  <label className="block text-xs font-bold text-[#5C3D31] mb-1.5">
                    攤還方式
                  </label>
                  <div className="grid grid-cols-2 gap-2 bg-[#F6E6DE] p-1 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setRepaymentMethod('equal-pi')}
                      className={`py-2 px-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                        repaymentMethod === 'equal-pi'
                          ? 'bg-[#382218] text-[#FFF9F6] shadow-xs'
                          : 'text-[#6E4B3E] hover:text-[#382218]'
                      }`}
                    >
                      本息均攤 (月付固定)
                    </button>
                    <button
                      type="button"
                      onClick={() => setRepaymentMethod('equal-principal')}
                      className={`py-2 px-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                        repaymentMethod === 'equal-principal'
                          ? 'bg-[#382218] text-[#FFF9F6] shadow-xs'
                          : 'text-[#6E4B3E] hover:text-[#382218]'
                      }`}
                    >
                      本金均攤 (越繳越少)
                    </button>
                  </div>
                </div>

                {loanCalcMode === 'by-amount' ? (
                  <NumberSliderInput
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
                  <div className="space-y-3">
                    <NumberSliderInput
                      label={
                        repaymentMethod === 'equal-pi'
                          ? '預期每月還款金額 (本息均攤月付)'
                          : '預期最高每月還款金額 (首期攤還月付)'
                      }
                      value={targetMonthlyPayment}
                      onChange={(val) => {
                        setTargetMonthlyPayment(val);
                      }}
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

                    {/* 逆推結果醒目提示卡 */}
                    <div className="bg-gradient-to-r from-[#FFF3EE] to-[#FDE6DF] border-2 border-[#E06D53] rounded-2xl p-3.5 flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-bold text-[#B85741]">
                          根據利率與 {loanMonths} 期逆推可貸總額
                        </p>
                        <p className="text-lg font-extrabold text-[#382218]">
                          {formatCurrency(effectiveLoanAmount)}
                        </p>
                        <p className="text-[11px] text-[#6E4B3E]">
                          扣除開辦費實拿：{formatCurrency(Math.max(0, effectiveLoanAmount - loanFee))}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setLoanAmount(effectiveLoanAmount);
                          setLoanCalcMode('by-amount');
                        }}
                        className="text-xs font-bold bg-[#382218] text-[#FFF9F6] px-3 py-2 rounded-xl hover:bg-[#523428] transition-all shrink-0"
                      >
                        鎖定此貸款額
                      </button>
                    </div>
                  </div>
                )}

                <NumberSliderInput
                  label="貸款總期數 (月)"
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
                    { label: '3年(36期)', value: 36 },
                    { label: '5年(60期)', value: 60 },
                    { label: '7年(84期)', value: 84 },
                    { label: '10年(120期)', value: 120 }
                  ]}
                />

                <NumberSliderInput
                  label="寬限期 (只繳息不還本)"
                  value={graceMonths}
                  onChange={setGraceMonths}
                  min={0}
                  max={Math.min(36, Math.max(0, loanMonths - 1))}
                  step={1}
                  unit="個月"
                  quickPresets={[
                    { label: '無寬限期', value: 0 },
                    { label: '6個月', value: 6 },
                    { label: '12個月', value: 12 },
                    { label: '24個月', value: 24 }
                  ]}
                />

                {/* 利率結構：一段式 vs 兩段式階梯利率 */}
                <div className="pt-1">
                  <label className="block text-xs font-bold text-[#5C3D31] mb-1.5">
                    計息結構
                  </label>
                  <div className="grid grid-cols-2 gap-2 bg-[#F6E6DE] p-1 rounded-2xl mb-3">
                    <button
                      type="button"
                      onClick={() => setRateMode('single')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                        rateMode === 'single'
                          ? 'bg-[#E06D53] text-white shadow-xs'
                          : 'text-[#6E4B3E] hover:text-[#382218]'
                      }`}
                    >
                      一段式固定利率
                    </button>
                    <button
                      type="button"
                      onClick={() => setRateMode('staged')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                        rateMode === 'staged'
                          ? 'bg-[#E06D53] text-white shadow-xs'
                          : 'text-[#6E4B3E] hover:text-[#382218]'
                      }`}
                    >
                      兩段式階梯利率
                    </button>
                  </div>

                  {rateMode === 'single' ? (
                    <NumberSliderInput
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
                    <div className="space-y-3 bg-[#FDF3EE] p-3 rounded-2xl border border-[#F0D9CE]">
                      <NumberSliderInput
                        label="第 1 段優惠期數"
                        value={stage1Months}
                        onChange={setStage1Months}
                        min={1}
                        max={Math.max(1, loanMonths - 1)}
                        step={1}
                        unit="個月"
                        quickPresets={[
                          { label: '前3期', value: 3 },
                          { label: '前6期', value: 6 },
                          { label: '前12期', value: 12 }
                        ]}
                      />
                      <NumberSliderInput
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
                        label={`第 2 段年利率 (第 ${stage1Months + 1} 期起)`}
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

                <NumberSliderInput
                  label="銀行開辦費 / 手續費"
                  value={loanFee}
                  onChange={setLoanFee}
                  min={0}
                  max={15000}
                  step={500}
                  prefix="NT$"
                  quickPresets={[
                    { label: '免開辦費 $0', value: 0 },
                    { label: '$3,000', value: 3000 },
                    { label: '$6,000', value: 6000 },
                    { label: '$9,000', value: 9000 }
                  ]}
                />
              </div>

              {/* 右側：信貸餘額與本息結構圖表 */}
              <div className="lg:col-span-7 space-y-6 min-w-0">
                <div className="bg-[#FFF9F6] border border-[#F0D9CE] rounded-3xl p-4 sm:p-5 shadow-xs min-w-0">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-base font-extrabold text-[#382218]">
                        剩餘貸款本金與累積利息走勢
                      </h3>
                      <p className="text-xs text-[#8A6253]">
                        觀察隨著期數推進，剩餘本金下降速度與累積利息變化
                      </p>
                    </div>
                  </div>

                  <div className="relative h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={loanCalc.schedule}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="loanRemainGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#E06D53" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#E06D53" stopOpacity={0.02} />
                          </linearGradient>
                          <linearGradient id="loanIntGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8A5A44" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#8A5A44" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F0D9CE" />
                        <XAxis
                          dataKey="month"
                          tick={{ fontSize: 11, fill: '#6E4B3E' }}
                          tickFormatter={(m) => `M${m}`}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: '#6E4B3E' }}
                          tickFormatter={formatShortCurrency}
                        />
                        <Tooltip
                          formatter={(val, name) => [formatCurrency(val), name]}
                          labelFormatter={(m) => `第 ${m} 期 (第 ${Math.ceil(m / 12)} 年)`}
                          contentStyle={{
                            backgroundColor: '#FFF9F6',
                            borderColor: '#E06D53',
                            borderRadius: '16px',
                            color: '#382218',
                            fontSize: '12px'
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        <Area
                          type="monotone"
                          dataKey="remainingBalance"
                          name="剩餘貸款本金"
                          stroke="#E06D53"
                          strokeWidth={2.5}
                          fill="url(#loanRemainGrad)"
                        />
                        <Area
                          type="monotone"
                          dataKey="cumulativeInterest"
                          name="累積已繳利息"
                          stroke="#5C3D31"
                          strokeWidth={2}
                          fill="url(#loanIntGrad)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 每期本金 vs 利息拆解圖 */}
                <div className="bg-[#FFF9F6] border border-[#F0D9CE] rounded-3xl p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-base font-extrabold text-[#382218]">
                        每月月付金結構拆解 (償還本金 vs 利息)
                      </h3>
                      <p className="text-xs text-[#8A6253]">
                        深焙咖代表每月繳納的利息，暖珊瑚粉代表實質減少的負債本金
                      </p>
                    </div>
                  </div>

                  <div className="relative h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={loanCalc.schedule.filter(
                          (_, idx) => loanMonths <= 48 || idx % 2 === 0 || idx === loanMonths - 1
                        )}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#F0D9CE" />
                        <XAxis
                          dataKey="month"
                          tick={{ fontSize: 11, fill: '#6E4B3E' }}
                          tickFormatter={(m) => `M${m}`}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: '#6E4B3E' }}
                          tickFormatter={formatShortCurrency}
                        />
                        <Tooltip
                          formatter={(val, name) => [formatCurrency(val), name]}
                          labelFormatter={(m) => `第 ${m} 期`}
                          contentStyle={{
                            backgroundColor: '#FFF9F6',
                            borderColor: '#E06D53',
                            borderRadius: '16px',
                            color: '#382218',
                            fontSize: '12px'
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        <Bar
                          dataKey="interest"
                          name="當月利息"
                          stackId="a"
                          fill="#5C3D31"
                          radius={[0, 0, 0, 0]}
                        />
                        <Bar
                          dataKey="principal"
                          name="當月還本"
                          stackId="a"
                          fill="#E06D53"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>

            {/* 信貸每期詳細還款明細表 */}
            <div
              id="loan-detail-schedule"
              className="bg-[#FFF9F6] border border-[#F0D9CE] rounded-3xl p-4 sm:p-5 shadow-xs min-w-0 overflow-hidden"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 min-w-0">
                <div className="min-w-0">
                  <h3 className="text-base font-extrabold text-[#382218] flex items-center gap-2">
                    <TableIcon className="w-4 h-4 text-[#E06D53] shrink-0" />
                    <span className="truncate">信貸每期詳細還款明細表（共 {loanMonths} 期）</span>
                  </h3>
                  <p className="text-xs text-[#8A6253] mt-0.5">
                    詳列每期期初本金、當期月付、還本、利息、本息比與期末剩餘貸款
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleExportCSV('loan')}
                  className="flex items-center justify-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl bg-[#382218] text-[#FFF9F6] hover:bg-[#523428] transition-all shrink-0 whitespace-nowrap self-start sm:self-auto"
                >
                  <Download className="w-3.5 h-3.5 shrink-0" />
                  <span>匯出完整明細 CSV</span>
                </button>
              </div>

              {/* 快速年份切換按鈕列 (獨立滿版寬度並支援橫向滑動，不撐破父容器) */}
              <div className="w-full overflow-x-auto pb-1 mb-3">
                <div className="inline-flex items-center gap-1 bg-[#F6E6DE] p-1 rounded-xl border border-[#EBCBC0]">
                  <button
                    type="button"
                    onClick={() => setLoanTableFilterYear('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                      loanTableFilterYear === 'all'
                        ? 'bg-[#E06D53] text-white shadow-2xs'
                        : 'text-[#6E4B3E] hover:text-[#382218]'
                    }`}
                  >
                    全部 ({loanMonths}期)
                  </button>
                  {yearOptions.map((y) => (
                    <button
                      key={y}
                      type="button"
                      onClick={() => setLoanTableFilterYear(String(y))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                        loanTableFilterYear === String(y)
                          ? 'bg-[#E06D53] text-white shadow-2xs'
                          : 'text-[#6E4B3E] hover:text-[#382218]'
                      }`}
                    >
                      第{y}年
                    </button>
                  ))}
                </div>
              </div>

              {/* 篩選期間統計小計條 */}
              {(() => {
                const filteredRows = loanCalc.schedule.filter(
                  (r) =>
                    loanTableFilterYear === 'all' || String(r.year) === loanTableFilterYear
                );
                const sumPayment = filteredRows.reduce((a, b) => a + b.payment, 0);
                const sumPrincipal = filteredRows.reduce((a, b) => a + b.principal, 0);
                const sumInterest = filteredRows.reduce((a, b) => a + b.interest, 0);
                const endRemain =
                  filteredRows.length > 0
                    ? filteredRows[filteredRows.length - 1].remainingBalance
                    : 0;
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mb-4 bg-[#FDF2EC] border border-[#EBCBC0] rounded-2xl p-3">
                    <div className="min-w-0">
                      <span className="text-[11px] text-[#8A6253] block truncate">
                        {loanTableFilterYear === 'all'
                          ? '全期應繳本息總計'
                          : `第 ${loanTableFilterYear} 年應繳小計`}
                      </span>
                      <span className="text-xs sm:text-sm font-extrabold text-[#382218] whitespace-nowrap tabular-nums">
                        {formatCurrency(sumPayment)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-[11px] text-[#8A6253] block truncate">期間償還本金合計</span>
                      <span className="text-xs sm:text-sm font-extrabold text-[#2E7D5B] whitespace-nowrap tabular-nums">
                        {formatCurrency(sumPrincipal)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-[11px] text-[#8A6253] block truncate">期間利息支出合計</span>
                      <span className="text-xs sm:text-sm font-extrabold text-[#C8533B] whitespace-nowrap tabular-nums">
                        {formatCurrency(sumInterest)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-[11px] text-[#8A6253] block truncate">期末剩餘貸款本金</span>
                      <span className="text-xs sm:text-sm font-extrabold text-[#E06D53] whitespace-nowrap tabular-nums">
                        {formatCurrency(endRemain)}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="overflow-x-auto max-h-[520px] rounded-2xl border border-[#F0D9CE]">
                <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                  <thead className="bg-[#F6E4DC] text-[#5C3D31] sticky top-0 z-10 shadow-2xs">
                    <tr>
                      <th className="py-3 px-3 font-bold">期數 (月/年)</th>
                      <th className="py-3 px-3 font-bold">年利率</th>
                      <th className="py-3 px-3 font-bold text-right">期初未還本金</th>
                      <th className="py-3 px-3 font-bold text-right bg-[#FCEAE2]">
                        當期應繳月付金
                      </th>
                      <th className="py-3 px-3 font-bold text-right">當期償還本金</th>
                      <th className="py-3 px-3 font-bold text-right">當期償還利息</th>
                      <th className="py-3 px-3 font-bold text-center">本息結構比例</th>
                      <th className="py-3 px-3 font-bold text-right">累積已還本金</th>
                      <th className="py-3 px-3 font-bold text-right">累積已繳利息</th>
                      <th className="py-3 px-3 font-bold text-right bg-[#EFE0D8]">
                        期末剩餘貸款
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F4E3DA]">
                    {loanCalc.schedule
                      .filter(
                        (r) =>
                          loanTableFilterYear === 'all' ||
                          String(r.year) === loanTableFilterYear
                      )
                      .map((row) => (
                        <tr
                          key={row.month}
                          className="hover:bg-[#FDF2EC] transition-colors"
                        >
                          <td className="py-2.5 px-3 font-bold text-[#382218]">
                            第 {row.month} 期
                            <span className="ml-1 text-[10px] font-normal text-[#8A6253]">
                              (Y{row.year}M{((row.month - 1) % 12) + 1})
                            </span>
                            {row.isGracePeriod && (
                              <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#FDE6DF] text-[#C8533B]">
                                寬限期
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-[#6E4B3E]">
                            {row.annualRate.toFixed(2)}%
                          </td>
                          <td className="py-2.5 px-3 text-right text-[#6E4B3E]">
                            {formatCurrency(row.beginningBalance)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-extrabold text-[#382218] bg-[#FFF4EE]">
                            {formatCurrency(row.payment)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-[#2E7D5B] font-bold">
                            {formatCurrency(row.principal)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-[#C8533B] font-semibold">
                            {formatCurrency(row.interest)}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="w-24 mx-auto">
                              <div className="flex justify-between text-[10px] text-[#6E4B3E] mb-0.5">
                                <span>本 {row.principalRatio.toFixed(0)}%</span>
                                <span>息 {(100 - row.principalRatio).toFixed(0)}%</span>
                              </div>
                              <div className="w-full h-1.5 bg-[#EBD5C8] rounded-full overflow-hidden flex">
                                <div
                                  className="bg-[#2E7D5B] h-full"
                                  style={{ width: `${Math.min(100, Math.max(0, row.principalRatio))}%` }}
                                />
                                <div
                                  className="bg-[#E06D53] h-full"
                                  style={{
                                    width: `${Math.min(100, Math.max(0, 100 - row.principalRatio))}%`
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right text-[#2E7D5B]">
                            {formatCurrency(row.cumulativePrincipal)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-[#8A6253]">
                            {formatCurrency(row.cumulativeInterest)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-extrabold text-[#382218] bg-[#FAF0EB]">
                            {formatCurrency(row.remainingBalance)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================
            PAGE 2: 投資複利試算 (Compound Interest Calculator)
           ==================================================== */}
        {activeTab === 'compound' && (
          <div className="space-y-6">
            {/* 核心結果 Hero Card */}
            <div className="bg-gradient-to-br from-[#382218] via-[#4D3023] to-[#694231] rounded-3xl p-4 sm:p-6 text-[#FFF9F6] shadow-lg min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4">
                <span className="text-[11px] sm:text-xs font-semibold tracking-wide bg-[#E06D53] text-white px-3 py-1 rounded-full whitespace-nowrap self-start">
                  單筆＋定期定額複利成長預測
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setArbGrowthRate(Number((compReturnRate * 0.6).toFixed(1)));
                    setArbDividendRate(Number((compReturnRate * 0.4).toFixed(1)));
                    setActiveTab('arbitrage');
                  }}
                  className="text-xs font-bold bg-[#E06D53] hover:bg-[#D15B41] text-white px-3.5 py-2 sm:py-1.5 rounded-full flex items-center justify-center gap-1.5 transition-all whitespace-nowrap"
                >
                  <span>帶入「信貸投資試算」</span>
                  <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white/10 rounded-2xl p-3 sm:p-3.5 min-w-0">
                  <p className="text-[11px] sm:text-xs text-[#F2DCD2] mb-1 truncate">期滿預期總資產</p>
                  <p className="text-base sm:text-xl md:text-2xl font-extrabold text-[#FF9B82] whitespace-nowrap tracking-tight tabular-nums">
                    {formatCurrency(compCalc.finalValue)}
                  </p>
                  <p className="text-[11px] text-[#EBCBC0] mt-1 truncate">
                    共 {compYears} 年 ({compYears * 12} 期)
                  </p>
                </div>

                <div className="bg-white/10 rounded-2xl p-3 sm:p-3.5 min-w-0">
                  <p className="text-[11px] sm:text-xs text-[#F2DCD2] mb-1 truncate">累積投入總本金</p>
                  <p className="text-base sm:text-xl md:text-2xl font-extrabold whitespace-nowrap tracking-tight tabular-nums">
                    {formatCurrency(compCalc.totalPrincipal)}
                  </p>
                  <p className="text-[11px] text-[#EBCBC0] mt-1 truncate">
                    單筆 {formatShortCurrency(compInitial)} + 月投 {formatShortCurrency(compMonthlyDCA)}
                  </p>
                </div>

                <div className="bg-white/10 rounded-2xl p-3 sm:p-3.5 min-w-0">
                  <p className="text-[11px] sm:text-xs text-[#F2DCD2] mb-1 truncate">複利總獲利金額</p>
                  <p className="text-base sm:text-xl md:text-2xl font-extrabold text-[#7CE0B3] whitespace-nowrap tracking-tight tabular-nums">
                    +{formatCurrency(compCalc.totalProfit)}
                  </p>
                  <p className="text-[11px] text-[#EBCBC0] mt-1 truncate">
                    總報酬率 +{compCalc.roiPercent.toFixed(1)}%
                  </p>
                </div>

                <div className="bg-white/10 rounded-2xl p-3 sm:p-3.5 min-w-0">
                  <p className="text-[11px] sm:text-xs text-[#F2DCD2] mb-1 truncate">扣通膨實質購買力</p>
                  <p className="text-base sm:text-xl md:text-2xl font-extrabold whitespace-nowrap tracking-tight tabular-nums">
                    {formatCurrency(compCalc.realFinalValue)}
                  </p>
                  <p className="text-[11px] text-[#EBCBC0] mt-1 truncate">
                    以年通膨 {compInflation}% 折現
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* 左側：複利參數設定 */}
              <div className="lg:col-span-5 space-y-4 bg-[#FFF9F6] border border-[#F0D9CE] rounded-3xl p-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-[#F2E2DA] pb-3">
                  <h2 className="text-base font-extrabold text-[#382218] flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#E06D53]" />
                    投資複利參數設定
                  </h2>
                </div>

                <NumberSliderInput
                  label="期初單筆投入本金"
                  value={compInitial}
                  onChange={setCompInitial}
                  min={0}
                  max={10000000}
                  step={50000}
                  prefix="NT$"
                  quickPresets={[
                    { label: '0元', value: 0 },
                    { label: '50萬', value: 500000 },
                    { label: '150萬', value: 1500000 },
                    { label: '300萬', value: 3000000 }
                  ]}
                />

                <NumberSliderInput
                  label="每月定期定額投入"
                  value={compMonthlyDCA}
                  onChange={setCompMonthlyDCA}
                  min={0}
                  max={200000}
                  step={1000}
                  prefix="NT$"
                  quickPresets={[
                    { label: '$0', value: 0 },
                    { label: '$10,000', value: 10000 },
                    { label: '$20,000', value: 20000 },
                    { label: '$50,000', value: 50000 }
                  ]}
                />

                <NumberSliderInput
                  label="投資期間 (年)"
                  value={compYears}
                  onChange={setCompYears}
                  min={1}
                  max={40}
                  step={1}
                  unit="年"
                  helperText={`共 ${compYears * 12} 個月`}
                  quickPresets={[
                    { label: '5年', value: 5 },
                    { label: '7年', value: 7 },
                    { label: '10年', value: 10 },
                    { label: '20年', value: 20 },
                    { label: '30年', value: 30 }
                  ]}
                />

                <NumberSliderInput
                  label="預期年化報酬率"
                  value={compReturnRate}
                  onChange={setCompReturnRate}
                  min={1}
                  max={20}
                  step={0.2}
                  unit="%"
                  quickPresets={[
                    { label: '保守 5%', value: 5 },
                    { label: '穩健 7%', value: 7 },
                    { label: '指數 8.5%', value: 8.5 },
                    { label: '積極 10%', value: 10 }
                  ]}
                />

                <div>
                  <label className="block text-xs font-bold text-[#5C3D31] mb-1.5">
                    複利計息頻率
                  </label>
                  <div className="grid grid-cols-2 gap-2 bg-[#F6E6DE] p-1 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setCompFreq('monthly')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                        compFreq === 'monthly'
                          ? 'bg-[#E06D53] text-white shadow-xs'
                          : 'text-[#6E4B3E] hover:text-[#382218]'
                      }`}
                    >
                      按月複利 (每月收益滾入)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCompFreq('annual')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                        compFreq === 'annual'
                          ? 'bg-[#E06D53] text-white shadow-xs'
                          : 'text-[#6E4B3E] hover:text-[#382218]'
                      }`}
                    >
                      按年複利 (每年底結算滾入)
                    </button>
                  </div>
                </div>

                <NumberSliderInput
                  label="預估年通膨率 (計算實質購買力)"
                  value={compInflation}
                  onChange={setCompInflation}
                  min={0}
                  max={6}
                  step={0.1}
                  unit="%"
                  quickPresets={[
                    { label: '不計 0%', value: 0 },
                    { label: '溫和 2%', value: 2 },
                    { label: '偏高 3%', value: 3 }
                  ]}
                />
              </div>

              {/* 右側：複利成長曲線 */}
              <div className="lg:col-span-7 space-y-6">
                <div className="bg-[#FFF9F6] border border-[#F0D9CE] rounded-3xl p-5 shadow-xs">
                  <div className="mb-4">
                    <h3 className="text-base font-extrabold text-[#382218]">
                      資產複利成長曲線 vs 累積投入本金
                    </h3>
                    <p className="text-xs text-[#8A6253]">
                      暖珊瑚粉區域為複利滾出的總資產，深焙咖啡色線為實際掏出的累積本金
                    </p>
                  </div>

                  <div className="relative h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={compCalc.yearlySchedule}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="compTotalGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#E06D53" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#E06D53" stopOpacity={0.03} />
                          </linearGradient>
                          <linearGradient id="compPrinGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#5C3D31" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#5C3D31" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F0D9CE" />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6E4B3E' }} />
                        <YAxis
                          tick={{ fontSize: 11, fill: '#6E4B3E' }}
                          tickFormatter={formatShortCurrency}
                        />
                        <Tooltip
                          formatter={(val, name) => [formatCurrency(val), name]}
                          contentStyle={{
                            backgroundColor: '#FFF9F6',
                            borderColor: '#E06D53',
                            borderRadius: '16px',
                            color: '#382218',
                            fontSize: '12px'
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        <Area
                          type="monotone"
                          dataKey="portfolioValue"
                          name="預期期末總資產"
                          stroke="#E06D53"
                          strokeWidth={3}
                          fill="url(#compTotalGrad)"
                        />
                        <Area
                          type="monotone"
                          dataKey="cumulativePrincipal"
                          name="累積投入本金"
                          stroke="#382218"
                          strokeWidth={2}
                          fill="url(#compPrinGrad)"
                        />
                        <Line
                          type="monotone"
                          dataKey="realValue"
                          name="通膨折現實質購買力"
                          stroke="#B87D4B"
                          strokeWidth={2}
                          strokeDasharray="4 4"
                          dot={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 複利年度/月度明細表 */}
                <div className="bg-[#FFF9F6] border border-[#F0D9CE] rounded-3xl p-5 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <div>
                      <h3 className="text-base font-extrabold text-[#382218]">
                        投資複利成長明細表
                      </h3>
                      <p className="text-xs text-[#8A6253]">
                        檢視每年或每月本金累積與複利收益變化
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex bg-[#F6E6DE] p-0.5 rounded-xl border border-[#EBCBC0]">
                        <button
                          type="button"
                          onClick={() => setCompTableViewMode('yearly')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                            compTableViewMode === 'yearly'
                              ? 'bg-[#E06D53] text-white'
                              : 'text-[#6E4B3E]'
                          }`}
                        >
                          按年檢視
                        </button>
                        <button
                          type="button"
                          onClick={() => setCompTableViewMode('monthly')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                            compTableViewMode === 'monthly'
                              ? 'bg-[#E06D53] text-white'
                              : 'text-[#6E4B3E]'
                          }`}
                        >
                          按月檢視
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleExportCSV('compound')}
                        className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl bg-[#382218] text-[#FFF9F6]"
                      >
                        <Download className="w-3.5 h-3.5" />
                        CSV
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto max-h-80 rounded-2xl border border-[#F0D9CE]">
                    <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                      <thead className="bg-[#F6E4DC] text-[#5C3D31] sticky top-0 z-10 shadow-2xs">
                        <tr>
                          <th className="py-3 px-3.5 font-bold whitespace-nowrap">期間</th>
                          <th className="py-3 px-3.5 font-bold text-right whitespace-nowrap">
                            累積投入本金
                          </th>
                          <th className="py-3 px-3.5 font-bold text-right whitespace-nowrap">
                            累積複利獲利
                          </th>
                          <th className="py-3 px-3.5 font-bold text-right whitespace-nowrap bg-[#FCEAE2]">
                            期末總資產
                          </th>
                          <th className="py-3 px-3.5 font-bold text-right whitespace-nowrap">
                            通膨折現實質購買力
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F4E3DA] tabular-nums">
                        {(compTableViewMode === 'yearly'
                          ? compCalc.yearlySchedule
                          : compCalc.monthlySchedule
                        ).map((row) => (
                          <tr key={row.month} className="hover:bg-[#FDF2EC] transition-colors">
                            <td className="py-2.5 px-3.5 font-bold text-[#382218] whitespace-nowrap">
                              {compTableViewMode === 'yearly'
                                ? row.label
                                : `第 ${row.month} 個月 (Y${row.year})`}
                            </td>
                            <td className="py-2.5 px-3.5 text-right text-[#6E4B3E] whitespace-nowrap">
                              {formatCurrency(row.cumulativePrincipal)}
                            </td>
                            <td className="py-2.5 px-3.5 text-right font-bold text-[#2E7D5B] whitespace-nowrap">
                              +{formatCurrency(row.totalProfit)}
                            </td>
                            <td className="py-2.5 px-3.5 text-right font-extrabold text-[#E06D53] bg-[#FFF4EE] whitespace-nowrap">
                              {formatCurrency(row.portfolioValue)}
                            </td>
                            <td className="py-2.5 px-3.5 text-right text-[#8A6253] whitespace-nowrap">
                              {formatCurrency(row.realValue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================
            PAGE 3: 信貸投資試算 (Loan-to-Invest Arbitrage & Monthly Cash Flow)
           ==================================================== */}
        {activeTab === 'arbitrage' && (
          <div className="space-y-6">
            {/* 頂部核心切換開關：還款資金來源模式 (使用者特別指定重點功能) */}
            <div className="bg-[#FFF9F6] border-2 border-[#E06D53] rounded-3xl p-4 sm:p-5 shadow-md">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 text-[11px] font-extrabold rounded-full bg-[#E06D53] text-white">
                      還款模式切換開關
                    </span>
                    <h2 className="text-base sm:text-lg font-extrabold text-[#382218]">
                      選擇每月信貸月付金的扣款來源
                    </h2>
                  </div>
                  <p className="text-xs text-[#6E4B3E]">
                    可隨時切換比較「直接賣股/配息扣抵月付金」與「用薪資繳貸款、讓信貸本金100%留在市場複利」的資產差異
                  </p>
                </div>

                {/* 雙模式切換器 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-[#F4E1D7] p-1.5 rounded-2xl border border-[#EBCBC0] shrink-0">
                  <button
                    type="button"
                    onClick={() => setRepaymentSource('portfolio')}
                    className={`flex flex-col items-start px-4 py-2.5 rounded-xl text-left transition-all ${
                      repaymentSource === 'portfolio'
                        ? 'bg-[#E06D53] text-white shadow-sm'
                        : 'text-[#5C3D31] hover:bg-[#EFE0D8]'
                    }`}
                  >
                    <span className="text-xs font-extrabold flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5" />
                      模式 A：由投資部位提領還款
                    </span>
                    <span
                      className={`text-[10px] mt-0.5 ${
                        repaymentSource === 'portfolio' ? 'text-white/90' : 'text-[#8A6253]'
                      }`}
                    >
                      不動用薪資，每月從投資帳戶扣繳月付金
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRepaymentSource('salary')}
                    className={`flex flex-col items-start px-4 py-2.5 rounded-xl text-left transition-all ${
                      repaymentSource === 'salary'
                        ? 'bg-[#382218] text-[#FFF9F6] shadow-sm'
                        : 'text-[#5C3D31] hover:bg-[#EFE0D8]'
                    }`}
                  >
                    <span className="text-xs font-extrabold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      模式 B：由薪資現金流繳款
                    </span>
                    <span
                      className={`text-[10px] mt-0.5 ${
                        repaymentSource === 'salary' ? 'text-[#F2DCD2]' : 'text-[#8A6253]'
                      }`}
                    >
                      信貸本金完整留在市場複利，薪水付月付金
                    </span>
                  </button>
                </div>
              </div>

              {/* 模式 A 專屬：實務「預留還款準備金（水庫機制）」設定面板 */}
              {repaymentSource === 'portfolio' && (
                <div className="mt-4 pt-3.5 border-t border-[#F2DCD2]">
                  <div className="bg-gradient-to-r from-[#FFF4EE] to-[#FDE8E0] border border-[#E06D53]/60 rounded-2xl p-3.5 sm:p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div>
                        <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-[#E06D53] text-white mr-2">
                          實務水庫機制
                        </span>
                        <span className="text-xs sm:text-sm font-extrabold text-[#382218]">
                          期初從貸款撥款中「預留還款現金準備金」
                        </span>
                        <p className="text-[11px] text-[#6E4B3E] mt-1">
                          避免每個月頻繁賣股票或遇到股市大跌被迫低點砍倉！先留半年～一年份月付金在交割戶扣款，配息自動流入補水，現金用完才整批賣股補水。
                        </p>
                      </div>

                      {cashBufferMonths > 0 && (
                        <button
                          type="button"
                          onClick={() => setAnnualRefillReserve(!annualRefillReserve)}
                          className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all shrink-0 self-start sm:self-center ${
                            annualRefillReserve
                              ? 'bg-[#382218] text-white border-[#382218]'
                              : 'bg-white text-[#5C3D31] border-[#EBCBC0]'
                          }`}
                        >
                          {annualRefillReserve
                            ? '補水方式：用罄時一次賣股補滿下一期'
                            : '補水方式：用罄後按月賣股扣款'}
                        </button>
                      )}
                    </div>

                    {/* 預留月數快速選擇膠囊 */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
                      {[
                        { m: 0, label: '0 個月 (全數投入)' },
                        { m: 6, label: '預留半年 (6期)' },
                        { m: 12, label: '預留 1 年 (12期)' },
                        { m: 18, label: '預留 1.5 年 (18期)' },
                        { m: 24, label: '預留 2 年 (24期)' }
                      ].map((opt) => (
                        <button
                          key={opt.m}
                          type="button"
                          onClick={() => setCashBufferMonths(opt.m)}
                          className={`py-2 px-2.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap ${
                            cashBufferMonths === opt.m
                              ? 'bg-[#E06D53] text-white shadow-xs'
                              : 'bg-white/80 text-[#5C3D31] border border-[#EBCBC0] hover:bg-white'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {/* 資金切分視覺化摘要條 */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-white/90 rounded-xl p-3 border border-[#F0D9CE] text-xs">
                      <div className="flex items-center justify-between sm:block">
                        <span className="text-[11px] text-[#8A6253] block">
                          1. 貸款＋自備總資金池
                        </span>
                        <span className="text-sm font-extrabold text-[#382218] tabular-nums">
                          {formatCurrency(arbCalc.totalAvailablePool)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between sm:block">
                        <span className="text-[11px] text-[#8A6253] block">
                          2. 保留於帳戶之還款準備金 ({cashBufferMonths}期)
                        </span>
                        <span className="text-sm font-extrabold text-[#C8533B] tabular-nums">
                          {formatCurrency(arbCalc.initialCashReserveA)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between sm:block">
                        <span className="text-[11px] text-[#8A6253] block">
                          3. 期初實際投入市場買股本金
                        </span>
                        <span className="text-sm font-extrabold text-[#2E7D5B] tabular-nums">
                          {formatCurrency(arbCalc.initialStockInvestedA)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 模式運作邏輯白話圖解說明卡 */}
              <div className="mt-4 pt-3.5 border-t border-[#F2DCD2] grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div
                  className={`rounded-2xl p-3.5 border ${
                    repaymentSource === 'portfolio'
                      ? 'bg-[#FFF3EE] border-[#E06D53]'
                      : 'bg-[#FAF2ED]/60 border-[#EBCBC0]'
                  }`}
                >
                  <p className="font-extrabold text-[#382218] flex items-center gap-1.5 mb-1">
                    <Info className="w-4 h-4 text-[#E06D53] shrink-0" />
                    模式 A（預留現金水庫＋投資自給自足）如何運作？
                  </p>
                  <p className="text-[#5C3D31] leading-relaxed">
                    如你所想，實務上<strong>每個月賣零股還貸款太頻繁、也怕遇到股市修正被迫砍在低點</strong>！因此模式 A 支援從借出的 150 萬中，先留<strong>半年（約 11.6 萬）或一年份（約 23.2 萬）現金</strong>在銀行扣款，其餘資金（約 126.8 萬）才投入股市。每個月領到的<strong>股息會自動流進現金池延長扣款壽命</strong>，平均每 1～1.5 年才需要逢高賣一次股票補充水庫（{loanMonths} 期下來僅需賣股 <strong>{arbCalc.sellStockCountA} 次</strong>），全程<strong>不動用半毛薪水</strong>！
                  </p>
                </div>

                <div
                  className={`rounded-2xl p-3.5 border ${
                    repaymentSource === 'salary'
                      ? 'bg-[#F7EAE2] border-[#382218]'
                      : 'bg-[#FAF2ED]/60 border-[#EBCBC0]'
                  }`}
                >
                  <p className="font-extrabold text-[#382218] flex items-center gap-1.5 mb-1">
                    <Sparkles className="w-4 h-4 text-[#382218] shrink-0" />
                    「模式 B：由薪資現金流繳款」有什麼差別？
                  </p>
                  <p className="text-[#5C3D31] leading-relaxed">
                    模式 B 代表你<strong>不賣股票</strong>，每個月乖乖從自己的<strong>薪水掏錢繳信貸月付金</strong>（可選擇用當月配息幫補貼）。好處是借來的 150 萬投資本金<strong>完全不會因為還款而縮水</strong>，能 100% 留在市場享受完整複利滾雪球，適合每月有穩定薪資結餘、想把期末總資產最大化的人。
                  </p>
                </div>
              </div>
            </div>

            {/* 槓桿套利核心指標卡片 */}
            <div className="bg-gradient-to-br from-[#382218] via-[#4A2E21] to-[#633E2D] rounded-3xl p-5 sm:p-6 text-[#FFF9F6] shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#E06D53] text-white">
                    {repaymentSource === 'portfolio'
                      ? '目前檢視：模式 A（投資帳戶自給自足還款）'
                      : '目前檢視：模式 B（薪資還款・本金完整複利）'}
                  </span>
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 ${
                      arbCalc.spreadRate > 0
                        ? 'bg-[#2E7D5B]/30 text-[#8QF0C2] border border-[#7CE0B3]/30'
                        : 'bg-[#C8533B]/40 text-[#FFD2C9]'
                    }`}
                  >
                    {arbCalc.spreadRate > 0 ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#7CE0B3]" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-[#FF9B82]" />
                    )}
                    年化利差：{arbCalc.spreadRate >= 0 ? '+' : ''}
                    {arbCalc.spreadRate.toFixed(2)}%
                  </span>
                </div>
                <span className="text-xs text-[#EBCBC0]">
                  損益兩平門檻報酬率：{arbCalc.apr.toFixed(2)}% (APR)
                </span>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white/10 rounded-2xl p-3 sm:p-4 min-w-0">
                  <p className="text-[11px] sm:text-xs text-[#F2DCD2] mb-1 truncate">
                    期滿投資終值 ({loanMonths}期)
                  </p>
                  <p className="text-base sm:text-xl md:text-2xl font-extrabold text-[#FF9B82] whitespace-nowrap tracking-tight tabular-nums">
                    {formatCurrency(arbCalc.activeFinalAsset)}
                  </p>
                  <p className="text-[11px] text-[#EBCBC0] mt-1 truncate">
                    期初本金：{formatCurrency(arbCalc.initialInvested)}
                  </p>
                </div>

                <div className="bg-white/10 rounded-2xl p-3 sm:p-4 min-w-0">
                  <p className="text-[11px] sm:text-xs text-[#F2DCD2] mb-1 truncate">
                    扣除還款與成本淨賺
                  </p>
                  <p
                    className={`text-base sm:text-xl md:text-2xl font-extrabold whitespace-nowrap tracking-tight tabular-nums ${
                      arbCalc.activeNetProfit >= 0 ? 'text-[#7CE0B3]' : 'text-[#FF8A70]'
                    }`}
                  >
                    {arbCalc.activeNetProfit >= 0 ? '+' : ''}
                    {formatCurrency(arbCalc.activeNetProfit)}
                  </p>
                  <p className="text-[11px] text-[#EBCBC0] mt-1 truncate">
                    另一模式：
                    {formatCurrency(
                      repaymentSource === 'portfolio'
                        ? arbCalc.finalNetProfitB
                        : arbCalc.finalNetProfitA
                    )}
                  </p>
                </div>

                <div className="bg-white/10 rounded-2xl p-3 sm:p-4 min-w-0">
                  <p className="text-[11px] sm:text-xs text-[#F2DCD2] mb-1 truncate">
                    首期應繳信貸月付金
                  </p>
                  <p className="text-base sm:text-xl md:text-2xl font-extrabold whitespace-nowrap tracking-tight tabular-nums">
                    {formatCurrency(arbCalc.monthlyDetails[0]?.loanPayment || 0)}
                  </p>
                  <p className="text-[11px] text-[#EBCBC0] mt-1 truncate">
                    首月總收益：{formatCurrency(arbCalc.monthlyDetails[0]?.monthTotalReturn || 0)}
                  </p>
                </div>

                <div className="bg-white/10 rounded-2xl p-3 sm:p-4 min-w-0">
                  <p className="text-[11px] sm:text-xs text-[#F2DCD2] mb-1 truncate">信貸總繳本息合計</p>
                  <p className="text-base sm:text-xl md:text-2xl font-extrabold whitespace-nowrap tracking-tight tabular-nums">
                    {formatCurrency(arbCalc.totalLoanPaid)}
                  </p>
                  <p className="text-[11px] text-[#EBCBC0] mt-1 truncate">
                    總利息：{formatCurrency(arbCalc.totalInterestPaid)}
                  </p>
                </div>
              </div>

              {repaymentSource === 'portfolio' && arbCalc.depletedMonthA && (
                <div className="mt-4 bg-[#C8533B]/30 border border-[#FF9B82]/50 rounded-2xl p-3 flex items-center gap-2.5 text-xs text-[#FFEAE5]">
                  <ShieldAlert className="w-5 h-5 text-[#FF9B82] shrink-0" />
                  <span>
                    提醒：在目前設定的投資報酬率下，若完全從投資帳戶提領還款，投資部位將於
                    <strong> 第 {arbCalc.depletedMonthA} 期 </strong>
                    提領完畢，後續期數需由自有資金貼補月付金。
                  </span>
                </div>
              )}
            </div>

            {/* 左側參數調整 & 右側圖表分析 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* 左側：信貸與投資組合快速調校 */}
              <div className="lg:col-span-5 space-y-4 bg-[#FFF9F6] border border-[#F0D9CE] rounded-3xl p-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-[#F2E2DA] pb-3">
                  <h3 className="text-base font-extrabold text-[#382218] flex items-center gap-2">
                    <Scale className="w-4 h-4 text-[#E06D53]" />
                    信貸與投資報酬參數調校
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('loan')}
                    className="text-xs font-bold text-[#E06D53] hover:underline"
                  >
                    進階信貸設定 →
                  </button>
                </div>

                <NumberSliderInput
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <NumberSliderInput
                    label="貸款期數 (月)"
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
                    label="寬限期 (只繳息不還本)"
                    value={graceMonths}
                    onChange={setGraceMonths}
                    min={0}
                    max={Math.min(36, Math.max(0, loanMonths - 1))}
                    step={3}
                    unit="個月"
                    quickPresets={[
                      { label: '無寬限', value: 0 },
                      { label: '12個月', value: 12 },
                      { label: '24個月', value: 24 }
                    ]}
                  />
                </div>

                {rateMode === 'single' ? (
                  <NumberSliderInput
                    label="信貸年利率 (一段式)"
                    value={singleRate}
                    onChange={setSingleRate}
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
                  <div className="p-3 rounded-2xl bg-[#FDF2EC] border border-[#F0D9CE] flex items-center justify-between text-xs">
                    <span className="font-bold text-[#5C3D31]">
                      兩段式利率：前{stage1Months}期 {stage1Rate}% / 後期 {stage2Rate}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('loan')}
                      className="text-[#E06D53] font-bold underline"
                    >
                      修改
                    </button>
                  </div>
                )}

                <div className="border-t border-[#F2E2DA] pt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-[#382218]">
                      預期年化總報酬率：{arbCalc.totalExpectedAnnualReturn.toFixed(2)}%
                    </span>
                    <span className="text-[11px] text-[#8A6253]">
                      拆分為「資本利得」＋「現金配息」
                    </span>
                  </div>

                  <NumberSliderInput
                    label="預期年化資本利得 (股價成長)"
                    value={arbGrowthRate}
                    onChange={setArbGrowthRate}
                    min={0}
                    max={18}
                    step={0.1}
                    unit="%"
                    quickPresets={[
                      { label: '純領息 0%', value: 0 },
                      { label: '溫和 3.5%', value: 3.5 },
                      { label: '市值型 6%', value: 6.0 },
                      { label: '積極 8%', value: 8.0 }
                    ]}
                  />

                  <NumberSliderInput
                    label="預期年化現金配息率 (股息/債息)"
                    value={arbDividendRate}
                    onChange={setArbDividendRate}
                    min={0}
                    max={15}
                    step={0.1}
                    unit="%"
                    quickPresets={[
                      { label: '不配息 0%', value: 0 },
                      { label: '季配/月配 4.5%', value: 4.5 },
                      { label: '高股息 6.5%', value: 6.5 },
                      { label: '8.0%', value: 8.0 }
                    ]}
                  />
                </div>

                {/* 進階資金選項 */}
                <div className="border-t border-[#F2E2DA] pt-3 space-y-3">
                  <NumberSliderInput
                    label="額外自備本金一併投入"
                    value={arbExtraCapital}
                    onChange={setArbExtraCapital}
                    min={0}
                    max={5000000}
                    step={50000}
                    prefix="NT$"
                    quickPresets={[
                      { label: '純信貸 $0', value: 0 },
                      { label: '+50萬', value: 500000 },
                      { label: '+100萬', value: 1000000 }
                    ]}
                  />

                  {repaymentSource === 'salary' && (
                    <div className="bg-[#FDF1EB] border border-[#EBCBC0] rounded-2xl p-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-[#382218]">
                          模式 B 配息處理方式
                        </p>
                        <p className="text-[11px] text-[#8A6253]">
                          {reinvestDividends
                            ? '將每月配息滾入再投資，最大化期末複利'
                            : '將每月配息領現，直接用來貼補信貸月付金'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReinvestDividends(!reinvestDividends)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          reinvestDividends
                            ? 'bg-[#E06D53] text-white'
                            : 'bg-[#382218] text-[#FFF9F6]'
                        }`}
                      >
                        {reinvestDividends ? '配息再投入' : '領息抵月付'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 右側：多維度圖表分析 */}
              <div className="lg:col-span-7 space-y-6">
                <div className="bg-[#FFF9F6] border border-[#F0D9CE] rounded-3xl p-5 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <div>
                      <h3 className="text-base font-extrabold text-[#382218]">
                        投資資產價值 vs 剩餘貸款本金走勢
                      </h3>
                      <p className="text-xs text-[#8A6253]">
                        即時觀察每一期的「投資資產」、「剩餘未還貸款」與「帳面淨資產」
                      </p>
                    </div>

                    <div className="flex bg-[#F6E6DE] p-1 rounded-xl border border-[#EBCBC0]">
                      {[
                        { id: 'balance', label: '資產 vs 剩餘貸款' },
                        { id: 'cashflow', label: '每月金流對比' },
                        { id: 'compare', label: '雙模式終值比較' }
                      ].map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setArbChartType(c.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                            arbChartType === c.id
                              ? 'bg-[#E06D53] text-white shadow-xs'
                              : 'text-[#6E4B3E]'
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="relative h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      {arbChartType === 'balance' ? (
                        <ComposedChart
                          data={arbCalc.monthlyDetails}
                          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="arbAssetGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#E06D53" stopOpacity={0.35} />
                              <stop offset="95%" stopColor="#E06D53" stopOpacity={0.03} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F0D9CE" />
                          <XAxis
                            dataKey="month"
                            tick={{ fontSize: 11, fill: '#6E4B3E' }}
                            tickFormatter={(m) => `M${m}`}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: '#6E4B3E' }}
                            tickFormatter={formatShortCurrency}
                          />
                          <Tooltip
                            formatter={(val, name) => [formatCurrency(val), name]}
                            labelFormatter={(m) => `第 ${m} 期 (第 ${Math.ceil(m / 12)} 年)`}
                            contentStyle={{
                              backgroundColor: '#FFF9F6',
                              borderColor: '#E06D53',
                              borderRadius: '16px',
                              color: '#382218',
                              fontSize: '12px'
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: '12px' }} />
                          <Area
                            type="monotone"
                            dataKey="endAsset"
                            name="期末投資部位資產"
                            stroke="#E06D53"
                            strokeWidth={2.5}
                            fill="url(#arbAssetGrad)"
                          />
                          <Line
                            type="monotone"
                            dataKey="remainingDebt"
                            name="剩餘貸款本金"
                            stroke="#382218"
                            strokeWidth={2.5}
                            dot={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="currentNetWorth"
                            name="帳面淨值 (資產-負債)"
                            stroke="#2E7D5B"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            dot={false}
                          />
                        </ComposedChart>
                      ) : arbChartType === 'cashflow' ? (
                        <ComposedChart
                          data={arbCalc.monthlyDetails}
                          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#F0D9CE" />
                          <XAxis
                            dataKey="month"
                            tick={{ fontSize: 11, fill: '#6E4B3E' }}
                            tickFormatter={(m) => `M${m}`}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: '#6E4B3E' }}
                            tickFormatter={formatShortCurrency}
                          />
                          <Tooltip
                            formatter={(val, name) => [formatCurrency(val), name]}
                            labelFormatter={(m) => `第 ${m} 期`}
                            contentStyle={{
                              backgroundColor: '#FFF9F6',
                              borderColor: '#E06D53',
                              borderRadius: '16px',
                              color: '#382218',
                              fontSize: '12px'
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: '12px' }} />
                          <ReferenceLine y={0} stroke="#8A6253" />
                          <Bar
                            dataKey="monthTotalReturn"
                            name="當月投資總收益 (價差+配息)"
                            fill="#E06D53"
                            radius={[3, 3, 0, 0]}
                          />
                          <Line
                            type="monotone"
                            dataKey="loanPayment"
                            name="當月信貸應繳月付金"
                            stroke="#382218"
                            strokeWidth={2.5}
                            dot={false}
                          />
                        </ComposedChart>
                      ) : (
                        <ComposedChart
                          data={arbCalc.monthlyDetails}
                          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#F0D9CE" />
                          <XAxis
                            dataKey="month"
                            tick={{ fontSize: 11, fill: '#6E4B3E' }}
                            tickFormatter={(m) => `M${m}`}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: '#6E4B3E' }}
                            tickFormatter={formatShortCurrency}
                          />
                          <Tooltip
                            formatter={(val, name) => [formatCurrency(val), name]}
                            labelFormatter={(m) => `第 ${m} 期`}
                            contentStyle={{
                              backgroundColor: '#FFF9F6',
                              borderColor: '#E06D53',
                              borderRadius: '16px',
                              color: '#382218',
                              fontSize: '12px'
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: '12px' }} />
                          <Line
                            type="monotone"
                            dataKey="endPortfolioA"
                            name="模式A：投資提領還款之期末資產"
                            stroke="#E06D53"
                            strokeWidth={3}
                            dot={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="endPortfolioB"
                            name="模式B：薪資還款之期末投資資產"
                            stroke="#382218"
                            strokeWidth={3}
                            dot={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="remainingDebtRounded"
                            name="剩餘貸款餘額"
                            stroke="#9A7465"
                            strokeWidth={2}
                            strokeDasharray="4 4"
                            dot={false}
                          />
                        </ComposedChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 雙模式並排比較小卡 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div
                    onClick={() => setRepaymentSource('portfolio')}
                    className={`cursor-pointer rounded-3xl p-4 border transition-all ${
                      repaymentSource === 'portfolio'
                        ? 'bg-[#FFF3EE] border-2 border-[#E06D53] shadow-sm'
                        : 'bg-[#FFF9F6] border-[#F0D9CE] opacity-80 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-extrabold text-[#E06D53]">
                        模式 A：由投資部位提領還款
                      </span>
                      {repaymentSource === 'portfolio' && (
                        <span className="text-[10px] font-bold bg-[#E06D53] text-white px-2 py-0.5 rounded-full">
                          使用中
                        </span>
                      )}
                    </div>
                    <p className="text-lg font-extrabold text-[#382218]">
                      期滿剩餘資產：{formatCurrency(arbCalc.finalAssetA)}
                    </p>
                    <p className="text-xs text-[#6E4B3E] mt-1">
                      淨利：{formatCurrency(arbCalc.finalNetProfitA)}（每月免掏薪水繳貸款，期末留下純獲利部位）
                    </p>
                  </div>

                  <div
                    onClick={() => setRepaymentSource('salary')}
                    className={`cursor-pointer rounded-3xl p-4 border transition-all ${
                      repaymentSource === 'salary'
                        ? 'bg-[#F7EAE2] border-2 border-[#382218] shadow-sm'
                        : 'bg-[#FFF9F6] border-[#F0D9CE] opacity-80 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-extrabold text-[#382218]">
                        模式 B：由薪資現金流還款
                      </span>
                      {repaymentSource === 'salary' && (
                        <span className="text-[10px] font-bold bg-[#382218] text-white px-2 py-0.5 rounded-full">
                          使用中
                        </span>
                      )}
                    </div>
                    <p className="text-lg font-extrabold text-[#382218]">
                      期滿累積資產：{formatCurrency(arbCalc.finalAssetB)}
                    </p>
                    <p className="text-xs text-[#6E4B3E] mt-1">
                      扣還款後淨利：{formatCurrency(arbCalc.finalNetProfitB)}（本金不減損，完整享受複利最大化）
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 詳盡每月金流與剩餘貸款總表 (使用者特別要求：顯示詳盡的每月金流以及剩餘貸款) */}
            <div className="bg-[#FFF9F6] border border-[#F0D9CE] rounded-3xl p-5 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-base font-extrabold text-[#382218] flex items-center gap-2">
                    <Coins className="w-4 h-4 text-[#E06D53]" />
                    詳盡每月金流暨剩餘貸款追蹤表 ({repaymentSource === 'portfolio' ? '模式A：投資提領還款' : '模式B：薪資現金流還款'})
                  </h3>
                  <p className="text-xs text-[#8A6253]">
                    逐月列出期初資產、資本利得、配息金流、信貸月付（本金/利息）、期末投資資產、期末剩餘貸款與帳面淨值
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={arbTableFilterYear}
                    onChange={(e) => setArbTableFilterYear(e.target.value)}
                    className="text-xs font-bold bg-[#FDF1EB] border border-[#EBCBC0] text-[#382218] rounded-xl px-3 py-2 focus:outline-none"
                  >
                    <option value="all">顯示全部 ({loanMonths} 個月)</option>
                    {yearOptions.map((y) => (
                      <option key={y} value={String(y)}>
                        第 {y} 年 (M{(y - 1) * 12 + 1}~M{Math.min(loanMonths, y * 12)})
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => handleExportCSV('arbitrage')}
                    className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl bg-[#E06D53] text-white hover:bg-[#D15B41] transition-all shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    匯出完整金流 CSV
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[500px] rounded-2xl border border-[#F0D9CE]">
                <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                  <thead className="bg-[#F6E4DC] text-[#5C3D31] sticky top-0 z-10 shadow-2xs">
                    <tr>
                      <th className="py-3 px-3 font-bold">期數</th>
                      {repaymentSource === 'portfolio' ? (
                        <>
                          <th className="py-3 px-3 font-bold text-right">期末股票部位市值</th>
                          <th className="py-3 px-3 font-bold text-right bg-[#FDF2EC]">
                            還款現金準備金餘額
                          </th>
                        </>
                      ) : (
                        <th className="py-3 px-3 font-bold text-right">期初投資資產</th>
                      )}
                      <th className="py-3 px-3 font-bold text-right">當月總收益(價差+配息)</th>
                      <th className="py-3 px-3 font-bold text-right">當月扣繳信貸月付</th>
                      <th className="py-3 px-3 font-bold text-right">內含還本 / 繳息</th>
                      {repaymentSource === 'portfolio' && (
                        <th className="py-3 px-3 font-bold text-right">
                          賣股補充準備金動作
                        </th>
                      )}
                      <th className="py-3 px-3 font-bold text-right bg-[#FCEAE2]">
                        {repaymentSource === 'portfolio'
                          ? '當月薪水自掏腰包'
                          : '配息抵月付後自掏薪水'}
                      </th>
                      <th className="py-3 px-3 font-bold text-right">
                        {repaymentSource === 'portfolio'
                          ? '期末總資產(股票+準備金)'
                          : '期末投資總資產'}
                      </th>
                      <th className="py-3 px-3 font-bold text-right bg-[#EFE0D8]">
                        期末剩餘貸款
                      </th>
                      <th className="py-3 px-3 font-bold text-right">期末帳面淨資產</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F4E3DA] tabular-nums">
                    {arbCalc.monthlyDetails
                      .filter(
                        (r) =>
                          arbTableFilterYear === 'all' ||
                          String(r.year) === arbTableFilterYear
                      )
                      .map((row) => {
                        return (
                          <tr
                            key={row.month}
                            className="hover:bg-[#FDF2EC] transition-colors"
                          >
                            <td className="py-2.5 px-3 font-bold text-[#382218]">
                              M{row.month}
                              <span className="ml-1 text-[10px] font-normal text-[#8A6253]">
                                (Y{row.year})
                              </span>
                            </td>
                            {repaymentSource === 'portfolio' ? (
                              <>
                                <td className="py-2.5 px-3 text-right font-bold text-[#382218]">
                                  {formatCurrency(row.endStockA)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-[#B85741] bg-[#FFF8F4]">
                                  {formatCurrency(row.endCashA)}
                                </td>
                              </>
                            ) : (
                              <td className="py-2.5 px-3 text-right text-[#6E4B3E]">
                                {formatCurrency(row.startAsset)}
                              </td>
                            )}
                            <td className="py-2.5 px-3 text-right text-[#2E7D5B] font-semibold">
                              +{formatCurrency(row.monthTotalReturn)}
                              <span className="ml-1 text-[10px] font-normal text-[#8A6253]">
                                (息 {formatShortCurrency(row.monthDividend)})
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-[#C8533B]">
                              -{formatCurrency(row.loanPayment)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-[11px] text-[#8A6253]">
                              本 {formatShortCurrency(row.loanPrincipal)} / 息{' '}
                              {formatShortCurrency(row.loanInterest)}
                            </td>
                            {repaymentSource === 'portfolio' && (
                              <td className="py-2.5 px-3 text-right">
                                {row.principalSoldFromPortfolioA > 0 ? (
                                  <span className="inline-block px-2 py-0.5 rounded-md bg-[#FDE6DF] text-[#C8533B] font-bold">
                                    賣股補水 {formatCurrency(row.principalSoldFromPortfolioA)}
                                  </span>
                                ) : (
                                  <span className="text-[#8A6253]">準備金池扣款 (免賣股)</span>
                                )}
                              </td>
                            )}
                            <td
                              className={`py-2.5 px-3 text-right font-extrabold bg-[#FFF4EE] ${
                                row.outOfPocketThisMonth === 0
                                  ? 'text-[#2E7D5B]'
                                  : 'text-[#C8533B]'
                              }`}
                            >
                              {row.outOfPocketThisMonth === 0
                                ? 'NT$ 0 (免掏薪水)'
                                : `-${formatCurrency(row.outOfPocketThisMonth)}`}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-[#E06D53]">
                              {formatCurrency(row.endAsset)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-extrabold text-[#382218] bg-[#FAF0EB]">
                              {formatCurrency(row.remainingDebt)}
                            </td>
                            <td
                              className={`py-2.5 px-3 text-right font-extrabold ${
                                row.currentNetWorth >= 0 ? 'text-[#2E7D5B]' : 'text-[#C8533B]'
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
            </div>
          </div>
        )}
      </main>

      {/* 手機產品級底部懸浮導覽列 (Mobile Bottom Navigation Bar) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#FFF9F6]/95 backdrop-blur-md border-t border-[#EBCBC0] px-4 py-2 shadow-lg">
        <div className="max-w-md mx-auto grid grid-cols-3 gap-2">
          {[
            { id: 'loan', label: '信貸試算', icon: Calculator },
            { id: 'compound', label: '投資複利', icon: TrendingUp },
            { id: 'arbitrage', label: '信貸投資', icon: ArrowRightLeft }
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center py-1.5 rounded-2xl transition-all ${
                  isActive
                    ? 'bg-[#E06D53] text-white shadow-sm'
                    : 'text-[#6E4B3E] hover:bg-[#F6E6DE]'
                }`}
              >
                <Icon className="w-4 h-4 mb-0.5" />
                <span className="text-[11px] font-bold">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}