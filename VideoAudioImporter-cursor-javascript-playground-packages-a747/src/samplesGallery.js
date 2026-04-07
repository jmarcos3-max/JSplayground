import { codeSamples } from "./codeSamples.js";
import { ctx } from "./playgroundContext.js";
import { logToConsole } from "./playgroundConsole.js";

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
    selectedSampleKey = btn.getAttribute("data-sample") || "";
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
    if (!codeSamples[selectedSampleKey]) {
      logToConsole(`Sample not found: ${selectedSampleKey}`, true);
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
    ctx.editor.setValue(codeSamples[selectedSampleKey]);
    logToConsole(`Imported ${kind}: ${selectedSampleKey}`);
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
