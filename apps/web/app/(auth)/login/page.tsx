import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";

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

  try {
    const session = await getSession();
    if (session?.user?.id) {
      redirect(safeCallbackUrl);
    }
  } catch {
    // If session lookup fails (e.g. DB unreachable), show login form anyway.
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
