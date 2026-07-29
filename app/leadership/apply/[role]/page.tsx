import { notFound } from "next/navigation";
import Link from "next/link";
import { getRole } from "@/lib/roles";
import ApplicationForm from "@/components/ApplicationForm";

export default async function ApplyPage({
  params,
}: {
  params: Promise<{ role: string }>;
}) {
  const { role: roleSlug } = await params;
  const role = getRole(roleSlug);

  if (!role || !role.open) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 md:py-20">
      <Link
        href="/leadership"
        className="inline-flex min-h-11 items-center font-mono text-xs uppercase tracking-[0.15em] text-forest/60 hover:text-forest"
      >
        ← Back to Leadership
      </Link>
      <p className="mt-6 font-mono text-xs uppercase tracking-[0.3em] text-gold">
        Leadership Application
      </p>
      <h1 className="mt-3 font-display text-2xl font-medium text-forest sm:text-3xl">{role.label}</h1>
      <p className="mt-4 text-sm leading-relaxed text-graphite/70 sm:text-base">
        Fill out the form below to apply. Applications are reviewed by the current GEA officer
        team on a rolling basis.
      </p>

      <div className="dim-divider my-10" />

      <ApplicationForm
        roleSlug={role.slug}
        roleLabel={role.label}
        requiresProof={Boolean("requiresProof" in role && role.requiresProof)}
      />
    </div>
  );
}
