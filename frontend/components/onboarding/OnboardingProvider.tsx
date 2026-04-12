"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

// Every dismissible onboarding step across the app
export type OnboardingStep =
  | "welcome"
  | "dashboard"
  | "upload"
  | "disputes"
  | "letters"
  | "tracker"
  | "profile";

const STORAGE_KEY = "creditfix_onboarding_dismissed";

interface OnboardingContextValue {
  /** True if the user has never visited before (no dismissed steps at all) */
  isFirstVisit: boolean;
  /** Check if a specific step's guide has been dismissed */
  isDismissed: (step: OnboardingStep) => boolean;
  /** Dismiss a step so it won't show again */
  dismiss: (step: OnboardingStep) => void;
  /** Reset all onboarding (show everything again) */
  resetAll: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [dismissed, setDismissed] = useState<Set<OnboardingStep>>(new Set());
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as OnboardingStep[];
        setDismissed(new Set(parsed));
      }
    } catch {
      // ignore parse errors
    }
    setLoaded(true);
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...dismissed]));
  }, [dismissed, loaded]);

  const isDismissed = useCallback(
    (step: OnboardingStep) => dismissed.has(step),
    [dismissed],
  );

  const dismiss = useCallback((step: OnboardingStep) => {
    setDismissed((prev) => new Set([...prev, step]));
  }, []);

  const resetAll = useCallback(() => {
    setDismissed(new Set());
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const isFirstVisit = loaded && dismissed.size === 0;

  // Don't render children until we've loaded from localStorage to prevent flash
  if (!loaded) return null;

  return (
    <OnboardingContext.Provider value={{ isFirstVisit, isDismissed, dismiss, resetAll }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}
