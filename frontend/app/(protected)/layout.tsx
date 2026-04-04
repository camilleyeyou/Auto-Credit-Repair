"use client";

import { useState } from "react";
import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/upload", label: "Upload" },
  { href: "/disputes", label: "Disputes" },
  { href: "/letters", label: "Letters" },
  { href: "/tracker", label: "Tracker" },
  { href: "/profile", label: "Profile" },
];

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/signin");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-sm">CreditFix</span>
            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-4">
              {NAV_LINKS.map((link) => (
                <Link key={link.href} href={link.href} className="text-sm text-muted-foreground hover:text-foreground">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <SignOutButton />
            {/* Mobile hamburger */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-gray-100"
              aria-label="Toggle menu"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
        {/* Mobile nav dropdown */}
        {menuOpen && (
          <div className="md:hidden mt-3 pb-2 flex flex-col gap-2 border-t pt-3">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="text-sm text-muted-foreground hover:text-foreground py-1.5"
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </nav>
      <main>{children}</main>
    </div>
  );
}
