/**
 * Smoke test: runs the real fetch + model pipeline against a live repo
 * using plain fetch and a token from GH_TOKEN. Checks structural invariants
 * that must hold for any wayfinder repo, and prints tallies, layers, and the
 * frontier for eyeballing.
 *
 * Usage: GH_TOKEN=$(gh auth token) SMOKE_REPO=owner/name npm run smoke
 */
import { GitHubClient, fetchSnapshot, type Http } from "../src/github";
import type { RepoConfig } from "../src/config";
import { buildModel, type Snapshot } from "../src/model";

const token = process.env.GH_TOKEN;
const repo = process.env.SMOKE_REPO;
if (!token || !repo?.includes("/")) {
  console.error("Set GH_TOKEN and SMOKE_REPO=owner/name");
  process.exit(1);
}

const http: Http = async (url, headers) => {
  const res = await fetch(url, { headers });
  const responseHeaders: Record<string, string> = {};
  res.headers.forEach((value, key) => {
    responseHeaders[key.toLowerCase()] = value;
  });
  return {
    status: res.status,
    headers: responseHeaders,
    json: await res.json().catch(() => null),
  };
};

const config: RepoConfig = { token, repo };
const gh = new GitHubClient(() => config, http);

const t0 = Date.now();
const snapshot = await fetchSnapshot(gh, null, true);
const snapshots: Record<string, Snapshot> = { [config.repo]: snapshot };
console.log(`fetched ${snapshot.issues.length} issues in ${Date.now() - t0}ms`);

const model = buildModel(snapshots[config.repo]);

let failures = 0;
function check(name: string, ok: boolean): void {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failures++;
}

console.log("\n— tallies —");
for (const { type, tally } of model.tallies) {
  console.log(`  ${type}: ${tally.open}/${tally.total}`);
}
console.log(`  total: ${model.totalOpen}/${model.totalIssues}\n`);

check("fetched at least one issue", snapshot.issues.length > 0);
check("has at least one map", model.maps.length >= 1);

const allTickets = model.maps.flatMap((m) => m.tickets).concat(model.orphans);
check(
  "every frontier ticket is open, unassigned, unblocked, and verified",
  allTickets
    .filter((t) => t.frontier)
    .every(
      (t) =>
        t.issue.state === "open" &&
        t.issue.assignees.length === 0 &&
        t.openBlockers.length === 0 &&
        !t.unverified,
    ),
);
check(
  "every same-repo open blocker that is in the snapshot is actually open",
  allTickets.every((t) =>
    t.openBlockers.every((b) => {
      if (b.repo) return true;
      const issue = snapshot.issues.find((i) => i.number === b.number);
      return !issue || issue.state === "open";
    }),
  ),
);
check(
  "layering: no ticket sits above one of its in-map blockers",
  model.maps.every((m) => {
    const layerOf = new Map(m.tickets.map((t) => [t.issue.number, t.layer]));
    return m.tickets.every((t) =>
      t.blockedBy.every((b) => (layerOf.get(b) ?? -Infinity) <= t.layer),
    );
  }),
);
check(
  "tallies add up to the wayfinder-labeled issue count",
  model.tallies.reduce((sum, { tally }) => sum + tally.total, 0) ===
    model.maps.length + allTickets.length,
);

const showcase = model.maps.find((m) => m.issue.state === "open" && m.total > 0) ?? model.maps[0];
if (showcase) {
  console.log(`\n— layers of "${showcase.issue.title}" (#${showcase.issue.number}) —`);
  showcase.layers.forEach((layer, i) =>
    console.log(
      `  L${i}: ${layer
        .map((t) => `#${t.issue.number}${t.frontier ? "*" : ""}${t.issue.state === "closed" ? "✓" : ""}`)
        .join("  ")}`,
    ),
  );
}
console.log("\n— frontier across all maps —");
for (const m of model.maps) {
  const f = m.tickets.filter((t) => t.frontier).map((t) => `#${t.issue.number} ${t.issue.title}`);
  if (f.length) console.log(`  ${m.issue.title}\n    ${f.join("\n    ")}`);
}

// Incremental sync: nothing changed, so zero dependency re-fetches.
let depCalls = 0;
const countingHttp: Http = async (url, headers) => {
  if (url.includes("/dependencies/")) depCalls++;
  return http(url, headers);
};
const gh2 = new GitHubClient(() => config, countingHttp);
await fetchSnapshot(gh2, snapshots[config.repo], false);
check(`incremental sync makes 0 dependency calls (made ${depCalls})`, depCalls === 0);

console.log(`\n${model.orphans.length} orphan(s)`);
for (const o of model.orphans) {
  console.log(`ORPHAN #${o.issue.number} [${o.issue.state}] parent=${o.parent} — ${o.issue.title}`);
  console.log(`  body head: ${JSON.stringify((o.issue.body ?? "").slice(0, 120))}`);
}

process.exit(failures ? 1 : 0);
