/** Matched before Run so the cloud routing template does not execute against the offline engine only. */
export const CLOUD_STUDIO_RUN_MARKER = "TEMPLATE: CLOUD SYNC & ROUTING";

export const templates = {
  offline: `// ==========================================
// TEMPLATE: OFFLINE MODE (NATIVE HTML CONTROLS)
// ==========================================
// Offline mode uses a local (unsynced) document. Plain <input type="range"> + listeners.

console.log("--- Loading Offline Template ---");

let mySynth;
await nexus.modify((t) => {
  mySynth = t.create("heisenberg", { positionX: 100, positionY: 100, gain: 0.7 });
});
console.log("> Synth created in memory.");

const uiContainer = document.getElementById("nexus-ui-container");
uiContainer.innerHTML = "";

const label = document.createElement("label");
label.textContent = "Synth gain";
label.style.display = "block";
label.style.fontSize = "12px";
label.style.marginBottom = "6px";

const slider = document.createElement("input");
slider.type = "range";
slider.min = "0";
slider.max = "1";
slider.step = "0.01";
slider.value = "0.7";

slider.addEventListener("input", async (e) => {
  const value = parseFloat(e.target.value);
  try {
    if (mySynth?.fields?.gain) {
      await nexus.modify((t) => t.update(mySynth.fields.gain, value));
      console.log("> Engine gain updated to: " + value.toFixed(2));
    }
  } catch (err) {
    console.warn("Update failed:", err);
  }
});

uiContainer.appendChild(label);
uiContainer.appendChild(slider);`,

  online: `// ==========================================
// TEMPLATE: CLOUD SYNC & ROUTING
// ==========================================
// 1. Click 'Login' at the top.
// 2. Choose a project (List Projects) or paste a Studio URL / project ID.
// 3. Click 'Connect Project'.
// 4. Hit Run, then 'Open Project' to see it in the Studio UI.

console.log("--- Loading Cloud Template ---");

await nexus.modify((t) => {
  const mySynth = t.create("heisenberg", {
    displayName: "Code-Generated Synth",
    positionX: 100,
    positionY: 200,
    gain: 0.7,
  });

  const myDelay = t.create("stompboxDelay", {
    displayName: "Code-Generated Delay",
    positionX: 400,
    positionY: 200,
    mix: 0.6,
    feedbackFactor: 0.4,
    stepLengthIndex: 2,
  });

  t.create("desktopAudioCable", {
    fromSocket: mySynth.fields.audioOutput.location,
    toSocket: myDelay.fields.audioInput.location,
  });
});

console.log("> Success: Devices spawned and cables routed.");
console.log("> If connected, check your Audiotool Studio tab now!");`,

  cheatsheet: `// ==========================================
// TEMPLATE: SDK CHEAT SHEET
// ==========================================
// Quick vocabulary + patterns from https://developer.audiotool.com/js-package-documentation/
//
// Pro tip: type t.create(" then press Ctrl+Space to see suggestions.

/*
--- COMMON DEVICES (t.create type keys) ---
Synths:
  - "heisenberg"
  - "bassline"
  - "tonematrix"
  - "machiniste"
  - "gakki"

Effects:
  - "stompboxDelay"
  - "stompboxReverb"
  - "stompboxChorus"
  - "stompboxCompressor"

Routing:
  - "desktopAudioCable"  // fromSocket / toSocket → .fields.audioOutput/.audioInput .location
  - "desktopNoteCable"   // e.g. tonematrix.fields.noteOutput → machiniste.fields.notesInput

--- TIMELINE (inside nexus.modify) ---
  - "noteCollection", "note", "noteTrack", "noteRegion"
  - Musical ticks: import { Ticks } from "@audiotool/nexus/utils"
    (Beat=quarter, SemiBreve=whole in 4/4 — see docs utils.Ticks)

--- READ ENTITIES (outside modify, document ready) ---
  - nexus.queryEntities.ofTypes("heisenberg").get()

--- COMMON create(...) config keys ---
  - positionX, positionY, displayName, gain (many devices)

--- DISCOVER FIELDS ---
Create a device, then inspect (see log below):
*/

await nexus.modify((t) => {
  const testDevice = t.create("heisenberg", { positionX: 100, positionY: 100 });
  console.log("Heisenberg entityType:", testDevice.entityType);
  console.log("Top-level field keys:", Object.keys(testDevice.fields));
});`,
};
