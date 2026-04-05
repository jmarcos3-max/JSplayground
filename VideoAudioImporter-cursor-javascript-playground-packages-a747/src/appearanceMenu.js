import * as monaco from "monaco-editor";
import { ctx } from "./playgroundContext.js";

const APPEARANCE_STORAGE_KEY = "playground-appearance";

function readAppearance() {
  try {
    const raw = localStorage.getItem(APPEARANCE_STORAGE_KEY);
    const o = raw ? JSON.parse(raw) : {};
    return {
      theme: o.theme === "dark" ? "dark" : "light",
      density: o.density === "compact" ? "compact" : "comfortable",
      editorFontSize: Math.min(
        18,
        Math.max(12, parseInt(o.editorFontSize, 10) || 14),
      ),
    };
  } catch {
    return { theme: "light", density: "comfortable", editorFontSize: 14 };
  }
}

function persistAppearance(partial) {
  const next = { ...readAppearance(), ...partial };
  localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(next));
  return next;
}

function applyPlaygroundTheme(theme) {
  const dark = theme === "dark";
  document.documentElement.classList.toggle("pg-theme-dark", dark);
  monaco.editor.setTheme(dark ? "vs-dark" : "vs");
}

function applyPlaygroundDensity(density) {
  document.documentElement.classList.toggle(
    "pg-density-compact",
    density === "compact",
  );
}

function applyEditorFontSize(px) {
  const n = Math.min(18, Math.max(12, px));
  ctx.editor?.updateOptions({ fontSize: n });
  document.documentElement.dataset.pgEditorFont = String(n);
  return n;
}

export function initAppearanceMenu() {
  const appearanceBtn = document.getElementById("appearance-menu-btn");
  const appearancePanel = document.getElementById("appearance-menu-panel");
  const appearanceWrap = document.getElementById("title-bar-appearance");
  const themeLightBtn = document.getElementById("appearance-theme-light");
  const themeDarkBtn = document.getElementById("appearance-theme-dark");
  const densityComfortableBtn = document.getElementById(
    "appearance-density-comfortable",
  );
  const densityCompactBtn = document.getElementById(
    "appearance-density-compact",
  );
  const fontRange = document.getElementById("appearance-font-range");
  const fontValueEl = document.getElementById("appearance-font-value");

  function syncAppearanceUIFromState() {
    const s = readAppearance();
    applyPlaygroundTheme(s.theme);
    applyPlaygroundDensity(s.density);
    const fs = applyEditorFontSize(s.editorFontSize);

    themeLightBtn?.setAttribute(
      "aria-pressed",
      s.theme === "light" ? "true" : "false",
    );
    themeLightBtn?.setAttribute(
      "aria-checked",
      s.theme === "light" ? "true" : "false",
    );
    themeDarkBtn?.setAttribute(
      "aria-pressed",
      s.theme === "dark" ? "true" : "false",
    );
    themeDarkBtn?.setAttribute(
      "aria-checked",
      s.theme === "dark" ? "true" : "false",
    );
    densityComfortableBtn?.setAttribute(
      "aria-pressed",
      s.density === "comfortable" ? "true" : "false",
    );
    densityComfortableBtn?.setAttribute(
      "aria-checked",
      s.density === "comfortable" ? "true" : "false",
    );
    densityCompactBtn?.setAttribute(
      "aria-pressed",
      s.density === "compact" ? "true" : "false",
    );
    densityCompactBtn?.setAttribute(
      "aria-checked",
      s.density === "compact" ? "true" : "false",
    );
    if (fontRange) fontRange.value = String(fs);
    if (fontValueEl) fontValueEl.textContent = `${fs}px`;
  }

  function isAppearanceMenuOpen() {
    return appearancePanel && !appearancePanel.hidden;
  }

  function openAppearanceMenu() {
    if (!appearancePanel || !appearanceBtn) return;
    appearancePanel.hidden = false;
    appearanceBtn.setAttribute("aria-expanded", "true");
  }

  function closeAppearanceMenu() {
    if (!appearancePanel || !appearanceBtn) return;
    if (appearancePanel.hidden) return;
    appearancePanel.hidden = true;
    appearanceBtn.setAttribute("aria-expanded", "false");
    appearanceBtn.focus();
  }

  syncAppearanceUIFromState();

  appearanceBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (isAppearanceMenuOpen()) closeAppearanceMenu();
    else openAppearanceMenu();
  });

  document.addEventListener("click", (e) => {
    if (!isAppearanceMenuOpen()) return;
    if (appearanceWrap?.contains(e.target)) return;
    closeAppearanceMenu();
  });

  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Escape") return;
      if (!isAppearanceMenuOpen()) return;
      e.stopPropagation();
      closeAppearanceMenu();
    },
    true,
  );

  function setThemeChoice(theme) {
    persistAppearance({ theme });
    syncAppearanceUIFromState();
  }

  function setDensityChoice(density) {
    persistAppearance({ density });
    syncAppearanceUIFromState();
  }

  themeLightBtn?.addEventListener("click", () => setThemeChoice("light"));
  themeDarkBtn?.addEventListener("click", () => setThemeChoice("dark"));
  densityComfortableBtn?.addEventListener("click", () =>
    setDensityChoice("comfortable"),
  );
  densityCompactBtn?.addEventListener("click", () =>
    setDensityChoice("compact"),
  );

  fontRange?.addEventListener("input", () => {
    const n = parseInt(fontRange.value, 10);
    if (!Number.isFinite(n)) return;
    const fs = applyEditorFontSize(n);
    if (fontValueEl) fontValueEl.textContent = `${fs}px`;
  });
  fontRange?.addEventListener("change", () => {
    const n = parseInt(fontRange.value, 10);
    if (!Number.isFinite(n)) return;
    persistAppearance({ editorFontSize: applyEditorFontSize(n) });
  });
}
