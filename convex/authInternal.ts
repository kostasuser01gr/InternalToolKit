import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
} from "./_generated/server";

// ── Internal queries (NOT callable from client) ─────────────────────────────

/** Full user record including password/pin hashes — internal only. */
export const getUserByEmailFull = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();
  },
});

export const getUserByLoginNameFull = internalQuery({
  args: { loginName: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("users")
      .withIndex("by_loginName", (q) =>
        q.eq("loginName", args.loginName.toLowerCase()),
      )
      .first();
  },
});

/** Lookup session + user for session resolution. */
export const getSessionWithUser = internalQuery({
  args: { sessionId: v.id("authSessions"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;
    if (session.userId !== args.userId) return null;
    if (session.revokedAt) return null;
    if (session.expiresAt < Date.now()) return null;

    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    return {
      session: {
        _id: session._id,
        tokenHash: session.tokenHash,
        lastSeenAt: session.lastSeenAt,
        expiresAt: session.expiresAt,
        elevatedUntil: session.elevatedUntil,
        _creationTime: session._creationTime,
      },
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        roleGlobal: user.roleGlobal,
      },
    };
  },
});

// ── Internal mutations ──────────────────────────────────────────────────────

/** Create user + workspace + membership atomically (signup). */
export const signupUser = internalMutation({
  args: {
    email: v.string(),
    loginName: v.optional(v.string()),
    name: v.string(),
    passwordHash: v.string(),
    pinHash: v.optional(v.string()),
    workspaceName: v.string(),
  },
  handler: async (ctx, args) => {
    const loginName = args.loginName?.toLowerCase();
    const userId = await ctx.db.insert("users", {
      email: args.email.toLowerCase(),
      ...(loginName !== undefined ? { loginName } : {}),
      name: args.name,
      passwordHash: args.passwordHash,
      ...(args.pinHash !== undefined ? { pinHash: args.pinHash } : {}),
      roleGlobal: "USER",
      themePreference: "DARK",
      localePreference: "EN",
      quantumTheme: "VIOLET",
      notificationsEnabled: true,
    });

    const workspaceId = await ctx.db.insert("workspaces", {
      name: args.workspaceName,
      ownerId: userId,
    });

    await ctx.db.insert("workspaceMembers", {
      workspaceId,
      userId,
      role: "ADMIN",
    });

    return { userId, workspaceId };
  },
});
