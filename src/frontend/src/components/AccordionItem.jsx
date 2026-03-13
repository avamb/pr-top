import React, { useRef, useEffect, useState } from 'react';

export default function AccordionItem({ title, isOpen, onToggle, children, id }) {
  const contentRef = useRef(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight);
    }
  }, [isOpen, children]);

  const panelId = `accordion-panel-${id}`;
  const headerId = `accordion-header-${id}`;

  return (
    <div className="border border-gray-200 rounded-lg mb-3 overflow-hidden bg-white shadow-sm">
      <button
        id={headerId}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        className="w-full flex items-center justify-between px-5 py-4 text-left font-semibold text-stone-800 hover:bg-stone-50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 min-h-[44px]"
      >
        <span className="text-sm sm:text-base pr-4">{title}</span>
        <svg
          className={`w-5 h-5 flex-shrink-0 text-stone-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={headerId}
        className="transition-all duration-300 ease-in-out overflow-hidden"
        style={{ maxHeight: isOpen ? `${height}px` : '0px', opacity: isOpen ? 1 : 0 }}
      >
        <div ref={contentRef} className="px-5 pb-5 pt-1 text-sm text-stone-600 leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );
}
