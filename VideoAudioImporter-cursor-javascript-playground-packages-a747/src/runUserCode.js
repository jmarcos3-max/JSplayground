import * as Nexus from "nexusui";
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

    document.getElementById("nexus-ui-container").innerHTML = "";
    logToConsole("<br/>--- Running Code ---");

    try {
      const AsyncFunction = Object.getPrototypeOf(async function () {})
        .constructor;
      const executeUserCode = new AsyncFunction(
        "nexus",
        "Nexus",
        "client",
        userCode,
      );
      await executeUserCode(ctx.nexus, Nexus, ctx.audiotoolClient);
      emitRunFeedback("Code ran successfully.", "success");
    } catch (err) {
      const message = err?.message ?? String(err);
      const stack = err?.stack ? `\n${err.stack}` : "";
      logToConsole(`Execution Error: ${message}${stack}`, true);
      emitRunFeedback(`Execution error: ${message}`, "error");
      console.error(err);
    }
  });
}
