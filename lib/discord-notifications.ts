/** Start delivery of queued notifications after a successful website save. */
export function dispatchDiscordNotifications() {
  // Keep the save committed even if delivery fails. Keepalive allows the
  // request to finish during the refresh/navigation that follows a save.
  void fetch('/api/discord/dispatch', { method: 'POST', credentials: 'same-origin', keepalive: true })
    .then(response => { if (!response.ok) console.warn('[Discord] Notification dispatch could not start; queued jobs are retained.'); })
    .catch(() => { console.warn('[Discord] Notification dispatch could not start; queued jobs are retained.'); });
}
