/** Server-only Discord transport. Never import into client components. */
export type DiscordEmbed = { title: string; description?: string; color?: number; fields?: { name: string; value: string; inline?: boolean }[]; url?: string };
export type DiscordMessage = { content?: string; embeds?: DiscordEmbed[]; components?: unknown[]; flags?: number };
export type DiscordTopic = 'tasks' | 'attendance' | 'announcements';
const webhookKeys = { tasks: 'DISCORD_WEBHOOK_TASKS', attendance: 'DISCORD_WEBHOOK_ATTENDANCE', announcements: 'DISCORD_WEBHOOK_ANNOUNCEMENTS' } as const;
export async function discordFetch(path: string, body: unknown, method = 'POST', bot = true) {
  if (bot && !process.env.DISCORD_BOT_TOKEN) throw new Error('Discord bot is not configured.');
  const response = await fetch(`https://discord.com/api/v10/${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(bot ? { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } : {}) },
    body: JSON.stringify(body), signal: AbortSignal.timeout(10000), cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Discord delivery failed (${response.status}).`);
  return response.status === 204 ? null : response.json();
}
export function safeMessage(message: DiscordMessage) {
  return { ...message, allowed_mentions: { parse: [] }, embeds: message.embeds?.map(embed => ({
    ...embed, title: embed.title.slice(0, 256), description: embed.description?.slice(0, 4000),
    fields: embed.fields?.slice(0, 5).map(field => ({ ...field, name: field.name.slice(0, 256), value: field.value.slice(0, 300) })),
  })) };
}
export async function sendDiscordEmbed(topic: DiscordTopic, embed: DiscordEmbed) {
  const value = process.env[webhookKeys[topic]];
  if (!value) return; // Channels are individually optional.
  const url = new URL(value);
  if (!['discord.com', 'canary.discord.com', 'ptb.discord.com'].includes(url.hostname) || url.protocol !== 'https:' || !/^\/api(?:\/v\d+)?\/webhooks\/\d+\/[\w-]+$/.test(url.pathname)) throw new Error('Invalid Discord webhook configuration.');
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(safeMessage({ embeds: [{ color: 0x24734e, ...embed }] })), signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Discord webhook failed (${response.status}).`);
}
export async function discordDM(userId: string, message: DiscordMessage) {
  const channel = await discordFetch('users/@me/channels', { recipient_id: userId });
  await discordFetch(`channels/${channel.id}/messages`, safeMessage(message));
}
export async function discordReply(token: string, message: DiscordMessage) {
  await discordFetch(`webhooks/${process.env.DISCORD_APPLICATION_ID}/${token}/messages/@original`, safeMessage(message), 'PATCH', false);
}
