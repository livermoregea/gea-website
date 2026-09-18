// Accept pasted website addresses without treating bare domains as local paths.
export function normalizeAnnouncementLink(value: string): string | null {
  const href = value.trim();
  if (!href || /[\u0000-\u001f\u007f\\]/.test(href)) return null;
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  if (href.startsWith("#") || href.startsWith("?")) return href;
  if (/^(mailto:|tel:)/i.test(href)) return href;

  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(href);
  const address = href.startsWith("//") ? `https:${href}` : hasScheme ? href : `https://${href}`;
  try {
    const url = new URL(address);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname || url.username || url.password) return null;
    if (!hasScheme && !url.hostname.includes(".")) return null;
    return url.href;
  } catch {
    return null;
  }
}
