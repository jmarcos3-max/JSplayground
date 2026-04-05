let consoleOutputEl = null;

export function initPlaygroundConsole(el) {
  consoleOutputEl = el;
}

export function logToConsole(msg, isError = false) {
  if (!consoleOutputEl) return;
  const color = isError ? "#b91c1c" : "#047857";
  consoleOutputEl.innerHTML += `<div style="color: ${color}; padding: 2px 0;">${msg}</div>`;
  consoleOutputEl.scrollTop = consoleOutputEl.scrollHeight;
}

export function installPlaygroundConsoleForward() {
  if (window.__PLAYGROUND_CONSOLE_WRAPPED__) return;
  window.__PLAYGROUND_CONSOLE_WRAPPED__ = true;
  const originalLog = console.log;
  console.log = (...args) => {
    originalLog(...args);
    logToConsole(`> ${args.join(" ")}`);
  };
}
