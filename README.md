# Repo Risk Signals (Chrome Extension)

This extension auto-checks GitHub repositories and gives immediate security-risk hints.

## What you get now

- Automatic in-page risk panel when you open a repo.
- Clear risk score (0-100) and confidence score.
- Contributor drill-down (why each account looks normal or suspicious).
- Script-pattern scan for common malware delivery commands.

## Signal categories

- Repository trust metadata (README/license/issues/description)
- Popularity anomalies (fork/star mismatch)
- Contributor-account anomalies (new account, follower/following behavior, weak profile, mostly-fork accounts)
- Suspicious script patterns (`curl|bash`, encoded PowerShell, risky downloader patterns)

## Install

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select `extension/`

## Limitation

This is heuristic triage, not guaranteed malware detection.
