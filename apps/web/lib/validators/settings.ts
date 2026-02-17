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
