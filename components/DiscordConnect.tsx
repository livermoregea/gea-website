import Link from 'next/link';
export default function DiscordConnect({ signedIn = false }: { signedIn?: boolean }) {
  return <div className="mt-5 rounded-xl border border-forest/15 p-4 text-sm">
    <Link href="/auth/discord?next=/operations" prefetch={false} className="inline-flex min-h-11 items-center font-medium text-forest underline underline-offset-4">{signedIn ? 'Connect Discord' : 'Continue with Discord'}</Link>
    <p className="mt-1 text-graphite/75">{signedIn ? 'Link Discord to use commands, submit work, and view your scores.' : 'Officers: use your existing GEA One account to connect Discord if your Discord email differs from your school email.'}</p>
  </div>;
}
