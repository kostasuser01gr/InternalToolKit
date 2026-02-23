import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ─── Workspace Queries ──────────────────────────────────────────────────────

export const getById = query({
  args: { id: v.id("workspaces") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.id);
  },
});

export const listByOwner = query({
  args: { ownerId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("workspaces")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
      .collect();
  },
});

export const listMemberships = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("workspaceMembers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const getMember = query({
  args: { workspaceId: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.userId),
      )
      .first();
  },
});

export const listMembers = query({
  args: { workspaceId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
  },
});

/** Get a user's first (default) workspace membership with workspace details. */
export const getDefaultMembership = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    if (memberships.length === 0) return null;

    // Get the workspace for each membership and return the oldest one
    const withWorkspaces = await Promise.all(
      memberships.map(async (m) => {
        const workspace = await ctx.db
          .query("workspaces")
          .filter((q) => q.eq(q.field("_id"), m.workspaceId))
          .first();
        return { ...m, workspace };
      }),
    );

    // Sort by workspace creation time (oldest first)
    withWorkspaces.sort(
      (a, b) => (a.workspace?._creationTime ?? 0) - (b.workspace?._creationTime ?? 0),
    );
    return withWorkspaces[0] ?? null;
  },
});

/** Get membership for a specific workspace+user with workspace details. */
export const getMemberWithWorkspace = query({
  args: { workspaceId: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const member = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.userId),
      )
      .first();
    if (!member) return null;
    const workspace = await ctx.db
      .query("workspaces")
      .filter((q) => q.eq(q.field("_id"), member.workspaceId))
      .first();
    return { ...member, workspace };
  },
});

// ─── Workspace Mutations ────────────────────────────────────────────────────

export const create = mutation({
  args: {
    name: v.string(),
    ownerId: v.string(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("workspaces", {
      name: args.name,
      ownerId: args.ownerId,
    });
    // Auto-add owner as ADMIN member
    await ctx.db.insert("workspaceMembers", {
      workspaceId: id,
      userId: args.ownerId,
      role: "ADMIN",
    });
    return id;
  },
});

export const addMember = mutation({
  args: {
    workspaceId: v.string(),
    userId: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if already member
    const existing = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.userId),
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { role: args.role });
      return existing._id;
    }
    return ctx.db.insert("workspaceMembers", {
      workspaceId: args.workspaceId,
      userId: args.userId,
      role: args.role,
    });
  },
});

export const removeMember = mutation({
  args: {
    workspaceId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const member = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.userId),
      )
      .first();
    if (member) {
      await ctx.db.delete(member._id);
    }
  },
});
