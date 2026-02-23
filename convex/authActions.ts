import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Verify user credentials (password or PIN) server-side.
 * Bcrypt comparison happens inside Convex Node.js runtime.
 * Never returns password/pin hashes to the caller.
 */
export const verifyCredentials = action({
  args: {
    email: v.optional(v.string()),
    loginName: v.optional(v.string()),
    password: v.optional(v.string()),
    pin: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{
    ok: boolean;
    user?: { id: string; email: string; name: string; roleGlobal: string };
    message?: string;
  }> => {
    const { compareSync } = await import("bcryptjs");

    if (args.loginName && args.pin) {
      const user = await ctx.runQuery(
        internal.authInternal.getUserByLoginNameFull,
        { loginName: args.loginName },
      );
      if (!user || !user.pinHash || !compareSync(args.pin, user.pinHash)) {
        return { ok: false, message: "Invalid credentials." };
      }
      return {
        ok: true,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          roleGlobal: user.roleGlobal,
        },
      };
    }

    if (args.email && args.password) {
      const user = await ctx.runQuery(
        internal.authInternal.getUserByEmailFull,
        { email: args.email },
      );
      if (
        !user ||
        !user.passwordHash ||
        !compareSync(args.password, user.passwordHash)
      ) {
        return { ok: false, message: "Invalid credentials." };
      }
      return {
        ok: true,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          roleGlobal: user.roleGlobal,
        },
      };
    }

    return { ok: false, message: "Missing credentials." };
  },
});

/**
 * Signup: hash password, create user + workspace + membership.
 */
export const signup = action({
  args: {
    email: v.string(),
    loginName: v.optional(v.string()),
    name: v.string(),
    password: v.string(),
    pin: v.optional(v.string()),
    workspaceName: v.string(),
  },
  handler: async (ctx, args): Promise<{ userId: string; workspaceId: string }> => {
    const { hashSync } = await import("bcryptjs");
    const passwordHash = hashSync(args.password, 10);
    const pinHash = args.pin ? hashSync(args.pin, 10) : undefined;

    const result = await ctx.runMutation(internal.authInternal.signupUser, {
      email: args.email,
      ...(args.loginName !== undefined ? { loginName: args.loginName } : {}),
      name: args.name,
      passwordHash,
      ...(pinHash !== undefined ? { pinHash } : {}),
      workspaceName: args.workspaceName,
    });

    return result;
  },
});
