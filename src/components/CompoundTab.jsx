import React from 'react';
import { TrendingUp, ArrowRightLeft, Download } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Line
} from 'recharts';
import NumberSliderInput from './NumberSliderInput';
import { formatCurrency, formatShortCurrency } from '../utils/finance';

export default function CompoundTab({
  compInitial,
  setCompInitial,
  compMonthlyDCA,
  setCompMonthlyDCA,
  compYears,
  setCompYears,
  compReturnRate,
  setCompReturnRate,
  compFreq,
  setCompFreq,
  compInflation,
  setCompInflation,
  compCalc,
  compTableViewMode,
  setCompTableViewMode,
  onSyncToArbitrage,
  onExportCSV
}) {
  const principalShare =
    compCalc.finalValue > 0
      ? Math.min(100, Math.max(0, (compCalc.totalPrincipal / compCalc.finalValue) * 100))
      : 100;
  const profitShare = Math.max(0, 100 - principalShare);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Controls */}
        <div className="lg:col-span-5 order-2 lg:order-1 bg-[#FFFDFB] border border-[#EADCD3] rounded-2xl p-4 sm:p-5 shadow-card space-y-4">
          <div className="flex items-center justify-between pb-2.5 border-b border-[#EFE3DC]">
            <h2 className="text-sm font-extrabold text-[#2C1A12] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#D95D39]" />
              投資複利參數設定
            </h2>
            <span className="text-[11px] font-semibold text-[#8B6B5C]">
              共 {compYears * 12} 個月
            </span>
          </div>

          <div>
            <NumberSliderInput
              id="comp-initial"
              label="期初單筆投入本金"
              value={compInitial}
              onChange={setCompInitial}
              min={0}
              max={10000000}
              step={50000}
              prefix="NT$"
              quickPresets={[
                { label: '$0', value: 0 },
                { label: '50萬', value: 500000 },
                { label: '150萬', value: 1500000 },
                { label: '300萬', value: 3000000 }
              ]}
            />

            <NumberSliderInput
              id="comp-monthly-dca"
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
              id="comp-years"
              label="投資期間"
              value={compYears}
              onChange={setCompYears}
              min={1}
              max={40}
              step={1}
              unit="年"
              helperText={`共 ${compYears * 12} 期`}
              quickPresets={[
                { label: '5年', value: 5 },
                { label: '7年', value: 7 },
                { label: '10年', value: 10 },
                { label: '20年', value: 20 },
                { label: '30年', value: 30 }
              ]}
            />

            <NumberSliderInput
              id="comp-return-rate"
              label="預期年化報酬率"
              value={compReturnRate}
              onChange={setCompReturnRate}
              min={1}
              max={20}
              step={0.2}
              unit="%"
              quickPresets={[
                { label: '5%', value: 5 },
                { label: '7%', value: 7 },
                { label: '8.5%', value: 8.5 },
                { label: '10%', value: 10 }
              ]}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#4B3227] mb-1.5">複利計息頻率</label>
            <div className="grid grid-cols-2 gap-1.5 bg-[#F4EAE3] p-1 rounded-xl border border-[#EADCD3]">
              <button
                type="button"
                onClick={() => setCompFreq('monthly')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                  compFreq === 'monthly'
                    ? 'bg-[#D95D39] text-white shadow-xs'
                    : 'text-[#6D4E40] hover:text-[#2C1A12]'
                }`}
              >
                按月複利
              </button>
              <button
                type="button"
                onClick={() => setCompFreq('annual')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                  compFreq === 'annual'
                    ? 'bg-[#D95D39] text-white shadow-xs'
                    : 'text-[#6D4E40] hover:text-[#2C1A12]'
                }`}
              >
                按年複利
              </button>
            </div>
          </div>

          <NumberSliderInput
            id="comp-inflation"
            label="預估年通膨率 (計算實質購買力)"
            value={compInflation}
            onChange={setCompInflation}
            min={0}
            max={6}
            step={0.1}
            unit="%"
            quickPresets={[
              { label: '0%', value: 0 },
              { label: '2%', value: 2 },
              { label: '3%', value: 3 }
            ]}
          />
        </div>

        {/* Right Canvas */}
        <div className="lg:col-span-7 order-1 lg:order-2 space-y-5 min-w-0">
          {/* Hero KPI Card */}
          <div className="bg-gradient-to-br from-[#2C1A12] via-[#3A2319] to-[#4F3124] rounded-2xl p-5 sm:p-6 text-[#FFFDFB] shadow-elevated">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#D95D39] text-white">
                單筆＋定期定額複利成長預測
              </span>

              <button
                type="button"
                onClick={onSyncToArbitrage}
                className="text-xs font-bold bg-white/15 hover:bg-white/25 text-white px-3.5 py-1.5 rounded-xl inline-flex items-center gap-1.5 transition-colors"
              >
                <span>帶入信貸投資</span>
                <ArrowRightLeft className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:gap-5">
              <div className="min-w-0">
                <p className="text-xs text-[#DFCBC1] mb-1 truncate">期滿預期總資產</p>
                <p className="text-xl sm:text-2xl font-extrabold text-[#FFA48D] tracking-tight tabular-nums whitespace-nowrap">
                  {formatCurrency(compCalc.finalValue)}
                </p>
                <p className="text-[11px] text-[#B89D90] mt-0.5 truncate">
                  共 {compYears} 年 ({compYears * 12} 期)
                </p>
              </div>

              <div className="min-w-0">
                <p className="text-xs text-[#DFCBC1] mb-1 truncate">複利總獲利金額</p>
                <p className="text-xl sm:text-2xl font-extrabold text-[#7CE0B3] tabular-nums whitespace-nowrap">
                  +{formatCurrency(compCalc.totalProfit)}
                </p>
                <p className="text-[11px] text-[#B89D90] mt-0.5 truncate">
                  總報酬率 +{compCalc.roiPercent.toFixed(1)}%
                </p>
              </div>

              <div className="min-w-0 pt-3 border-t border-white/10">
                <p className="text-xs text-[#DFCBC1] mb-1 truncate">累積投入總本金</p>
                <p className="text-lg sm:text-xl font-extrabold tabular-nums whitespace-nowrap">
                  {formatCurrency(compCalc.totalPrincipal)}
                </p>
                <p className="text-[11px] text-[#B89D90] mt-0.5 truncate">
                  單筆 {formatShortCurrency(compInitial)} + 月投 {formatShortCurrency(compMonthlyDCA)}
                </p>
              </div>

              <div className="min-w-0 pt-3 border-t border-white/10">
                <p className="text-xs text-[#DFCBC1] mb-1 truncate">扣通膨實質購買力</p>
                <p className="text-lg sm:text-xl font-extrabold tabular-nums whitespace-nowrap">
                  {formatCurrency(compCalc.realFinalValue)}
                </p>
                <p className="text-[11px] text-[#B89D90] mt-0.5 truncate">
                  年通膨 {compInflation}% 折現
                </p>
              </div>
            </div>
          </div>

          {/* Principal vs Compound Profit Proportion Strip */}
          <div className="bg-[#FFFDFB] border border-[#EADCD3] rounded-2xl p-4 shadow-card space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-extrabold text-[#2C1A12]">期末資產組成比例</span>
              <div className="flex items-center gap-3 text-[11px] font-semibold">
                <span className="flex items-center gap-1.5 text-[#2C1A12]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#4B3227]" />
                  投入本金 {principalShare.toFixed(1)}%
                </span>
                <span className="flex items-center gap-1.5 text-[#1F7A5C]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#D95D39]" />
                  複利獲利 {profitShare.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="w-full h-2.5 rounded-full bg-[#F4EAE3] overflow-hidden flex">
              <div className="bg-[#4B3227] h-full" style={{ width: `${principalShare}%` }} />
              <div className="bg-[#D95D39] h-full" style={{ width: `${profitShare}%` }} />
            </div>
          </div>

          {/* Compound Growth Chart */}
          <div className="bg-[#FFFDFB] border border-[#EADCD3] rounded-2xl p-4 sm:p-5 shadow-card">
            <div className="mb-4">
              <h3 className="text-sm sm:text-base font-extrabold text-[#2C1A12]">
                資產複利成長曲線 vs 累積投入本金
              </h3>
              <p className="text-xs text-[#8B6B5C]">
                對比複利滾出的名目資產、實際投入本金與通膨折現後的實質購買力
              </p>
            </div>

            <div className="relative h-72 sm:h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={compCalc.yearlySchedule}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="compTotalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D95D39" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#D95D39" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="compPrinGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4B3227" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#4B3227" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EFE3DC" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6D4E40' }} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#6D4E40' }}
                    tickFormatter={formatShortCurrency}
                    width={52}
                  />
                  <Tooltip
                    formatter={(val, name) => [formatCurrency(val), name]}
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
                    dataKey="portfolioValue"
                    name="預期期末總資產"
                    stroke="#D95D39"
                    strokeWidth={2.5}
                    fill="url(#compTotalGrad)"
                  />
                  <Area
                    isAnimationActive={false}
                    type="monotone"
                    dataKey="cumulativePrincipal"
                    name="累積投入本金"
                    stroke="#2C1A12"
                    strokeWidth={2}
                    fill="url(#compPrinGrad)"
                  />
                  <Line
                    isAnimationActive={false}
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

          {/* Yearly / Monthly Table */}
          <div className="bg-[#FFFDFB] border border-[#EADCD3] rounded-2xl p-4 sm:p-5 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-[#2C1A12]">
                  投資複利成長明細表
                </h3>
                <p className="text-xs text-[#8B6B5C]">檢視每年或每月本金累積與複利收益變化</p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex bg-[#F4EAE3] p-0.5 rounded-xl border border-[#EADCD3]">
                  <button
                    type="button"
                    onClick={() => setCompTableViewMode('yearly')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      compTableViewMode === 'yearly'
                        ? 'bg-[#FFFDFB] text-[#2C1A12] shadow-2xs'
                        : 'text-[#6D4E40]'
                    }`}
                  >
                    按年檢視
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompTableViewMode('monthly')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      compTableViewMode === 'monthly'
                        ? 'bg-[#FFFDFB] text-[#2C1A12] shadow-2xs'
                        : 'text-[#6D4E40]'
                    }`}
                  >
                    按月檢視
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => onExportCSV('compound')}
                  className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl bg-[#2C1A12] text-[#FFFDFB] hover:bg-[#3F261B] transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  CSV
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-80 warm-scroll rounded-xl border border-[#EFE3DC]">
              <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                <thead className="bg-[#F4EAE3] text-[#4B3227] sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3.5 font-bold">期間</th>
                    <th className="py-2.5 px-3.5 font-bold text-right">累積投入本金</th>
                    <th className="py-2.5 px-3.5 font-bold text-right">累積複利獲利</th>
                    <th className="py-2.5 px-3.5 font-bold text-right">期末總資產</th>
                    <th className="py-2.5 px-3.5 font-bold text-right">實質購買力</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F4EAE3] tabular-nums">
                  {(compTableViewMode === 'yearly'
                    ? compCalc.yearlySchedule
                    : compCalc.monthlySchedule
                  ).map((row) => (
                    <tr key={row.month} className="hover:bg-[#FAF5F0] transition-colors">
                      <td className="py-2.5 px-3.5 font-bold text-[#2C1A12]">
                        {compTableViewMode === 'yearly'
                          ? row.label
                          : `第 ${row.month} 個月 (Y${row.year})`}
                      </td>
                      <td className="py-2.5 px-3.5 text-right text-[#6D4E40]">
                        {formatCurrency(row.cumulativePrincipal)}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-bold text-[#1F7A5C]">
                        +{formatCurrency(row.totalProfit)}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-extrabold text-[#D95D39]">
                        {formatCurrency(row.portfolioValue)}
                      </td>
                      <td className="py-2.5 px-3.5 text-right text-[#8B6B5C]">
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
  );
}
