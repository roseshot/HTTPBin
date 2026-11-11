import { execFileSync } from "node:child_process";

interface VersionSources {
  tag?: string | undefined;
  sha?: string | undefined;
  describe?: (() => string) | undefined;
}

/**
 * Use the exact tag when HEAD is tagged. For later commits, Git describe
 * includes both the ancestor tag and the commit distance; without tags,
 * it uses a short commit SHA instead of claiming an older release.
 */
export function resolveBuildVersion({ tag, sha, describe }: VersionSources): string {
  const explicitTag = tag?.trim();
  if (explicitTag) return explicitTag;

  try {
    const ref = describe?.().trim();
    if (ref) return ref;
  } catch {
    // Cloud builds without a .git directory can still provide a commit SHA.
  }

  return sha?.trim().slice(0, 7) || "dev";
}

export function getBuildVersion(): string {
  return resolveBuildVersion({
    tag: process.env.HTTPBIN_GIT_TAG,
    sha: process.env.GITHUB_SHA ?? process.env.CF_PAGES_COMMIT_SHA,
    describe: () => execFileSync("git", ["describe", "--tags", "--always", "--dirty", "--abbrev=7"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }),
  });
}
