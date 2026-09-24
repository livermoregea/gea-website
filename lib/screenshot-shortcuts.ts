type ShortcutEvent = Pick<KeyboardEvent, "key" | "code" | "metaKey" | "shiftKey" | "ctrlKey" | "altKey">;

export function shouldCoverLeadershipPhotos(event: Pick<ShortcutEvent, "metaKey" | "shiftKey" | "ctrlKey" | "altKey">): boolean {
  return event.shiftKey && (event.metaKey || event.altKey || event.ctrlKey);
}

export function isScreenshotShortcut(event: ShortcutEvent, isMac: boolean): boolean {
  if (event.key === "PrintScreen" || event.code === "PrintScreen") return true;

  if (isMac) {
    // Control is also allowed: macOS uses it to copy a capture to the clipboard.
    return event.metaKey && event.shiftKey && !event.altKey && (
      ["Digit3", "Digit4", "Digit5"].includes(event.code) ||
      ["3", "4", "5", "#", "$", "%"].includes(event.key)
    );
  }

  return event.metaKey && event.shiftKey && !event.ctrlKey && !event.altKey &&
    (event.code === "KeyS" || event.key.toLowerCase() === "s");
}
