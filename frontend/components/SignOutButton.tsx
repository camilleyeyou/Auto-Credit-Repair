"use client";

import { useAuthActions } from "@convex-dev/auth/react";

export function SignOutButton() {
  const { signOut } = useAuthActions();

  return (
    <button
      onClick={() => void signOut()}
      className="text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors px-2 py-1 rounded-md hover:bg-slate-50"
    >
      Sign out
    </button>
  );
}
