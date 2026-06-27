/** Canonical site URL for SEO, sitemap, and OpenGraph. */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (explicit) return explicit;

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/\/$/, "");
  if (production) return `https://${production}`;

  const deployment = process.env.VERCEL_URL?.replace(/\/$/, "");
  if (deployment) return `https://${deployment}`;

  return "http://localhost:3000";
}
