#!/usr/bin/env node
// bump-version.js — Semantic version bumper + changelog entry
// Usage: node scripts/bump-version.js <patch|minor|major> [description]
//
// Version definitions for Spiros:
//   PATCH (0.0.x) — Bug fixes, typos, minor CSS tweaks, small QoL improvements
//   MINOR (0.x.0) — New features, new buildings/troops, UI redesigns, new tabs
//   MAJOR (x.0.0) — Breaking changes, major architecture rewrites, data migrations

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BUMP_TYPE = process.argv[2];
if (!['patch', 'minor', 'major'].includes(BUMP_TYPE)) {
  console.error('Usage: node scripts/bump-version.js <patch|minor|major> [description]');
  console.error('  patch — Bug fixes, typos, minor tweaks');
  console.error('  minor — New features, UI changes, new content');
  console.error('  major — Breaking changes, data migrations, architecture rewrites');
  process.exit(1);
}

const description = process.argv.slice(3).join(' ') || null;

// Read package.json
const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
const oldVersion = pkg.version;

// Bump version
const parts = oldVersion.split('.').map(Number);
if (BUMP_TYPE === 'major') { parts[0]++; parts[1] = 0; parts[2] = 0; }
else if (BUMP_TYPE === 'minor') { parts[1]++; parts[2] = 0; }
else { parts[2]++; }
const newVersion = parts.join('.');

// Update package.json
pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// Append to CHANGELOG.md
const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
const date = new Date().toISOString().split('T')[0];
const entry = `\n## v${newVersion} — ${date}\n**${BUMP_TYPE.toUpperCase()}**${description ? ` — ${description}` : ''}\n`;

let changelog = '';
if (fs.existsSync(changelogPath)) {
  changelog = fs.readFileSync(changelogPath, 'utf-8');
}

if (!changelog.startsWith('# Spiros Changelog')) {
  changelog = '# Spiros Changelog\n\nAll notable changes to Spiros are documented here.\nFormat: [Semantic Versioning](https://semver.org/) — MAJOR.MINOR.PATCH\n' + changelog;
}

// Insert new entry after the header block
const headerEnd = changelog.indexOf('\n\n## ');
if (headerEnd >= 0) {
  changelog = changelog.slice(0, headerEnd) + '\n' + entry + changelog.slice(headerEnd + 1);
} else {
  changelog += entry;
}

fs.writeFileSync(changelogPath, changelog);

// Create git tag
try {
  execSync(`git tag v${newVersion}`, { cwd: path.join(__dirname, '..', '..') });
  console.log(`Bumped: v${oldVersion} -> v${newVersion} (${BUMP_TYPE})`);
  console.log(`Tag created: v${newVersion}`);
} catch (e) {
  console.log(`Bumped: v${oldVersion} -> v${newVersion} (${BUMP_TYPE})`);
  console.warn(`Warning: could not create git tag — ${e.message}`);
}
console.log(`Changelog updated: ${changelogPath}`);
if (description) console.log(`Note: ${description}`);
console.log(`\nNext: git add -A && git commit -m "v${newVersion}" && git push && git push --tags`);
