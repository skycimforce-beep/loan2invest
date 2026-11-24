// ==========================================
// 財務數學核心計算函式 (Financial Math Engine)
// ==========================================

// 格式化台幣金額
export const formatCurrency = (val) => {
  if (val === undefined || val === null || isNaN(val)) return 'NT$ 0';
  const rounded = Math.round(val);
  const prefix = rounded < 0 ? '-NT$ ' : 'NT$ ';
  return prefix + Math.abs(rounded).toLocaleString('zh-TW');
};

export const formatShortCurrency = (val) => {
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
export const calcPMT = (principal, monthlyRate, months) => {
  if (months <= 0 || principal <= 0) return 0;
  if (monthlyRate <= 0) return principal / months;
  const factor = Math.pow(1 + monthlyRate, months);
  return (principal * monthlyRate * factor) / (factor - 1);
};

// 由預期每月還款金額逆推可貸總本金 (支援本息均攤/本金均攤、寬限期、一段式/兩段式利率)
export const solveMaxPrincipalFromMonthlyPayment = ({
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

// 逆推利率之年利率上限 (%)
export const MAX_REVERSE_ANNUAL_RATE = 30;

// 由貸款總額 + 預期每月還款金額逆推名目年利率 (%) (支援本息均攤/本金均攤、寬限期)
// 回傳 { rate, error }；error: 'insufficient' (月付不足以在期限內還清本金) | 'too-high' (超過上限) | null
export const solveAnnualRateFromPayment = ({
  loanAmount,
  targetMonthlyPayment,
  totalMonths,
  repaymentMethod,
  graceMonths
}) => {
  const P = Math.max(0, Number(loanAmount) || 0);
  const pmt = Math.max(0, Number(targetMonthlyPayment) || 0);
  const N = Math.max(1, Math.min(360, Math.round(Number(totalMonths) || 84)));
  const G = Math.max(0, Math.min(N - 1, Math.round(Number(graceMonths) || 0)));
  const n = Math.max(1, N - G); // 寬限期後實際攤還期數
  if (P <= 0 || pmt <= 0) return { rate: 0, error: null };

  if (repaymentMethod === 'equal-principal') {
    // 本金平均攤還：首期攤還月付 = P / n + P * r  →  r = (PMT - P / n) / P (封閉解)
    const r = (pmt - P / n) / P;
    if (r < -1e-12) return { rate: 0, error: 'insufficient' };
    const annual = Math.max(0, r) * 12 * 100;
    return annual > MAX_REVERSE_ANNUAL_RATE
      ? { rate: MAX_REVERSE_ANNUAL_RATE, error: 'too-high' }
      : { rate: annual, error: null };
  }

  // 本息平均攤還：PMT 隨月利率單調遞增，以二分法求解 (穩定不發散)
  if (pmt * n < P - 0.5) return { rate: 0, error: 'insufficient' };
  let lo = 0;
  let hi = MAX_REVERSE_ANNUAL_RATE / 100 / 12;
  if (calcPMT(P, hi, n) < pmt) return { rate: MAX_REVERSE_ANNUAL_RATE, error: 'too-high' };
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (calcPMT(P, mid, n) > pmt) hi = mid;
    else lo = mid;
  }
  return { rate: ((lo + hi) / 2) * 12 * 100, error: null };
};

// 使用牛頓法求解總費用年百分率 (APR / IRR)
export const calculateAPR = (loanAmount, fee, monthlyPayments) => {
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
export const generateLoanSchedule = ({
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
export const generateCompoundSchedule = ({
  initialPrincipal,
  monthlyContribution,
  years,
  annualReturnRate,
  compoundingFrequency, // 'monthly' | 'annual'
  inflationRate
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
export const generateArbitrageSimulation = ({
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
