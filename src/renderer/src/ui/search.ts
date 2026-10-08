// Whether `text` contains every word of `query`, ignoring case. An empty
// query matches everything.
export function matchesQuery(text: string, query: string): boolean {
  const lower = text.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => lower.includes(word));
}
