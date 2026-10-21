import { discordFetch, safeMessage, sendDiscordEmbed, type DiscordEmbed } from '@/lib/discord';

/** Match GEA roster positions and their common abbreviations. */
function officerPositionKey(position: string | null | undefined): string | undefined {
  const normalized = (position || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  let key: string | undefined;
  if (/^(vp|vice president)\b/.test(normalized)) key = 'VICE_PRESIDENT';
  else if (/^(co )?secretary$/.test(normalized)) key = 'SECRETARY';
  else if (/^(co )?publicist$/.test(normalized)) key = 'PUBLICIST';
  else if (/^(co )?treasurer$/.test(normalized)) key = 'TREASURER';
  else if (/^(president|pres)$/.test(normalized)) key = 'PRESIDENT';
  else if (/\b(rep|reps|representative|representatives)\b/.test(normalized)) {
    if (/\b(9|9th|freshman|freshmen)\b/.test(normalized)) key = 'REP_9';
    else if (/\b(10|10th|sophomore|sophomores)\b/.test(normalized)) key = 'REP_10';
    else key = 'REPS';
  }
  return key;
}
function officerDestinationId(position: string | null | undefined, prefix: 'CHANNEL' | 'ROLE') {
  const key = officerPositionKey(position);
  const id = key && (process.env[`DISCORD_${prefix}_${key}`] || (key.startsWith('REP_') ? process.env[`DISCORD_${prefix}_REPS`] : undefined));
  if (!id) return undefined;
  if (!/^\d{17,20}$/.test(id)) throw new Error(`Invalid DISCORD_${prefix}_${key} ID.`);
  return id;
}
export function officerChannelId(position: string | null | undefined) {
  return officerDestinationId(position, 'CHANNEL');
}
export function officerRoleId(position: string | null | undefined) {
  return officerDestinationId(position, 'ROLE');
}
export function officerNotificationMessage(position: string | null | undefined, embed: DiscordEmbed) {
  const role = officerRoleId(position);
  return { ...safeMessage({ content: role ? `<@&${role}>` : undefined, embeds: [embed] }),
    allowed_mentions: { parse: [], roles: role ? [role] : [], users: [] },
  };
}

export type TaskNotification = {
  title: string; description?: string | null; task_id?: string;
  assignee_name?: string | null; assignee_position?: string | null;
  channel_id?: string | null;
};
export async function sendTaskNotification(notification: TaskNotification) {
  const channel = notification.channel_id || officerChannelId(notification.assignee_position);
  if (channel && !/^\d{17,20}$/.test(channel)) throw new Error('Invalid task channel ID.');
  const embed: DiscordEmbed = {
    title: notification.title, description: notification.description || 'Open GEA One for the full record.', color: 0x24734e,
    fields: [
      ...(notification.assignee_name ? [{ name: 'Assigned to', value: notification.assignee_name }] : []),
      ...(notification.assignee_position ? [{ name: 'Officer position', value: notification.assignee_position }] : []),
      ...(notification.task_id ? [{ name: 'Task ID', value: notification.task_id }] : []),
    ],
  };
  if (channel) await discordFetch(`channels/${channel}/messages`, officerNotificationMessage(notification.assignee_position, embed));
  else await sendDiscordEmbed('tasks', embed);
}
