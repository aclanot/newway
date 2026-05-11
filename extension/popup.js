const statusEl = document.getElementById("status");
const analyzeBtn = document.getElementById("analyze");
const summaryEl = document.getElementById("summary");
const scoreEl = document.getElementById("score");
const signalsEl = document.getElementById("signals");
const signalListEl = document.getElementById("signal-list");

analyzeBtn.addEventListener("click", async () => {
  clearResults();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const repo = tab?.url ? parseRepoUrl(tab.url) : null;
  if (!repo) return setStatus("Open a GitHub repository page first.");

  setStatus(`Analyzing ${repo.owner}/${repo.name} ...`);
  const response = await chrome.runtime.sendMessage({ type: "analyze_repo", owner: repo.owner, repo: repo.name });
  if (!response?.ok) return setStatus(`Failed: ${response?.error || "unknown error"}`);

  renderReport(response.report);
  setStatus("Done.");
});

function parseRepoUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "github.com") return null;
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], name: parts[1] };
  } catch {
    return null;
  }
}

function renderReport(report) {
  summaryEl.hidden = false;
  signalsEl.hidden = false;
  const level = report.riskScore >= 60 ? "HIGH" : report.riskScore >= 30 ? "MEDIUM" : "LOW";
  scoreEl.textContent = `Risk score: ${report.riskScore}/100 (${level}) • Confidence ${report.confidence.label} (${report.confidence.value}/100)`;

  signalListEl.innerHTML = "";
  for (const signal of report.signals) {
    const li = document.createElement("li");
    li.className = signal.level;
    li.textContent = signal.text;
    signalListEl.appendChild(li);
  }
}

function setStatus(message) { statusEl.textContent = message; }
function clearResults() { summaryEl.hidden = true; signalsEl.hidden = true; signalListEl.innerHTML = ""; }
