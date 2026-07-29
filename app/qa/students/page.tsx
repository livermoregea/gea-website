import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LoginForm from "@/components/LoginForm";
import AskQuestionForm from "@/components/AskQuestionForm";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export const revalidate = 0;

export default async function StudentQuestionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!hasSupabaseConfig()) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 md:py-20">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">Student Questions</p>
        <h1 className="mt-4 font-display text-2xl font-medium text-forest sm:text-3xl">
          Student login is unavailable in demo mode
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-graphite/70 sm:text-base">
          Supabase is not configured, so this private student question area is unavailable right now.
          You can still use the public Q&A page for general questions.
        </p>
        <div className="dim-divider my-10" />
        <Link
          href="/qa"
          className="inline-flex min-h-11 items-center rounded-sm bg-forest px-5 py-3 font-mono text-xs uppercase tracking-[0.15em] text-gold"
        >
          Go to Public Q&A
        </Link>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 sm:px-6 md:py-20">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">GEA Students</p>
        <h1 className="mt-4 font-display text-2xl font-medium text-forest sm:text-3xl">
          Sign in to ask a deeper question
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-graphite/70 sm:text-base">
          Log in with your GEA account to ask more detailed questions about projects, classes,
          academics, or anything related to the academy or school.
        </p>
        <div className="dim-divider my-10" />
        <LoginForm redirectTo="/qa/students" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 md:py-20">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">GEA Students</p>
      <h1 className="mt-4 font-display text-2xl font-medium text-forest sm:text-3xl">
        Ask a deeper question
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-graphite/70 sm:text-base">
        Use this space for more detailed questions about projects, classes, college prep, the
        academy, or anything else related to GEA and school life.
      </p>

      <div className="dim-divider my-10" />

      <AskQuestionForm />
    </div>
  );
}
