import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
  args: {
    workspaceId: v.string(),
    actorUserId: v.optional(v.string()),
    action: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    metaJson: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("auditLogs", {
      workspaceId: args.workspaceId,
      ...(args.actorUserId !== undefined ? { actorUserId: args.actorUserId } : {}),
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId,
      metaJson: args.metaJson ?? {},
    });
  },
});

export const listByWorkspace = query({
  args: {
    workspaceId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const q = ctx.db
      .query("auditLogs")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc");
    if (args.limit) {
      return q.take(args.limit);
    }
    return q.take(100);
  },
});
