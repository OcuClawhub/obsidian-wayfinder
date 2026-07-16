import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SETTINGS, isValidRepoConfig, sanitizeSettings } from "../src/config";

test("sanitizeSettings migrates a legacy token and repo into one entry", () => {
  assert.deepEqual(sanitizeSettings({ token: " secret ", repo: " owner/repo " }).repos, [
    { token: "secret", repo: "owner/repo" },
  ]);
});

test("sanitizeSettings trims new-shape repository entries", () => {
  assert.deepEqual(
    sanitizeSettings({
      repos: [
        { repo: " owner/one ", token: " first " },
        { repo: "owner/two", token: " second" },
      ],
    }).repos,
    [
      { repo: "owner/one", token: "first" },
      { repo: "owner/two", token: "second" },
    ],
  );
});

test("sanitizeSettings drops junk and wholly empty repository entries", () => {
  assert.deepEqual(
    sanitizeSettings({
      repos: [
        null,
        "owner/repo",
        { repo: "owner/repo" },
        { repo: 42, token: "secret" },
        { repo: " ", token: " " },
        { repo: "owner/kept", token: "" },
      ],
    }).repos,
    [{ repo: "owner/kept", token: "" }],
  );
});

test("sanitizeSettings still clamps poll intervals and preserves copy templates", () => {
  assert.equal(sanitizeSettings({ pollIntervalMinutes: 0 }).pollIntervalMinutes, 0.5);
  assert.equal(sanitizeSettings({ pollIntervalMinutes: 999 }).pollIntervalMinutes, 120);
  assert.equal(sanitizeSettings({ copyTemplate: "take {url}" }).copyTemplate, "take {url}");
});

test("sanitizeSettings returns defaults for empty input", () => {
  assert.deepEqual(sanitizeSettings(undefined), DEFAULT_SETTINGS);
});

test("isValidRepoConfig requires a token and owner/name repository", () => {
  assert.equal(isValidRepoConfig({ repo: "owner/repo", token: "secret" }), true);
  assert.equal(isValidRepoConfig({ repo: "owner", token: "secret" }), false);
  assert.equal(isValidRepoConfig({ repo: "owner/repo", token: "" }), false);
});
