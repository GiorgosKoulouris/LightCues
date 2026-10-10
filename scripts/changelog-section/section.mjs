// Finds one version's section in a Keep a Changelog file. The section runs
// from its `## [X.Y.Z]` heading to the next `## [` heading or the end.

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Returns the section body without its heading, trimmed. Throws when the
// section is missing, or has nothing but blank lines and subheadings.
export function changelogSection(changelog, version) {
  const lines = changelog.split(/\r?\n/);
  const heading = new RegExp(`^## \\[${escapeRegExp(version)}\\](\\s|$)`);
  const start = lines.findIndex((line) => heading.test(line));
  if (start === -1) {
    throw new Error(`No section for ${version}.`);
  }
  let end = lines.findIndex((line, i) => i > start && line.startsWith('## ['));
  if (end === -1) end = lines.length;
  const body = lines.slice(start + 1, end);
  if (!body.some((line) => line.trim() !== '' && !line.startsWith('#'))) {
    throw new Error(`The section for ${version} is empty.`);
  }
  return body.join('\n').trim();
}
