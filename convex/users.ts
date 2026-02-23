import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ─── Queries ────────────────────────────────────────────────────────────────

export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();
    if (!user) return null;
    const { passwordHash: _, pinHash: _p, ...safe } = user;
    return safe;
  },
});

export const getByLoginName = query({
  args: { loginName: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_loginName", (q) =>
        q.eq("loginName", args.loginName.toLowerCase()),
      )
      .first();
    if (!user) return null;
    const { passwordHash: _, pinHash: _p, ...safe } = user;
    return safe;
  },
});

export const getById = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.id);
  },
});

// ─── Mutations ──────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    email: v.string(),
    loginName: v.optional(v.string()),
    name: v.string(),
    passwordHash: v.string(),
    pinHash: v.optional(v.string()),
    roleGlobal: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const loginName = args.loginName?.toLowerCase();
    const id = await ctx.db.insert("users", {
      email: args.email.toLowerCase(),
      ...(loginName !== undefined ? { loginName } : {}),
      name: args.name,
      passwordHash: args.passwordHash,
      ...(args.pinHash !== undefined ? { pinHash: args.pinHash } : {}),
      roleGlobal: args.roleGlobal ?? "USER",
      themePreference: "DARK",
      localePreference: "EN",
      quantumTheme: "VIOLET",
      notificationsEnabled: true,
    });
    return id;
  },
});

export const updatePreferences = mutation({
  args: {
    id: v.id("users"),
    themePreference: v.optional(v.string()),
    localePreference: v.optional(v.string()),
    quantumTheme: v.optional(v.string()),
    notificationsEnabled: v.optional(v.boolean()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined),
    );
    if (Object.keys(filtered).length > 0) {
      await ctx.db.patch(id, filtered);
    }
  },
});
