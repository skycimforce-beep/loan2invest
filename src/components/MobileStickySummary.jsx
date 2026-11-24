import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

export default function MobileStickySummary({ targetRef, items = [] }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = targetRef?.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 64);
      },
      { threshold: 0, rootMargin: '-64px 0px 0px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [targetRef]);

  if (!visible || items.length === 0) return null;

  return (
    <div className="lg:hidden fixed top-16 left-0 right-0 z-20 px-3 pt-2 pointer-events-none">
      <button
        type="button"
        onClick={() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        className="pointer-events-auto w-full max-w-xl mx-auto bg-[#2C1A12] text-[#FFFDFB] border border-[#4F3124] rounded-xl px-3.5 py-2 shadow-elevated flex items-center justify-between gap-2 active:scale-[0.99] transition-transform"
      >
        <div className="flex items-center gap-3 sm:gap-4 min-w-0 overflow-hidden">
          {items.map((item) => (
            <div key={item.label} className="min-w-0 text-left">
              <span className="text-[10px] text-[#CEB6AA] block leading-none truncate">
                {item.label}
              </span>
              <span
                className={`text-xs font-extrabold tabular-nums whitespace-nowrap block mt-0.5 ${
                  item.tone === 'positive'
                    ? 'text-[#7CE0B3]'
                    : item.tone === 'accent'
                    ? 'text-[#FFA48D]'
                    : item.tone === 'negative'
                    ? 'text-[#FF9E88]'
                    : 'text-[#FFFDFB]'
                }`}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>

        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#FFA48D] shrink-0 bg-white/10 px-2 py-1 rounded-lg">
          <ArrowUp className="w-3 h-3" />
          頂部
        </span>
      </button>
    </div>
  );
}
