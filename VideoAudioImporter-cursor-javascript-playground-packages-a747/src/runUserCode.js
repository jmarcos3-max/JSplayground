import * as Nexus from "nexusui";
import { CLOUD_STUDIO_RUN_MARKER } from "./templates.js";
import { ctx } from "./playgroundContext.js";
import { logToConsole } from "./playgroundConsole.js";
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
      } else {
        logToConsole(
          "Connect a cloud project first: paste a Studio URL or project ID and click Connect Project, then run again.",
          true,
        );
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
    } catch (err) {
      const message = err?.message ?? String(err);
      const stack = err?.stack ? `\n${err.stack}` : "";
      logToConsole(`Execution Error: ${message}${stack}`, true);
      console.error(err);
    }
  });
}
