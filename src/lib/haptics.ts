/**
 * Thin, best-effort wrapper around the Vibration API (Android; iOS Safari has
 * no support and silently no-ops). Centralizes the buzz patterns used across
 * the draft and reveal so they stay consistent. Haptics are independent of the
 * sound mute toggle — a user can silence audio but keep the tactile feedback.
 */

export type Haptic = "light" | "medium" | "select" | "success" | "error";

const PATTERNS: Record<Haptic, number | number[]> = {
  light: 8,
  medium: 18,
  select: 12,
  success: [120, 60, 120, 60, 240],
  error: [60, 40, 60],
};

export function haptic(kind: Haptic) {
  if (typeof navigator === "undefined") return;
  try {
    navigator.vibrate?.(PATTERNS[kind]);
  } catch {
    // best-effort only
  }
}
