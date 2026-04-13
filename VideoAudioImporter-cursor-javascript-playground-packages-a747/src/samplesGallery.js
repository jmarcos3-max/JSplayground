import { codeSamples } from "./codeSamples.js";
import { ctx } from "./playgroundContext.js";
import { logToConsole } from "./playgroundConsole.js";
import {
  buildPreviewSrcdoc,
  injectPreviewPostRunHint,
  loadPreviewIframeSrcdoc,
  refreshPreviewEmptyOverlay,
} from "./previewIframe.js";

/** gs* buttons vs canonical keys (handles older bundles / bookmarks). */
const SAMPLE_KEY_ALIASES = {
  gs1: "sample1LoginConnect",
  gs2: "sample2CreateAudiotoolClient",
  gs3: "sample3NexusEvents",
  gs4: "sample4ModifyTonematrix",
};

function resolveSampleSource(key) {
  const k = (key || "").trim();
  if (!k) return "";
  if (codeSamples[k]) return codeSamples[k];
  const canon = SAMPLE_KEY_ALIASES[k];
  if (canon && codeSamples[canon]) return codeSamples[canon];
  return "";
}

export function initSamplesGallery() {
  const modal = document.getElementById("samples-modal");
  const openBtn = document.getElementById("browse-samples-btn");
  const closeBtn = document.getElementById("close-samples-btn");
  const importBtn = document.getElementById("import-sample-btn");
  let selectedSampleKey = "";

  const clearSelection = () => {
    selectedSampleKey = "";
    importBtn?.setAttribute("disabled", "true");
    modal?.querySelectorAll(".load-sample-btn.is-selected").forEach((el) => {
      el.classList.remove("is-selected");
    });
  };

  const selectSampleButton = (btn) => {
    if (!btn) return;
    selectedSampleKey = (btn.getAttribute("data-sample") || "").trim();
    modal?.querySelectorAll(".load-sample-btn.is-selected").forEach((el) => {
      el.classList.remove("is-selected");
    });
    btn.classList.add("is-selected");
    if (selectedSampleKey) importBtn?.removeAttribute("disabled");
    else importBtn?.setAttribute("disabled", "true");
  };

  const importSelectedSample = () => {
    if (!selectedSampleKey) {
      logToConsole("Select a sample first, then click Import to Editor.", true);
      return;
    }
    const key = selectedSampleKey.trim();
    const source = resolveSampleSource(key);
    if (!source) {
      logToConsole(
        `Sample not found: ${key}. Hard-refresh (Cmd+Shift+R) or rebuild the app.`,
        true,
      );
      return;
    }
    if (!ctx.editor) {
      logToConsole("Editor is not ready yet.", true);
      return;
    }
    const selectedBtn = modal?.querySelector(
      `.load-sample-btn[data-sample="${selectedSampleKey}"]`,
    );
    const kind =
      selectedBtn?.getAttribute("data-kind") === "template"
        ? "Template"
        : "Sample";
    ctx.editor.setValue(source);
    logToConsole(`Imported ${kind}: ${selectedSampleKey}`);

    const previewHintKind =
      key === "gs2"
        ? "console"
        : key === "gs3" || key === "gs4"
          ? "studio"
          : null;
    if (previewHintKind) {
      const iframe = document.getElementById("preview-sandbox-iframe");
      if (iframe) {
        void (async () => {
          try {
            await loadPreviewIframeSrcdoc(iframe, buildPreviewSrcdoc());
            injectPreviewPostRunHint(iframe, previewHintKind);
            refreshPreviewEmptyOverlay();
          } catch {
            /* preview iframe optional */
          }
        })();
      }
    }

    close();
  };

  const open = () => {
    if (!modal) return;
    clearSelection();
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
    importBtn?.focus?.();
  };
  const close = () => {
    if (!modal) return;
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
    clearSelection();
    openBtn?.focus?.();
  };

  openBtn?.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);

  modal?.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal?.style.display === "flex") close();
  });

  // Event delegation keeps sample buttons working after HMR / modal content updates.
  modal?.addEventListener("click", (e) => {
    const btn = e.target?.closest?.(".load-sample-btn");
    if (!btn) return;
    selectSampleButton(btn);
  });

  importBtn?.addEventListener("click", importSelectedSample);
}
