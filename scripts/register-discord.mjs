import { registerDiscordCommands } from './discord-command-registration.mjs';
// Run with server environment loaded: node --env-file=.env.local scripts/register-discord.mjs
const required = ['DISCORD_APPLICATION_ID', 'DISCORD_GUILD_ID', 'DISCORD_BOT_TOKEN'];
for (const key of required) if (!process.env[key]) throw new Error(`Missing ${key}`);
const option = (name, description, type, required = true) => ({ name, description, type, required });
const admin = { default_member_permissions: '32' };
const commands = [
  { name: 'score', description: 'View your private PEET and CAGE scores' },
  { name: 'tasks', description: 'View your open tasks' },
  { name: 'events', description: 'View meetings and events' },
  { name: 'submit-task', description: 'Submit your work notes and project/document link' },
  { name: 'absence-notice', description: 'Give advance notice of absence or tardiness' },
  { name: 'assign-task', description: 'Create a task for an officer', ...admin, options: [option('officer', 'Linked officer to assign', 6), option('channel', 'Optional committee channel for notification', 7, false)] },
  { name: 'review-task', description: 'Review contributions and approve PEET scores', ...admin },
  { name: 'mark-attendance', description: 'Take roll: choose a meeting, mark the roster, and save', default_member_permissions: null, options: [] },
].map(command => ({ ...command, type: 1 }));
await registerDiscordCommands({
  applicationId: process.env.DISCORD_APPLICATION_ID,
  guildId: process.env.DISCORD_GUILD_ID,
  botToken: process.env.DISCORD_BOT_TOKEN,
  commands,
  onRegistered: name => console.log(`Registered /${name}`),
});
