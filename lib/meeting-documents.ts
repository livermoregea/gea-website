/** Only Google Docs documents; reject other hosts, credentials, and script links. */
export function googleDocLink(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const input = value.trim();
  if (input.length > 2048 || !/^https:\/\//i.test(input) || /[\s\\]/.test(input)) return null;
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com' || url.port || url.username || url.password) return null;
    if (!/^\/document\/(?:u\/\d+\/)?d\/(?:e\/)?[A-Za-z0-9_-]+(?:\/(?:edit|view|preview|pub|mobilebasic))?\/?$/.test(url.pathname)) return null;
    return url.href;
  } catch { return null; }
}
