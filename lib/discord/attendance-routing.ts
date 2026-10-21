import { discordFetch } from '@/lib/discord';
import { officerChannelId, officerNotificationMessage } from './task-routing';

const labels = { present: 'Present', late: 'Tardy', excused: 'Excused', unexcused: 'Unexcused', unmarked: 'Not recorded' } as const;
export type AttendanceNotification = { officer_name: string; officer_position: string; event_title: string; status: keyof typeof labels };
export async function sendAttendanceNotification(notification: AttendanceNotification) {
  if (!Object.hasOwn(labels, notification.status)) throw new Error('Invalid attendance status.');
  const channel = officerChannelId(notification.officer_position);
  if (!channel) throw new Error('Configure a channel for this officer position to deliver attendance.');
  const cleared = notification.status === 'unmarked';
  await discordFetch(`channels/${channel}/messages`, officerNotificationMessage(notification.officer_position, {
    title: cleared ? 'Attendance record cleared' : 'Attendance recorded',
    description: cleared ? 'The previous attendance mark was cleared. Attendance is not recorded for this event yet.' : 'Attendance was saved in GEA One.',
    color: cleared ? 0xb7791f : 0x24734e,
    fields: [{ name: 'Officer', value: notification.officer_name }, { name: 'Meeting / event', value: notification.event_title }, { name: 'Status', value: labels[notification.status] }],
  }));
}
