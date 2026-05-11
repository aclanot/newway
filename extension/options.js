const tokenInput = document.getElementById("github-token");
const saveBtn = document.getElementById("save");
const clearBtn = document.getElementById("clear");
const statusEl = document.getElementById("status");

init();

saveBtn.addEventListener("click", async () => {
  const token = tokenInput.value.trim();
  await chrome.storage.local.set({ githubToken: token });
  setStatus(token ? "Token saved." : "Saved empty token.");
});

clearBtn.addEventListener("click", async () => {
  await chrome.storage.local.remove("githubToken");
  tokenInput.value = "";
  setStatus("Token removed.");
});

async function init() {
  const data = await chrome.storage.local.get(["githubToken"]);
  if (data.githubToken) tokenInput.value = data.githubToken;
}

function setStatus(text) {
  statusEl.textContent = text;
}
