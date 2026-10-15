/** Shared vector identity for GEA's unified account experience. */
export default function GEAOneBadge({
  size = "default",
  inverse = false,
}: {
  size?: "compact" | "default" | "hero";
  inverse?: boolean;
}) {
  return (
    <span className={`gea-one-badge gea-one-badge--${size}${inverse ? " gea-one-badge--inverse" : ""}`}>
      <svg className="gea-one-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <rect x="1" y="1" width="38" height="38" rx="12" stroke="currentColor" strokeOpacity=".45" />
        <path d="M13 15L21 10V29M15 29H27" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M28 10V16M25 13H31" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span className="gea-one-wordmark"><span>GEA</span>{" "}<span className="gea-one-signature">One</span></span>
    </span>
  );
}
