/**
 * Basic explicit-word filter for USER-SUBMITTED names (team names, lobby names,
 * standings display names). Deliberately small and hardcoded — a guard against
 * the obvious stuff, not a perfect moderation system. Applied server-side at the
 * save boundaries so it's authoritative.
 *
 * Note: this screens user INPUT only. The "Coach Buckets" AI voice (output) is
 * intentionally slangy and is unaffected.
 *
 * Matching strategy (kept simple):
 *  1. Lowercase, strip accents, and fold common leetspeak (0→o, 3→e, @→a, …).
 *  2. Flag if any whole word token is on the blocklist (avoids the Scunthorpe
 *     problem — "Bass"/"Shell"/"Cassidy" are fine).
 *  3. Also flag if the letters-only collapse of the string contains a severe
 *     slur, to catch separator/spacing obfuscation ("n-i-g…", "f u c k").
 */

const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "@": "a",
  $: "s",
  "!": "i",
  "|": "i",
};

/** Whole-word blocklist (matched against normalized word tokens). */
const BLOCKLIST = new Set<string>([
  "fuck",
  "fucker",
  "fucking",
  "motherfucker",
  "shit",
  "bullshit",
  "bitch",
  "bitches",
  "bastard",
  "asshole",
  "dick",
  "dickhead",
  "cock",
  "pussy",
  "cunt",
  "slut",
  "whore",
  "wanker",
  "twat",
  "jerkoff",
  "cum",
  "jizz",
  "blowjob",
  "handjob",
  "boner",
  "nigger",
  "nigga",
  "faggot",
  "fag",
  "retard",
  "retarded",
  "spic",
  "chink",
  // "kike" is intentionally omitted: it collides with the very common Spanish
  // given name "Kike" (Enrique). Basic filtering favors not blocking real names.
  "wetback",
  "tranny",
  "coon",
  "rapist",
  "rape",
  "nazi",
  "pedo",
  "pedophile",
]);

/** Terms also caught as substrings of the letters-only collapse, to defeat
 *  separator/spacing obfuscation ("f u c k", "n.i.g..."). Deliberately limited
 *  to words with no common innocent superstring — e.g. "spic" (→ "spice") and
 *  "kike" (a Spanish given name) are intentionally left to whole-word matching
 *  only, to avoid false positives. */
const SEVERE = [
  "fuck",
  "shit",
  "bitch",
  "cunt",
  "pussy",
  "asshole",
  "bullshit",
  "motherfucker",
  "faggot",
  "nigger",
  "nigga",
  "tranny",
  "wetback",
  "rapist",
  "pedophile",
];

function canonicalize(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining accent marks
    .replace(/[0134578@$!|]/g, (c) => LEET[c] ?? c);
}

/** True if the text contains an explicit/blocked word. */
export function containsProfanity(raw: string): boolean {
  const canon = canonicalize(raw);
  const tokens = canon.split(/[^a-z]+/).filter(Boolean);
  if (tokens.some((t) => BLOCKLIST.has(t))) return true;
  const collapsed = canon.replace(/[^a-z]/g, "");
  return SEVERE.some((w) => collapsed.includes(w));
}

/** Shared message shown when a submitted name is rejected. */
export const PROFANITY_ERROR = "Please choose a name without explicit language.";
