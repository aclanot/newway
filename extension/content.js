(() => {
  const repo = parseRepoUrl(location.href);
  if (!repo) return;

  injectPanel();
  requestAnalysis(repo.owner, repo.name);

  async function requestAnalysis(owner, name) {
    setStatus(`Analyzing ${owner}/${name} ...`);
    const response = await chrome.runtime.sendMessage({ type: "analyze_repo", owner, repo: name });
    if (!response?.ok) {
      setStatus(`Failed: ${response?.error || "unknown error"}`);
      return;
    }
    render(response.report);
  }

  function render(report) {
    const scoreNode = document.getElementById("rrs-score");
    const listNode = document.getElementById("rrs-signals");
    const metaNode = document.getElementById("rrs-meta");
    const contributorNode = document.getElementById("rrs-contributors");

    const level = report.riskScore >= 60 ? "HIGH" : report.riskScore >= 30 ? "MEDIUM" : "LOW";
    scoreNode.textContent = `Risk ${report.riskScore}/100 (${level})`;
    metaNode.textContent = `Confidence: ${report.confidence.label} (${report.confidence.value}/100) • Scanned ~${report.checkedFiles} files`;
    listNode.innerHTML = "";
    contributorNode.innerHTML = "";

    report.signals.forEach((s) => {
      const li = document.createElement("li");
      li.className = `rrs-${s.level}`;
      li.textContent = `${s.text}${s.points ? ` (+${s.points})` : ""}`;
      listNode.appendChild(li);
    });

    report.contributors.slice(0, 6).forEach((c) => {
      const li = document.createElement("li");
      li.className = c.points >= 10 ? "rrs-medium" : "rrs-low";
      li.textContent = `@${c.login} — points ${c.points}; ${c.reasons.join(", ") || "no clear anomaly"}`;
      contributorNode.appendChild(li);
    });

    setStatus("Analysis complete.");
  }

  function injectPanel() {
    if (document.getElementById("repo-risk-signals-panel")) return;
    const panel = document.createElement("section");
    panel.id = "repo-risk-signals-panel";
    panel.innerHTML = `
      <style>
        #repo-risk-signals-panel {border:1px solid #d0d7de;border-radius:8px;padding:12px;margin:12px 0;background:#fff;}
        #repo-risk-signals-panel h3 {margin:0 0 6px;font-size:16px;}
        #repo-risk-signals-panel h4 {margin:10px 0 4px;font-size:13px;}
        #repo-risk-signals-panel ul {margin:8px 0 0 18px;}
        #repo-risk-signals-panel .rrs-high {color:#b00020;}
        #repo-risk-signals-panel .rrs-medium {color:#9c6b00;}
        #repo-risk-signals-panel .rrs-low {color:#444;}
        #repo-risk-signals-panel small {color:#57606a;display:block;margin-top:8px;}
      </style>
      <h3>Repo Risk Signals</h3>
      <div id="rrs-status">Starting...</div>
      <div id="rrs-score"></div>
      <small id="rrs-meta"></small>
      <h4>Signals</h4>
      <ul id="rrs-signals"></ul>
      <h4>Contributor drill-down</h4>
      <ul id="rrs-contributors"></ul>
      <small>Heuristic warnings only. Manually verify before trusting/running code.</small>
    `;

    const mount = document.querySelector("main") || document.body;
    mount.prepend(panel);
  }

  function setStatus(text) {
    const node = document.getElementById("rrs-status");
    if (node) node.textContent = text;
  }

  function parseRepoUrl(url) {
    const parsed = new URL(url);
    if (parsed.hostname !== "github.com") return null;
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    if (["issues", "pull", "actions", "security"].includes(parts[0])) return null;
    return { owner: parts[0], name: parts[1] };
  }
})();
