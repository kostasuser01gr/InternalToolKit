"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

import { PrimaryButton } from "@/components/kit/primary-button";
import { logoutSession } from "@/lib/auth/client";

function SignOutButton() {
  const router = useRouter();

  return (
    <PrimaryButton
      type="button"
      onClick={async () => {
        await logoutSession();
        router.push("/login");
        router.refresh();
      }}
      variant="outline"
      className="bg-transparent"
    >
      <LogOut className="size-4" />
      Sign out
    </PrimaryButton>
  );
}

export { SignOutButton };
