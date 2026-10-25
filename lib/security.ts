export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const configuredUrl = process.env.NEXTAUTH_URL || process.env.AUTH_URL;
    const expectedOrigin = configuredUrl ? new URL(configuredUrl).origin : new URL(request.url).origin;
    return new URL(origin).origin === expectedOrigin;
  } catch {
    return false;
  }
}
