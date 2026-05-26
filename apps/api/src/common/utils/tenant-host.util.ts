export function extractTenantSlugFromHost(hostname: string, appDomain: string) {
  const cleanHost = hostname.split(":")[0]?.toLowerCase();
  const suffix = `.${appDomain.toLowerCase()}`;

  if (!cleanHost?.endsWith(suffix)) {
    return null;
  }

  const subdomain = cleanHost.slice(0, -suffix.length);
  const parts = subdomain.split(".");

  if (parts.length >= 2 && parts[0] === "app") {
    return parts[1] ?? null;
  }

  return null;
}
