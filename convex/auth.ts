import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ─── Session Queries ────────────────────────────────────────────────────────

export const getByTokenHash = query({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("authSessions")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", args.tokenHash))
      .first();
    if (!session) return null;
    const now = Date.now();
    if (session.expiresAt < now) return null;
    if (session.revokedAt) return null;
    return session;
  },
});

/** Resolve session by ID + userId, return session + user (safe fields). */
export const resolveSession = query({
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

/** List active (non-revoked, non-expired) sessions for a user. */
export const listActiveSessions = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
    const now = Date.now();
    return sessions
      .filter((s) => !s.revokedAt && s.expiresAt > now)
      .sort((a, b) => (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0));
  },
});

export const getByUserId = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("authSessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// ─── Session Mutations ──────────────────────────────────────────────────────

export const create = mutation({
  args: {
    userId: v.string(),
    tokenHash: v.string(),
    userAgent: v.optional(v.string()),
    deviceId: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("authSessions", {
      userId: args.userId,
      tokenHash: args.tokenHash,
      ...(args.userAgent !== undefined ? { userAgent: args.userAgent } : {}),
      ...(args.deviceId !== undefined ? { deviceId: args.deviceId } : {}),
      ...(args.ipAddress !== undefined ? { ipAddress: args.ipAddress } : {}),
      lastSeenAt: now,
      expiresAt: args.expiresAt,
    });
    return id;
  },
});

export const revoke = mutation({
  args: {
    id: v.id("authSessions"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      revokedAt: Date.now(),
      revokedReason: args.reason ?? "logout",
    });
  },
});

export const revokeAllForUser = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
    const now = Date.now();
    for (const s of sessions) {
      if (!s.revokedAt) {
        await ctx.db.patch(s._id, { revokedAt: now, revokedReason: "logout_all" });
      }
    }
  },
});

export const touch = mutation({
  args: { id: v.id("authSessions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { lastSeenAt: Date.now() });
  },
});

/** Revoke a specific session owned by a user. */
export const revokeBySessionAndUser = mutation({
  args: {
    sessionId: v.id("authSessions"),
    userId: v.id("users"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== args.userId || session.revokedAt) return 0;
    await ctx.db.patch(args.sessionId, {
      revokedAt: Date.now(),
      revokedReason: args.reason ?? "user_revoked",
    });
    return 1;
  },
});

/** Revoke all sessions for a user except optionally one. */
export const revokeAllExcept = mutation({
  args: {
    userId: v.id("users"),
    exceptSessionId: v.optional(v.id("authSessions")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
    const now = Date.now();
    let count = 0;
    for (const s of sessions) {
      if (!s.revokedAt && s._id !== args.exceptSessionId) {
        await ctx.db.patch(s._id, {
          revokedAt: now,
          revokedReason: args.reason ?? "user_revoked_all",
        });
        count++;
      }
    }
    return count;
  },
});

/** Set elevatedUntil on a session (for sudo-mode). */
export const elevateSession = mutation({
  args: {
    sessionId: v.id("authSessions"),
    userId: v.id("users"),
    elevatedUntil: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (
      !session ||
      session.userId !== args.userId ||
      session.revokedAt ||
      session.expiresAt < Date.now()
    ) {
      return false;
    }
    await ctx.db.patch(args.sessionId, { elevatedUntil: args.elevatedUntil });
    return true;
  },
});

// ─── Throttle ───────────────────────────────────────────────────────────────

export const checkThrottle = query({
  args: {
    dimension: v.string(),
    identifier: v.string(),
  },
  handler: async (ctx, args) => {
    const throttle = await ctx.db
      .query("authThrottles")
      .withIndex("by_dimension_identifier", (q) =>
        q.eq("dimension", args.dimension).eq("identifier", args.identifier),
      )
      .first();
    if (!throttle) return { blocked: false, attemptCount: 0 };
    const now = Date.now();
    if (throttle.lockoutUntil && throttle.lockoutUntil > now) {
      return { blocked: true, attemptCount: throttle.attemptCount, lockoutUntil: throttle.lockoutUntil };
    }
    return { blocked: false, attemptCount: throttle.attemptCount };
  },
});

export const recordAttempt = mutation({
  args: {
    dimension: v.string(),
    identifier: v.string(),
    lockoutUntil: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("authThrottles")
      .withIndex("by_dimension_identifier", (q) =>
        q.eq("dimension", args.dimension).eq("identifier", args.identifier),
      )
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        attemptCount: existing.attemptCount + 1,
        lastAttemptAt: now,
        ...(args.lockoutUntil !== undefined ? { lockoutUntil: args.lockoutUntil } : {}),
      });
    } else {
      await ctx.db.insert("authThrottles", {
        dimension: args.dimension,
        identifier: args.identifier,
        windowStartedAt: now,
        attemptCount: 1,
        lastAttemptAt: now,
        ...(args.lockoutUntil !== undefined ? { lockoutUntil: args.lockoutUntil } : {}),
      });
    }
  },
});

export const resetThrottle = mutation({
  args: {
    dimension: v.string(),
    identifier: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("authThrottles")
      .withIndex("by_dimension_identifier", (q) =>
        q.eq("dimension", args.dimension).eq("identifier", args.identifier),
      )
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

// ─── Security Events ────────────────────────────────────────────────────────

export const logSecurityEvent = mutation({
  args: {
    event: v.string(),
    severity: v.optional(v.string()),
    requestId: v.optional(v.string()),
    actorUserId: v.optional(v.string()),
    targetUserId: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    deviceId: v.optional(v.string()),
    route: v.optional(v.string()),
    detailsJson: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("securityEvents", {
      event: args.event,
      severity: args.severity ?? "info",
      ...(args.requestId !== undefined ? { requestId: args.requestId } : {}),
      ...(args.actorUserId !== undefined ? { actorUserId: args.actorUserId } : {}),
      ...(args.targetUserId !== undefined ? { targetUserId: args.targetUserId } : {}),
      ...(args.ipAddress !== undefined ? { ipAddress: args.ipAddress } : {}),
      ...(args.deviceId !== undefined ? { deviceId: args.deviceId } : {}),
      ...(args.route !== undefined ? { route: args.route } : {}),
      detailsJson: args.detailsJson ?? {},
    });
  },
});
