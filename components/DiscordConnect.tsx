import Link from 'next/link';
export default function DiscordConnect({ signedIn = false, linked = false, commandsReady = false }: { signedIn?: boolean; linked?: boolean; commandsReady?: boolean }) {
  return <div className="mt-5 rounded-xl border border-forest/15 p-4 text-sm">
    {linked && <p className="font-medium text-forest">Discord already linked</p>}
    <Link href="/auth/discord?next=/operations" prefetch={false} className="inline-flex min-h-11 items-center font-medium text-forest underline underline-offset-4">{linked ? 'Check Discord connection' : signedIn ? 'Connect Discord' : 'Continue with Discord'}</Link>
    <p className="mt-1 text-graphite/75">{linked ? commandsReady ? 'Your officer account is connected. You can use /score and your other Discord commands.' : 'Discord is linked to your login. Check the connection to finish syncing your officer access.' : signedIn ? 'Link Discord to use commands, submit work, and view your scores.' : 'Officers: use your existing GEA One account to connect Discord if your Discord email differs from your school email.'}</p>
  </div>;
}
