/** Upsert commands without deleting unrelated commands; respect Discord's limits. */
export async function registerDiscordCommands({ applicationId, guildId, botToken, commands, fetchImpl = fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), onRegistered = () => {} }) {
  const url = `https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`;
  for (const [index, command] of commands.entries()) {
    for (let attempt = 0; ; attempt++) {
      const response = await fetchImpl(url, { method: 'POST', headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(command) });
      if (response.status === 429) {
        if (attempt >= 5) throw new Error(`Command ${command.name}: Discord rate limit persisted. Retry registration later.`);
        const body = await response.json().catch(() => ({}));
        const seconds = Number(body.retry_after ?? response.headers.get('retry-after') ?? 1);
        await sleep(Number.isFinite(seconds) && seconds >= 0 ? Math.max(100, Math.ceil(seconds * 1000)) : 1000);
        continue;
      }
      if (!response.ok) throw new Error(`Command ${command.name}: Discord HTTP ${response.status}`);
      onRegistered(command.name);
      // A successful request can consume the last available slot too.
      const resetAfter = Number(response.headers.get('x-ratelimit-reset-after'));
      if (index < commands.length - 1 && response.headers.get('x-ratelimit-remaining') === '0' && Number.isFinite(resetAfter) && resetAfter > 0) await sleep(Math.ceil(resetAfter * 1000));
      break;
    }
  }
}
