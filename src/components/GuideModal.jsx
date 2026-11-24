import React from 'react';
import { X, Wallet, Sparkles, CheckCircle2, Info } from 'lucide-react';
import { formatCurrency } from '../utils/finance';

export default function GuideModal({
  isOpen,
  onClose,
  loanAmount,
  loanMonths,
  cashBufferMonths,
  arbCalc
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2C1A12]/45 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="guide-modal-title"
    >
      <div
        className="w-full max-w-2xl bg-[#FFFDFB] border border-[#EADCD3] rounded-3xl shadow-elevated overflow-hidden max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-[#EFE3DC] flex items-center justify-between bg-[#FAF5F0]">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-[#D95D39]" />
            <h2 id="guide-modal-title" className="text-base font-extrabold text-[#2C1A12]">
              信貸投資雙模式運作原理（依目前參數試算）
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#6D4E40] hover:bg-[#EFE3DC] hover:text-[#2C1A12] transition-colors"
            aria-label="關閉說明"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto warm-scroll space-y-4 text-sm text-[#4B3227]">
          <div className="rounded-2xl p-4 bg-[#FFF6F2] border border-[#F0D5C9]">
            <div className="flex items-center gap-2 font-extrabold text-[#D95D39] mb-2">
              <Wallet className="w-4 h-4" />
              <span>模式 A：投資部位自給自足（預留現金水庫）</span>
            </div>
            <p className="text-xs sm:text-sm leading-relaxed text-[#5D4033]">
              實務上每月賣零股還貸款既繁瑣，又怕遇到市場回檔被迫砍在低點。系統支援從您目前的{' '}
              <strong className="text-[#2C1A12]">{formatCurrency(arbCalc.totalAvailablePool)}</strong>{' '}
              資金池中，預留前{' '}
              <strong className="text-[#2C1A12]">{cashBufferMonths} 期</strong>約{' '}
              <strong className="text-[#C04832]">{formatCurrency(arbCalc.initialCashReserveA)}</strong>{' '}
              作為還款準備金，其餘{' '}
              <strong className="text-[#1F7A5C]">{formatCurrency(arbCalc.initialStockInvestedA)}</strong>{' '}
              投入市場。
            </p>
            <ul className="mt-2.5 space-y-1.5 text-xs text-[#6D4E40]">
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#1F7A5C] shrink-0 mt-0.5" />
                <span>每月配息自動匯入現金水庫，延長無需賣股的扣款週期。</span>
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#1F7A5C] shrink-0 mt-0.5" />
                <span>
                  在目前參數下，{loanMonths} 期僅需賣股補水{' '}
                  <strong className="text-[#2C1A12]">{arbCalc.sellStockCountA} 次</strong>
                  ，全程幾乎免掏薪水。
                </span>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl p-4 bg-[#FAF5F0] border border-[#E5D2C7]">
            <div className="flex items-center gap-2 font-extrabold text-[#2C1A12] mb-2">
              <Sparkles className="w-4 h-4 text-[#D95D39]" />
              <span>模式 B：薪資現金流還款（本金 100% 複利）</span>
            </div>
            <p className="text-xs sm:text-sm leading-relaxed text-[#5D4033]">
              不賣出任何投資部位，由每月薪資現金流支付信貸月付金（可自由切換「配息再投入」或「領息貼補月付」）。借入與自備之{' '}
              <strong className="text-[#2C1A12]">{formatCurrency(arbCalc.totalAvailablePool)}</strong>{' '}
              全額留在市場複利滾雪球，適合有穩定現金流結餘、追求期滿資產極大化的投資人。
            </p>
          </div>

          <div className="rounded-2xl p-3.5 bg-[#F4EAE3]/70 text-xs text-[#6D4E40] leading-relaxed">
            <strong className="text-[#2C1A12]">損益兩平基準：</strong>
            信貸考量開辦費後的實質年化成本為{' '}
            <strong className="text-[#2C1A12]">APR {arbCalc.apr.toFixed(2)}%</strong>
            。只要長期年化總報酬率（資本利得＋配息）高於 APR，即具備正利差套利空間；同時務必留意市場波動與個人緊急預備金水位。
          </div>
        </div>

        <div className="px-6 py-3.5 border-t border-[#EFE3DC] bg-[#FAF5F0] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#2C1A12] text-[#FFFDFB] text-xs font-bold hover:bg-[#3F261B] transition-colors"
          >
            了解，開始試算
          </button>
        </div>
      </div>
    </div>
  );
}
