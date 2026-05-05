# Fishing Battle

## Working agreements

### Git workflow (important)
As you do work on this project, **commit to Git and push to GitHub regularly** with clean, descriptive commit messages. This protects the project so we never lose status or progress.

- Commit after each meaningful unit of work (a feature, a fix, a milestone) — not in giant catch-all batches.
- Write commit messages that explain the *why*, not just the *what*. Subject line under ~70 chars; body for details if needed.
- Push to `origin main` (or the active branch) after each commit so GitHub stays in sync with local.
- Never use `--no-verify`, `--force`, or `reset --hard` without explicit user approval.
- Stage specific files by name rather than `git add -A` to avoid sneaking in noise.

### Deployment
- The game is deployed via **GitHub Pages** from the `main` branch.
- Pushing to `main` updates the live site within ~1 minute.
