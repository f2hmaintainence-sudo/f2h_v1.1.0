#!/usr/bin/env bash
set -e

# ============================================================================
# F2H Fresh — SSH Direct Edit Auto-Sync to GitHub
# Allows senior engineers to edit code directly on the server via SSH
# and automatically sync changes back to GitHub main branch & PM2.
# ============================================================================

REPO_DIR="/home/f2hfresh/htdocs/f2hfresh.com"
cd "$REPO_DIR"

echo "======================================================================"
echo " [F2H Auto-Sync] Checking for server changes..."
echo "======================================================================"

# Add safe.directory configuration
git config --global --add safe.directory "$REPO_DIR" 2>/dev/null || true

# Check if there are uncommitted local changes
if [ -n "$(git status --porcelain)" ]; then
  echo "[F2H Auto-Sync] Local changes detected! Staging and committing..."
  git add .
  COMMIT_MSG="Senior Dev SSH update: $(date '+%Y-%m-%d %H:%M:%S')"
  git commit -m "$COMMIT_MSG"
  echo "[F2H Auto-Sync] Committed: '$COMMIT_MSG'"
else
  echo "[F2H Auto-Sync] No local uncommitted changes."
fi

# Pull latest changes with rebase
echo "[F2H Auto-Sync] Fetching & rebasing from GitHub main branch..."
git fetch origin main
git rebase origin/main || {
  echo "[F2H Auto-Sync] Rebase conflict detected. Aborting rebase."
  git rebase --abort
  exit 1
}

# Push to GitHub main branch
echo "[F2H Auto-Sync] Pushing changes to GitHub repository..."
git push origin main

echo "======================================================================"
echo " [F2H Auto-Sync] SUCCESS! Monorepo synced to GitHub main."
echo "======================================================================"
