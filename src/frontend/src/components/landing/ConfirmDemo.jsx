import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * ConfirmDemo — animated/mocked illustration of the Telegram reminder flow.
 * Uses a static SVG/HTML mockup since a real screenshot is not yet available.
 */
export default function ConfirmDemo() {
  const { t } = useTranslation();

  return (
    <section aria-label="Demo" className="py-20 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-text">
            {t('landingConfirm.demo.title')}
          </h2>
          <p className="mt-3 text-secondary text-base">
            {t('landingConfirm.demo.caption')}
          </p>
        </div>

        {/* Telegram chat mockup */}
        <div className="max-w-sm mx-auto">
          {/* Phone outer shell */}
          <div className="bg-gray-900 rounded-[2.5rem] p-3 shadow-2xl">
            {/* Screen */}
            <div className="bg-[#17212b] rounded-[2rem] overflow-hidden">
              {/* Status bar */}
              <div className="bg-[#232e3c] px-5 py-2 flex items-center justify-between">
                <span className="text-white/70 text-xs">9:41</span>
                <div className="flex items-center gap-1">
                  <svg className="w-3 h-3 text-white/70" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M1.5 8.5a13 13 0 0121 0M5 12a10 10 0 0114 0M8.5 15.5a6.5 6.5 0 017 0M12 19h.01" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div className="w-3 h-2 bg-white/70 rounded-sm" />
                </div>
              </div>

              {/* Chat header */}
              <div className="bg-[#232e3c] px-4 py-3 flex items-center gap-3 border-b border-white/5">
                <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold">R</div>
                <div>
                  <div className="text-white text-sm font-semibold">PR-TOP Remind</div>
                  <div className="text-white/50 text-xs">bot</div>
                </div>
              </div>

              {/* Messages */}
              <div className="px-3 py-4 space-y-3 bg-[#0d1117] min-h-[280px]">
                {/* Incoming reminder message */}
                <div className="flex justify-start">
                  <div className="bg-[#182533] rounded-2xl rounded-tl-sm max-w-[85%] px-3 py-2.5">
                    <p className="text-white/90 text-sm leading-relaxed">
                      📅 <strong className="text-white">Session reminder</strong><br />
                      <span className="text-white/70 text-xs">Tomorrow · Thu, May 29</span><br />
                      <span className="text-primary text-xs font-medium">3:00 PM → 4:00 PM</span><br />
                      <span className="text-white/60 text-xs">Dr. Maria Ivanova</span>
                    </p>
                    <p className="text-white/50 text-[10px] text-right mt-1.5">3:47 PM ✓✓</p>
                  </div>
                </div>

                {/* Inline keyboard */}
                <div className="space-y-1.5 px-1">
                  <button className="w-full bg-[#2b5278] hover:bg-[#3a6898] text-white text-sm py-2.5 px-4 rounded-xl font-medium transition-colors text-left flex items-center gap-2">
                    <span>✅</span> Confirm session
                  </button>
                  <button className="w-full bg-[#2b5278] hover:bg-[#3a6898] text-white text-sm py-2.5 px-4 rounded-xl font-medium transition-colors text-left flex items-center gap-2">
                    <span>🔄</span> Request reschedule
                  </button>
                  <button className="w-full bg-[#2b5278] hover:bg-[#3a6898] text-white text-sm py-2.5 px-4 rounded-xl font-medium transition-colors text-left flex items-center gap-2">
                    <span>🆓</span> Release slot
                  </button>
                </div>

                {/* Client reply (after confirm tap) */}
                <div className="flex justify-end">
                  <div className="bg-[#2b5278] rounded-2xl rounded-tr-sm max-w-[80%] px-3 py-2">
                    <p className="text-white/90 text-sm">✅ Confirm session</p>
                    <p className="text-white/50 text-[10px] text-right mt-1">3:48 PM ✓✓</p>
                  </div>
                </div>

                {/* Bot confirmation message */}
                <div className="flex justify-start">
                  <div className="bg-[#182533] rounded-2xl rounded-tl-sm max-w-[85%] px-3 py-2.5">
                    <p className="text-white/90 text-sm">
                      🎉 Great, see you tomorrow! Your therapist has been notified.
                    </p>
                    <p className="text-white/50 text-[10px] text-right mt-1.5">3:48 PM ✓</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature callout below mockup */}
        <div className="mt-10 flex flex-wrap justify-center gap-4 text-sm text-secondary">
          <span className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
            Works in existing Telegram
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
            No extra apps for clients
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
            Instant dashboard update
          </span>
        </div>
      </div>
    </section>
  );
}
