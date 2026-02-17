import type { GlobalRole } from "@prisma/client";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  roleGlobal: GlobalRole;
};

export type AppSession = {
  user: SessionUser;
};
