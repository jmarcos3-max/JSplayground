import "./style.css";
import "monaco-editor/min/vs/editor/editor.main.css";
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import { createAudiotoolClient, getLoginStatus } from "@audiotool/nexus";
import { PreviewPanel } from "./PreviewPanel.js";
import noteEditorSampleHtml from "./samples/note-editor/sample.html?raw";
import noteEditorSampleCss from "./samples/note-editor/sample.css?raw";
import noteEditorSampleJs from "./samples/note-editor/sample.js?raw";

self.MonacoEnvironment = {
  getWorker(_moduleId, label) {
    if (label === "javascript" || label === "typescript") {
      return new tsWorker();
    }

    return new editorWorker();
  },
};

const defaultPackages = "dayjs,lodash-es";
const audiotoolClientId = "379f8d67-b211-43b2-8a9d-9553aa8aad32";
const audiotoolScope = "project:write";

const defaultHtml = `<div class="demo">
  <h1>JS Playground</h1>
  <p id="demo-line">Edit HTML, CSS, and JavaScript, then click Run.</p>
</div>
`;

const defaultCss = `body {
  font-family: system-ui, sans-serif;
  margin: 0;
  padding: 1rem;
  background: #0f172a;
  color: #e2e8f0;
}
.demo h1 {
  color: #38bdf8;
  margin: 0 0 0.5rem;
}
`;

const defaultSource = `import dayjs from "dayjs";
import { startCase } from "lodash-es";

const demoLine = document.getElementById("demo-line");
if (demoLine) {
  demoLine.textContent = \`\${startCase("monaco sandbox is running")} · \${dayjs().format("YYYY-MM-DD HH:mm:ss")}\`;
}

console.log(startCase("monaco sandbox is running"));
console.log("Current time:", dayjs().format("YYYY-MM-DD HH:mm:ss"));

try {
  await window.audiotool.apply({
    ops: [
      { op: "ensureEntity", entityType: "tonematrix", alias: "tm" },
      { op: "updateField", entityAlias: "tm", field: "positionX", value: 900 },
      { op: "updateField", entityAlias: "tm", field: "positionY", value: 600 },
    ],
  });
  console.log("Audiotool ops were synced to the connected project.");
} catch (error) {
  console.warn(
    "Connect a project first, then run again to sync operations.",
    error,
  );
}
`;

/**
 * Older pages used a single `#editor` div. The app now expects tabbed `#editor-html` /
 * `#editor-css` / `#editor-js`. Inject the workbench so Monaco and tabs work without
 * hand-editing every deployment HTML.
 */
function injectEditorWorkbenchIfNeeded() {
  if (document.getElementById("editor-html")) return;
  const mount = document.getElementById("editor");
  if (!mount) return;
  mount.classList.add("editor-workbench");
  mount.innerHTML = `
    <div class="editor-tab-bar">
      <div class="editor-tab-inline-group">
        <div class="editor-tab-buttons" role="tablist" aria-label="Editor source">
          <button type="button" class="editor-tab" role="tab" id="tab-html" aria-selected="false" aria-controls="editor-html" data-editor-tab="html">HTML</button>
          <button type="button" class="editor-tab" role="tab" id="tab-css" aria-selected="false" aria-controls="editor-css" data-editor-tab="css">CSS</button>
          <button type="button" class="editor-tab active" role="tab" id="tab-js" aria-selected="true" aria-controls="editor-js" data-editor-tab="js">JavaScript</button>
        </div>
        <button type="button" id="sdk-view-toggle" class="editor-tab sdk-view-toggle" aria-pressed="false" aria-label="Show SDK simulation instead of live preview" title="SDK simulation (Tone Matrix & apply output)">SDK</button>
        <button type="button" id="note-editor-open" class="editor-tab note-editor-open-btn" aria-label="Load note editor sample" title="Load the piano-roll note editor into HTML, CSS, and JavaScript">Note editor</button>
      </div>
    </div>
    <div class="editor-tab-panels">
      <div id="editor-html" class="editor-panel" role="tabpanel" aria-labelledby="tab-html" hidden></div>
      <div id="editor-css" class="editor-panel" role="tabpanel" aria-labelledby="tab-css" hidden></div>
      <div id="editor-js" class="editor-panel active" role="tabpanel" aria-labelledby="tab-js"></div>
    </div>
  `;
}

/** Legacy preview iframe used `#project-preview`; live preview expects `#preview-frame`. */
function ensurePreviewFrameAlias() {
  const next = document.getElementById("preview-frame");
  if (next) return;
  const legacy = document.getElementById("project-preview");
  if (!legacy) return;
  legacy.id = "preview-frame";
  legacy.classList.add("preview-frame");
  legacy.setAttribute("title", "Live preview");
  legacy.setAttribute(
    "sandbox",
    "allow-scripts allow-same-origin allow-forms allow-modals",
  );
}

/** Audiotool simulation needs `#preview-panel`; insert if the page only had an iframe. */
function ensurePreviewPanelMount() {
  if (document.getElementById("preview-panel")) return;
  const pane = document.querySelector(".preview-pane");
  if (!pane) return;
  const panel = document.createElement("div");
  panel.id = "preview-panel";
  panel.className = "preview-panel";
  panel.setAttribute("role", "region");
  panel.setAttribute("aria-label", "Audiotool simulation");
  const iframe = pane.querySelector("iframe#preview-frame");
  if (iframe?.parentElement) {
    iframe.parentElement.insertAdjacentElement("afterend", panel);
  } else {
    pane.appendChild(panel);
  }
}

/**
 * Layout CSS expects `.panes` to contain editor | splitter | preview. Older HTML omitted
 * the splitter, which breaks the grid and collapses the editor column.
 */
function ensurePanesSplitter() {
  const panes = document.querySelector(".panes");
  if (!panes || panes.querySelector("#splitter,.splitter")) return;
  const preview = document.querySelector(".preview-pane");
  if (!preview) return;
  const split = document.createElement("div");
  split.id = "splitter";
  split.className = "splitter";
  split.setAttribute("role", "separator");
  split.setAttribute("aria-orientation", "vertical");
  split.setAttribute("tabindex", "0");
  split.setAttribute("aria-label", "Resize editor and preview");
  preview.before(split);
}

function injectSdkToggleIfNeeded() {
  if (document.getElementById("sdk-view-toggle")) return;
  const tablist = document.querySelector(".editor-tab-buttons");
  if (!tablist) return;
  let group = tablist.parentElement;
  if (!group?.classList.contains("editor-tab-inline-group")) {
    const newGroup = document.createElement("div");
    newGroup.className = "editor-tab-inline-group";
    const bar = tablist.parentElement;
    if (!bar?.classList.contains("editor-tab-bar")) {
      const wrap = document.createElement("div");
      wrap.className = "editor-tab-bar";
      tablist.replaceWith(wrap);
      wrap.appendChild(newGroup);
    } else {
      tablist.replaceWith(newGroup);
    }
    newGroup.appendChild(tablist);
    group = newGroup;
  }
  const btn = document.createElement("button");
  btn.id = "sdk-view-toggle";
  btn.type = "button";
  btn.className = "editor-tab sdk-view-toggle";
  btn.textContent = "SDK";
  btn.title = "SDK simulation (Tone Matrix & apply output)";
  btn.setAttribute("aria-pressed", "false");
  btn.setAttribute("aria-label", "Show SDK simulation instead of live preview");
  group.appendChild(btn);
}

function injectNoteEditorButtonIfNeeded() {
  if (document.getElementById("note-editor-open")) return;
  const sdk = document.getElementById("sdk-view-toggle");
  if (!sdk?.parentElement) return;
  const btn = document.createElement("button");
  btn.id = "note-editor-open";
  btn.type = "button";
  btn.className = "editor-tab note-editor-open-btn";
  btn.textContent = "Note editor";
  btn.title = "Load the piano-roll note editor into HTML, CSS, and JavaScript";
  btn.setAttribute("aria-label", "Load note editor sample");
  btn.setAttribute("aria-pressed", "false");
  sdk.insertAdjacentElement("afterend", btn);
}

injectEditorWorkbenchIfNeeded();
ensurePanesSplitter();
ensurePreviewFrameAlias();
ensurePreviewPanelMount();
injectSdkToggleIfNeeded();
injectNoteEditorButtonIfNeeded();

const editorHtmlElement = document.getElementById("editor-html");
const editorCssElement = document.getElementById("editor-css");
const editorJsElement = document.getElementById("editor-js");
const previewFrameElement = document.getElementById("preview-frame");
const runButton = document.getElementById("run-btn");
const resetButton = document.getElementById("reset-btn");
const samplesButton = document.getElementById("samples-btn");
const packageInput = document.getElementById("packages");
const projectInput = document.getElementById("project-input");
const authButton = document.getElementById("auth-btn");
const connectButton = document.getElementById("connect-btn");
const disconnectButton = document.getElementById("disconnect-btn");
const openProjectButton = document.getElementById("open-project-btn");
const reloadPreviewButton = document.getElementById("reload-preview-btn");
const previewModeLabel = document.getElementById("preview-mode-label");
const audiotoolStatusElement = document.getElementById("audiotool-status");
const redirectUrlElement = document.getElementById("redirect-url");
const previewPanelElement = document.getElementById("preview-panel");
const previewPaneElement = document.getElementById("preview-pane");
const previewSurfaceIndicator = document.getElementById("preview-surface-indicator");
const sdkViewToggle = document.getElementById("sdk-view-toggle");
const noteEditorOpenButton = document.getElementById("note-editor-open");
const listProjectsButton = document.getElementById("list-projects-btn");
const createProjectButton = document.getElementById("create-project-btn");
const consoleOutput = document.getElementById("console-output");

function setNoteEditorButtonActive(active) {
  noteEditorOpenButton?.classList.toggle("active", active);
  noteEditorOpenButton?.setAttribute("aria-pressed", active ? "true" : "false");
}

const THEME_KEY = "jsplayground-theme";
const ACCENT_KEY = "jsplayground-accent";
// Keep existing key for editor font size so previous preferences still apply there.
const EDITOR_FONT_SIZE_KEY = "jsplayground-font-size";
const PAGE_FONT_SIZE_KEY = "jsplayground-page-font-size";

const THEME_OPTIONS = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "solarized", label: "Solarized" },
  { id: "high-contrast", label: "High contrast" },
];

const ACCENT_OPTIONS = [
  { id: "default", label: "Default" },
  { id: "muted-purple", label: "Purple" },
  { id: "indigo", label: "Indigo" },
  { id: "emerald", label: "Emerald" },
];

const FONT_SIZE_OPTIONS = [
  { id: "small", label: "Small", px: 12 },
  { id: "medium", label: "Medium", px: 14 },
  { id: "large", label: "Large", px: 16 },
];

function getMonacoThemeForAppTheme(themeId) {
  if (themeId === "light" || themeId === "solarized") return "soft-slate-light";
  return "soft-slate";
}

function applyTheme(themeId) {
  const html = document.documentElement;
  html.classList.remove("theme-light", "theme-dark", "theme-solarized", "theme-high-contrast");
  const themeClass =
    themeId === "solarized"
      ? "theme-solarized"
      : themeId === "high-contrast"
        ? "theme-high-contrast"
        : themeId === "dark"
          ? "theme-dark"
          : "theme-light";
  html.classList.add(themeClass);
  try {
    localStorage.setItem(THEME_KEY, themeId);
  } catch (_) {}
  try {
    if (typeof monaco !== "undefined" && monaco.editor) {
      monaco.editor.setTheme(getMonacoThemeForAppTheme(themeId));
    }
  } catch (_) {}
}

function applyAccent(accentId) {
  const html = document.documentElement;
  html.classList.remove("accent-muted-purple", "accent-indigo", "accent-emerald");
  if (accentId === "muted-purple") html.classList.add("accent-muted-purple");
  else if (accentId === "indigo") html.classList.add("accent-indigo");
  else if (accentId === "emerald") html.classList.add("accent-emerald");
  try {
    localStorage.setItem(ACCENT_KEY, accentId);
  } catch (_) {}
}

function applyPageFontSize(sizeId) {
  const html = document.documentElement;
  html.classList.remove("font-size-small", "font-size-medium", "font-size-large");
  const opt = FONT_SIZE_OPTIONS.find((o) => o.id === sizeId) || FONT_SIZE_OPTIONS[1];
  html.classList.add(`font-size-${opt.id}`);
  try {
    localStorage.setItem(PAGE_FONT_SIZE_KEY, opt.id);
  } catch (_) {}
}

function initTheme() {
  try {
    const savedTheme = localStorage.getItem(THEME_KEY);
    const validThemes = THEME_OPTIONS.map((o) => o.id);
    if (savedTheme && validThemes.includes(savedTheme)) {
      applyTheme(savedTheme);
    } else {
      applyTheme("light");
    }
    const savedAccent = localStorage.getItem(ACCENT_KEY);
    const validAccents = ACCENT_OPTIONS.map((o) => o.id);
    if (savedAccent && validAccents.includes(savedAccent)) {
      applyAccent(savedAccent);
    }
    const savedPageFontSize = localStorage.getItem(PAGE_FONT_SIZE_KEY);
    const validSizes = FONT_SIZE_OPTIONS.map((o) => o.id);
    if (savedPageFontSize && validSizes.includes(savedPageFontSize)) {
      applyPageFontSize(savedPageFontSize);
    } else {
      applyPageFontSize("medium");
    }
    return;
  } catch (_) {}
  applyTheme("light");
  applyPageFontSize("medium");
}

initTheme();

function initAppearanceDropdown() {
  const appearanceBtn = document.getElementById("appearance-btn");
  const dropdown = document.getElementById("appearance-dropdown");
  if (!appearanceBtn || !dropdown) return;

  // Core handler for all appearance choices.
  function applyAppearance(kind, value) {
    if (kind === "theme") {
      applyTheme(value);
    } else if (kind === "accent") {
      applyAccent(value);
    } else if (kind === "editor-font-size") {
      applyEditorFontSize(value);
    } else if (kind === "ui-font-size") {
      applyPageFontSize(value);
    }
  }

  appearanceBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.hidden = !dropdown.hidden;
    const isOpen = !dropdown.hidden;
    appearanceBtn.setAttribute("aria-expanded", String(isOpen));
  });

  // Handle clicks on any `.appearance-option` using data attributes, and update active state.
  dropdown.addEventListener("click", (e) => {
    const btn = e.target.closest(".appearance-option");
    if (!btn) return;
    const kind = btn.getAttribute("data-appearance");
    const value = btn.getAttribute("data-value");
    if (!kind || !value) return;
    applyAppearance(kind, value);

    // Update active state indicator for the group.
    const groupButtons = dropdown.querySelectorAll(
      `.appearance-option[data-appearance="${kind}"]`,
    );
    groupButtons.forEach((el) => {
      el.classList.toggle("active", el === btn);
    });
  });

  document.addEventListener("click", (e) => {
    if (dropdown.hidden) return;
    if (!dropdown.contains(e.target) && !appearanceBtn.contains(e.target)) {
      dropdown.hidden = true;
      appearanceBtn.setAttribute("aria-expanded", "false");
    }
  });
}

initAppearanceDropdown();

const sessionProjectMeta = document.getElementById("session-project-meta");
const sessionEntitySummary = document.getElementById("session-entity-summary");
const sessionEntityCounts = document.getElementById("session-entity-counts");
const sessionAliasSummary = document.getElementById("session-alias-summary");
const sessionLastApply = document.getElementById("session-last-apply");
const sessionActivityLog = document.getElementById("session-activity-log");

packageInput.value = defaultPackages;

let loginStatus = null;
let audiotoolClient = null;
let activeDocument = null;
let activeProject = "";
let activeProjectStudioUrl = "";
let isConnectingProject = false;
let isInitializingAuth = false;
let audiotoolQueue = Promise.resolve();
let sessionSubscriptions = [];
let sessionEntityCountsState = new Map();
let sessionAliasState = new Map();
let sessionActivity = [];
let sessionMeta = null;
let lastApplySummary = "No apply requests yet.";
/** Tracks the current preview run so iframe `audiotool.apply` can record ops. */
let previewRunCapture = null;
/** `live` = HTML/CSS/JS iframe; `sdk` = Tone Matrix / simulation panel. */
let previewSurfaceMode = "live";
let livePreviewDebounceTimer = null;
const LIVE_PREVIEW_DEBOUNCE_MS = 380;

monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);
monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
  allowNonTsExtensions: true,
  target: monaco.languages.typescript.ScriptTarget.ES2020,
  moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
  module: monaco.languages.typescript.ModuleKind.ESNext,
});

// Define a custom Monaco theme matching the Soft Slate palette and use it for the editor.
monaco.editor.defineTheme("soft-slate", {
  base: "vs-dark",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#0f1724",
    "editor.foreground": "#E6EEF8",
    "editorLineNumber.foreground": "#93a5cf",
    "editorLineNumber.activeForeground": "#E6EEF8",
    "editorCursor.foreground": "#38B2AC",
    "editor.selectionBackground": "#143836",
    "editor.inactiveSelectionBackground": "#0f2a28",
    "editorIndentGuide.background": "#0f2230",
    "editorLineHighlightBackground": "#0f2230",
  },
});

// Light variant tuned to match the Soft Light palette (used for 'light' theme)
monaco.editor.defineTheme("soft-slate-light", {
  base: "vs",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#fffdf9",
    "editor.foreground": "#2b2b25",
    "editorLineNumber.foreground": "#7c8b9a",
    "editorLineNumber.activeForeground": "#2b2b25",
    "editorCursor.foreground": "#7c3aed",
    "editor.selectionBackground": "#efe7ff",
    "editor.inactiveSelectionBackground": "#f7f4ef",
    "editorIndentGuide.background": "#efe6d6",
    "editorLineHighlightBackground": "#fff6ec",
  },
});

const initialThemeId =
  (document.documentElement.classList.contains("theme-light") || document.documentElement.classList.contains("theme-solarized"))
    ? "soft-slate-light"
    : "soft-slate";
const initialEditorTheme = initialThemeId;

const initialFontSize =
  (FONT_SIZE_OPTIONS.find((o) => o.id === (localStorage.getItem(EDITOR_FONT_SIZE_KEY) || "medium")) || FONT_SIZE_OPTIONS[1]).px;

const editorBaseOptions = {
  theme: initialEditorTheme,
  minimap: { enabled: false },
  automaticLayout: true,
  fontSize: initialFontSize,
  tabSize: 2,
};

if (!editorHtmlElement || !editorCssElement || !editorJsElement) {
  throw new Error(
    "JS Playground: missing editor panels. Expected #editor-html, #editor-css, #editor-js (or a legacy #editor container).",
  );
}

const editorHtml = monaco.editor.create(editorHtmlElement, {
  ...editorBaseOptions,
  value: defaultHtml,
  language: "html",
});

const editorCss = monaco.editor.create(editorCssElement, {
  ...editorBaseOptions,
  value: defaultCss,
  language: "css",
});

const editorJs = monaco.editor.create(editorJsElement, {
  ...editorBaseOptions,
  value: defaultSource,
  language: "javascript",
});

// Expose JS editor for samples and ad-hoc debugging.
try {
  window.editor = editorJs;
} catch (_) {}

function initEditorTabs() {
  // Only HTML / CSS / JS tabs (inside the tablist). Do not match SDK / Note editor toolbar buttons.
  const tabButtons = document.querySelectorAll(".editor-tab-buttons .editor-tab[data-editor-tab]");
  const panels = {
    html: editorHtmlElement,
    css: editorCssElement,
    js: editorJsElement,
  };
  const editors = { html: editorHtml, css: editorCss, js: editorJs };
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.editorTab;
      if (!name || !panels[name]) return;
      tabButtons.forEach((b) => {
        const active = b === btn;
        b.classList.toggle("active", active);
        b.setAttribute("aria-selected", String(active));
      });
      Object.entries(panels).forEach(([k, el]) => {
        const active = k === name;
        el.hidden = !active;
        el.classList.toggle("active", active);
        if (active) editors[k].layout();
      });
    });
  });
}

initEditorTabs();

requestAnimationFrame(() => {
  for (const ed of [editorHtml, editorCss, editorJs]) {
    ed.layout();
  }
});

setPreviewSurfaceMode("live");

for (const ed of [editorHtml, editorCss, editorJs]) {
  ed.onDidChangeModelContent(() => {
    scheduleLivePreviewRefresh();
  });
}

sdkViewToggle?.addEventListener("click", () => {
  setNoteEditorButtonActive(false);
  const isSdk = sdkViewToggle.getAttribute("aria-pressed") === "true";
  setPreviewSurfaceMode(isSdk ? "live" : "sdk");
});

function applyEditorFontSize(sizeId) {
  const opt = FONT_SIZE_OPTIONS.find((o) => o.id === sizeId) || FONT_SIZE_OPTIONS[1];
  try {
    localStorage.setItem(EDITOR_FONT_SIZE_KEY, opt.id);
  } catch (_) {}
  try {
    if (typeof monaco !== "undefined" && monaco.editor) {
      for (const ed of [editorHtml, editorCss, editorJs]) {
        ed.updateOptions({ fontSize: opt.px });
      }
    }
  } catch (_) {}
}

// Appearance controls (removed) — keep editor themes defined above but do not wire runtime controls.

function appendConsoleLine(level, message) {
  const line = `[${level}] ${message}`;
  consoleOutput.textContent = `${consoleOutput.textContent}${line}\n`;
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

function clearConsole() {
  consoleOutput.textContent = "";
}

// ---- Samples modal and actions ----
const SAMPLE_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "html", label: "HTML" },
  { id: "css", label: "CSS" },
  { id: "javascript", label: "JavaScript" },
  { id: "sdk", label: "SDK" },
];

function getSampleJsPayload(s) {
  return s.js !== undefined ? s.js : s.code;
}

function sampleHasLoadableContent(s) {
  return (
    s.html !== undefined ||
    s.css !== undefined ||
    getSampleJsPayload(s) !== undefined
  );
}

function applySampleToEditors(s) {
  if (s.html !== undefined) editorHtml.setValue(s.html);
  if (s.css !== undefined) editorCss.setValue(s.css);
  const j = getSampleJsPayload(s);
  if (j !== undefined) editorJs.setValue(j);
}

function sampleRunsViaAudiotoolOnly(s) {
  const j = getSampleJsPayload(s);
  const hasJs = j !== undefined && String(j).trim() !== "";
  return !hasJs && (s.ops || s.opsGenerator);
}

const samples = [
  {
    id: "sample-html-hello",
    category: "html",
    title: "Hello section",
    description: "A simple section with a heading and paragraph.",
    html: `<section class="demo-block">\n  <h2>Hello</h2>\n  <p>Edit HTML and click Run to refresh the live preview.</p>\n</section>\n`,
  },
  {
    id: "sample-css-accent",
    category: "css",
    title: "Accent heading",
    description: "Style the demo heading in the live preview.",
    css: `.demo-block h2 {\n  color: #38bdf8;\n  margin-top: 0;\n}\n`,
  },
  {
    id: "sample-js-log",
    category: "javascript",
    title: "Console message",
    description: "Log a message from the sandboxed preview (see Console below).",
    js: `console.log("Hello from the playground preview");\n`,
  },
  {
    id: "ensure-tonematrix",
    category: "sdk",
    title: "Create Tone Matrix",
    description: "Creates a ToneMatrix (alias: tm) and sets a default position.",
    ops: [
      { op: "ensureEntity", entityType: "tonematrix", alias: "tm" },
      { op: "updateField", entityAlias: "tm", field: "positionX", value: 900 },
      { op: "updateField", entityAlias: "tm", field: "positionY", value: 600 },
    ],
    code: `// Create Tone Matrix\nawait window.audiotool.apply({\n  ops: [\n    { op: \"ensureEntity\", entityType: \"tonematrix\", alias: \"tm\" },\n    { op: \"updateField\", entityAlias: \"tm\", field: \"positionX\", value: 900 },\n    { op: \"updateField\", entityAlias: \"tm\", field: \"positionY\", value: 600 },\n  ],\n});\n`,
  },
  {
    id: "add-synth",
    category: "sdk",
    title: "Add Device",
    description: "Adds a synth device (alias: synth1) and sets a preset + position.",
    ops: [
      { op: "ensureEntity", entityType: "synth", alias: "synth1" },
      { op: "updateField", entityAlias: "synth1", field: "preset", value: "default-saw" },
      { op: "updateField", entityAlias: "synth1", field: "positionX", value: 1200 },
      { op: "updateField", entityAlias: "synth1", field: "positionY", value: 420 },
    ],
    code: `// Synth sample: synth1\nawait window.audiotool.apply({ ops: [\n  { op: 'ensureEntity', entityType: 'synth', alias: 'synth1' },\n  { op: 'updateField', entityAlias: 'synth1', field: 'preset', value: 'default-saw' },\n] });\n`,
  },
  {
    id: "connect-parameter-slider",
    category: "sdk",
    title: "Connect Parameter to Slider",
    description:
      "Updates a numeric parameter, then adjust it in the Preview panel via a slider.",
    ops: [
      { op: "ensureEntity", entityType: "tonematrix", alias: "tm" },
      { op: "updateField", entityAlias: "tm", field: "positionX", value: 600 },
    ],
    code: `// Connect Parameter to Slider (Preview)\n// Run once. Then use the slider in Preview: tm.positionX\nawait window.audiotool.apply({\n  ops: [\n    { op: \"ensureEntity\", entityType: \"tonematrix\", alias: \"tm\" },\n    { op: \"updateField\", entityAlias: \"tm\", field: \"positionX\", value: 600 },\n  ],\n});\n`,
  },
  {
    id: "add-drum-machine",
    category: "sdk",
    title: "Add Drum Machine",
    description: "Create a drum machine (alias: drum1) and set a drum kit/pattern.",
    ops: [
      { op: "ensureEntity", entityType: "drumMachine", alias: "drum1" },
      { op: "updateField", entityAlias: "drum1", field: "kit", value: "acoustic-kit" },
      { op: "updateField", entityAlias: "drum1", field: "positionX", value: 600 },
      { op: "updateField", entityAlias: "drum1", field: "positionY", value: 480 },
    ],
    code: `// Add Drum Machine\nawait window.audiotool.apply({\n  ops: [\n    { op: "ensureEntity", entityType: "drumMachine", alias: "drum1" },\n    { op: "updateField", entityAlias: "drum1", field: "kit", value: "acoustic-kit" },\n    { op: "updateField", entityAlias: "drum1", field: "positionX", value: 600 },\n    { op: "updateField", entityAlias: "drum1", field: "positionY", value: 480 },\n  ],\n});\n`,
  },
  {
    id: "add-bass",
    category: "sdk",
    title: "Add Bass",
    description: "Create a bass instrument (alias: bass1) with a deep preset and place it.",
    ops: [
      { op: "ensureEntity", entityType: "bass", alias: "bass1" },
      { op: "updateField", entityAlias: "bass1", field: "preset", value: "deep-sub" },
      { op: "updateField", entityAlias: "bass1", field: "positionX", value: 1000 },
      { op: "updateField", entityAlias: "bass1", field: "positionY", value: 500 },
    ],
    code: `// Add Bass\nawait window.audiotool.apply({\n  ops: [\n    { op: "ensureEntity", entityType: "bass", alias: "bass1" },\n    { op: "updateField", entityAlias: "bass1", field: "preset", value: "deep-sub" },\n    { op: "updateField", entityAlias: "bass1", field: "positionX", value: 1000 },\n    { op: "updateField", entityAlias: "bass1", field: "positionY", value: 500 },\n  ],\n});\n`,
  },
  {
    id: "populate-tonematrix-pattern",
    category: "sdk",
    title: "Populate ToneMatrix Pattern",
    description: "Write a simple repeating pattern into the tonematrix (creates it if missing).",
    opsGenerator: () => {
      const pattern = Array.from({ length: 16 }, (_, i) => (i % 4 === 0 ? 1 : 0));
      return [
        { op: "ensureEntity", entityType: "tonematrix", alias: "tm" },
        { op: "updateField", entityAlias: "tm", field: "pattern", value: pattern },
      ];
    },
  },
  {
    id: "create-band",
    category: "sdk",
    title: "Create Mini Band",
    description: "Create a small band: synth, bass and drum machine positioned across the studio.",
    ops: [
      { op: "ensureEntity", entityType: "synth", alias: "synth_band" },
      { op: "updateField", entityAlias: "synth_band", field: "preset", value: "pad-choir" },
      { op: "updateField", entityAlias: "synth_band", field: "positionX", value: 800 },
      { op: "ensureEntity", entityType: "bass", alias: "bass_band" },
      { op: "updateField", entityAlias: "bass_band", field: "preset", value: "sub-deep" },
      { op: "updateField", entityAlias: "bass_band", field: "positionX", value: 1000 },
      { op: "ensureEntity", entityType: "drumMachine", alias: "drum_band" },
      { op: "updateField", entityAlias: "drum_band", field: "kit", value: "electro-kit" },
      { op: "updateField", entityAlias: "drum_band", field: "positionX", value: 600 },
    ],
    code: `// Mini-band sample: synth_band, bass_band, drum_band\nawait window.audiotool.apply({ ops: [\n  { op: 'ensureEntity', entityType: 'synth', alias: 'synth_band' },\n  { op: 'updateField', entityAlias: 'synth_band', field: 'preset', value: 'pad-choir' },\n  { op: 'ensureEntity', entityType: 'bass', alias: 'bass_band' },\n  { op: 'updateField', entityAlias: 'bass_band', field: 'preset', value: 'sub-deep' },\n  { op: 'ensureEntity', entityType: 'drumMachine', alias: 'drum_band' },\n  { op: 'updateField', entityAlias: 'drum_band', field: 'kit', value: 'electro-kit' },\n] });\n`,
  },
];

/** Loaded only via the "Note editor" toolbar button (not listed under Samples). */
const NOTE_EDITOR_SAMPLE = {
  html: noteEditorSampleHtml,
  css: noteEditorSampleCss,
  js: noteEditorSampleJs,
};

function loadNoteEditorSample() {
  try {
    applySampleToEditors(NOTE_EDITOR_SAMPLE);
    setNoteEditorButtonActive(true);
    sdkViewToggle?.classList.remove("active");
    sdkViewToggle?.setAttribute("aria-pressed", "false");
    setPreviewSurfaceMode("live");
    scheduleLivePreviewRefresh();
    appendConsoleLine("info", "Loaded note editor into editors.");
  } catch (err) {
    appendConsoleLine("error", `Failed to load note editor: ${err?.message || err}`);
  }
}

document.body.addEventListener("click", (e) => {
  const open = e.target && e.target.closest && e.target.closest("#note-editor-open");
  if (!open) return;
  e.preventDefault();
  loadNoteEditorSample();
});

function openSamplesModal() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.tabIndex = -1;

  const modal = document.createElement("div");
  modal.className = "modal modal-samples";

  const title = document.createElement("h3");
  title.textContent = "Samples";
  modal.appendChild(title);

  const subtitle = document.createElement("p");
  subtitle.className = "subtle samples-modal-subtitle";
  subtitle.textContent =
    "Browse by category. SDK samples target Audiotool / simulation; HTML, CSS, and JavaScript update the live preview.";
  modal.appendChild(subtitle);

  let categoryFilter = "all";

  const categoryBar = document.createElement("div");
  categoryBar.className = "samples-category-bar";
  categoryBar.setAttribute("role", "tablist");
  categoryBar.setAttribute("aria-label", "Sample categories");

  const categoryButtons = [];

  function setActiveCategoryButton() {
    for (const { btn, id } of categoryButtons) {
      const active = id === categoryFilter;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    }
  }

  for (const cat of SAMPLE_CATEGORIES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "samples-category-btn";
    btn.textContent = cat.label;
    btn.dataset.category = cat.id;
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", categoryFilter === cat.id ? "true" : "false");
    if (categoryFilter === cat.id) btn.classList.add("active");
    btn.addEventListener("click", () => {
      categoryFilter = cat.id;
      setActiveCategoryButton();
      renderSampleRows();
    });
    categoryBar.appendChild(btn);
    categoryButtons.push({ btn, id: cat.id });
  }
  modal.appendChild(categoryBar);

  const list = document.createElement("ul");
  list.className = "project-list samples-modal-list";

  function categoryLabelFor(sample) {
    return SAMPLE_CATEGORIES.find((c) => c.id === sample.category)?.label ?? sample.category ?? "—";
  }

  function renderSampleRows() {
    list.innerHTML = "";
    const filtered =
      categoryFilter === "all"
        ? samples
        : samples.filter((s) => s.category === categoryFilter);

    if (!filtered.length) {
      const li = document.createElement("li");
      li.className = "project-list-empty-match";
      li.textContent = "No samples in this category.";
      list.appendChild(li);
      return;
    }

    for (const s of filtered) {
      const li = document.createElement("li");
      const meta = document.createElement("div");
      meta.className = "meta";

      const titleRow = document.createElement("div");
      titleRow.className = "samples-title-row";
      const t = document.createElement("div");
      t.className = "title";
      t.textContent = s.title;
      titleRow.appendChild(t);
      if (categoryFilter === "all") {
        const pill = document.createElement("span");
        pill.className = "samples-cat-pill";
        pill.textContent = categoryLabelFor(s);
        titleRow.appendChild(pill);
      }
      meta.appendChild(titleRow);

      const d = document.createElement("div");
      d.className = "subtle";
      d.textContent = s.description;
      meta.appendChild(d);

      const actions = document.createElement("div");

      if (sampleHasLoadableContent(s)) {
        const loadBtn = document.createElement("button");
        loadBtn.textContent = "Load";
        loadBtn.className = "btn";
        loadBtn.addEventListener("click", () => {
          try {
            applySampleToEditors(s);
            appendConsoleLine("info", `Loaded sample into editor(s): ${s.title}`);
          } catch (err) {
            appendConsoleLine("error", `Failed to load sample: ${err?.message || err}`);
          }
        });
        actions.appendChild(loadBtn);
      }

      const applyBtn = document.createElement("button");
      applyBtn.textContent = "Run";
      applyBtn.className = "btn-primary";
      applyBtn.addEventListener("click", async () => {
        try {
          appendConsoleLine("info", `Running sample: ${s.title}`);
          applySampleToEditors(s);
          if (sampleRunsViaAudiotoolOnly(s)) {
            const ops = s.opsGenerator ? s.opsGenerator() : s.ops;
            await window.audiotool.apply({ ops });
            if (s.category === "sdk") {
              setPreviewSurfaceMode("sdk");
            }
          } else {
            await runCode({ endSurface: s.category === "sdk" ? "sdk" : "live" });
          }
          appendConsoleLine("ok", `Sample ran: ${s.title}`);
          pushSessionActivity("info", `Ran sample: ${s.title}`);
          document.body.removeChild(overlay);
        } catch (err) {
          appendConsoleLine("error", `Failed to run sample: ${err?.message || err}`);
        }
      });
      actions.appendChild(applyBtn);

      li.appendChild(meta);
      li.appendChild(actions);
      list.appendChild(li);
    }
  }

  renderSampleRows();
  modal.appendChild(list);

  const closeRow = document.createElement("div");
  closeRow.className = "modal-actions";
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close";
  closeBtn.addEventListener("click", () => {
    document.body.removeChild(overlay);
  });
  closeRow.appendChild(closeBtn);
  modal.appendChild(closeRow);

  overlay.appendChild(modal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) document.body.removeChild(overlay);
  });

  document.body.appendChild(overlay);
  modal.focus && modal.focus();
}

if (samplesButton) {
  samplesButton.addEventListener("click", () => openSamplesModal());
}

function parsePackageSpec(spec) {
  const trimmed = spec.trim();

  if (!trimmed) {
    return null;
  }

  if (!trimmed.includes("@")) {
    return { name: trimmed, version: "" };
  }

  if (trimmed.startsWith("@")) {
    const slashIndex = trimmed.indexOf("/");
    const versionIndex = trimmed.indexOf("@", slashIndex + 1);

    if (slashIndex === -1 || versionIndex === -1) {
      return { name: trimmed, version: "" };
    }

    return {
      name: trimmed.slice(0, versionIndex),
      version: trimmed.slice(versionIndex + 1),
    };
  }

  const versionIndex = trimmed.indexOf("@");
  return {
    name: trimmed.slice(0, versionIndex),
    version: trimmed.slice(versionIndex + 1),
  };
}

function parsePackageInput(inputValue) {
  return inputValue
    .split(",")
    .map((entry) => parsePackageSpec(entry))
    .filter((entry) => entry && entry.name);
}

function buildImportMap(packageList) {
  const imports = {};

  for (const pkg of packageList) {
    const packageId = pkg.version ? `${pkg.name}@${pkg.version}` : pkg.name;
    const url = `https://esm.sh/${packageId}`;
    imports[pkg.name] = url;
    imports[`${pkg.name}/`] = `${url}/`;
  }

  return { imports };
}

function toDisplayString(value) {
  if (value instanceof Error) {
    return value.stack || value.message;
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Escape `<` in CSS so it cannot break out of a `<style>` block. */
function escapeCssForStyleElement(css) {
  return String(css).replace(/</g, "\\3c ");
}

/** Escape `</script>` sequences in user JS when embedding a script tag. */
function escapeClosingScriptTag(js) {
  return String(js).replace(/<\/script>/gi, "<\\/script>");
}

function formatClockTime(date = new Date()) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function resolveImportSpecifier(specifier, importMap) {
  if (!importMap || !importMap.imports) return specifier;
  const imports = importMap.imports;
  if (imports[specifier]) return imports[specifier];
  const prefixes = Object.keys(imports).filter((k) => k.endsWith("/") && specifier.startsWith(k));
  prefixes.sort((a, b) => b.length - a.length);
  const match = prefixes[0];
  if (match) {
    return `${imports[match]}${specifier.slice(match.length)}`;
  }
  return specifier;
}

function rewriteImportsToUrls(sourceCode, importMap) {
  const rewriters = [
    [/(\bfrom\s+)(["'])([^"']+)\2/g, (_m, prefix, q, spec) => `${prefix}${q}${resolveImportSpecifier(spec, importMap)}${q}`],
    [/(\bimport\s*\(\s*)(["'])([^"']+)\2(\s*\))/g, (_m, prefix, q, spec, suffix) => `${prefix}${q}${resolveImportSpecifier(spec, importMap)}${q}${suffix}`],
    [/(\bexport\s+[^;]*?\bfrom\s+)(["'])([^"']+)\2/g, (_m, prefix, q, spec) => `${prefix}${q}${resolveImportSpecifier(spec, importMap)}${q}`],
  ];

  let out = sourceCode;
  for (const [re, fn] of rewriters) {
    out = out.replace(re, fn);
  }
  return out;
}

function buildPreviewSrcdoc({ html, css, js, importMap }) {
  const safeCss = escapeCssForStyleElement(css);
  const rewrittenJs = rewriteImportsToUrls(js, importMap);
  const safeJs = escapeClosingScriptTag(rewrittenJs);
  const importMapJson = JSON.stringify(importMap).replace(/</g, "\\u003c");
  const bridge = `(function(){var send=function(level,args){try{var s=args.map(function(a){if(a instanceof Error)return a.stack||a.message;try{return typeof a==="object"?JSON.stringify(a):String(a)}catch(e){return String(a)}});parent.postMessage({type:"playground-console",level:level,args:s},"*")}catch(e){}};["log","info","warn","error","debug"].forEach(function(m){var k=m==="debug"?"log":m;var orig=console[m];console[m]=function(){var args=Array.prototype.slice.call(arguments);send(k,args);return orig.apply(console,arguments)}});window.onerror=function(msg,src,line,col,err){parent.postMessage({type:"playground-error",message:String(msg),stack:err&&err.stack},"*");return false};window.addEventListener("unhandledrejection",function(e){var r=e.reason;parent.postMessage({type:"playground-error",message:String(r&&r.message||r),stack:r&&r.stack},"*")});window.audiotool={apply:function(payload){return new Promise(function(resolve,reject){var id="at_"+Math.random().toString(36).slice(2);function onMsg(e){if(!e.data||e.data.type!=="audiotool-result"||e.data.id!==id)return;window.removeEventListener("message",onMsg);if(e.data.error)reject(new Error(e.data.error));else resolve(e.data.result)}window.addEventListener("message",onMsg);parent.postMessage({type:"audiotool-apply",id:id,payload:payload},"*")})}}})();`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script type="importmap">${importMapJson}</script>
<style>${safeCss}</style>
</head>
<body>
<script>${bridge}</script>
${html}
<script type="module">${safeJs}</script>
</body>
</html>`;
}

function setPreviewSurfaceMode(mode) {
  previewSurfaceMode = mode;
  previewPaneElement?.classList.toggle("preview-pane--live", mode === "live");
  previewPaneElement?.classList.toggle("preview-pane--sdk", mode === "sdk");
  if (previewPaneElement) previewPaneElement.dataset.previewSurface = mode;
  sdkViewToggle?.setAttribute("aria-pressed", mode === "sdk" ? "true" : "false");
  sdkViewToggle?.classList.toggle("active", mode === "sdk");
  if (previewSurfaceIndicator) {
    previewSurfaceIndicator.textContent =
      mode === "sdk"
        ? "SDK simulation · Tone Matrix & apply output"
        : "Live preview · HTML, CSS, and JavaScript";
  }
}

function applyLivePreviewOnly() {
  const packageList = parsePackageInput(packageInput.value);
  const importMap = buildImportMap(packageList);
  const html = editorHtml.getValue();
  const css = editorCss.getValue();
  const sourceCode = editorJs.getValue();
  const capturedOps = [];
  previewRunCapture = { capturedOps };
  try {
    const srcdoc = buildPreviewSrcdoc({ html, css, js: sourceCode, importMap });
    if (previewFrameElement) {
      previewFrameElement.srcdoc = srcdoc;
      previewFrameElement.onload = null;
    }
  } catch {
    /* invalid while typing */
  }
}

function scheduleLivePreviewRefresh() {
  setPreviewSurfaceMode("live");
  clearTimeout(livePreviewDebounceTimer);
  livePreviewDebounceTimer = setTimeout(() => {
    livePreviewDebounceTimer = null;
    applyLivePreviewOnly();
  }, LIVE_PREVIEW_DEBOUNCE_MS);
}

function addSessionSubscription(terminable) {
  sessionSubscriptions.push(terminable);
}

function clearSessionSubscriptions() {
  for (const subscription of sessionSubscriptions) {
    try {
      subscription?.terminate?.();
    } catch {
      // Ignore subscription cleanup failures.
    }
  }
  sessionSubscriptions = [];
}

function setSessionModeLabel(message) {
  if (previewModeLabel) {
    previewModeLabel.textContent = `Session mode: ${message}`;
  }
}

function pushSessionActivity(level, message, detail = "") {
  sessionActivity.unshift({
    at: formatClockTime(),
    level,
    message,
    detail,
  });
  if (sessionActivity.length > 120) {
    sessionActivity = sessionActivity.slice(0, 120);
  }
  renderSessionDashboard();
}

function updateSessionEntityCount(entityType, delta) {
  const current = sessionEntityCountsState.get(entityType) || 0;
  const next = Math.max(0, current + delta);
  if (next === 0) {
    sessionEntityCountsState.delete(entityType);
    return;
  }
  sessionEntityCountsState.set(entityType, next);
}

function upsertSessionAlias(alias, entityType, entityId) {
  sessionAliasState.set(alias, {
    alias,
    entityType,
    entityId,
    updatedAt: formatClockTime(),
  });
}

function pruneAliasesByEntityIds(entityIds) {
  const activeEntityIds = new Set(entityIds);
  for (const [alias, value] of sessionAliasState.entries()) {
    if (!activeEntityIds.has(value.entityId)) {
      sessionAliasState.delete(alias);
    }
  }
}

function removeAliasesByEntityId(entityId) {
  for (const [alias, value] of sessionAliasState.entries()) {
    if (value.entityId === entityId) {
      sessionAliasState.delete(alias);
    }
  }
}

function renderSessionMetaList() {
  if (!sessionProjectMeta) {
    return;
  }

  const statusLabel =
    activeDocument && activeProject ? "connected" : "not connected";

  const values = sessionMeta
    ? [
        ["Project", sessionMeta.displayName || sessionMeta.projectId || "(unknown)"],
        ["Project ID", sessionMeta.projectId || "(unknown)"],
        ["Creator", sessionMeta.creatorName || "(unknown)"],
        ["Status", statusLabel],
        ["Studio URL", sessionMeta.studioUrl || activeProjectStudioUrl || "(none)"],
      ]
    : [
        ["Project", "(not connected)"],
        ["Project ID", "-"],
        ["Creator", "-"],
        ["Status", statusLabel],
        ["Studio URL", "-"],
      ];

  sessionProjectMeta.innerHTML = values
    .map(
      ([key, value]) =>
        `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`,
    )
    .join("");
}

function renderEntitySummaryList() {
  if (!sessionEntitySummary || !sessionEntityCounts) {
    return;
  }

  const total = Array.from(sessionEntityCountsState.values()).reduce(
    (sum, value) => sum + value,
    0,
  );
  sessionEntitySummary.textContent = `Total tracked entities: ${total.toLocaleString()}`;

  const sorted = Array.from(sessionEntityCountsState.entries()).sort(
    (a, b) => b[1] - a[1],
  );
  if (!sorted.length) {
    sessionEntityCounts.innerHTML = "<li>No entities tracked yet.</li>";
    return;
  }

  sessionEntityCounts.innerHTML = sorted
    .slice(0, 20)
    .map(
      ([entityType, count]) =>
        `<li><strong>${escapeHtml(entityType)}</strong>: ${count.toLocaleString()}</li>`,
    )
    .join("");
}

function renderAliasSummaryList() {
  if (!sessionAliasSummary) {
    return;
  }

  const aliases = Array.from(sessionAliasState.values()).sort((a, b) =>
    a.alias.localeCompare(b.alias),
  );
  if (!aliases.length) {
    sessionAliasSummary.innerHTML = "<li>No aliases captured yet.</li>";
    return;
  }

  sessionAliasSummary.innerHTML = aliases
    .map(
      (entry) =>
        `<li><strong>${escapeHtml(entry.alias)}</strong> → ${escapeHtml(entry.entityType)} <span class="subtle">(${escapeHtml(entry.entityId)})</span></li>`,
    )
    .join("");
}

function renderSessionActivityList() {
  if (!sessionActivityLog) {
    return;
  }

  if (!sessionActivity.length) {
    sessionActivityLog.innerHTML = "<li>No activity yet.</li>";
    return;
  }

  sessionActivityLog.innerHTML = sessionActivity
    .map(
      (item) =>
        `<li><strong>${escapeHtml(item.at)}</strong> [${escapeHtml(item.level)}] ${escapeHtml(item.message)}${item.detail ? `<div class="subtle">${escapeHtml(item.detail)}</div>` : ""}</li>`,
    )
    .join("");
}

function renderLastApplySummary() {
  if (!sessionLastApply) {
    return;
  }
  sessionLastApply.textContent = lastApplySummary;
}

function renderSessionDashboard() {
  // While a SyncedDocument is active, keep the preview label in sync on every render.
  if (activeDocument && activeProject) {
    setSessionModeLabel(
      "sandbox runtime active; use Open Project Tab for Studio visuals.",
    );
  }
  renderSessionMetaList();
  renderEntitySummaryList();
  renderAliasSummaryList();
  renderLastApplySummary();
  renderSessionActivityList();
}

function resetSessionDashboard(message = "waiting for project connection") {
  sessionMeta = null;
  sessionEntityCountsState = new Map();
  sessionAliasState = new Map();
  sessionActivity = [];
  lastApplySummary = "No apply requests yet.";
  setSessionModeLabel(message);
  renderSessionDashboard();
}

async function refreshSessionEntitySummary() {
  if (!activeDocument) {
    sessionEntityCountsState = new Map();
    renderSessionDashboard();
    return;
  }

  const entities = activeDocument.queryEntities.get();
  const counts = new Map();
  for (const entity of entities) {
    counts.set(entity.entityType, (counts.get(entity.entityType) || 0) + 1);
  }
  sessionEntityCountsState = counts;
  pruneAliasesByEntityIds(entities.map((entity) => entity.id));
  renderSessionDashboard();
}

async function refreshSessionMetadata() {
  if (!activeProjectStudioUrl) {
    sessionMeta = null;
    renderSessionDashboard();
    return;
  }

  try {
    const metadata = await loadProjectPreviewMetadata(activeProjectStudioUrl);
    sessionMeta = {
      projectId: metadata.projectId,
      displayName: metadata.displayName,
      creatorName: metadata.creatorName,
      description: metadata.description,
      imageUrl: metadata.imageUrl,
      studioUrl: activeProjectStudioUrl,
    };
  } catch (error) {
    sessionMeta = {
      projectId: activeProject || "(unknown)",
      displayName: "(metadata unavailable)",
      creatorName: "",
      description: toDisplayString(error),
      imageUrl: "",
      studioUrl: activeProjectStudioUrl,
    };
    pushSessionActivity(
      "warn",
      "Could not load project metadata.",
      toDisplayString(error),
    );
  }

  renderSessionDashboard();
}

function attachSessionDocumentSubscriptions() {
  if (!activeDocument) {
    return;
  }

  clearSessionSubscriptions();

  try {
    if (activeDocument.events?.onCreate) {
      addSessionSubscription(
        activeDocument.events.onCreate("*", (entity) => {
          updateSessionEntityCount(entity.entityType, 1);
          pushSessionActivity(
            "event",
            `Entity created: ${entity.entityType}`,
            entity.id,
          );
        }),
      );
    }
  } catch (error) {
    pushSessionActivity(
      "warn",
      "Entity create event subscription unavailable.",
      toDisplayString(error),
    );
  }

  try {
    if (activeDocument.events?.onRemove) {
      addSessionSubscription(
        activeDocument.events.onRemove("*", (entity) => {
          updateSessionEntityCount(entity.entityType, -1);
          removeAliasesByEntityId(entity.id);
          pushSessionActivity(
            "event",
            `Entity removed: ${entity.entityType}`,
            entity.id,
          );
        }),
      );
    }
  } catch (error) {
    pushSessionActivity(
      "warn",
      "Entity remove event subscription unavailable.",
      toDisplayString(error),
    );
  }
}

function setAudiotoolStatus(message, state = "warn") {
  audiotoolStatusElement.textContent = message;
  audiotoolStatusElement.dataset.state = state;
}

function getRedirectUrl() {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";

  let path = url.pathname;
  if (path.endsWith(".html")) {
    path = path.slice(0, path.lastIndexOf("/") + 1);
  }
  if (!path.endsWith("/")) {
    path = `${path}/`;
  }

  url.pathname = path;
  return url.toString();
}

function extractProjectUuid(projectValue) {
  const uuidRegex =
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;
  const directMatch = projectValue.match(uuidRegex);
  if (directMatch) {
    return directMatch[0];
  }

  try {
    const parsed = new URL(projectValue);
    const fromQuery = parsed.searchParams.get("project");
    if (!fromQuery) {
      return "";
    }
    const queryMatch = fromQuery.match(uuidRegex);
    return queryMatch ? queryMatch[0] : fromQuery;
  } catch {
    return "";
  }
}

function buildStudioUrl(origin, projectId) {
  return `${origin}/studio?project=${encodeURIComponent(projectId)}`;
}

function normalizeAudiotoolOrigin(candidateOrigin) {
  try {
    const parsed = new URL(candidateOrigin);
    if (parsed.hostname.toLowerCase() === "beta.audiotool.com") {
      return parsed.origin;
    }

    if (/audiotool\.com$/i.test(parsed.hostname)) {
      return "https://beta.audiotool.com";
    }
  } catch {
    // Ignore invalid origin.
  }

  return "https://beta.audiotool.com";
}

function resolveProjectConnection(projectValue) {
  const trimmed = projectValue.trim();
  if (!trimmed) {
    return { projectReference: "", studioUrl: "" };
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const parsed = new URL(trimmed);
      const projectId = extractProjectUuid(trimmed);
      if (projectId) {
        const origin = normalizeAudiotoolOrigin(parsed.origin);
        return {
          projectReference: projectId,
          studioUrl: buildStudioUrl(origin, projectId),
        };
      }

      return {
        projectReference: trimmed,
        studioUrl: trimmed,
      };
    } catch {
      return { projectReference: trimmed, studioUrl: trimmed };
    }
  }

  const projectUuid = extractProjectUuid(trimmed);
  if (projectUuid) {
    return {
      projectReference: projectUuid,
      studioUrl: buildStudioUrl("https://beta.audiotool.com", projectUuid),
    };
  }

  return {
    projectReference: trimmed,
    studioUrl: buildStudioUrl("https://beta.audiotool.com", trimmed),
  };
}

function resolveProjectResourceName(projectReference, studioUrl) {
  const projectUuid =
    extractProjectUuid(projectReference) || extractProjectUuid(studioUrl);
  if (!projectUuid) {
    return "";
  }
  return `projects/${projectUuid}`;
}

function normalizePreviewImageUrl(imageUrl) {
  if (!imageUrl) {
    return "";
  }

  try {
    const parsed = new URL(imageUrl);
    if (!parsed.searchParams.has("width")) {
      parsed.searchParams.set("width", "1440");
    }
    if (!parsed.searchParams.has("height")) {
      parsed.searchParams.set("height", "810");
    }
    if (!parsed.searchParams.has("fit")) {
      parsed.searchParams.set("fit", "cover");
    }
    if (!parsed.searchParams.has("format")) {
      parsed.searchParams.set("format", "webp");
    }
    return parsed.toString();
  } catch {
    return imageUrl;
  }
}

async function loadProjectPreviewMetadata(studioUrl) {
  const projectName = resolveProjectResourceName(activeProject, studioUrl);
  if (!projectName) {
    throw new Error("Could not infer a project UUID for preview metadata.");
  }

  const client = await ensureClient();
  const response = await client.api.projectService.getProject({
    name: projectName,
  });

  if (response instanceof Error) {
    throw response;
  }
  if (!response.project) {
    throw new Error("Project metadata is unavailable.");
  }

  const projectId = projectName.replace("projects/", "");
  return {
    projectId,
    displayName: response.project.displayName || projectId,
    description: response.project.description || "",
    creatorName: response.project.creatorName || "",
    imageUrl: normalizePreviewImageUrl(
      response.project.snapshotUrl || response.project.coverUrl || "",
    ),
  };
}

function updateControls() {
  const loggedIn = Boolean(loginStatus && loginStatus.loggedIn);
  authButton.disabled = isInitializingAuth;
  authButton.textContent = loggedIn ? "Logout" : "Login";

  connectButton.disabled = !loggedIn || isConnectingProject;
  disconnectButton.disabled = !activeDocument || isConnectingProject;
  openProjectButton.disabled = !activeProjectStudioUrl;
  reloadPreviewButton.disabled = !activeProjectStudioUrl;
}

function queueAudiotoolTask(task) {
  const nextTask = audiotoolQueue.then(task, task);
  audiotoolQueue = nextTask.catch(() => {});
  return nextTask;
}

async function stopActiveDocument(note = "Disconnected from project.") {
  if (!activeDocument) {
    return;
  }

  clearSessionSubscriptions();
  const previousDoc = activeDocument;
  activeDocument = null;
  const previousProject = activeProject;
  activeProject = "";
  activeProjectStudioUrl = "";
  resetSessionDashboard("project disconnected.");
  updateControls();

  try {
    await previousDoc.stop();
    setAudiotoolStatus(note, "warn");
    appendConsoleLine(
      "system",
      `Stopped Audiotool sync for project: ${previousProject || "(unknown)"}`,
    );
    pushSessionActivity(
      "system",
      "Project disconnected.",
      previousProject || "(unknown)",
    );
  } catch (error) {
    const detail = toDisplayString(error);
    setAudiotoolStatus(`Failed stopping project: ${detail}`, "error");
    appendConsoleLine("error", detail);
    pushSessionActivity("error", "Error while stopping project sync.", detail);
  }
}

async function ensureClient() {
  if (!loginStatus || !loginStatus.loggedIn) {
    throw new Error("Login required before creating an Audiotool client.");
  }

  if (audiotoolClient) {
    return audiotoolClient;
  }

  audiotoolClient = await createAudiotoolClient({
    authorization: loginStatus,
  });

  return audiotoolClient;
}

async function connectProject(project) {
  if (!project) {
    throw new Error("Project URL or UUID is required.");
  }

  const { projectReference, studioUrl } = resolveProjectConnection(project);
  if (!projectReference || !studioUrl) {
    throw new Error("Could not determine a valid project reference.");
  }

  isConnectingProject = true;
  updateControls();
  setAudiotoolStatus("Connecting to Audiotool project...", "warn");

  try {
    const client = await ensureClient();

    if (activeDocument && activeProject === projectReference) {
      setAudiotoolStatus("Project already connected.", "ok");
      return;
    }

    if (activeDocument) {
      await stopActiveDocument("Switching to another project...");
    }

    const document = await client.createSyncedDocument({
      project: projectReference,
    });
    await document.start();

    activeDocument = document;
    activeProject = projectReference;
    activeProjectStudioUrl = studioUrl;
    renderSessionDashboard();
    await refreshSessionMetadata();
    await refreshSessionEntitySummary();
    attachSessionDocumentSubscriptions();
    projectInput.value = studioUrl;
    setAudiotoolStatus(`Connected to project: ${projectReference}`, "ok");
    appendConsoleLine(
      "system",
      `Connected: ${projectReference}. Preview and apply sync here; use Open Project Tab for full Studio.`,
    );
    pushSessionActivity(
      "system",
      "Project connected.",
      `${projectReference} (${studioUrl})`,
    );
  } finally {
    isConnectingProject = false;
    updateControls();
  }
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} must be a non-empty string.`);
  }

  return value.trim();
}

function resolveEntityFromOp(t, aliases, op) {
  if (typeof op.entityAlias === "string" && op.entityAlias.trim()) {
    const entity = aliases.get(op.entityAlias.trim());
    if (!entity) {
      throw new Error(`Entity alias "${op.entityAlias}" was not defined.`);
    }
    return entity;
  }

  if (typeof op.entityType === "string" && op.entityType.trim()) {
    const entity = t.entities.ofTypes(op.entityType.trim()).getOne();
    if (!entity) {
      throw new Error(`No entity found for type "${op.entityType}".`);
    }
    return entity;
  }

  throw new Error(
    'Operation must specify "entityAlias" or "entityType" to resolve an entity.',
  );
}

function safeUpdateField(t, fieldRef, value) {
  if (typeof t.tryUpdate === "function") {
    const maybeError = t.tryUpdate(fieldRef, value);
    if (maybeError) {
      throw maybeError instanceof Error ? maybeError : new Error(String(maybeError));
    }
    return;
  }

  t.update(fieldRef, value);
}

function applyAudiotoolOperations(t, operations) {
  const aliases = new Map();
  const aliasUpdates = [];
  const removedAliases = new Set();
  const operationSummaries = [];

  for (const rawOp of operations) {
    if (!isRecord(rawOp)) {
      throw new Error("Each operation must be an object.");
    }

    const opName = asString(rawOp.op, "op");

    if (opName === "ensureEntity") {
      const entityType = asString(rawOp.entityType, "entityType");
      let entity = t.entities.ofTypes(entityType).getOne();
      const existed = Boolean(entity);

      if (!entity) {
        const createValues = isRecord(rawOp.create) ? rawOp.create : {};
        entity = t.create(entityType, createValues);
      }

      if (typeof rawOp.alias === "string" && rawOp.alias.trim()) {
        const alias = rawOp.alias.trim();
        aliases.set(alias, entity);
        aliasUpdates.push({
          alias,
          entityType: entity.entityType,
          entityId: entity.id,
        });
        operationSummaries.push(
          `ensureEntity(${entityType}) as ${alias} (${existed ? "existing" : "created"})`,
        );
      } else {
        operationSummaries.push(
          `ensureEntity(${entityType}) (${existed ? "existing" : "created"})`,
        );
      }

      continue;
    }

    if (opName === "createEntity") {
      const entityType = asString(rawOp.entityType, "entityType");
      const createValues = isRecord(rawOp.values) ? rawOp.values : {};
      const entity = t.create(entityType, createValues);

      if (typeof rawOp.alias === "string" && rawOp.alias.trim()) {
        const alias = rawOp.alias.trim();
        aliases.set(alias, entity);
        aliasUpdates.push({
          alias,
          entityType: entity.entityType,
          entityId: entity.id,
        });
        operationSummaries.push(`createEntity(${entityType}) as ${alias}`);
      } else {
        operationSummaries.push(`createEntity(${entityType})`);
      }

      continue;
    }

    if (opName === "updateField") {
      const entity = resolveEntityFromOp(t, aliases, rawOp);
      const fieldName = asString(rawOp.field, "field");
      const fieldRef = entity.fields?.[fieldName];

      if (!fieldRef) {
        throw new Error(`Field "${fieldName}" does not exist on selected entity.`);
      }

      safeUpdateField(t, fieldRef, rawOp.value);
      operationSummaries.push(
        `updateField(${entity.entityType}.${fieldName} = ${toDisplayString(rawOp.value)})`,
      );
      continue;
    }

    if (opName === "removeEntity") {
      const entity = resolveEntityFromOp(t, aliases, rawOp);
      if (typeof rawOp.entityAlias === "string" && rawOp.entityAlias.trim()) {
        removedAliases.add(rawOp.entityAlias.trim());
      }
      operationSummaries.push(`removeEntity(${entity.entityType}:${entity.id})`);
      t.remove(entity);
      continue;
    }

    throw new Error(
      `Unsupported Audiotool operation "${opName}". Supported ops: ensureEntity, createEntity, updateField, removeEntity.`,
    );
  }

  return {
    aliasUpdates,
    removedAliases: Array.from(removedAliases),
    operationSummaries,
  };
}

function validateApplyPayload(rawPayload) {
  if (!isRecord(rawPayload)) {
    throw new Error("audiotool.apply payload must be an object.");
  }

  const project =
    typeof rawPayload.project === "string" ? rawPayload.project.trim() : "";

  if (!Array.isArray(rawPayload.ops)) {
    throw new Error('audiotool.apply payload must include an "ops" array.');
  }
  if (!rawPayload.ops.length) {
    throw new Error('audiotool.apply payload "ops" cannot be empty.');
  }
  if (rawPayload.ops.length > 50) {
    throw new Error("audiotool.apply supports up to 50 operations per request.");
  }

  return { project, ops: rawPayload.ops };
}

async function ensureRequestedProject(requestedProject) {
  const fallbackProject = projectInput.value.trim();
  const targetProject = requestedProject || activeProject || fallbackProject;

  if (!targetProject) {
    throw new Error(
      "No project selected. Enter a project URL/UUID and click Connect Project first.",
    );
  }

  if (!activeDocument || activeProject !== targetProject) {
    await connectProject(targetProject);
  }
}

// iframe-free runner: no postMessage result channel

async function processAudiotoolApplyRequest(request) {
  try {
    const { project, ops } = validateApplyPayload(request?.payload);
    pushSessionActivity(
      "apply",
      `Apply request received (${ops.length} op${ops.length === 1 ? "" : "s"}).`,
    );

    await ensureRequestedProject(project);
    let applyResult = null;
    await activeDocument.modify((transaction) => {
      applyResult = applyAudiotoolOperations(transaction, ops);
    });

    for (const alias of applyResult?.removedAliases || []) {
      sessionAliasState.delete(alias);
    }
    for (const aliasUpdate of applyResult?.aliasUpdates || []) {
      upsertSessionAlias(
        aliasUpdate.alias,
        aliasUpdate.entityType,
        aliasUpdate.entityId,
      );
    }
    await refreshSessionEntitySummary();
    lastApplySummary = `${formatClockTime()} — Applied ${ops.length} operation(s) successfully.`;
    renderSessionDashboard();
    if (applyResult?.operationSummaries?.length) {
      pushSessionActivity(
        "apply",
        `Applied ${ops.length} operation(s).`,
        applyResult.operationSummaries.join(" | "),
      );
    }

    setAudiotoolStatus(
      `Applied ${ops.length} operation(s) to project sync.`,
      "ok",
    );
    appendConsoleLine("system", `Audiotool apply succeeded (${ops.length} ops).`);
  } catch (error) {
    const detail = toDisplayString(error);
    setAudiotoolStatus(`Apply failed: ${detail}`, "error");
    appendConsoleLine("error", detail);
    lastApplySummary = `${formatClockTime()} — Apply failed.`;
    pushSessionActivity("error", "Apply request failed.", detail);
    renderSessionDashboard();

    if (activeDocument) {
      await stopActiveDocument(
        "Document stopped after apply error. Reconnect before retrying.",
      );
    }

  }
}

function getCurrentThemeId() {
  const html = document.documentElement;
  if (html.classList.contains("theme-high-contrast")) return "high-contrast";
  if (html.classList.contains("theme-solarized")) return "solarized";
  if (html.classList.contains("theme-dark")) return "dark";
  return "light";
}

const previewPanel = new PreviewPanel(previewPanelElement, {
  onParameterChange: ({ entityAlias, field, value }) => {
    previewPanel.applyOps([{ op: "updateField", entityAlias, field, value }]);
    queueAudiotoolTask(async () => {
      if (!activeDocument) return;
      await processAudiotoolApplyRequest({
        payload: { project: activeProject, ops: [{ op: "updateField", entityAlias, field, value }] },
      });
    }).catch(() => {});
  },
});
previewPanel.render();

async function executeAudiotoolApplyWithPreview(payload, { captureOps } = {}) {
  const { project, ops } = validateApplyPayload(payload);
  if (captureOps) captureOps.push(...ops);
  previewPanel.applyOps(ops);
  if (loginStatus?.loggedIn) {
    try {
      await queueAudiotoolTask(async () => {
        await ensureRequestedProject(project);
        await processAudiotoolApplyRequest({ payload: { project, ops } });
      });
    } catch (err) {
      appendConsoleLine("error", toDisplayString(err));
      throw err;
    }
  }
  return { applied: ops.length, simulated: !loginStatus?.loggedIn };
}

function initPreviewMessageBridge() {
  if (!previewFrameElement) return;
  window.addEventListener("message", (e) => {
    if (e.source !== previewFrameElement.contentWindow) return;
    const d = e.data;
    if (!d || typeof d !== "object") return;

    if (d.type === "playground-console" && Array.isArray(d.args)) {
      const level =
        d.level === "error" || d.level === "warn" ? d.level : "log";
      const text = d.args.join(" ");
      appendConsoleLine(level, text);
      if (level === "warn" || level === "error") {
        pushSessionActivity(level, "Preview console message.", text);
      }
      return;
    }

    if (d.type === "playground-error") {
      const detail = d.stack || d.message || "Unknown preview error";
      appendConsoleLine("error", detail);
      pushSessionActivity("error", "Preview runtime error.", detail);
      return;
    }

    if (d.type === "audiotool-apply") {
      const { id, payload } = d;
      if (!id) return;
      void executeAudiotoolApplyWithPreview(payload, {
        captureOps: previewRunCapture?.capturedOps,
      })
        .then((result) => {
          e.source?.postMessage({ type: "audiotool-result", id, result }, "*");
        })
        .catch((err) => {
          e.source?.postMessage(
            { type: "audiotool-result", id, error: toDisplayString(err) },
            "*",
          );
        });
    }
  });
}

initPreviewMessageBridge();

// Provide a default local audiotool shim so Samples can run without clicking Run.
window.audiotool = {
  apply: async (payload) => {
    const { ops } = validateApplyPayload(payload);
    previewPanel.applyOps(ops);
    if (loginStatus?.loggedIn) {
      await queueAudiotoolTask(async () => {
        await ensureRequestedProject(payload?.project);
        await processAudiotoolApplyRequest({ payload: { project: payload?.project, ops } });
      });
    }
    return { applied: ops.length, simulated: !loginStatus?.loggedIn };
  },
};

/**
 * @param {{ endSurface?: "live" | "sdk" }} [options]
 *   `endSurface: "sdk"` keeps the preview surface on SDK simulation after run (for SDK-category samples).
 */
async function runCode(options = {}) {
  const endSurface = options.endSurface ?? "live";
  if (endSurface !== "sdk") {
    setPreviewSurfaceMode("live");
  }
  clearConsole();
  previewPanel.reset();

  const packageList = parsePackageInput(packageInput.value);
  const importMap = buildImportMap(packageList);
  const html = editorHtml.getValue();
  const css = editorCss.getValue();
  const sourceCode = editorJs.getValue();

  const capturedOps = [];
  previewRunCapture = { capturedOps };

  try {
    const srcdoc = buildPreviewSrcdoc({ html, css, js: sourceCode, importMap });
    if (previewFrameElement) {
      previewFrameElement.srcdoc = srcdoc;
      previewFrameElement.onload = () => {
        appendConsoleLine("system", "Preview iframe loaded.");
      };
    } else {
      appendConsoleLine("warn", "Preview iframe element missing; cannot render HTML/CSS/JS.");
    }
  } catch (err) {
    const detail = toDisplayString(err);
    appendConsoleLine("error", detail);
    pushSessionActivity("error", "Failed to build preview document.", detail);
  }

  const packageLabel = packageList.length
    ? packageList
        .map((pkg) => (pkg.version ? `${pkg.name}@${pkg.version}` : pkg.name))
        .join(", ")
    : "(none)";

  appendConsoleLine("system", `Running with packages: ${packageLabel}`);
  appendConsoleLine(
    "system",
    `Preview document updated. Theme: ${getCurrentThemeId()}.`,
  );
  pushSessionActivity("runtime", "Sandbox runtime refreshed.", packageLabel);

  if (endSurface === "sdk") {
    setPreviewSurfaceMode("sdk");
  }
}

function normalizeProjectListEntry(item) {
  const name = item?.name || item?.projectId || item?.id || "";
  let projectId = "";
  if (typeof name === "string" && name.startsWith("projects/")) {
    projectId = name.replace(/^projects\//, "");
  } else if (typeof item?.projectId === "string") {
    projectId = item.projectId;
  } else if (typeof item?.id === "string") {
    projectId = item.id;
  }
  const displayName = item?.displayName || item?.title || projectId || name;
  const searchBlob = `${displayName} ${projectId} ${name} ${item?.description || ""}`.toLowerCase();
  return { item, name, projectId, displayName, searchBlob };
}

function projectListEntryMatchesQuery(entry, q) {
  if (!q) return true;
  return entry.searchBlob.includes(q);
}

function appendProjectListRow(listEl, entry) {
  const { item, projectId, displayName } = entry;
  const li = document.createElement("li");
  const meta = document.createElement("div");
  meta.className = "meta";
  meta.innerHTML = `<div class="title">${escapeHtml(displayName)}</div><div class="subtle">${escapeHtml(projectId)}</div>`;

  const actions = document.createElement("div");
  const connectBtn = document.createElement("button");
  connectBtn.textContent = "Connect";
  connectBtn.className = "buttons";
  connectBtn.addEventListener("click", async () => {
    try {
      let target = projectId;
      if (!target) {
        target = extractProjectUuid(item?.studioUrl || item?.url || item?.name || "");
      }
      if (!target) {
        setAudiotoolStatus("Could not determine project ID for selection.", "error");
        return;
      }
      const overlayEl = document.getElementById("_project_list_overlay");
      overlayEl?.remove();
      projectInput.value = target;
      await connectProject(target);
    } catch (err) {
      const detail = toDisplayString(err);
      setAudiotoolStatus(`Could not connect to project: ${detail}`, "error");
      appendConsoleLine("error", detail);
    }
  });

  const copyBtn = document.createElement("button");
  copyBtn.textContent = "Copy ID";
  copyBtn.className = "buttons";
  copyBtn.addEventListener("click", async () => {
    try {
      const toCopy = projectId || item?.projectId || item?.id || item?.name || "";
      await navigator.clipboard.writeText(toCopy);
      setAudiotoolStatus("Project ID copied to clipboard.", "ok");
    } catch (err) {
      setAudiotoolStatus("Copy failed.", "warn");
    }
  });

  actions.appendChild(connectBtn);
  actions.appendChild(copyBtn);
  li.appendChild(meta);
  li.appendChild(actions);
  listEl.appendChild(li);
}

function renderProjectListItems(overlay) {
  const listEl = overlay.querySelector("#_project_list_items");
  const searchWrap = overlay.querySelector("#_project_list_search_wrap");
  const searchInput = overlay.querySelector("#_project_list_search");
  const rawItems = overlay._allProjectItems || [];
  const q = (searchInput?.value || "").trim().toLowerCase();

  listEl.innerHTML = "";

  if (!rawItems.length) {
    if (searchWrap) searchWrap.hidden = true;
    const li = document.createElement("li");
    li.textContent = "No projects found or you don't have permissions to list projects.";
    listEl.appendChild(li);
    return;
  }

  if (searchWrap) searchWrap.hidden = false;

  const entries = rawItems.map(normalizeProjectListEntry);
  const filtered = q ? entries.filter((e) => projectListEntryMatchesQuery(e, q)) : entries;

  if (!filtered.length) {
    const li = document.createElement("li");
    li.className = "project-list-empty-match";
    li.textContent = "No projects match your search.";
    listEl.appendChild(li);
    return;
  }

  for (const entry of filtered) {
    appendProjectListRow(listEl, entry);
  }
}

function createProjectListModal() {
  let overlay = document.getElementById("_project_list_overlay");
  // Hot reload or an older script version can leave a cached overlay without the search field.
  if (overlay && !overlay.querySelector("#_project_list_search")) {
    overlay.remove();
    overlay = null;
  }
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "_project_list_overlay";
  overlay.className = "modal-overlay";

  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `
    <h3>Available Projects</h3>
    <div id="_project_list_search_wrap" class="project-list-search-wrap" role="search" aria-label="Search projects">
      <label for="_project_list_search" class="project-list-search-label">Search projects</label>
      <div class="project-list-search-field">
        <span class="project-list-search-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
        </span>
        <input type="text" id="_project_list_search" class="project-list-search" inputmode="search" enterkeyhint="search" placeholder="Search by name, ID, or description…" autocomplete="off" spellcheck="false" />
      </div>
    </div>
    <p class="subtle project-list-hint">Select a project below, or narrow the list with the search bar.</p>
    <ul class="project-list" id="_project_list_items"></ul>
    <div class="modal-actions">
      <button id="_project_list_close" class="buttons">Close</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  document.getElementById("_project_list_close").addEventListener("click", () => {
    overlay.remove();
  });

  const searchInput = overlay.querySelector("#_project_list_search");
  searchInput?.addEventListener("input", () => renderProjectListItems(overlay));

  return overlay;
}

function showProjectList(items = []) {
  const overlay = createProjectListModal();
  overlay._allProjectItems = Array.isArray(items) ? items : [];
  const searchInput = overlay.querySelector("#_project_list_search");
  if (searchInput) searchInput.value = "";
  renderProjectListItems(overlay);
  requestAnimationFrame(() => searchInput?.focus());
}

listProjectsButton?.addEventListener("click", async () => {
  queueAudiotoolTask(async () => {
    try {
      setAudiotoolStatus("Loading projects…", "warn");
      const client = await ensureClient();
      const service = client.api?.projectService || client.api?.projects || client.api;
      if (!service) {
        throw new Error("Audiotool project service not available.");
      }

      let response = null;
      // try common RPC shapes
      if (typeof service.listProjects === "function") {
        response = await service.listProjects({ pageSize: 50 });
      } else if (typeof service.searchProjects === "function") {
        response = await service.searchProjects({ query: "", pageSize: 50 });
      } else if (typeof service.list === "function") {
        response = await service.list({ pageSize: 50 });
      } else {
        // fallback: try calling projectService.getProject with current project (will fail) -> but we should notify
        throw new Error("Project listing method not found on client API.");
      }

      // normalize response to array
      let items = [];
      if (Array.isArray(response)) items = response;
      else if (Array.isArray(response.projects)) items = response.projects;
      else if (Array.isArray(response.items)) items = response.items;
      else {
        const found = Object.values(response || {}).find((v) => Array.isArray(v));
        items = Array.isArray(found) ? found : [];
      }

      showProjectList(items);
      setAudiotoolStatus(`Found ${items.length} project(s).`, "ok");
    } catch (error) {
      const detail = toDisplayString(error);
      setAudiotoolStatus(`Could not list projects: ${detail}`, "error");
      appendConsoleLine("error", detail);
      // show empty modal with message
      showProjectList([]);
    }
  }).catch((e) => {
    appendConsoleLine("error", toDisplayString(e));
  });
});

function createProjectModal() {
  let overlay = document.getElementById("_create_project_overlay");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "_create_project_overlay";
  overlay.className = "modal-overlay";

  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `
    <h3>Create Project</h3>
    <label class="subtle">Display name</label>
    <input id="_create_project_name" type="text" placeholder="My New Project" />
    <label class="subtle">Description (optional)</label>
    <input id="_create_project_description" type="text" placeholder="Short description" />
    <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
      <input id="_create_project_connect" type="checkbox" />
      <label for="_create_project_connect" class="subtle">Connect after create</label>
    </div>
    <div class="modal-actions">
      <button id="_create_project_cancel" class="buttons">Cancel</button>
      <button id="_create_project_submit" class="buttons">Create</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  document.getElementById("_create_project_cancel").addEventListener("click", () => {
    overlay.remove();
  });

  return overlay;
}

function extractCreatedProjectId(response) {
  // Try common response shapes: { project: { name: 'projects/<uuid>' } } or { name: 'projects/<uuid>' } or { id: '<uuid>' }
  const maybe = response?.project || response;
  let name = maybe?.name || maybe?.project?.name || maybe?.id || maybe?.projectId || maybe?.projectId;
  if (!name && typeof response === 'string') {
    name = response;
  }
  if (!name) return "";
  // name may be 'projects/<uuid>' or just uuid
  return String(name).replace(/^projects\//, "");
}

createProjectButton?.addEventListener("click", () => {
  const overlay = createProjectModal();
  const submit = overlay.querySelector("#_create_project_submit");
  const cancel = overlay.querySelector("#_create_project_cancel");

  const onSubmit = async () => {
    const nameInput = overlay.querySelector("#_create_project_name");
    const descInput = overlay.querySelector("#_create_project_description");
    const connectAfter = overlay.querySelector("#_create_project_connect").checked;
    const displayName = (nameInput.value || "").trim();
    const description = (descInput.value || "").trim();

    if (!displayName) {
      setAudiotoolStatus("Project display name is required.", "warn");
      return;
    }

    queueAudiotoolTask(async () => {
      try {
        setAudiotoolStatus("Creating project…", "warn");
        const client = await ensureClient();
        const service = client.api?.projectService || client.api?.projects || client.api;
        if (!service) {
          throw new Error("Audiotool project service not available.");
        }

        let response = null;
        // try a few common creation shapes
        if (typeof service.createProject === "function") {
          // gRPC-like: createProject({ project: { displayName, description } })
          response = await service.createProject({ project: { displayName, description } });
        } else if (typeof service.create === "function") {
          // generic create
          response = await service.create({ displayName, description });
        } else if (typeof service.createNewProject === "function") {
          response = await service.createNewProject({ displayName, description });
        } else if (typeof service.createProjectAsync === "function") {
          response = await service.createProjectAsync({ displayName, description });
        } else {
          throw new Error("Project creation API not found on client.");
        }

        const projectId = extractCreatedProjectId(response);
        if (!projectId) {
          throw new Error("Could not determine created project id from server response.");
        }

        appendConsoleLine("system", `Created project: ${projectId}`);
        setAudiotoolStatus(`Project created: ${projectId}`, "ok");

        // optionally connect
        if (connectAfter) {
          try {
            await connectProject(projectId);
          } catch (err) {
            appendConsoleLine("error", toDisplayString(err));
            setAudiotoolStatus(`Created project but failed to connect: ${toDisplayString(err)}`, "warn");
          }
        } else {
          // fill input with the created id so user can connect later
          projectInput.value = projectId;
        }

        overlay.remove();
      } catch (err) {
        const detail = toDisplayString(err);
        appendConsoleLine("error", detail);
        setAudiotoolStatus(`Create failed: ${detail}`, "error");
      }
    });
  };

  submit.addEventListener("click", onSubmit, { once: true });
});

runButton.addEventListener("click", runCode);
resetButton.addEventListener("click", () => {
  editorHtml.setValue(defaultHtml);
  editorCss.setValue(defaultCss);
  editorJs.setValue(defaultSource);
  packageInput.value = defaultPackages;
  runCode();
});

projectInput.addEventListener("input", () => {
  if (activeProject && projectInput.value.trim() !== activeProject) {
    setAudiotoolStatus(
      "Project input changed. Click Connect Project to switch sync target.",
      "warn",
    );
  }
});

authButton.addEventListener("click", async () => {
  if (!loginStatus) {
    setAudiotoolStatus("Auth status not ready yet, try again.", "warn");
    return;
  }

  if (loginStatus.loggedIn) {
    try {
      await loginStatus.logout();
    } finally {
      // reflect visual state immediately
      authButton.classList.remove("signed-in");
      setAudiotoolStatus("Logged out.", "warn");
    }
    return;
  }

  try {
    setAudiotoolStatus("Redirecting to Audiotool login...", "warn");
    await loginStatus.login();
  } catch (error) {
    setAudiotoolStatus(`Login failed: ${toDisplayString(error)}`, "error");
  }
});

function updateAuthButtonVisual() {
  try {
    if (loginStatus && loginStatus.loggedIn) {
      authButton.classList.add("signed-in");
    } else {
      authButton.classList.remove("signed-in");
    }
  } catch {
    authButton.classList.remove("signed-in");
  }
}

connectButton.addEventListener("click", () => {
  const project = projectInput.value.trim();
  queueAudiotoolTask(async () => {
    try {
      await connectProject(project);
    } catch (error) {
      const detail = toDisplayString(error);
      setAudiotoolStatus(`Connect failed: ${detail}`, "error");
      appendConsoleLine("error", detail);
    }
  });
});

disconnectButton.addEventListener("click", () => {
  queueAudiotoolTask(() => stopActiveDocument("Disconnected from project."));
});

openProjectButton.addEventListener("click", () => {
  if (!activeProjectStudioUrl) {
    return;
  }

  window.open(activeProjectStudioUrl, "_blank");
});

reloadPreviewButton.addEventListener("click", () => {
  if (!activeProjectStudioUrl) {
    return;
  }

  queueAudiotoolTask(async () => {
    await refreshSessionMetadata();
    await refreshSessionEntitySummary();
    appendConsoleLine("system", "Session data refreshed.");
    pushSessionActivity("system", "Session data refreshed.");
  });
});

async function initializeAudiotoolAuth() {
  isInitializingAuth = true;
  updateControls();
  setAudiotoolStatus("Initializing Audiotool authentication...", "warn");

  const redirectUrl = getRedirectUrl();
  redirectUrlElement.textContent = redirectUrl;

  try {
    loginStatus = await getLoginStatus({
      clientId: audiotoolClientId,
      redirectUrl,
      scope: audiotoolScope,
    });

    if (loginStatus.loggedIn) {
      const userName = await loginStatus.getUserName();
      setAudiotoolStatus(
        `Logged in as ${toDisplayString(userName)}. Connect a project to start syncing.`,
        "ok",
      );
      await ensureClient();
      appendConsoleLine("system", "Audiotool client initialized.");
      updateAuthButtonVisual();
    } else {
      setAudiotoolStatus("Logged out. Click Login to authorize this app.", "warn");
    }
  } catch (error) {
    const detail = toDisplayString(error);
    setAudiotoolStatus(`Auth setup failed: ${detail}`, "error");
    appendConsoleLine("error", detail);
  } finally {
    isInitializingAuth = false;
    updateControls();
  }
}

for (const ed of [editorHtml, editorCss, editorJs]) {
  ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, runCode);
}

resetSessionDashboard("waiting for project connection.");
runCode();
initializeAudiotoolAuth();

window.addEventListener("beforeunload", () => {
  clearSessionSubscriptions();
  if (activeDocument) {
    void activeDocument.stop();
  }
});

// --- Splitter logic: allow dragging between editor and preview panes ---
(() => {
  const panes = document.querySelector(".panes");
  const splitter = document.getElementById("splitter");
  const leftPane = document.querySelector(".editor-pane");
  const rightPane = document.querySelector(".preview-pane");
  if (!panes || !splitter || !leftPane || !rightPane) return;

  let dragging = false;
  let startX = 0;
  let startLeftWidth = 0;

  const minLeft = 280; // px
  const minRight = 340; // px
  const SPLITTER_SIZE = 8; // matches CSS

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function onPointerDown(e) {
    e.preventDefault();
    dragging = true;
    startX = e.clientX ?? (e.touches && e.touches[0] && e.touches[0].clientX) ?? 0;
    const rect = leftPane.getBoundingClientRect();
    startLeftWidth = rect.width;
    document.body.style.userSelect = "none";
    splitter.classList.add("active");
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const clientX = e.clientX ?? (e.touches && e.touches[0] && e.touches[0].clientX) ?? 0;
    const dx = clientX - startX;
    const parentRect = panes.getBoundingClientRect();
    let nextLeft = startLeftWidth + dx;

    // compute max left to ensure rightPane not smaller than minRight
    const maxLeft = parentRect.width - minRight - SPLITTER_SIZE; // splitter width
    nextLeft = clamp(nextLeft, minLeft, maxLeft);

    // apply sizes by setting explicit pixel columns
    panes.style.gridTemplateColumns = `${nextLeft}px ${SPLITTER_SIZE}px minmax(${minRight}px, 1fr)`;
  }

  function onPointerUp() {
    if (!dragging) return;
    dragging = false;
    document.body.style.userSelect = "";
    splitter.classList.remove("active");
    // clean up inline style if user resizes to default-like proportions
  }

  splitter.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);

  // double-click resets to initial grid-template
  splitter.addEventListener("dblclick", () => {
    panes.style.gridTemplateColumns = `minmax(320px, 0.92fr) ${SPLITTER_SIZE}px minmax(400px, 1.78fr)`;
  });
})();
