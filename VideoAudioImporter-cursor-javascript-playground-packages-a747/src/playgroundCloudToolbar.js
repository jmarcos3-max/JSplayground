import { ctx } from "./playgroundContext.js";

const TIP_LIST = "Log in to list your cloud projects";
const TIP_CREATE = "Log in to create a cloud project";
const TIP_CONNECT = "Log in to connect a Studio project";

/** Enables List Projects, New project, and Connect Project only when signed in. */
export function syncCloudToolbarEnabled() {
  const has = Boolean(ctx.audiotoolClient);
  const listBtn = document.getElementById("list-projects-btn");
  const createBtn = document.getElementById("create-project-btn");
  const connectBtn = document.getElementById("connect-btn");

  if (listBtn) {
    listBtn.disabled = !has;
    listBtn.title = has ? "" : TIP_LIST;
  }
  if (createBtn) {
    createBtn.disabled = !has;
    createBtn.title = has ? "" : TIP_CREATE;
  }
  if (connectBtn) {
    connectBtn.disabled = !has;
    connectBtn.title = has ? "" : TIP_CONNECT;
  }
}
