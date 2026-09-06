"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf-8")
);

test("manifest_version is 3", () => {
  assert.equal(manifest.manifest_version, 3);
});

test("required top-level fields are present", () => {
  assert.equal(typeof manifest.name, "string");
  assert.equal(typeof manifest.version, "string");
});

test("background.service_worker is a string, not an array (a V2 holdover mistake)", () => {
  assert.equal(typeof manifest.background.service_worker, "string");
  assert.ok(!Array.isArray(manifest.background.service_worker));
});

test("uses 'action', not the V2-only 'browser_action' or 'page_action'", () => {
  assert.ok(manifest.action);
  assert.ok(!manifest.browser_action);
  assert.ok(!manifest.page_action);
});

test("host patterns live in host_permissions, not permissions", () => {
  const hostLikePattern = /:\/\//;
  for (const perm of manifest.permissions || []) {
    assert.ok(!hostLikePattern.test(perm), `"${perm}" looks like a host pattern but is in permissions, not host_permissions`);
  }
  assert.ok(Array.isArray(manifest.host_permissions));
  assert.ok(manifest.host_permissions.length > 0);
});

test("every file referenced by background.service_worker exists on disk", () => {
  const swPath = path.join(__dirname, "..", manifest.background.service_worker);
  assert.ok(fs.existsSync(swPath), `${swPath} does not exist`);
});

test("every file referenced by content_scripts exists on disk", () => {
  for (const entry of manifest.content_scripts) {
    for (const file of entry.js || []) {
      const filePath = path.join(__dirname, "..", file);
      assert.ok(fs.existsSync(filePath), `${filePath} does not exist`);
    }
  }
});

test("every icon referenced in manifest.icons and action.default_icon exists on disk", () => {
  const allIconPaths = [
    ...Object.values(manifest.icons || {}),
    ...Object.values(manifest.action?.default_icon || {}),
  ];
  assert.ok(allIconPaths.length > 0, "expected at least one icon reference");
  for (const iconPath of allIconPaths) {
    const fullPath = path.join(__dirname, "..", iconPath);
    assert.ok(fs.existsSync(fullPath), `${fullPath} does not exist`);
  }
});

test("action.default_popup file exists on disk", () => {
  const popupPath = path.join(__dirname, "..", manifest.action.default_popup);
  assert.ok(fs.existsSync(popupPath));
});

test("content_scripts does not needlessly inject site-detector.js (analysis happens in the background worker, not the page)", () => {
  for (const entry of manifest.content_scripts) {
    assert.ok(
      !entry.js.includes("site-detector.js"),
      "site-detector.js should only be loaded via importScripts in background.js, not injected into every page"
    );
  }
});

test("host_permissions and content_scripts.matches are both scoped to http/https, not the broader <all_urls>", () => {
  // A deliberate narrowing: <all_urls> also covers file://, ftp://, etc.,
  // which this extension has no use for and shouldn't ask for.
  const allPatterns = [
    ...manifest.host_permissions,
    ...manifest.content_scripts.flatMap((e) => e.matches),
  ];
  for (const pattern of allPatterns) {
    assert.ok(
      pattern.startsWith("http://") || pattern.startsWith("https://"),
      `${pattern} should be scoped to http/https`
    );
  }
});

test("does not request the separate 'tabs' permission, since host_permissions already covers tab.url visibility", () => {
  // Verified against Chrome's own docs: host_permissions covering a tab's
  // URL are sufficient for chrome.tabs.query() to return url/title/
  // favIconUrl for that tab, without also declaring "tabs" -- which would
  // trigger an extra, unnecessary permission warning at install time.
  assert.ok(!(manifest.permissions || []).includes("tabs"));
});
