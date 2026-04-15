/** Preview runs user code inside a real document via iframe + srcdoc (not Shadow DOM). */

let innerObserver = null;

function getPreviewThemeColors() {
  const dark = document.documentElement.classList.contains("pg-theme-dark");
  return {
    dark,
    bg: dark
      ? "linear-gradient(180deg, #0e1622, #0a111b)"
      : "radial-gradient(circle at 50% 42%, rgba(15, 118, 110, 0.08) 0%, #fbf6ea 58%)",
    fg: dark ? "#e5e7eb" : "#1f2937",
    panelBg: dark ? "rgba(255, 255, 255, 0.045)" : "rgba(255, 255, 255, 0.88)",
    panelBorder: dark ? "rgba(229, 231, 235, 0.14)" : "rgba(31, 41, 55, 0.12)",
  };
}

export function buildPreviewSrcdoc() {
  const { dark, bg, fg, panelBorder: border, panelBg } = getPreviewThemeColors();
  const shadow = dark
    ? "0 10px 36px rgba(0, 0, 0, 0.38)"
    : "0 12px 32px rgba(44, 62, 80, 0.1)";
  const accent = dark ? "#2dd4bf" : "#0f766e";
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
html, body { margin: 0; min-height: 100%; }
body {
  box-sizing: border-box;
  padding: 20px 18px;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: ${dark
    ? "linear-gradient(180deg, #0e1622, #0a111b)"
    : "radial-gradient(circle at 50% 42%, rgba(15, 118, 110, 0.08) 0%, #fbf6ea 58%)"};
  color: ${fg};
  line-height: 1.45;
  /* Center controls whether you use document.body or #nexus-ui-container */
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 16px;
}
#nexus-ui-container:empty { display: none; }
#nexus-ui-container:not(:empty) {
  width: min(100%, 440px);
  max-width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  padding: 18px 20px;
  border-radius: 16px;
  border: 1px solid ${border};
  background: ${panelBg};
  box-shadow: ${shadow};
}
button, input, select, textarea { font: inherit; color: inherit; }
button {
  cursor: pointer;
  padding: 9px 16px;
  border-radius: 10px;
  border: 1px solid ${border};
  background: ${dark ? "rgba(45, 212, 191, 0.14)" : "rgba(15, 118, 110, 0.12)"};
  font-weight: 600;
  transition: filter 0.15s ease, border-color 0.15s ease;
}
button:hover { filter: brightness(1.08); border-color: ${accent}; }
input[type="range"] { width: 100%; cursor: pointer; }
label { font-size: 13px; font-weight: 600; opacity: 0.92; }
</style></head><body><div id="nexus-ui-container"></div></body></html>`;
}

export function loadPreviewIframeSrcdoc(iframe, srcdoc) {
  return new Promise((resolve) => {
    const onLoad = () => {
      iframe.removeEventListener("load", onLoad);
      resolve();
    };
    iframe.addEventListener("load", onLoad);
    iframe.srcdoc = srcdoc;
  });
}

/**
 * AsyncFunction in the iframe realm so `document` / `document.body` target the sandbox.
 */
export function getIframeAsyncFunction(iframe) {
  return iframe.contentWindow.eval("(async function(){}).constructor");
}

const PREVIEW_CONSOLE_HINT_ID = "pg-console-output-hint";
const PREVIEW_STUDIO_HINT_ID = "pg-studio-workflow-hint";

const RUNNER_HINT_IDS = new Set([
  PREVIEW_CONSOLE_HINT_ID,
  PREVIEW_STUDIO_HINT_ID,
]);

function previewDocHasUserPlacedUi(doc) {
  const inner = doc.getElementById("nexus-ui-container");
  if (inner && Array.from(inner.children).some((c) => c.nodeType === 1)) {
    return true;
  }
  const body = doc.body;
  if (!body) return false;
  for (const el of body.children) {
    if (el.nodeType !== 1) continue;
    if (el === inner) continue;
    if (RUNNER_HINT_IDS.has(el.id)) continue;
    return true;
  }
  return false;
}

function removePreviewRunnerHints(doc) {
  if (!doc) return;
  doc.getElementById(PREVIEW_CONSOLE_HINT_ID)?.remove();
  doc.getElementById(PREVIEW_STUDIO_HINT_ID)?.remove();
}

function appendHintShell(doc, id, titleText, bodyText, withArrow = true) {
  const dark = document.documentElement.classList.contains("pg-theme-dark");
  const border = dark ? "rgba(229, 231, 235, 0.18)" : "rgba(31, 41, 55, 0.14)";
  const bg = dark ? "rgba(45, 212, 191, 0.1)" : "rgba(15, 118, 110, 0.12)";
  const fg = dark ? "#e5e7eb" : "#1f2937";

  const wrap = doc.createElement("div");
  wrap.id = id;
  wrap.setAttribute("role", "status");
  wrap.style.cssText = [
    "max-width:min(100%,400px)",
    "box-sizing:border-box",
    "padding:18px 20px",
    "border-radius:14px",
    `border:1px solid ${border}`,
    `background:${bg}`,
    `color:${fg}`,
    "text-align:center",
    "font-size:14px",
    "line-height:1.5",
  ].join(";");

  const title = doc.createElement("div");
  title.textContent = titleText;
  title.style.cssText =
    "font-weight:800;font-size:15px;margin-bottom:8px;letter-spacing:-0.02em;";
  wrap.appendChild(title);

  const p = doc.createElement("p");
  p.style.cssText = "margin:0;opacity:0.92;";
  p.textContent = bodyText;
  wrap.appendChild(p);

  if (withArrow) {
    const arrow = doc.createElement("div");
    arrow.textContent = "\u2198";
    arrow.setAttribute("aria-hidden", "true");
    arrow.style.cssText =
      "margin-top:12px;font-size:26px;line-height:1;opacity:0.55;";
    wrap.appendChild(arrow);
  }

  doc.body.appendChild(wrap);
}

/**
 * After Run: if the user added no preview DOM, show a runner hint (Terminal vs Studio).
 * Steps 3 & 4 use the Studio card when editor matches canonical samples — user script unchanged.
 */
export function injectPreviewPostRunHint(iframe, kind) {
  const doc = iframe?.contentDocument;
  if (!doc?.body) return;

  removePreviewRunnerHints(doc);
  if (previewDocHasUserPlacedUi(doc)) return;

  if (kind === "studio") {
    appendHintShell(
      doc,
      PREVIEW_STUDIO_HINT_ID,
      "Use Audiotool Studio for this step",
      "Log in, connect a cloud project (or create one), then Open Project. In Studio, create or tweak devices (e.g. delay mix) — event logs appear in Terminal on the right. Re-run here after connecting if needed.",
      false,
    );
    return;
  }

  appendHintShell(
    doc,
    PREVIEW_CONSOLE_HINT_ID,
    "Output is in Terminal",
    "This run didn't add controls in the preview. Scroll down on the right to Terminal Output for console.log and other messages.",
  );
}

export function refreshPreviewEmptyOverlay() {
  const iframe = document.getElementById("preview-sandbox-iframe");
  const empty = document.getElementById("preview-empty");
  if (!iframe || !empty) return;

  innerObserver?.disconnect();
  innerObserver = null;

  const doc = iframe.contentDocument;
  if (!doc) {
    empty.style.display = "grid";
    return;
  }

  const inner = doc.getElementById("nexus-ui-container");
  if (!inner) {
    empty.style.display = "grid";
    return;
  }

  const hasPreviewContent = () => {
    if (Array.from(inner.children).some((c) => c.nodeType === 1)) return true;
    const body = doc.body;
    if (!body) return false;
    for (const el of body.children) {
      if (el.nodeType !== 1) continue;
      if (el === inner) continue;
      return true;
    }
    return false;
  };

  const sync = () => {
    const has = hasPreviewContent();
    empty.style.display = has ? "none" : "grid";
    empty.setAttribute("aria-hidden", has ? "true" : "false");
  };

  sync();
  innerObserver = new MutationObserver(sync);
  innerObserver.observe(inner, { childList: true, subtree: true });
  innerObserver.observe(doc.body, { childList: true, subtree: false });
}

let loadListenerWired = false;

export function initPreviewEmptyOverlay() {
  const iframe = document.getElementById("preview-sandbox-iframe");
  if (!iframe || loadListenerWired) return;
  loadListenerWired = true;
  iframe.addEventListener("load", () => {
    refreshPreviewEmptyOverlay();
  });
}

export async function primePreviewIframe() {
  const iframe = document.getElementById("preview-sandbox-iframe");
  if (!iframe) return;
  await loadPreviewIframeSrcdoc(iframe, buildPreviewSrcdoc());
}

export function syncPreviewIframeTheme() {
  const iframe = document.getElementById("preview-sandbox-iframe");
  const doc = iframe?.contentDocument;
  if (!doc?.body) return;

  const { fg, bg, panelBg, panelBorder } = getPreviewThemeColors();
  doc.body.style.background = bg;
  doc.body.style.color = fg;

  const inner = doc.getElementById("nexus-ui-container");
  if (inner && inner.children.length > 0) {
    inner.style.background = panelBg;
    inner.style.borderColor = panelBorder;
  }
}
