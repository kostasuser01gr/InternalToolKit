import { AccessReviewStatus } from "@prisma/client";
import { z } from "zod";

export const createRetentionPolicySchema = z.object({
  workspaceId: z.string().min(1),
  module: z.string().trim().min(1).max(50),
  retainDays: z.coerce.number().int().min(1).max(3650),
});

export const createAccessReviewSchema = z.object({
  workspaceId: z.string().min(1),
  targetUserId: z.string().min(1),
});

export const resolveAccessReviewSchema = z.object({
  workspaceId: z.string().min(1),
  reviewId: z.string().min(1),
  status: z.enum(["APPROVED", "REVOKED"]),
  decision: z.string().trim().max(500).optional(),
});
