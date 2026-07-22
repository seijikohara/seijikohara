/** Profile-specific configuration: identity, links, card geometry. */

export const LOGIN =
  process.env["GITHUB_LOGIN"] ??
  process.env["GITHUB_REPOSITORY_OWNER"] ??
  "seijikohara";

/** README column width measured on github.com profile pages (2026-07-22). */
export const CARD_WIDTH = 846;
export const CARD_PADDING = 24;
export const CARD_RADIUS = 6;

export interface BadgeSpec {
  /** File name stem under assets/badges/. */
  readonly id: string;
  readonly label: string;
  readonly href: string;
  /**
   * simple-icons slug. Omitted for brands the package does not carry
   * (LinkedIn was removed for legal reasons; LAPRAS and Maven Central were
   * never included) — those render as text-only pills, never lookalike marks.
   */
  readonly icon?: string;
}

export const SOCIAL_BADGES: readonly BadgeSpec[] = [
  { id: "linkedin", label: "LinkedIn", href: "https://www.linkedin.com/in/seijikohara/" },
  { id: "facebook", label: "Facebook", href: "https://www.facebook.com/seiji.khr/", icon: "facebook" },
  { id: "findy", label: "Findy", href: "https://findy-code.io/skills-share/y0erzwXymYuaZ" },
  { id: "lapras", label: "LAPRAS", href: "https://lapras.com/public/seijikohara" },
  { id: "wantedly", label: "Wantedly", href: "https://www.wantedly.com/id/seiji_kohara", icon: "wantedly" },
  { id: "qiita", label: "Qiita", href: "https://qiita.com/seijikohara", icon: "qiita" },
  { id: "zenn", label: "Zenn", href: "https://zenn.dev/seijikohara", icon: "zenn" },
];

export const PACKAGE_BADGES: readonly BadgeSpec[] = [
  { id: "maven-central", label: "Maven Central", href: "https://central.sonatype.com/namespace/io.github.seijikohara" },
  { id: "npm", label: "npm", href: "https://www.npmjs.com/~seijikohara", icon: "npm" },
];
