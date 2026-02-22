import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { features } from "@/lib/constants/features";

export default async function RootPage() {
  const session = await requireSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  redirect(features.chatFirstUi ? "/chat" : "/overview");
}
