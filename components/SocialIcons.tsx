import type { SVGProps } from "react";

export type SocialLink = {
  label: string;
  href: string;
  icon: SocialIconKey;
};

export type SocialIconKey = "instagram" | "tiktok" | "facebook" | "youtube";

type IconProps = SVGProps<SVGSVGElement>;

function InstagramIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17" cy="7" r="1.15" fill="currentColor" />
    </svg>
  );
}

function TikTokIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M14 4.5c.7 1.9 2 3.3 4 3.7v3.1c-1.7-.1-3.1-.6-4.3-1.5v5.5c0 2.8-2.2 4.7-5 4.7-2.7 0-4.8-1.9-4.8-4.6 0-2.8 2.1-4.8 4.8-4.8.4 0 .8 0 1.2.1v3c-.4-.2-.8-.3-1.2-.3-1.1 0-1.9.8-1.9 1.9 0 1 .8 1.8 1.9 1.8 1.3 0 2.2-.9 2.2-2.6V4.5H14Z"
        fill="currentColor"
      />
      <path
        d="M13.8 4.5h2.1c.5 1.7 1.8 2.9 4 3.3v2.8c-1.8-.1-3.4-.7-4.6-1.6v4.5c0 3-2.3 5.2-5.4 5.2-3 0-5.3-2.1-5.3-5.2 0-3.1 2.3-5.4 5.4-5.4.3 0 .6 0 .9.1v2.2c-.3-.1-.6-.1-.9-.1-1.9 0-3.2 1.3-3.2 3.2 0 1.8 1.3 3 3.1 3 2 0 3.3-1.3 3.3-3.7V4.5Z"
        fill="currentColor"
        opacity=".24"
      />
    </svg>
  );
}

function FacebookIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M13.5 21V13.5h2.5l.4-2.9h-2.9V8.7c0-.8.2-1.4 1.5-1.4h1.6V4.8c-.7-.1-1.6-.2-2.6-.2-2.5 0-4.2 1.5-4.2 4.3v1.7H7v2.9h2.8V21h3.7Z"
        fill="currentColor"
      />
    </svg>
  );
}

function YouTubeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <rect x="3.5" y="6" width="17" height="12" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10.2 9.3 15.1 12l-4.9 2.7V9.3Z" fill="currentColor" />
    </svg>
  );
}

export function SocialIcon({ icon, className }: { icon: SocialIconKey; className?: string }) {
  const sharedProps = {
    className,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    "aria-hidden": true,
  };

  switch (icon) {
    case "instagram":
      return <InstagramIcon {...sharedProps} />;
    case "tiktok":
      return <TikTokIcon {...sharedProps} />;
    case "facebook":
      return <FacebookIcon {...sharedProps} />;
    case "youtube":
      return <YouTubeIcon {...sharedProps} />;
  }
}

export const socialLinks: SocialLink[] = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/lhsgEA",
    icon: "instagram",
  },
  {
    label: "TikTok",
    href: "https://www.tiktok.com/@lhsgreenengineering",
    icon: "tiktok",
  },
  {
    label: "Facebook",
    href: "https://www.facebook.com/profile.php?id=61586760381539",
    icon: "facebook",
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/@LivermoreGEA",
    icon: "youtube",
  },
];
