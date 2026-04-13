import "./style.css";
import "monaco-editor/min/vs/editor/editor.main.css";
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import {
  createOfflineDocument,
  createAudiotoolClient,
  getLoginStatus,
} from "@audiotool/nexus";
import { gettingStartedSamples } from "./gettingStartedSamples.js";
import { extractProjectId, parseProjectIdFromInput } from "./projectIds.js";
import { installPlaygroundIntellisense } from "./playgroundIntellisense.js";
import { ctx } from "./playgroundContext.js";
import {
  initPlaygroundConsole,
  installPlaygroundConsoleForward,
  logToConsole,
} from "./playgroundConsole.js";
import { initAppearanceMenu } from "./appearanceMenu.js";
import { initSamplesGallery } from "./samplesGallery.js";
import { syncCloudToolbarEnabled } from "./playgroundCloudToolbar.js";
import { initProjectsMenu } from "./projectsMenu.js";
import { initCreateProjectFlow } from "./createProjectFlow.js";
import { initPreviewEmptyOverlay, primePreviewIframe } from "./previewIframe.js";
import { initRunUserCode } from "./runUserCode.js";
import { initOnboardingTour, startOnboardingTour } from "./onboardingTour.js";

self.MonacoEnvironment = {
  getWorker(_moduleId, label) {
    if (label === "javascript" || label === "typescript") {
      return new tsWorker();
    }
    return new editorWorker();
  },
};

const initialEditorFont = (() => {
  const n = parseInt(document.documentElement.dataset.pgEditorFont, 10);
  return Number.isFinite(n) ? Math.min(18, Math.max(12, n)) : 14;
})();

ctx.editor = monaco.editor.create(document.getElementById("editor-js"), {
  value: gettingStartedSamples.sample1LoginConnect,
  language: "javascript",
  theme: document.documentElement.classList.contains("pg-theme-dark")
    ? "vs-dark"
    : "vs",
  automaticLayout: true,
  fontSize: initialEditorFont,
  minimap: { enabled: false },
});

installPlaygroundIntellisense(monaco);

initPlaygroundConsole(document.getElementById("console-output"));
installPlaygroundConsoleForward();
initAppearanceMenu();
initSamplesGallery();
initPreviewEmptyOverlay();
void primePreviewIframe();

const audiotoolClientId = "379f8d67-b211-43b2-8a9d-9553aa8aad32";
const audiotoolScope = "project:write";
const LAST_CONNECTED_PROJECT_KEY = "audiotool-playground-last-project-id";

ctx.nexus = window.__NEXUS_INSTANCE__ || null;

const authBtn = document.getElementById("auth-btn");
const connectBtn = document.getElementById("connect-btn");
const projectInput = document.getElementById("project-input");
const playgroundStatus = document.getElementById("playground-status");
const playgroundStatusText = document.getElementById("playground-status-text");
const playgroundModeBadge = document.getElementById("playground-mode-badge");
const playgroundSteps = Array.from(
  document.querySelectorAll("#playground-steps .playground-step"),
);
const playgroundCloudHint = document.getElementById("playground-cloud-hint");
const openProjectBtn = document.getElementById("open-project-btn");
const toastStack = document.getElementById("toast-stack");

syncCloudToolbarEnabled();

function setActiveSteps(keys) {
  const active = new Set(keys);
  for (const item of playgroundSteps) {
    const key = item.dataset.step;
    item.classList.toggle("is-active", active.has(key));
  }
}

function setModeBadge(label, modeClass) {
  if (!playgroundModeBadge) return;
  playgroundModeBadge.textContent = label;
  playgroundModeBadge.className = `status-mode-badge ${modeClass}`;
}

function showToast(message, variant = "default") {
  if (!toastStack || !message) return;
  const toast = document.createElement("div");
  toast.className = `toast toast--${variant}`;
  toast.textContent = message;
  toastStack.appendChild(toast);
  window.setTimeout(() => {
    toast.classList.add("toast--fade");
  }, 2600);
  window.setTimeout(() => {
    toast.remove();
  }, 2900);
}

function updatePlaygroundStatus() {
  if (!playgroundStatus || !playgroundStatusText) return;
  if (ctx.connectedProjectId && ctx.connectedProjectName) {
    playgroundStatusText.textContent = `Cloud Mode · ${ctx.connectedProjectName}`;
    setModeBadge("Connected", "mode-cloud");
    playgroundStatus.removeAttribute("aria-describedby");
    if (playgroundCloudHint) playgroundCloudHint.hidden = true;
    setActiveSteps(["login", "connect", "run", "open"]);
    return;
  }
  if (ctx.loginStatus?.loggedIn) {
    playgroundStatusText.textContent =
      "Signed in · not connected to a cloud project";
    setModeBadge("Signed in", "mode-signed-in");
    playgroundStatus.setAttribute(
      "aria-describedby",
      "playground-cloud-hint",
    );
    if (playgroundCloudHint) playgroundCloudHint.hidden = false;
    setActiveSteps(["login"]);
    return;
  }
  playgroundStatusText.textContent =
    "Offline mode · run without logging in; log in for cloud";
  setModeBadge("Offline", "mode-offline");
  playgroundStatus.removeAttribute("aria-describedby");
  if (playgroundCloudHint) playgroundCloudHint.hidden = true;
  setActiveSteps([]);
}

function getRedirectUrl() {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  let path = url.pathname;
  if (path.endsWith(".html")) path = path.slice(0, path.lastIndexOf("/") + 1);
  if (!path.endsWith("/")) path = `${path}/`;
  url.pathname = path;
  return url.toString();
}

async function initAuth() {
  try {
    ctx.loginStatus = await getLoginStatus({
      clientId: audiotoolClientId,
      redirectUrl: getRedirectUrl(),
      scope: audiotoolScope,
    });

    if (ctx.loginStatus.loggedIn) {
      authBtn.textContent = "Logout";
      ctx.audiotoolClient = await createAudiotoolClient({
        authorization: ctx.loginStatus,
      });
      try {
        if (!sessionStorage.getItem("pg-signed-in-toast-shown")) {
          showToast("Signed in successfully.", "success");
          sessionStorage.setItem("pg-signed-in-toast-shown", "1");
        }
      } catch {
        /* ignore */
      }
    } else {
      authBtn.textContent = "Login";
      ctx.audiotoolClient = null;
    }

    openProjectBtn.disabled = true;
    ctx.connectedProjectId = "";
    ctx.connectedProjectName = "";
    updatePlaygroundStatus();
  } catch (error) {
    logToConsole(`Auth Error: ${error.message}`, true);
    showToast(`Auth error: ${error.message}`, "error");
    ctx.audiotoolClient = null;
  } finally {
    syncCloudToolbarEnabled();
    try {
      const last = sessionStorage.getItem(LAST_CONNECTED_PROJECT_KEY);
      if (last?.trim() && projectInput && !projectInput.value.trim()) {
        projectInput.value = last.trim();
      }
    } catch {
      /* ignore */
    }
  }
}

async function bootEngine() {
  if (window.__NEXUS_IS_BOOTING__) {
    console.log("Engine is currently booting in the background...");
    return;
  }

  if (window.__NEXUS_INSTANCE__) {
    logToConsole("Engine already running (Reused from cache).");
    ctx.nexus = window.__NEXUS_INSTANCE__;
    return;
  }

  window.__NEXUS_IS_BOOTING__ = true;

  try {
    logToConsole("Booting Local Offline Engine...");
    ctx.nexus = await createOfflineDocument();
    window.__NEXUS_INSTANCE__ = ctx.nexus;
    window.__NEXUS_MODE__ = "offline";
    logToConsole("Offline Engine Ready!");
    updatePlaygroundStatus();
  } catch (err) {
    logToConsole(`Boot Error: ${err.message}`, true);
    console.error(err);
  } finally {
    window.__NEXUS_IS_BOOTING__ = false;
  }
}

authBtn.addEventListener("click", async () => {
  if (!ctx.loginStatus) return;
  if (ctx.loginStatus.loggedIn) {
    await ctx.loginStatus.logout();
    window.location.reload();
  } else {
    logToConsole("Redirecting to Audiotool login...");
    await ctx.loginStatus.login();
  }
});

async function connectToProject(projectId, displayNameHint) {
  if (!ctx.audiotoolClient) {
    logToConsole("You must log in first (use Login in the Project bar).", true);
    return;
  }

  if (!projectId) {
    logToConsole(
      "Paste a Studio URL or project ID, then try Connect Project again.",
      true,
    );
    return;
  }

  try {
    logToConsole(`Connecting to cloud project: ${projectId}...`);

    if (
      ctx.nexus &&
      window.__NEXUS_MODE__ === "synced" &&
      typeof ctx.nexus.stop === "function"
    ) {
      await ctx.nexus.stop();
    }

    window.__NEXUS_INSTANCE__ = null;
    window.__NEXUS_MODE__ = null;
    ctx.nexus = null;

    ctx.nexus = await ctx.audiotoolClient.createSyncedDocument({
      project: projectId,
    });
    await ctx.nexus.start();
    window.__NEXUS_INSTANCE__ = ctx.nexus;
    window.__NEXUS_MODE__ = "synced";

    let projectName = (displayNameHint || "").trim();
    if (!projectName) {
      try {
        const resp = await ctx.audiotoolClient.api.projectService.getProject({
          name: `projects/${projectId}`,
        });
        projectName = resp?.project?.displayName?.trim() || "";
      } catch {
        // ignore, fallback below
      }
    }
    if (!projectName) projectName = projectId;

    logToConsole("Cloud Sync Ready! Your code now updates the real project.");
    showToast(`Connected to ${projectName}.`, "success");
    ctx.connectedProjectId = projectId;
    openProjectBtn.disabled = false;
    ctx.connectedProjectName = projectName;
    updatePlaygroundStatus();
    try {
      sessionStorage.setItem(LAST_CONNECTED_PROJECT_KEY, projectId);
    } catch {
      /* ignore */
    }
  } catch (err) {
    logToConsole(`Connect Error: ${err.message}`, true);
    showToast(`Connect error: ${err.message}`, "error");
    console.error(err);
  }
}

connectBtn.addEventListener("click", async () => {
  await connectToProject(parseProjectIdFromInput(projectInput.value));
});

initProjectsMenu(connectToProject);
initCreateProjectFlow(connectToProject);
initRunUserCode();
initOnboardingTour();

document.addEventListener("click", (event) => {
  const action = event.target.closest("[data-empty-action]")?.dataset.emptyAction;
  if (!action) return;

  if (action === "samples") {
    document.getElementById("browse-samples-btn")?.click();
  }

  if (action === "run") {
    document.getElementById("run-btn")?.click();
  }
});

// Fallback delegation: ensures "Take tour" works even if the direct
// listener is missed during dynamic UI reflows/theme toggles.
document.addEventListener("click", (event) => {
  const takeTour = event.target.closest("#take-tour-btn");
  if (!takeTour) return;
  if (event.__pgTourHandled) return;
  event.preventDefault();
  startOnboardingTour(true);
});

window.addEventListener("pg:onboarding-ended", () => {
  try {
    ctx.editor?.layout();
  } catch {
    // ignore
  }
});

openProjectBtn.addEventListener("click", () => {
  if (!ctx.connectedProjectId) {
    logToConsole("No project connected yet.", true);
    showToast("Connect a project before opening Studio.", "error");
    return;
  }
  const url = `https://beta.audiotool.com/studio?project=${encodeURIComponent(ctx.connectedProjectId)}`;
  window.open(url, "_blank", "noopener,noreferrer");
  showToast("Opened project in a new tab.", "success");
});

window.addEventListener("pg:run-feedback", (event) => {
  const detail = event?.detail || {};
  if (!detail.message) return;
  const variant = detail.variant || "default";
  showToast(detail.message, variant);
  if (variant === "success" && ctx.connectedProjectId) {
    setActiveSteps(["login", "connect", "run", "open"]);
  }
});

initAuth();
bootEngine();
