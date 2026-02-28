import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { getSession } from "@/lib/auth/session";
import { getAuthRuntimeEnvError } from "@/lib/env";

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
  const requestHeaders = await headers();
  const safeCallbackUrl =
    params.callbackUrl && params.callbackUrl.startsWith("/")
      ? params.callbackUrl
      : "/overview";
  const envError = getAuthRuntimeEnvError();
  const requestIdFromHeaders = requestHeaders.get("x-request-id") ?? undefined;

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
      error={params.error ?? envError ?? undefined}
      requestId={
        params.requestId ??
        (params.error || envError ? requestIdFromHeaders : undefined)
      }
      errorId={params.errorId}
    />
  );
}
