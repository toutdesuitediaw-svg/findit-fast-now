const DEFAULT_AUTH_REDIRECT = "/dashboard";

export const sanitizeAuthRedirect = (value: string | null | undefined) => {
  if (!value) return DEFAULT_AUTH_REDIRECT;
  if (!value.startsWith("/") || value.startsWith("//")) return DEFAULT_AUTH_REDIRECT;
  if (value.startsWith("/auth")) return DEFAULT_AUTH_REDIRECT;
  return value;
};

export const getAuthCallbackUrl = (next?: string | null) => {
  const url = new URL("/auth/callback", window.location.origin);
  url.searchParams.set("next", sanitizeAuthRedirect(next));
  return url.toString();
};