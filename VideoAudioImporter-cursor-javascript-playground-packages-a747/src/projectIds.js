/** Expected API shape: "projects/<uuid>" */
export function extractProjectId(projectName) {
  const parts = String(projectName || "").split("/");
  const idx = parts.indexOf("projects");
  if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
  return parts[parts.length - 1] || "";
}

/** Bare project UUID or Studio URL (?project=…). */
export function parseProjectIdFromInput(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";

  try {
    const u = new URL(s);
    const p = u.searchParams.get("project");
    if (p) return p.trim();
  } catch {
    /* not an absolute URL */
  }

  const q = s.match(/[?&]project=([^&\s#]+)/i);
  if (q) {
    try {
      return decodeURIComponent(q[1].trim());
    } catch {
      return q[1].trim();
    }
  }

  return s;
}
