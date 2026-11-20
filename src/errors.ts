/** Turns a getUserMedia failure into an actionable message. */
export function micErrorMessage(err: unknown): string {
  const name = err instanceof Error ? err.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Microphone permission was denied. Allow access in your browser's site settings, then press Start again.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No microphone was found. Plug one in and try again.";
    case "NotReadableError":
    case "AbortError":
      return "The microphone is busy or unavailable. Close other apps using it and try again.";
    case "UnsupportedError":
      return "This browser cannot access a microphone here. Use a recent browser over HTTPS.";
    default:
      return "Could not start the microphone. Check your browser settings and try again.";
  }
}
