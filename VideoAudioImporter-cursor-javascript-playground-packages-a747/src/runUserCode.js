import {
  createAudiotoolClient,
  getLoginStatus,
} from "@audiotool/nexus";
import {
  buildPreviewSrcdoc,
  getIframeAsyncFunction,
  injectPreviewPostRunHint,
  loadPreviewIframeSrcdoc,
  refreshPreviewEmptyOverlay,
} from "./previewIframe.js";
import { gettingStartedSamples } from "./gettingStartedSamples.js";
import { CLOUD_STUDIO_RUN_MARKER } from "./templates.js";
import { ctx } from "./playgroundContext.js";
import { logToConsole } from "./playgroundConsole.js";

function emitRunFeedback(message, variant = "default") {
  window.dispatchEvent(
    new CustomEvent("pg:run-feedback", {
      detail: { message, variant },
    }),
  );
}

function isSyncedCloudProjectReady() {
  return (
    Boolean(ctx.audiotoolClient) &&
    Boolean(ctx.connectedProjectId) &&
    window.__NEXUS_MODE__ === "synced"
  );
}

/**
 * Static `import … from "@audiotool/nexus"` cannot appear inside the AsyncFunction
 * body (not a module). Strip those lines so user code can match the docs; Run still
 * passes the real functions from this bundle.
 */
function stripAudiotoolNexusImports(source) {
  return source.replace(
    /^\s*import\s+[\s\S]*?from\s+["']@audiotool\/nexus["']\s*;?\s*$/gm,
    "",
  );
}

function normalizeForSampleMatch(s) {
  return (s || "").replace(/\r\n/g, "\n").trim();
}

/** Steps 3 & 4: same Studio workflow hint when editor matches canonical sample text. */
function shouldUseStudioWorkflowHint(editorValue) {
  const cur = normalizeForSampleMatch(editorValue);
  if (!cur.length) return false;
  const step3 = normalizeForSampleMatch(
    gettingStartedSamples.sample3NexusEvents,
  );
  const step4 = normalizeForSampleMatch(
    gettingStartedSamples.sample4ModifyTonematrix,
  );
  return cur === step3 || cur === step4;
}

function formatConsoleArg(arg) {
  if (arg === null || arg === undefined) return String(arg);
  if (typeof arg === "string") return arg;
  if (typeof arg === "object") {
    try {
      return JSON.stringify(arg);
    } catch {
      return String(arg);
    }
  }
  return String(arg);
}

/** User code runs in the preview iframe; bridge its console to the playground panel. */
function installPreviewConsoleBridge(win) {
  if (!win?.console) return;
  const levels = ["log", "info", "debug", "warn", "error"];
  for (const level of levels) {
    const orig = win.console[level].bind(win.console);
    win.console[level] = (...args) => {
      orig(...args);
      const text = args.map(formatConsoleArg).join(" ");
      const line = `> ${text}`;
      if (level === "error" || level === "warn") {
        logToConsole(line, level === "error");
      } else {
        logToConsole(line);
      }
    };
  }
}

export function initRunUserCode() {
  document.getElementById("run-btn")?.addEventListener("click", async () => {
    if (!ctx.nexus) {
      logToConsole("Hold on! Engine is booting...", true);
      emitRunFeedback(
        "Engine is still booting. Try again in a moment.",
        "error",
      );
      return;
    }

    const userCode = ctx.editor?.getValue() ?? "";
    if (
      userCode.includes(CLOUD_STUDIO_RUN_MARKER) &&
      !isSyncedCloudProjectReady()
    ) {
      logToConsole("<br/>--- Running Code ---");
      if (!ctx.audiotoolClient) {
        logToConsole(
          "Log in, then connect a project (Connect Project), then run this template again — it syncs to Audiotool Studio, not only the offline engine.",
          true,
        );
        emitRunFeedback(
          "Login and connect a cloud project before running this template.",
          "error",
        );
      } else {
        logToConsole(
          "Connect a cloud project first: paste a Studio URL or project ID and click Connect Project, then run again.",
          true,
        );
        emitRunFeedback("Connect a cloud project, then run again.", "error");
      }
      return;
    }

    const previewIframe = document.getElementById("preview-sandbox-iframe");
    if (!previewIframe) {
      logToConsole("Preview iframe missing — cannot run code.", true);
      emitRunFeedback("Preview iframe not found.", "error");
      return;
    }

    logToConsole("<br/>--- Running Code ---");

    try {
      await loadPreviewIframeSrcdoc(previewIframe, buildPreviewSrcdoc());
      refreshPreviewEmptyOverlay();

      const iframeWin = previewIframe.contentWindow;
      if (iframeWin) {
        installPreviewConsoleBridge(iframeWin);
      }

      const AsyncFunction = getIframeAsyncFunction(previewIframe);
      const runnable = stripAudiotoolNexusImports(userCode);
      // Same exports as `@audiotool/nexus` (imported at top of this file). `sdk*` names are aliases for older snippets.
      const executeUserCode = new AsyncFunction(
        "nexus",
        "Nexus",
        "client",
        "getLoginStatus",
        "createAudiotoolClient",
        "sdkGetLoginStatus",
        "sdkCreateAudiotoolClient",
        runnable,
      );
      await executeUserCode(
        ctx.nexus,
        null,
        ctx.audiotoolClient,
        getLoginStatus,
        createAudiotoolClient,
        getLoginStatus,
        createAudiotoolClient,
      );
      injectPreviewPostRunHint(
        previewIframe,
        shouldUseStudioWorkflowHint(userCode) ? "studio" : "console",
      );
      refreshPreviewEmptyOverlay();
      emitRunFeedback("Code ran successfully.", "success");
    } catch (err) {
      const message = err?.message ?? String(err);
      const stack = err?.stack ? `\n${err.stack}` : "";
      logToConsole(`Execution Error: ${message}${stack}`, true);
      emitRunFeedback(`Execution error: ${message}`, "error");
      console.error(err);
      refreshPreviewEmptyOverlay();
    }
  });
}
