import { ctx } from "./playgroundContext.js";
import { logToConsole } from "./playgroundConsole.js";
import { extractProjectId } from "./projectIds.js";
export function initCreateProjectFlow(connectToProject) {
  const createProjectModal = document.getElementById("create-project-modal");
  const createProjectForm = document.getElementById("create-project-form");
  const createProjectNameInput = document.getElementById(
    "create-project-name-input",
  );
  const closeCreateProjectBtn = document.getElementById(
    "close-create-project-btn",
  );
  const cancelCreateProjectBtn = document.getElementById(
    "create-project-cancel-btn",
  );
  const createProjectSubmitBtn = document.getElementById(
    "create-project-submit-btn",
  );
  const createProjectBtn = document.getElementById("create-project-btn");
  const projectInput = document.getElementById("project-input");

  function defaultNewProjectName() {
    return `JSPlayground ${new Date().toLocaleString(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    })}`;
  }

  function openCreateProjectModal() {
    if (!createProjectModal || !createProjectNameInput) return;
    createProjectNameInput.value = "";
    createProjectModal.style.display = "flex";
    createProjectModal.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => createProjectNameInput.focus());
  }

  function closeCreateProjectModal() {
    if (!createProjectModal) return;
    createProjectModal.style.display = "none";
    createProjectModal.setAttribute("aria-hidden", "true");
    createProjectBtn?.focus?.();
  }

  function setCreateProjectModalBusy(isBusy) {
    if (createProjectSubmitBtn) createProjectSubmitBtn.disabled = isBusy;
    if (cancelCreateProjectBtn) cancelCreateProjectBtn.disabled = isBusy;
    if (closeCreateProjectBtn) closeCreateProjectBtn.disabled = isBusy;
    if (createProjectNameInput) createProjectNameInput.disabled = isBusy;
  }

  createProjectBtn?.addEventListener("click", () => {
    if (!ctx.audiotoolClient) return;
    openCreateProjectModal();
  });

  createProjectModal?.addEventListener("click", (e) => {
    if (e.target === createProjectModal) closeCreateProjectModal();
  });
  closeCreateProjectBtn?.addEventListener("click", closeCreateProjectModal);
  cancelCreateProjectBtn?.addEventListener("click", closeCreateProjectModal);

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!createProjectModal || createProjectModal.style.display !== "flex")
      return;
    closeCreateProjectModal();
  });

  createProjectForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!ctx.audiotoolClient) {
      logToConsole("Login first to create a project on your account.", true);
      closeCreateProjectModal();
      return;
    }

    const displayName =
      createProjectNameInput?.value.trim() || defaultNewProjectName();

    setCreateProjectModalBusy(true);
    try {
      const resp = await ctx.audiotoolClient.api.projectService.createProject({
        project: { displayName },
      });
      const p = resp?.project;
      const projectId = extractProjectId(p?.name);
      if (!projectId) {
        throw new Error("API did not return a project id");
      }
      const resolvedName = (p?.displayName || "").trim() || displayName;
      projectInput.value = `https://beta.audiotool.com/studio?project=${encodeURIComponent(projectId)}`;
      logToConsole(
        `Created project "${resolvedName}" (${projectId}). Connecting…`,
      );
      closeCreateProjectModal();
      await connectToProject(projectId, resolvedName);
    } catch (err) {
      logToConsole(`Create project failed: ${err.message}`, true);
      console.error(err);
    } finally {
      setCreateProjectModalBusy(false);
    }
  });
}
