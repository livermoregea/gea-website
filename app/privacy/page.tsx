import Link from "next/link";

export const metadata = {
  title: "Student Data Privacy | GEA",
  description: "How the Green Engineering Academy handles student information, security, and privacy.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 md:py-20">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">Student Privacy</p>
      <h1 className="mt-4 font-display text-3xl font-medium text-forest sm:text-4xl">
        Student Data Privacy
      </h1>
      <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-graphite/45">
        Effective August 26, 2026
      </p>
      <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-graphite/45">
        Last updated August 27, 2026
      </p>
      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-graphite/75 sm:text-base">
        This notice explains how the Green Engineering Academy handles student information on this
        website and during the leadership application process.
      </p>

      <div className="mt-8 rounded-sm bg-forest/[0.04] p-5 ring-1 ring-forest/10">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">
          Summary
        </p>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-graphite/75">
          <p>We do not sell student information.</p>
          <p>
            We do not use advertising cookies, tracking pixels, or website analytics tools on the
            public GEA website.
          </p>
          <p>
            We only collect the information needed to operate the website, manage applications,
            and contact students about leadership opportunities.
          </p>
        </div>
      </div>

      <section className="mt-8 space-y-6">
        <div className="rounded-sm bg-paper p-5 ring-1 ring-forest/10">
          <h2 className="font-display text-xl text-forest">Information we collect</h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-graphite/75">
            <p>Depending on how you use the site, we may collect:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Student name and contact information</li>
              <li>School email address</li>
              <li>Graduating class year</li>
              <li>Student ID number</li>
              <li>Leadership application answers and supporting information</li>
              <li>Leadership seat updates, officer notes, and other school program records</li>
            </ul>
          </div>
        </div>

        <div className="rounded-sm bg-paper p-5 ring-1 ring-forest/10">
          <h2 className="font-display text-xl text-forest">How we use information</h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-graphite/75">
            <p>We use this information to:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Review leadership applications</li>
              <li>Contact students about interviews and application updates</li>
              <li>Maintain student and officer records for the GEA program</li>
              <li>Help run the student Q&A forum</li>
              <li>Manage leadership photos and role information on the public site</li>
            </ul>
          </div>
        </div>

        <div className="rounded-sm bg-paper p-5 ring-1 ring-forest/10">
          <h2 className="font-display text-xl text-forest">Cookies and tracking</h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-graphite/75">
            <p>
              We do not use advertising cookies or website analytics tools to track visitors or
              collect statistics from the public site.
            </p>
            <p>
              If you sign in, the site may use essential session cookies so your login stays
              active. Those cookies are only used for sign-in and site functionality.
            </p>
          </div>
        </div>

        <div className="rounded-sm bg-paper p-5 ring-1 ring-forest/10">
          <h2 className="font-display text-xl text-forest">Security</h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-graphite/75">
            <p>
              Sensitive information is stored in a secure database and protected by our app and
              hosting providers.
            </p>
            <p>
              Passwords are not stored in plain text by the website. Authentication is handled by
              the sign-in system, and data is transmitted securely over encrypted connections.
            </p>
            <p>
              We also limit who can access staff-only records and administrative tools.
            </p>
          </div>
        </div>

        <div className="rounded-sm bg-paper p-5 ring-1 ring-forest/10">
          <h2 className="font-display text-xl text-forest">Sharing and selling</h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-graphite/75">
            <p>We do not sell student information.</p>
            <p>
              We do not use student data for advertising. Information is only shared when needed to
              operate the site, manage the program, or communicate with students and staff about
              GEA activities.
            </p>
          </div>
        </div>

        <div className="rounded-sm bg-paper p-5 ring-1 ring-forest/10">
          <h2 className="font-display text-xl text-forest">Access, correction, and updates</h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-graphite/75">
            <p>
              If a student or parent needs help reviewing, correcting, or deleting information, they
              can contact the GEA staff team using the information below.
            </p>
            <p>
              We may update this page if the website changes or if our privacy practices change.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-sm bg-forest/[0.04] p-5 ring-1 ring-forest/10">
        <h2 className="font-display text-xl text-forest">Contact</h2>
        <p className="mt-3 text-sm leading-relaxed text-graphite/75">
          For privacy questions, please email{" "}
          <a
            href="mailto:livermoregea@gmail.com"
            className="text-forest underline decoration-gold underline-offset-4"
          >
            livermoregea@gmail.com
          </a>
          .
        </p>
      </section>
    </div>
  );
}
