/** Mutable refs shared across playground modules (avoid import cycles through main). */
export const ctx = {
  /** @type {import("monaco-editor").editor.IStandaloneCodeEditor | null} */
  editor: null,
  nexus: null,
  audiotoolClient: null,
  loginStatus: null,
  connectedProjectId: "",
  connectedProjectName: "",
};
