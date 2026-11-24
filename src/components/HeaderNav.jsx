import React from 'react';
import { Calculator, TrendingUp, ArrowRightLeft, Scale, Copy, Check, HelpCircle } from 'lucide-react';

const TABS = [
  { id: 'loan', label: '信貸試算', shortLabel: '信貸試算', icon: Calculator },
  { id: 'compound', label: '投資複利', shortLabel: '投資複利', icon: TrendingUp },
  { id: 'arbitrage', label: '信貸投資', shortLabel: '信貸投資', icon: ArrowRightLeft }
];

export default function HeaderNav({
  activeTab,
  onTabChange,
  onCopySummary,
  copiedToast,
  onOpenGuide
}) {
  return (
    <>
      <header className="sticky top-0 z-30 bg-[#FFFDFB]/90 backdrop-blur-md border-b border-[#EADCD3]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Brand */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#D95D39] to-[#B64323] flex items-center justify-center text-white shadow-sm shrink-0">
              <Scale className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-[#2C1A12] truncate">
                WarmRoast
              </h1>
              <p className="text-[11px] text-[#8B6B5C] truncate hidden sm:block">
                信貸・複利・槓桿套利決策試算
              </p>
            </div>
          </div>

          {/* Desktop Segmented Navigation (hidden on mobile; mobile uses bottom bar) */}
          <nav
            aria-label="主功能導覽"
            className="hidden md:flex items-center bg-[#F4EAE3] p-1 rounded-xl border border-[#EADCD3]"
          >
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`nav-tab-${tab.id}`}
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-[#FFFDFB] text-[#2C1A12] shadow-sm'
                      : 'text-[#6D4E40] hover:text-[#2C1A12]'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#D95D39]' : ''}`} />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              id="btn-open-guide"
              type="button"
              onClick={onOpenGuide}
              className="flex items-center gap-1.5 text-xs font-bold px-2.5 sm:px-3 py-2 rounded-xl text-[#6D4E40] hover:text-[#2C1A12] hover:bg-[#F4EAE3] transition-colors"
              title="試算模型與還款模式說明"
            >
              <HelpCircle className="w-4 h-4 text-[#8B6B5C]" />
              <span className="hidden sm:inline">運作原理</span>
            </button>

            <button
              id="btn-copy-summary"
              type="button"
              onClick={onCopySummary}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border transition-all whitespace-nowrap ${
                copiedToast
                  ? 'bg-[#EAF6F1] text-[#1F7A5C] border-[#B8E2D1]'
                  : 'bg-[#FFFDFB] hover:bg-[#F4EAE3] text-[#2C1A12] border-[#E5D2C7]'
              }`}
            >
              {copiedToast ? (
                <>
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>已複製摘要</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#D95D39] shrink-0" />
                  <span>複製報告</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation (Single navigation for < md) */}
      <nav
        aria-label="行動版主導覽"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FFFDFB]/95 backdrop-blur-md border-t border-[#EADCD3] px-3 py-2 shadow-elevated"
      >
        <div className="max-w-md mx-auto grid grid-cols-3 gap-1.5">
          {TABS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`mobile-nav-tab-${item.id}`}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-all ${
                  isActive
                    ? 'bg-[#D95D39] text-white shadow-xs'
                    : 'text-[#6D4E40] hover:bg-[#F4EAE3]'
                }`}
              >
                <Icon className="w-4 h-4 mb-0.5" />
                <span className="text-[11px] font-bold">{item.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
