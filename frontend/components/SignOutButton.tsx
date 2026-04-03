"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const { signOut } = useAuthActions();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => void signOut()}
    >
      Sign Out
    </Button>
  );
}
