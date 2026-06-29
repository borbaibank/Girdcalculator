import { headers } from "next/headers";

/** Build canonical origin from the incoming request host (works with any custom domain). */
export function resolveSiteUrl(host: string | null, proto?: string | null): string {
  if (host) {
    const hostname = host.split(",")[0]?.trim();
    if (hostname) {
      if (hostname.startsWith("localhost") || hostname.startsWith("127.0.0.1")) {
        return `http://${hostname}`;
      }
      const protocol = proto === "http" || proto === "https" ? proto : "https";
      return `${protocol}://${hostname}`;
    }
  }
  return getSiteUrlFallback();
}

/** Request-aware site URL — preferred for SEO metadata, sitemap, and robots. */
export async function getRequestSiteUrl(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto");
  return resolveSiteUrl(host, proto);
}

/** Sync fallback when request headers are unavailable (local build). */
export function getSiteUrl(): string {
  return getSiteUrlFallback();
}

function getSiteUrlFallback(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (explicit) return explicit;

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/\/$/, "");
  if (production) return `https://${production}`;

  const deployment = process.env.VERCEL_URL?.replace(/\/$/, "");
  if (deployment) return `https://${deployment}`;

  return "http://localhost:4000";
}
