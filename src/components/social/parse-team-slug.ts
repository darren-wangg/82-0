/** Pure helper: extract a team slug from a raw slug, /t/ path, or full link. */

export function parseTeamSlug(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/t\/([^/?#\s]+)/i);
  return (match ? match[1] : trimmed).replace(/^\/+|\/+$/g, "");
}
