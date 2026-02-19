import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";

import { LoginForm } from "./login-form";

type LoginPageProps = {
  searchParams: Promise<{
    callbackUrl?: string;
    error?: string;
    requestId?: string;
    errorId?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const safeCallbackUrl =
    params.callbackUrl && params.callbackUrl.startsWith("/")
      ? params.callbackUrl
      : "/overview";
  const session = await requireSession();

  if (session?.user?.id) {
    redirect(safeCallbackUrl);
  }

  return (
    <LoginForm
      callbackUrl={safeCallbackUrl}
      error={params.error}
      requestId={params.requestId}
      errorId={params.errorId}
    />
  );
}
