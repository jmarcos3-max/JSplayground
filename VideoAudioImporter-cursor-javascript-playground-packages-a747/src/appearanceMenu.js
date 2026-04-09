import * as monaco from "monaco-editor";
import { ctx } from "./playgroundContext.js";

const APPEARANCE_STORAGE_KEY = "playground-appearance";

function readAppearance() {
  try {
    const raw = localStorage.getItem(APPEARANCE_STORAGE_KEY);
    const o = raw ? JSON.parse(raw) : {};
    return {
      theme:
        o.theme === "dark" || o.theme === "system" ? o.theme : "light",
      density: o.density === "compact" ? "compact" : "comfortable",
      motion: o.motion === "reduced" ? "reduced" : "standard",
      uiFontSize:
        o.uiFontSize === "small" || o.uiFontSize === "large"
          ? o.uiFontSize
          : "medium",
      editorFontSize: Math.min(
        18,
        Math.max(12, parseInt(o.editorFontSize, 10) || 14),
      ),
    };
  } catch {
    return {
      theme: "light",
      density: "comfortable",
      motion: "standard",
      uiFontSize: "medium",
      editorFontSize: 14,
    };
  }
}

function persistAppearance(partial) {
  const next = { ...readAppearance(), ...partial };
  localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(next));
  return next;
}

function applyPlaygroundTheme(theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("pg-theme-dark", dark);
  monaco.editor.setTheme(dark ? "vs-dark" : "vs");
}

function applyPlaygroundDensity(density) {
  document.documentElement.classList.toggle(
    "pg-density-compact",
    density === "compact",
  );
}

function applyMotionPreference(motion) {
  document.documentElement.classList.toggle(
    "pg-reduced-motion",
    motion === "reduced",
  );
}

function applyUIFontSize(uiFontSize) {
  const root = document.documentElement;
  root.classList.toggle("pg-ui-font-small", uiFontSize === "small");
  root.classList.toggle("pg-ui-font-large", uiFontSize === "large");
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
  const themeSystemBtn = document.getElementById("appearance-theme-system");
  const densityComfortableBtn = document.getElementById(
    "appearance-density-comfortable",
  );
  const densityCompactBtn = document.getElementById(
    "appearance-density-compact",
  );
  const motionStandardBtn = document.getElementById(
    "appearance-motion-standard",
  );
  const motionReducedBtn = document.getElementById("appearance-motion-reduced");
  const uiFontSmallBtn = document.getElementById("appearance-ui-font-small");
  const uiFontMediumBtn = document.getElementById("appearance-ui-font-medium");
  const uiFontLargeBtn = document.getElementById("appearance-ui-font-large");
  const fontRange = document.getElementById("appearance-font-range");
  const fontValueEl = document.getElementById("appearance-font-value");
  const themeGroup = themeLightBtn?.parentElement || null;
  const densityGroup = densityComfortableBtn?.parentElement || null;
  const motionGroup = motionStandardBtn?.parentElement || null;
  const uiFontGroup = uiFontSmallBtn?.parentElement || null;

  function syncAppearanceUIFromState() {
    const s = readAppearance();
    applyPlaygroundTheme(s.theme);
    applyPlaygroundDensity(s.density);
    applyMotionPreference(s.motion);
    applyUIFontSize(s.uiFontSize);
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
    themeSystemBtn?.setAttribute(
      "aria-pressed",
      s.theme === "system" ? "true" : "false",
    );
    themeSystemBtn?.setAttribute(
      "aria-checked",
      s.theme === "system" ? "true" : "false",
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
    motionStandardBtn?.setAttribute(
      "aria-pressed",
      s.motion === "standard" ? "true" : "false",
    );
    motionStandardBtn?.setAttribute(
      "aria-checked",
      s.motion === "standard" ? "true" : "false",
    );
    motionReducedBtn?.setAttribute(
      "aria-pressed",
      s.motion === "reduced" ? "true" : "false",
    );
    motionReducedBtn?.setAttribute(
      "aria-checked",
      s.motion === "reduced" ? "true" : "false",
    );
    uiFontSmallBtn?.setAttribute(
      "aria-pressed",
      s.uiFontSize === "small" ? "true" : "false",
    );
    uiFontSmallBtn?.setAttribute(
      "aria-checked",
      s.uiFontSize === "small" ? "true" : "false",
    );
    uiFontMediumBtn?.setAttribute(
      "aria-pressed",
      s.uiFontSize === "medium" ? "true" : "false",
    );
    uiFontMediumBtn?.setAttribute(
      "aria-checked",
      s.uiFontSize === "medium" ? "true" : "false",
    );
    uiFontLargeBtn?.setAttribute(
      "aria-pressed",
      s.uiFontSize === "large" ? "true" : "false",
    );
    uiFontLargeBtn?.setAttribute(
      "aria-checked",
      s.uiFontSize === "large" ? "true" : "false",
    );
    if (fontRange) fontRange.value = String(fs);
    if (fontRange) fontRange.setAttribute("aria-valuetext", `${fs} pixels`);
    if (fontValueEl) fontValueEl.textContent = `${fs}px`;

    const syncTabStop = (buttons, selected) => {
      for (const btn of buttons) {
        btn.tabIndex = btn === selected ? 0 : -1;
      }
    };
    if (themeLightBtn && themeDarkBtn && themeSystemBtn) {
      syncTabStop(
        [themeLightBtn, themeDarkBtn, themeSystemBtn],
        s.theme === "dark"
          ? themeDarkBtn
          : s.theme === "system"
            ? themeSystemBtn
            : themeLightBtn,
      );
    }
    if (densityComfortableBtn && densityCompactBtn) {
      syncTabStop(
        [densityComfortableBtn, densityCompactBtn],
        s.density === "compact" ? densityCompactBtn : densityComfortableBtn,
      );
    }
    if (motionStandardBtn && motionReducedBtn) {
      syncTabStop(
        [motionStandardBtn, motionReducedBtn],
        s.motion === "reduced" ? motionReducedBtn : motionStandardBtn,
      );
    }
    if (uiFontSmallBtn && uiFontMediumBtn && uiFontLargeBtn) {
      syncTabStop(
        [uiFontSmallBtn, uiFontMediumBtn, uiFontLargeBtn],
        s.uiFontSize === "small"
          ? uiFontSmallBtn
          : s.uiFontSize === "large"
            ? uiFontLargeBtn
            : uiFontMediumBtn,
      );
    }
  }

  function isAppearanceMenuOpen() {
    return appearancePanel && !appearancePanel.hidden;
  }

  function setAppearanceExpanded(isOpen) {
    if (!appearanceBtn) return;
    appearanceBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    appearanceBtn.setAttribute(
      "aria-label",
      isOpen ? "Close appearance settings" : "Open appearance settings",
    );
  }

  function openAppearanceMenu() {
    if (!appearancePanel || !appearanceBtn) return;
    appearancePanel.hidden = false;
    setAppearanceExpanded(true);
    const checked = appearancePanel.querySelector(
      '[role="radio"][aria-checked="true"]',
    );
    checked?.focus();
  }

  function closeAppearanceMenu({ restoreFocus = true } = {}) {
    if (!appearancePanel || !appearanceBtn) return;
    if (appearancePanel.hidden) return;
    appearancePanel.hidden = true;
    setAppearanceExpanded(false);
    if (restoreFocus) appearanceBtn.focus();
  }

  syncAppearanceUIFromState();
  setAppearanceExpanded(false);

  appearanceBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (isAppearanceMenuOpen()) closeAppearanceMenu();
    else openAppearanceMenu();
  });
  appearanceBtn?.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowDown") return;
    if (isAppearanceMenuOpen()) return;
    e.preventDefault();
    openAppearanceMenu();
  });

  document.addEventListener("click", (e) => {
    if (!isAppearanceMenuOpen()) return;
    if (appearanceWrap?.contains(e.target)) return;
    closeAppearanceMenu({ restoreFocus: false });
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

  function setMotionChoice(motion) {
    persistAppearance({ motion });
    syncAppearanceUIFromState();
  }

  function setUIFontSizeChoice(uiFontSize) {
    persistAppearance({ uiFontSize });
    syncAppearanceUIFromState();
  }

  function setupRadioGroupKeyboard(groupEl, buttons, onSelect) {
    if (!groupEl || !buttons.length) return;
    groupEl.addEventListener("keydown", (event) => {
      const currentIndex = buttons.indexOf(document.activeElement);
      if (currentIndex < 0) return;

      const key = event.key;
      if (
        ![
          "ArrowRight",
          "ArrowDown",
          "ArrowLeft",
          "ArrowUp",
          "Home",
          "End",
          " ",
          "Enter",
        ].includes(key)
      ) {
        return;
      }
      event.preventDefault();

      if (key === " " || key === "Enter") {
        buttons[currentIndex].click();
        return;
      }

      let nextIndex = currentIndex;
      if (key === "Home") nextIndex = 0;
      else if (key === "End") nextIndex = buttons.length - 1;
      else if (key === "ArrowRight" || key === "ArrowDown") {
        nextIndex = (currentIndex + 1) % buttons.length;
      } else if (key === "ArrowLeft" || key === "ArrowUp") {
        nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
      }

      const nextButton = buttons[nextIndex];
      onSelect(nextButton);
      nextButton.focus();
    });
  }

  themeLightBtn?.addEventListener("click", () => setThemeChoice("light"));
  themeDarkBtn?.addEventListener("click", () => setThemeChoice("dark"));
  themeSystemBtn?.addEventListener("click", () => setThemeChoice("system"));
  densityComfortableBtn?.addEventListener("click", () =>
    setDensityChoice("comfortable"),
  );
  densityCompactBtn?.addEventListener("click", () =>
    setDensityChoice("compact"),
  );
  motionStandardBtn?.addEventListener("click", () => setMotionChoice("standard"));
  motionReducedBtn?.addEventListener("click", () => setMotionChoice("reduced"));
  uiFontSmallBtn?.addEventListener("click", () => setUIFontSizeChoice("small"));
  uiFontMediumBtn?.addEventListener("click", () => setUIFontSizeChoice("medium"));
  uiFontLargeBtn?.addEventListener("click", () => setUIFontSizeChoice("large"));

  setupRadioGroupKeyboard(
    themeGroup,
    [themeLightBtn, themeDarkBtn, themeSystemBtn].filter(Boolean),
    (button) =>
      setThemeChoice(
        button === themeDarkBtn
          ? "dark"
          : button === themeSystemBtn
            ? "system"
            : "light",
      ),
  );
  setupRadioGroupKeyboard(
    densityGroup,
    [densityComfortableBtn, densityCompactBtn].filter(Boolean),
    (button) =>
      setDensityChoice(
        button === densityCompactBtn ? "compact" : "comfortable",
      ),
  );
  setupRadioGroupKeyboard(
    motionGroup,
    [motionStandardBtn, motionReducedBtn].filter(Boolean),
    (button) => setMotionChoice(button === motionReducedBtn ? "reduced" : "standard"),
  );
  setupRadioGroupKeyboard(
    uiFontGroup,
    [uiFontSmallBtn, uiFontMediumBtn, uiFontLargeBtn].filter(Boolean),
    (button) =>
      setUIFontSizeChoice(
        button === uiFontSmallBtn
          ? "small"
          : button === uiFontLargeBtn
            ? "large"
            : "medium",
      ),
  );

  const systemThemeQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
  const onSystemThemeChanged = () => {
    if (readAppearance().theme === "system") {
      syncAppearanceUIFromState();
    }
  };
  if (systemThemeQuery?.addEventListener) {
    systemThemeQuery.addEventListener("change", onSystemThemeChanged);
  } else if (systemThemeQuery?.addListener) {
    systemThemeQuery.addListener(onSystemThemeChanged);
  }

  fontRange?.addEventListener("input", () => {
    const n = parseInt(fontRange.value, 10);
    if (!Number.isFinite(n)) return;
    const fs = applyEditorFontSize(n);
    fontRange.setAttribute("aria-valuetext", `${fs} pixels`);
    if (fontValueEl) fontValueEl.textContent = `${fs}px`;
  });
  fontRange?.addEventListener("change", () => {
    const n = parseInt(fontRange.value, 10);
    if (!Number.isFinite(n)) return;
    persistAppearance({ editorFontSize: applyEditorFontSize(n) });
  });
}
