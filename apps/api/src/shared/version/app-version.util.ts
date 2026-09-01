/**
 * One implementation of app version parsing, shared by the public force-update
 * check and the admin write path that configures it.
 *
 * Both sides have to agree exactly: if the admin panel accepts a value the
 * checker reads differently, the mismatch shows up as customers being locked
 * out of an app that is actually up to date.
 */

/** `major.minor.patch` with an optional `+build`, e.g. `1.0.8+21`. */
export const APP_VERSION_PATTERN = /^\d+\.\d+\.\d+(\+\d+)?$/;

/**
 * Orders two Flutter-style version strings.
 *
 * Returns a negative number when [a] is older than [b], 0 when they are the
 * same release, positive when [a] is newer.
 *
 * The build number is the tiebreaker and only the tiebreaker: Play Store
 * `versionCode` rises on every upload, so `1.0.8+21` and `1.0.8+22` are the
 * same release but different builds, and the newer build must win.
 */
export function compareAppVersions(a: string, b: string): number {
  const parse = (raw: string) => {
    const [name, build] = String(raw ?? '').trim().split('+');
    const parts = String(name ?? '')
      .split('.')
      .map((p) => Number.parseInt(p, 10));
    return {
      // A missing or non-numeric segment reads as 0 rather than NaN — NaN
      // comparisons are all false, which would silently order versions wrongly.
      parts: [0, 1, 2].map((i) => (Number.isFinite(parts[i]) ? parts[i] : 0)),
      build: Number.isFinite(Number.parseInt(build, 10)) ? Number.parseInt(build, 10) : 0,
    };
  };

  const left = parse(a);
  const right = parse(b);

  for (let i = 0; i < 3; i++) {
    if (left.parts[i] !== right.parts[i]) {
      return left.parts[i] > right.parts[i] ? 1 : -1;
    }
  }

  if (left.build !== right.build) return left.build > right.build ? 1 : -1;
  return 0;
}
