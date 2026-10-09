// Prints the CHANGELOG.md section for a version: the release body.
//   node scripts/changelog-section.mjs <version>
// Exits 1 if the section is missing or empty. Used by
// .github/workflows/release.yml and ci.yml.
import { readFileSync } from 'node:fs';
import { changelogSection } from './changelog-section/section.mjs';

const version = process.argv[2];
if (!version) {
  console.error('Usage: node scripts/changelog-section.mjs <version>');
  process.exit(1);
}
const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
try {
  console.log(changelogSection(changelog, version));
} catch (error) {
  console.error(`CHANGELOG.md: ${error.message}`);
  process.exit(1);
}
