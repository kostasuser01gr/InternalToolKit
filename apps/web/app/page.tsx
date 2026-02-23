import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { requireSession } from "@/lib/auth/session";
import { features } from "@/lib/constants/features";

export default async function RootPage() {
  const session = await requireSession();

  if (!session?.user?.id) {
    // Clear stale/invalid cookie to prevent redirect loop with proxy.ts
    const cookieStore = await cookies();
    if (cookieStore.get(SESSION_COOKIE_NAME)?.value) {
      cookieStore.delete(SESSION_COOKIE_NAME);
    }
    redirect("/login");
  }

  redirect(features.chatFirstUi ? "/chat" : "/overview");
}
