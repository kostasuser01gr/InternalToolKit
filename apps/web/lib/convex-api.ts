/**
 * Re-export Convex generated API for use within the web app.
 * Import this instead of using relative paths to ../../convex/_generated/api.
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — path resolved by tsconfig paths alias @convex/*
export { api } from "@convex/_generated/api";
