export const SESSION_COOKIE_NAME = "uit_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
export const SESSION_COOKIE_SAME_SITE = "lax";
export const SESSION_COOKIE_SECURE =
  process.env.NODE_ENV === "production" ||
  process.env.SESSION_COOKIE_SECURE === "1";
