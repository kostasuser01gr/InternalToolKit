import type { GlobalRole } from "@prisma/client";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  roleGlobal: GlobalRole;
};

export type AppSession = {
  user: SessionUser;
  session: {
    id: string;
    createdAt: Date;
    lastSeenAt: Date;
    expiresAt: Date;
    elevatedUntil: Date | null;
  };
};

export type ActiveSessionInfo = {
  id: string;
  userAgent: string | null;
  deviceId: string | null;
  ipAddress: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  elevatedUntil: Date | null;
  isCurrent: boolean;
};
