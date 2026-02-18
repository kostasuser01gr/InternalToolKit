import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";

import { SignupForm } from "./signup-form";

type SignupPageProps = {
  searchParams: Promise<{
    callbackUrl?: string;
    error?: string;
  }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;
  const safeCallbackUrl =
    params.callbackUrl && params.callbackUrl.startsWith("/")
      ? params.callbackUrl
      : "/overview";
  const session = await requireSession();

  if (session?.user?.id) {
    redirect(safeCallbackUrl);
  }

  return <SignupForm callbackUrl={safeCallbackUrl} error={params.error} />;
}
