export type Action = "toggle" | "tuner" | "chords";

export interface KeyLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  target?: { tagName?: string; isContentEditable?: boolean } | null;
}

/**
 * Maps a keydown to an app action: Space = start/stop, T = tuner, C = chords.
 * Ignored with modifiers and while typing in a form field. Space on a button
 * is left to the browser (it already clicks the button), avoiding a double toggle.
 */
export function resolveShortcut(e: KeyLike): Action | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  const tag = e.target?.tagName?.toUpperCase();
  if (
    tag === "INPUT" ||
    tag === "SELECT" ||
    tag === "TEXTAREA" ||
    e.target?.isContentEditable
  )
    return null;
  if (e.key === " ") return tag === "BUTTON" ? null : "toggle";
  switch (e.key.toLowerCase()) {
    case "t":
      return "tuner";
    case "c":
      return "chords";
    default:
      return null;
  }
}
