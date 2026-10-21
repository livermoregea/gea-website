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
  { name: 'mark-attendance', description: 'Record attendance (secretaries: meetings; reviewers: all events)', default_member_permissions: null, options: [option('event', 'Event UUID from GEA One or /events', 3), option('officer', 'Linked officer', 6), { ...option('status', 'Attendance status', 3), choices: [{name:'Present',value:'present'},{name:'Tardy',value:'late'},{name:'Unexcused',value:'unexcused'},{name:'Excused',value:'excused'}] }, option('notes', 'Reviewer notes', 3, false)] },
].map(command => ({ ...command, type: 1 }));
// Create/update only these commands. Preserve unrelated application commands.
for (const command of commands) {
  const response = await fetch(`https://discord.com/api/v10/applications/${process.env.DISCORD_APPLICATION_ID}/guilds/${process.env.DISCORD_GUILD_ID}/commands`, { method: 'POST', headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(command) });
  if (!response.ok) throw new Error(`Command ${command.name}: Discord HTTP ${response.status}`);
  console.log(`Registered /${command.name}`);
}
