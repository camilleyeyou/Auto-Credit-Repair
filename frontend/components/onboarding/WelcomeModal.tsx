"use client";

import { useOnboarding } from "./OnboardingProvider";
import { Dialog } from "@base-ui/react/dialog";

export function WelcomeModal() {
  const { isFirstVisit, dismiss } = useOnboarding();

  if (!isFirstVisit) return null;

  return (
    <Dialog.Root
      defaultOpen
      onOpenChange={(open) => {
        if (!open) dismiss("welcome");
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-0 shadow-xl">
          {/* Header with brand color */}
          <div className="rounded-t-2xl bg-gradient-to-r from-[#0F172A] to-[#1E3A8A] px-8 py-8 text-center">
            <div className="mx-auto mb-4 h-14 w-14 rounded-xl bg-white/10 flex items-center justify-center">
              <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <Dialog.Title className="text-xl font-bold text-white">
              Welcome to CreditFix
            </Dialog.Title>
            <p className="mt-2 text-sm text-blue-100">
              Your free AI-powered credit repair assistant
            </p>
          </div>

          {/* Body */}
          <div className="px-8 py-6">
            <p className="text-sm text-slate-600 mb-5">
              CreditFix helps you dispute inaccurate items on your credit report under federal law. Here&apos;s how it works:
            </p>

            <div className="space-y-4">
              <Step number={1} title="Set up your profile" desc="Add your name and address — they go on every letter." />
              <Step number={2} title="Upload your credit reports" desc="Get free reports from annualcreditreport.com and upload the PDFs." />
              <Step number={3} title="Review AI findings" desc="The AI scans your reports and flags items you can dispute." />
              <Step number={4} title="Generate & mail letters" desc="Download personalized dispute letters and mail them via Certified Mail." />
              <Step number={5} title="Track & escalate" desc="Monitor the 30-day deadline. Escalate if the bureau doesn't respond." />
            </div>

            <p className="mt-5 text-xs text-slate-400 text-center">
              Each page has a quick guide to help you along the way. You can dismiss them anytime.
            </p>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 px-8 py-4">
            <Dialog.Close className="w-full rounded-lg bg-[#1E3A8A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1E3A8A]/90 transition-colors">
              Get Started
            </Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Step({ number, title, desc }: { number: number; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="shrink-0 mt-0.5 h-6 w-6 rounded-full bg-[#1E3A8A] text-white text-xs font-bold flex items-center justify-center">
        {number}
      </span>
      <div>
        <p className="text-sm font-medium text-slate-800">{title}</p>
        <p className="text-xs text-slate-500">{desc}</p>
      </div>
    </div>
  );
}
