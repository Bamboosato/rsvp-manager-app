const clipboardErrorMessage =
  "URLコピーに失敗しました。ブラウザのフォーカスやクリップボード設定を確認してください。";

export async function copyPlainTextToClipboard(text: string) {
  if (typeof window !== "undefined") {
    window.focus();
  }

  if (typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function") {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall back to the legacy path below for browsers that reject async Clipboard writes.
    }
  }

  if (copyTextWithTextarea(text)) {
    return;
  }

  throw new Error(clipboardErrorMessage);
}

function copyTextWithTextarea(text: string) {
  if (typeof document === "undefined" || !document.body) {
    return false;
  }

  const activeElement = document.activeElement;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "0";
  textarea.style.top = "0";
  textarea.style.width = "1px";
  textarea.style.height = "1px";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";

  document.body.appendChild(textarea);
  textarea.focus({ preventScroll: true });
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  let copied = false;

  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }

  document.body.removeChild(textarea);

  if (activeElement instanceof HTMLElement) {
    activeElement.focus({ preventScroll: true });
  }

  return copied;
}
