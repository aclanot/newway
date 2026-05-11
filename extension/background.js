chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "analyze_repo") return false;

  analyzeRepo(message.owner, message.repo)
    .then((report) => sendResponse({ ok: true, report }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});

async function analyzeRepo(owner, repo) {
  const [repoData, contributors, readmeExists, treeFiles] = await Promise.all([
    gh(`/repos/${owner}/${repo}`),
    gh(`/repos/${owner}/${repo}/contributors?per_page=20`),
    checkReadme(owner, repo),
    fetchRepoTree(owner, repo)
  ]);

  let riskScore = 0;
  const signals = [];

  if (!repoData.description) addSignal("low", "Repository has no description.", 4);
  if (repoData.archived) addSignal("low", "Repository is archived.", 10);
  if (!repoData.has_issues) addSignal("medium", "Issues are disabled (reduces transparency).", 8);
  if (!repoData.license) addSignal("low", "No license detected.", 5);
  if (!readmeExists) addSignal("medium", "README is missing.", 12);
  if (repoData.forks_count > 1000 && repoData.stargazers_count < 50) {
    addSignal("medium", "Very high forks with very low stars.", 20);
  }

  const suspiciousFileHits = scanSuspiciousFiles(treeFiles);
  for (const hit of suspiciousFileHits) {
    addSignal("high", `Suspicious code pattern in ${hit.path}: ${hit.pattern}`, 12);
  }

  const contributorChecks = await Promise.all(
    contributors.slice(0, 12).map(async (c) => {
      const user = await gh(`/users/${c.login}`);
      const ageDays = daysOld(user.created_at);
      let points = 0;
      const reasons = [];

      if (ageDays < 45) { points += 8; reasons.push("new account"); }
      if (user.public_repos > 50 && user.followers < 3) { points += 8; reasons.push("many repos + very few followers"); }
      if ((user.following ?? 0) > 200 && (user.followers ?? 0) < 5) { points += 8; reasons.push("aggressive following pattern"); }
      if (!String(c.login).includes("[bot]") && user.bio === null && user.name === null) { points += 3; reasons.push("empty profile"); }

      const forkRatio = await estimateForkRatio(c.login);
      if (forkRatio >= 0.9) { points += 12; reasons.push(`mostly forks (${Math.round(forkRatio*100)}%)`); }

      return { login: c.login, points, reasons, forkRatio };
    })
  );

  const suspiciousContributors = contributorChecks.filter((c) => c.points >= 10);
  if (suspiciousContributors.length >= 3) {
    addSignal("high", `${suspiciousContributors.length} contributors match suspicious-account heuristics.`, 28);
  } else if (suspiciousContributors.length > 0) {
    addSignal("medium", `${suspiciousContributors.length} contributor(s) match suspicious-account heuristics.`, 14);
  }

  suspiciousContributors.slice(0, 5).forEach((c) => {
    addSignal("low", `@${c.login}: ${c.reasons.join(", ")}.`, 0);
  });

  if (signals.length === 0) addSignal("low", "No obvious red flags from current checks.", 0);

  const normalizedRisk = Math.min(100, riskScore);
  const confidenceValue = confidenceScore(treeFiles.length, contributors.length, suspiciousFileHits.length);

  return {
    owner,
    repo,
    riskScore: normalizedRisk,
    confidence: {
      value: confidenceValue,
      label: confidenceValue >= 75 ? "High" : confidenceValue >= 45 ? "Medium" : "Low"
    },
    signals,
    contributors: contributorChecks.sort((a,b)=>b.points-a.points),
    checkedFiles: treeFiles.length
  };

  function addSignal(level, text, points) {
    riskScore += points;
    signals.push({ level, text, points });
  }
}

function daysOld(dateString) {
  const created = new Date(dateString).getTime();
  return Math.floor((Date.now() - created) / 86400000);
}

function scanSuspiciousFiles(files) {
  const patterns = [
    /powershell\s+-enc/i,
    /frombase64string\(/i,
    /curl\s+[^\n|]+\|\s*(bash|sh)/i,
    /wget\s+[^\n|]+\|\s*(bash|sh)/i,
    /invoke-webrequest/i,
    /new-object\s+net\.webclient/i
  ];

  return files
    .filter((f) => /\.(ps1|bat|cmd|sh|js|ts|py|yml|yaml)$/i.test(f.path) && f.content)
    .flatMap((f) => {
      const hit = patterns.find((p) => p.test(f.content));
      return hit ? [{ path: f.path, pattern: hit.source }] : [];
    })
    .slice(0, 10);
}

async function fetchRepoTree(owner, repo) {
  const repoData = await gh(`/repos/${owner}/${repo}`);
  const tree = await gh(`/repos/${owner}/${repo}/git/trees/${repoData.default_branch}?recursive=1`);
  const candidates = (tree.tree || [])
    .filter((n) => n.type === "blob")
    .filter((n) => n.size <= 150000)
    .slice(0, 80);

  const files = await Promise.all(candidates.map(async (node) => {
    if (!/\.(ps1|bat|cmd|sh|js|ts|py|yml|yaml)$/i.test(node.path)) return { path: node.path };
    try {
      const safePath = node.path.split("/").map(encodeURIComponent).join("/");
      const content = await ghText(`/repos/${owner}/${repo}/contents/${safePath}?ref=${repoData.default_branch}`);
      return { path: node.path, content };
    } catch {
      return { path: node.path };
    }
  }));

  return files;
}


async function estimateForkRatio(login) {
  try {
    const repos = await gh(`/users/${login}/repos?per_page=100&type=owner&sort=updated`);
    if (!Array.isArray(repos) || repos.length === 0) return 0;
    const forks = repos.filter((r) => r.fork).length;
    return forks / repos.length;
  } catch {
    return 0;
  }
}

async function checkReadme(owner, repo) {
  const headers = await githubHeaders();
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, { headers });
  return res.ok;
}

async function gh(path) {
  const headers = await githubHeaders();
  const resp = await fetch(`https://api.github.com${path}`, { headers });
  if (!resp.ok) throw new Error(`GitHub API error ${resp.status} for ${path}`);
  return resp.json();
}

async function ghText(path) {
  const data = await gh(path);
  if (!data.content) return "";
  return atob(data.content.replace(/\n/g, ""));
}


function confidenceScore(scannedFiles, contributorCount, suspiciousHits) {
  let score = 20;
  score += Math.min(35, Math.floor(scannedFiles / 3));
  score += Math.min(20, contributorCount);
  score -= Math.min(25, suspiciousHits * 3);
  if (scannedFiles < 20) score -= 20;
  return Math.max(5, Math.min(100, score));
}


async function githubHeaders() {
  const data = await chrome.storage.local.get(["githubToken"]);
  const headers = { Accept: "application/vnd.github+json" };
  if (data.githubToken) headers.Authorization = `Bearer ${data.githubToken}`;
  return headers;
}
