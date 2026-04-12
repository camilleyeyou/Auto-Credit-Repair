"use client";

import { useOnboarding, type OnboardingStep } from "./OnboardingProvider";

interface PageGuideProps {
  step: OnboardingStep;
  title: string;
  /** Array of tip strings — each rendered as a numbered step */
  tips: string[];
  /** Optional next page link */
  nextLabel?: string;
  nextHref?: string;
}

export function PageGuide({ step, title, tips, nextLabel, nextHref }: PageGuideProps) {
  const { isDismissed, dismiss } = useOnboarding();

  if (isDismissed(step)) return null;

  return (
    <div className="mb-6 rounded-xl border border-blue-200/60 bg-gradient-to-r from-blue-50 to-indigo-50 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {/* Light bulb icon */}
          <div className="mt-0.5 shrink-0 h-8 w-8 rounded-lg bg-[#1E3A8A] flex items-center justify-center">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M9.75 8.25a3 3 0 116 0 3 3 0 01-6 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#1E3A8A]">{title}</h3>
            <ol className="mt-2 space-y-1.5">
              {tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                  <span className="shrink-0 mt-0.5 h-5 w-5 rounded-full bg-[#1E3A8A]/10 text-[#1E3A8A] text-xs font-semibold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span>{tip}</span>
                </li>
              ))}
            </ol>
            {nextLabel && nextHref && (
              <a
                href={nextHref}
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[#1E3A8A] hover:text-blue-700"
              >
                {nextLabel}
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </a>
            )}
          </div>
        </div>
        {/* Dismiss button */}
        <button
          onClick={() => dismiss(step)}
          className="shrink-0 rounded-md p-1 text-slate-400 hover:text-slate-600 hover:bg-white/60 transition-colors"
          aria-label="Dismiss guide"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
