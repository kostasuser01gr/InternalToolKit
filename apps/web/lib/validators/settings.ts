import { ThemePreference } from "@prisma/client";
import { z } from "zod";

export const updateProfileSchema = z.object({
  userId: z.string().min(1),
  name: z.string().trim().min(2).max(80),
});

export const updatePreferencesSchema = z.object({
  userId: z.string().min(1),
  notificationsEnabled: z.boolean(),
  themePreference: z.nativeEnum(ThemePreference),
});

export const revokeSessionSchema = z.object({
  userId: z.string().min(1),
  sessionId: z.string().min(1),
});

export const revokeAllSessionsSchema = z.object({
  userId: z.string().min(1),
});

export const createShortcutSchema = z.object({
  userId: z.string().min(1),
  workspaceId: z.string().min(1),
  label: z.string().trim().min(1).max(60),
  command: z.string().trim().min(1).max(300),
  keybinding: z.string().trim().max(40).optional(),
});

export const deleteShortcutSchema = z.object({
  userId: z.string().min(1),
  workspaceId: z.string().min(1),
  shortcutId: z.string().min(1),
});

export const createActionButtonSchema = z.object({
  userId: z.string().min(1),
  workspaceId: z.string().min(1),
  label: z.string().trim().min(1).max(40),
  action: z.string().trim().min(1).max(200),
  position: z.coerce.number().int().min(0).max(200).optional(),
});

export const deleteActionButtonSchema = z.object({
  userId: z.string().min(1),
  workspaceId: z.string().min(1),
  buttonId: z.string().min(1),
});

export const createPromptTemplateSchema = z.object({
  userId: z.string().min(1),
  workspaceId: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  prompt: z.string().trim().min(1).max(2000),
});

export const deletePromptTemplateSchema = z.object({
  userId: z.string().min(1),
  workspaceId: z.string().min(1),
  templateId: z.string().min(1),
});
