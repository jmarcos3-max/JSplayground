import { ctx } from "./playgroundContext.js";
import { logToConsole } from "./playgroundConsole.js";
import { extractProjectId } from "./projectIds.js";
let cachedListedProjects = [];

function projectMatchesSearchQuery(project, rawQuery) {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  const projectId = extractProjectId(project.name);
  const title = (
    (project.displayName || "").trim() ||
    projectId ||
    ""
  ).toLowerCase();
  const creator = (project.creatorName || "").toLowerCase();
  const nameField = String(project.name || "").toLowerCase();
  return (
    title.includes(q) ||
    projectId.toLowerCase().includes(q) ||
    creator.includes(q) ||
    nameField.includes(q)
  );
}

function buildProjectRowMarkup(p) {
  const projectId = extractProjectId(p.name);
  const title =
    (p.displayName || "").trim() || projectId || "(Untitled project)";
  const subtitle = projectId ? `UUID: ${projectId}` : p.name;
  const creator = p.creatorName
    ? `by ${p.creatorName.split("/").pop()}`
    : "";
  return `
          <div class="project-row" role="menuitem" tabindex="0" data-project-id="${projectId}" data-project-name="${title.replaceAll('"', "&quot;")}">
            <div>
              <div class="project-title">${title}</div>
              <div class="project-subtitle">${subtitle}</div>
            </div>
            <div class="project-meta">${creator}</div>
          </div>
        `;
}

export function initProjectsMenu(connectToProject) {
  const projectsMenu = document.getElementById("projects-menu");
  const listProjectsBtn = document.getElementById("list-projects-btn");
  const projectInput = document.getElementById("project-input");

  function wireProjectRowListeners(container) {
    container.querySelectorAll(".project-row").forEach((row) => {
      row.addEventListener("click", async () => {
        const projectId = row.getAttribute("data-project-id") || "";
        const projectName = row.getAttribute("data-project-name") || "";
        if (!projectId) {
          logToConsole("Could not extract project UUID from selection.", true);
          return;
        }
        projectInput.value = projectId;
        projectsMenu.hidden = true;
        listProjectsBtn.setAttribute("aria-expanded", "false");
        await connectToProject(projectId, projectName);
      });
      row.addEventListener("keydown", async (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        row.click();
      });
    });
  }

  function renderFilteredProjectList(listEl, projects, query) {
    const filtered = query.trim()
      ? projects.filter((p) => projectMatchesSearchQuery(p, query))
      : projects;
    if (!filtered.length) {
      listEl.innerHTML = `<div class="project-subtitle projects-menu-empty">${query.trim() ? "No projects match your filter." : "No projects found."}</div>`;
      return;
    }
    listEl.innerHTML = filtered.map(buildProjectRowMarkup).join("");
    wireProjectRowListeners(listEl);
  }

  function mountProjectsMenuWithSearch(projects) {
    cachedListedProjects = projects;
    projectsMenu.innerHTML = `
    <div class="projects-menu-inner">
      <input type="search" id="projects-search" class="projects-menu-search" placeholder="Filter projects…" autocomplete="off" spellcheck="false" aria-label="Filter projects by name or UUID" />
      <div id="projects-menu-list" class="projects-menu-list" role="presentation"></div>
    </div>
  `;
    const listEl = document.getElementById("projects-menu-list");
    const searchInput = document.getElementById("projects-search");
    const applyFilter = () =>
      renderFilteredProjectList(listEl, cachedListedProjects, searchInput.value);
    applyFilter();
    searchInput.addEventListener("input", applyFilter);
    requestAnimationFrame(() => searchInput.focus());
  }

  function setProjectsMenuOpen(isOpen) {
    projectsMenu.hidden = !isOpen;
    listProjectsBtn.setAttribute("aria-expanded", String(isOpen));
    if (isOpen) {
      projectsMenu.innerHTML = `<div class="project-subtitle">Loading projects…</div>`;
    }
  }

  document.addEventListener("click", (e) => {
    if (projectsMenu.hidden) return;
    const dropdown = document.getElementById("projects-dropdown");
    if (dropdown && !dropdown.contains(e.target)) {
      projectsMenu.hidden = true;
      listProjectsBtn.setAttribute("aria-expanded", "false");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (projectsMenu.hidden) return;
    projectsMenu.hidden = true;
    listProjectsBtn.setAttribute("aria-expanded", "false");
    listProjectsBtn.focus();
  });

  listProjectsBtn.addEventListener("click", async () => {
    if (!ctx.audiotoolClient) return;

    const willOpen = projectsMenu.hidden;
    setProjectsMenuOpen(willOpen);
    if (!willOpen) return;

    try {
      const resp = await ctx.audiotoolClient.api.projectService.listProjects({
        pageSize: 50,
        filter: "",
        pageToken: "",
        orderBy: "project.update_time desc",
      });

      const projects = resp?.projects ?? [];
      if (!projects.length) {
        projectsMenu.innerHTML = `<div class="project-subtitle">No projects found.</div>`;
        cachedListedProjects = [];
        return;
      }

      mountProjectsMenuWithSearch(projects);
    } catch (err) {
      projectsMenu.innerHTML = `<div class="project-subtitle">Failed to load projects.</div>`;
      logToConsole(`List Projects Error: ${err.message}`, true);
      console.error(err);
    }
  });
}
