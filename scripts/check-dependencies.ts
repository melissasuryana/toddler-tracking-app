import { execFileSync } from "node:child_process";
import { posix } from "node:path";
import { pathToFileURL } from "node:url";

type Manifest = {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};
type LockedPackage = Manifest & {
  version?: string;
  integrity?: string;
  link?: boolean;
  resolved?: string;
};
type Lock = { packages: Record<string, LockedPackage> };
export type Candidate = {
  name: string;
  version: string;
  integrity: string;
  manifest: string;
};
const sections = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
] as const;

function locked(lock: Lock, directory: string, name: string) {
  for (let dir = directory; ; dir = posix.dirname(dir)) {
    const entry = lock.packages[posix.join(dir, "node_modules", name)];
    if (entry) return entry;
    if (!dir || dir === ".") return undefined;
  }
}

export function candidates(
  path: string,
  before: Manifest,
  after: Manifest,
  oldLock: Lock,
  newLock: Lock
): Candidate[] {
  const directory = posix.dirname(path) === "." ? "" : posix.dirname(path);
  const result = new Map<string, Candidate>();
  for (const section of sections) {
    for (const [name, spec] of Object.entries(after[section] ?? {})) {
      const entry = locked(newLock, directory, name);
      const previous = locked(oldLock, directory, name);
      if (
        before[section]?.[name] === spec &&
        previous?.version === entry?.version &&
        previous?.resolved === entry?.resolved &&
        previous?.integrity === entry?.integrity
      )
        continue;
      if (entry?.link) {
        const target = newLock.packages[entry.resolved ?? ""];
        if (target?.name === name) continue;
        throw new Error(`${path}: ${name} has an invalid workspace link`);
      }
      if (
        spec.startsWith("npm:")
          ? !/^npm:(?:@[^/@]+\/)?[^/@]+(?:@[^/:\\]+)?$/.test(spec)
          : /[:/\\]/.test(spec)
      )
        throw new Error(`${path}: ${name} must use a published npm dependency`);
      if (newLock.packages[directory]?.[section]?.[name] !== spec)
        throw new Error(
          `${path}: stage an up-to-date package-lock.json for ${name}`
        );
      if (!entry?.version || !entry.integrity)
        throw new Error(
          `${path}: ${name} needs a registry version and integrity in the staged lockfile`
        );
      const registryName = spec.startsWith("npm:")
        ? spec.slice(4).replace(/@[^@/]+$/, "")
        : name;
      result.set(name, {
        name: registryName,
        version: entry.version,
        integrity: entry.integrity,
        manifest: path,
      });
    }
  }
  return [...result.values()];
}

type JsonRequest = (url: string, init?: RequestInit) => Promise<any>;
const request: JsonRequest = async (url, init) => {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error(`HTTP ${response.status} from ${new URL(url).host}`);
  return response.json();
};

export async function checkHealth(
  candidate: Candidate,
  get: JsonRequest = request,
  now = Date.now()
): Promise<void> {
  const { name, version } = candidate;
  const encoded = encodeURIComponent(name);
  const metadata = await get(`https://registry.npmjs.org/${encoded}`);
  const published = metadata.versions?.[version];
  if (metadata.name !== name || !published)
    throw new Error(`${name}@${version} is not published on npm`);
  if (published.dist?.integrity !== candidate.integrity)
    throw new Error(`${name}@${version} lockfile integrity does not match npm`);
  if (published.deprecated) throw new Error(`${name}@${version} is deprecated`);
  const latest = metadata["dist-tags"]?.latest;
  if (
    !latest ||
    !metadata.versions?.[latest] ||
    metadata.versions[latest].deprecated
  )
    throw new Error(`${name} has no supported latest release`);
  const released = Date.parse(metadata.time?.[latest]);
  const age = now - released;
  if (!Number.isFinite(released) || age < 0 || age > 365 * 86400000)
    throw new Error(`${name} has no latest release within 365 days`);
  const downloads = await get(
    `https://api.npmjs.org/downloads/point/last-month/${encoded}`
  );
  if (
    downloads.package !== name ||
    !Number.isFinite(downloads.downloads) ||
    downloads.downloads < 100
  )
    throw new Error(
      `${name} has fewer than 100 downloads in the last month or missing download data`
    );
  const advisories = await get("https://api.osv.dev/v1/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ package: { ecosystem: "npm", name }, version }),
  });
  if (
    !advisories ||
    typeof advisories !== "object" ||
    (advisories.vulns !== undefined && !Array.isArray(advisories.vulns))
  )
    throw new Error(`${name}: invalid vulnerability response`);
  const active = (advisories.vulns ?? []).filter(
    (v: { withdrawn?: string }) => !v.withdrawn
  );
  if (active.length)
    throw new Error(
      `${name}@${version} has known vulnerabilities: ${active.map((v: { id: string }) => v.id).join(", ")}`
    );
}

function git(...args: string[]): string {
  return execFileSync("git", args, {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export function stagedCandidates(): Candidate[] {
  const changed = git(
    "diff",
    "--cached",
    "--name-only",
    "--diff-filter=ACMR",
    "-z"
  )
    .split("\0")
    .filter(Boolean);
  const manifestPattern =
    /^(?:package\.json|app\/package\.json|packages\/[^/]+\/package\.json)$/;
  if (
    !changed.some(
      (path) => manifestPattern.test(path) || path === "package-lock.json"
    )
  )
    return [];
  const headExists = (() => {
    try {
      git("rev-parse", "--verify", "HEAD");
      return true;
    } catch {
      return false;
    }
  })();
  const oldPaths = new Set(
    headExists
      ? git("ls-tree", "-r", "--name-only", "-z", "HEAD").split("\0")
      : []
  );
  const readOld = (path: string) =>
    oldPaths.has(path) ? JSON.parse(git("show", `HEAD:${path}`)) : {};
  const oldLock = readOld("package-lock.json");
  const newLock = JSON.parse(git("show", ":package-lock.json"));
  const paths = git("ls-files", "-z")
    .split("\0")
    .filter((path) => manifestPattern.test(path));
  const checks = new Map<string, Candidate>();
  for (const path of paths) {
    const after = JSON.parse(git("show", `:${path}`));
    for (const candidate of candidates(
      path,
      readOld(path),
      after,
      { packages: {}, ...oldLock },
      newLock
    ))
      checks.set(
        `${candidate.name}@${candidate.version}:${candidate.integrity}`,
        candidate
      );
  }
  return [...checks.values()];
}

export async function main() {
  let failed = false;
  const checks = stagedCandidates();
  for (const candidate of checks) {
    try {
      await checkHealth(candidate);
      console.log(
        `dependency-health: ${candidate.name}@${candidate.version} passed`
      );
    } catch (error) {
      failed = true;
      console.error(
        `dependency-health: ${candidate.manifest}: ${(error as Error).message}`
      );
    }
  }
  if (failed)
    throw new Error(
      "Dependency health checks failed; see README.md#dependency-health."
    );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: Error) => {
    console.error(`dependency-health: ${error.message}`);
    process.exitCode = 1;
  });
}
