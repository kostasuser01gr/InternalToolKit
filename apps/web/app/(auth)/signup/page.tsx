import { SignupForm } from "./signup-form";

type SignupPageProps = {
  searchParams: Promise<{
    callbackUrl?: string;
    error?: string;
  }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;

  return <SignupForm callbackUrl={params.callbackUrl} error={params.error} />;
}
