import { discordFetch, safeMessage } from '@/lib/discord';
import { officerChannelId, officerNotificationMessage } from './task-routing';
import { button, row } from './protocol';

export async function sendServiceNotification(payload: any) {
  if (payload.topic === 'service_review' || payload.topic === 'event_request' || payload.topic === 'workflow_review') {
    const channel = process.env.DISCORD_REVIEW_CHANNEL_ID;
    if (!channel) throw new Error('Configure the private reviewer channel for service verification.');
    const id = payload.topic === 'service_review' ? payload.log_id : payload.request_id;
    if (!/^\d{17,20}$/.test(channel) || !/^[0-9a-f-]{36}$/i.test(id || '')) throw new Error('Invalid review destination.');
    if (payload.topic === 'workflow_review' && !['help', 'cancellation'].includes(payload.request_kind)) throw new Error('Invalid task request type.');
    const control = payload.topic === 'service_review' ? button('Review service hours', `officer:reviewlog:${id}`)
      : payload.topic === 'event_request' ? button('View participation request', `officer:request:${id}`)
      : button('View task request', `officer:taskrequest:${payload.request_kind}:${id}`);
    await discordFetch(`channels/${channel}/messages`, safeMessage({ content: `${payload.title}\n${payload.description}`.slice(0, 1950), components: [row(control)] }));
    return;
  }
  if (payload.topic === 'event_assignment') {
    const channel = officerChannelId(payload.officer_position);
    if (!channel) throw new Error('Configure the officer channel for event assignments.');
    await discordFetch(`channels/${channel}/messages`, officerNotificationMessage(payload.officer_position, {
      title: payload.assigned ? 'Assigned to an event' : 'Event assignment removed',
      fields: [{ name: 'Officer', value: payload.officer_name }, { name: 'Event', value: payload.event_title }],
    }));
    return;
  }
  if (!['approved', 'pending', 'rejected'].includes(payload.status) || !Number.isInteger(payload.minutes) || payload.minutes < 1 || payload.minutes > 1440) throw new Error('Invalid service receipt.');
  const channel = officerChannelId(payload.officer_position);
  if (!channel) throw new Error('Configure a channel for this officer position to deliver verified service hours.');
  const verified = payload.status === 'approved';
  await discordFetch(`channels/${channel}/messages`, officerNotificationMessage(payload.officer_position, {
    title: verified ? 'Community service hours verified' : 'Service verification updated',
    description: verified ? 'A reviewer verified this service log in GEA One.' : 'This service log is no longer verified. Check your private service records for details.',
    color: verified ? 0x24734e : 0xb7791f,
    fields: [{ name: 'Officer', value: payload.officer_name }, { name: 'Event', value: payload.event_title },
      { name: 'Verified hours', value: verified ? `${(payload.minutes / 60).toFixed(2)} hours (${payload.minutes} minutes)` : '0 hours for this log' }],
  }));
}
