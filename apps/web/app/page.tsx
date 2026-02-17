import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";

export default async function RootPage() {
  const session = await requireSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  redirect("/overview");
}
