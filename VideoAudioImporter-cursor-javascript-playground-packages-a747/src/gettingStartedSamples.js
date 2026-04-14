/**
 * “Getting started” steps (merged into `codeSamples`) — aligned with Audiotool “Getting started” docs.
 */
export const gettingStartedSamples = {
  sample1LoginConnect: `import { getLoginStatus } from "@audiotool/nexus";

// Check if the user is logged in
const status = await getLoginStatus({
  clientId: "<your-client-id>",
  redirectUrl: "http://127.0.0.1:5173/", // must match your app settings
  scope: "project:write", // permission to modify projects
});

// Create a login/logout button based on current status
const button = document.createElement("button");
button.innerHTML = status.loggedIn ? "Logout" : "Login";

// Toggle login state on click
button.addEventListener("click", () => {
  status.loggedIn ? status.logout() : status.login(); // redirects if logging in
});

// Attach button to the page
document.body.appendChild(button);

// If already logged in, you can continue with next steps
if (status.loggedIn) {
  console.log("Access granted.");
}`,

  sample2CreateAudiotoolClient: `import { getLoginStatus, createAudiotoolClient } from "@audiotool/nexus";

// Check if the user is logged in
const status = await getLoginStatus({
  clientId: "<your-client-id>",
  redirectUrl: "http://127.0.0.1:5173/",
  scope: "project:write",
});

// Stop here if not logged in (requires Step 1)
// Logs result to the console
if (!status.loggedIn) {
  console.log("Not logged in — use Step 1 (Login), then run again.");
} else {
  // Create an authenticated Audiotool client
  const audiotoolClient = await createAudiotoolClient({
    authorization: status,
  });

  // Confirm the client is ready (see console)
  console.log("AudiotoolClient ready.", audiotoolClient != null);
}`,

  sample3NexusEvents: `// Listen for new devices being created
nexus.events.onCreate("tonematrix", (tm) => {
  console.debug("tonematrix created with id", tm.id);

  // Cleanup when removed
  return () => console.debug("tonematrix removed with id", tm.id);
});

// Listen for changes to a delay effect's mix parameter
nexus.events.onCreate("stompboxDelay", (delay) => {
  nexus.events.onUpdate(delay.fields.mix, (g) => {
    console.debug("stompbox delay mix factor value set to", g);
  });
});

// Create a delay effect in the project
await nexus.modify((t) => {
  t.create("stompboxDelay", {
    displayName: "Getting started — delay",
    positionX: 200,
    positionY: 160,
    mix: 0.2,
  });
});

// Logs updates when the delay is created or modified (see console)
console.log("Event listeners active.");`,

  sample4ModifyTonematrix: `// Create a Heisenberg device at a fixed position
await nexus.modify((t) => {
  t.create("heisenberg", {
    positionX: 50,
    positionY: 100,
    displayName: "Getting started — Heisenberg",
  });
});

// Logs result (see console)
console.log("Heisenberg created.");`,
};
