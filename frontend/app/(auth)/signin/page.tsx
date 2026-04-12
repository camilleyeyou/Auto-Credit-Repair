"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Map raw Convex auth errors to friendly messages a non-technical user
 * can understand and act on.
 */
function friendlyError(raw: string, mode: "signIn" | "signUp"): string {
  const lower = raw.toLowerCase();

  // Account / credential issues
  if (lower.includes("invalid password") || lower.includes("could not verify"))
    return "Incorrect email or password. Please try again.";
  if (lower.includes("invalidaccountid") || lower.includes("no account") || lower.includes("user not found"))
    return "No account found with that email. Click \"Sign up\" below to create one.";
  if (lower.includes("already exists") || lower.includes("account already"))
    return "An account with that email already exists. Try signing in instead.";

  // Password strength
  if (lower.includes("password") && (lower.includes("short") || lower.includes("weak") || lower.includes("least")))
    return "Your password is too short. Please use at least 8 characters.";

  // Email format
  if (lower.includes("invalid email") || lower.includes("email"))
    return "Please enter a valid email address.";

  // Rate limiting
  if (lower.includes("rate") || lower.includes("too many"))
    return "Too many attempts. Please wait a minute and try again.";

  // Network / server
  if (lower.includes("network") || lower.includes("fetch"))
    return "Connection problem. Please check your internet and try again.";

  // Generic fallback — still friendly
  if (mode === "signIn")
    return "Couldn't sign in. Please check your email and password.";
  return "Couldn't create your account. Please try again.";
}

export default function SignInPage() {
  const { signIn } = useAuthActions();
  const [step, setStep] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn("password", new FormData(e.currentTarget));
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      setError(friendlyError(raw, step));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#0F172A] text-white flex-col justify-between p-12">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-lg bg-[#1E3A8A] flex items-center justify-center">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="text-xl font-semibold tracking-tight">CreditFix</span>
          </div>
          <p className="text-slate-400 text-sm mt-1">AI-powered credit dispute automation</p>
        </div>

        <div className="space-y-8">
          <div>
            <p className="text-2xl font-light leading-relaxed text-slate-200">
              Dispute inaccurate items on your credit report — for free.
            </p>
            <p className="text-slate-400 mt-4 text-sm leading-relaxed">
              Under the Fair Credit Reporting Act, you have the right to dispute
              any inaccurate, outdated, or unverifiable information on your credit report.
              CreditFix automates the process.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-700/50">
            <div>
              <p className="text-2xl font-semibold text-white">3</p>
              <p className="text-xs text-slate-400 mt-0.5">Bureau support</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">30</p>
              <p className="text-xs text-slate-400 mt-0.5">Day tracking</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">FCRA</p>
              <p className="text-xs text-slate-400 mt-0.5">Compliant</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-500">
          This tool generates dispute letters. It does not provide legal advice.
        </p>
      </div>

      {/* Right panel — auth form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-[#F8FAFC]">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="h-9 w-9 rounded-lg bg-[#0F172A] flex items-center justify-center">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="text-xl font-semibold tracking-tight text-[#0F172A]">CreditFix</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-[#0F172A]">
              {step === "signIn" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {step === "signIn"
                ? "Sign in to manage your credit disputes"
                : "Get started with free credit dispute automation"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                Email address
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="h-11 bg-white border-slate-200 focus:border-[#1E3A8A] focus:ring-[#1E3A8A]/20"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete={step === "signIn" ? "current-password" : "new-password"}
                className="h-11 bg-white border-slate-200 focus:border-[#1E3A8A] focus:ring-[#1E3A8A]/20"
              />
            </div>

            <input name="flow" type="hidden" value={step} />

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-[#0F172A] hover:bg-[#1E293B] text-white font-medium"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Please wait...
                </span>
              ) : step === "signIn" ? "Sign in" : "Create account"}
            </Button>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-[#F8FAFC] px-3 text-slate-400">or</span>
              </div>
            </div>

            <button
              type="button"
              className="w-full text-center text-sm text-[#1E3A8A] hover:text-[#1E40AF] font-medium py-2 transition-colors"
              onClick={() => {
                setError(null);
                setStep(s => s === "signIn" ? "signUp" : "signIn");
              }}
            >
              {step === "signIn" ? "Need an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
