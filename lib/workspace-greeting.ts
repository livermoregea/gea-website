/** Keep greetings consistent with GEA's school calendar and displayed times. */
export function workspaceGreeting(date = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', hour: 'numeric', hourCycle: 'h23',
  }).format(date));
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}
