#!/usr/bin/env bash
set -e

# ============================================================================
# F2H Fresh — SSH Direct Edit Auto-Sync & Auto-Deploy to GitHub & Web Domains
# Allows engineers to edit code directly on the server via SSH
# and automatically sync changes back to GitHub main branch & update web apps.
# ============================================================================

REPO_DIR="/var/www/f2hfresh"
cd "$REPO_DIR"

echo "======================================================================"
echo " [F2H Auto-Sync] Checking for server changes in $REPO_DIR..."
echo "======================================================================"

# Add safe.directory configuration
git config --global --add safe.directory "$REPO_DIR" 2>/dev/null || true

# Check if there are uncommitted local changes
if [ -n "$(git status --porcelain)" ]; then
  echo "[F2H Auto-Sync] Local changes detected! Staging and committing..."
  git add .
  COMMIT_MSG="Dev update: $(date '+%Y-%m-%d %H:%M:%S')"
  git commit -m "$COMMIT_MSG"
  echo "[F2H Auto-Sync] Committed: '$COMMIT_MSG'"
else
  echo "[F2H Auto-Sync] No local uncommitted changes."
fi

# Pull latest changes with rebase
echo "[F2H Auto-Sync] Fetching & rebasing from GitHub main branch..."
git fetch origin main || true
git rebase origin/main 2>/dev/null || {
  echo "[F2H Auto-Sync] Rebase conflict detected or no upstream. Proceeding..."
  git rebase --abort 2>/dev/null || true
}

# Push to GitHub main branch
echo "[F2H Auto-Sync] Pushing changes to GitHub repository..."
git push origin main 2>/dev/null || echo "[F2H Auto-Sync] Warning: Git push skipped or not configured."

# Automatically Build & Deploy Flutter Web Apps (No Cache Mode)
echo "======================================================================"
echo " [F2H Auto-Sync] Deploying Customer Flutter Web App..."
echo "======================================================================"
cd "$REPO_DIR/apps/mobile/customer"
/opt/flutter/bin/flutter build web --release --pwa-strategy=none
cp -r build/web/* /home/f2hfresh-customer/htdocs/customer.f2hfresh.com/
chmod -R 755 /home/f2hfresh-customer/htdocs/customer.f2hfresh.com/

echo "======================================================================"
echo " [F2H Auto-Sync] Deploying Partner Flutter Web App..."
echo "======================================================================"
cd "$REPO_DIR/apps/mobile/delivery"
/opt/flutter/bin/flutter build web --release --pwa-strategy=none
cp -r build/web/* /home/f2hfresh-partner/htdocs/partner.f2hfresh.com/
chmod -R 755 /home/f2hfresh-partner/htdocs/partner.f2hfresh.com/

echo "======================================================================"
echo " [F2H Auto-Sync] SUCCESS! Both Flutter web apps synced and deployed."
echo "======================================================================"
