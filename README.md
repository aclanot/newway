# Repo Risk Signals (Chrome Extension)

This extension now works automatically on GitHub repository pages.

## What is improved

- Auto-injects a **Repo Risk Signals** panel directly in the repository page.
- Scans repository metadata, contributor-account anomalies, and common suspicious script patterns.
- Shows a 0-100 risk score with explainable findings.

## Checks currently included

- Repo transparency and trust markers (README, license, issues enabled).
- Star/fork distribution anomalies.
- Contributor anomalies (new accounts, extreme following ratio, weak reputation profile).
- Pattern scan for suspicious commands in script files (e.g., encoded PowerShell and `curl|bash`).

## Install

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select `extension/`

## Important

This is heuristic detection, not definitive malware classification.
