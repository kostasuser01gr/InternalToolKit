import { WorkspaceRole } from "@prisma/client";
import { z } from "zod";

export const inviteMemberSchema = z.object({
  workspaceId: z.string().min(1),
  email: z.string().email().max(200),
  role: z.nativeEnum(WorkspaceRole),
});

export const updateMemberRoleSchema = z.object({
  workspaceId: z.string().min(1),
  userId: z.string().min(1),
  role: z.nativeEnum(WorkspaceRole),
});

export const removeMemberSchema = z.object({
  workspaceId: z.string().min(1),
  userId: z.string().min(1),
});

export const verifyAdminStepUpSchema = z.object({
  workspaceId: z.string().min(1),
  pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits."),
});
