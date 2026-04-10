#!/bin/bash
# Run this script ONCE to remove .replit and replit.md from GitHub.
# Files stay on your local machine — they're just removed from git tracking.
# After this runs, GitHub will no longer show these files.

set -e

echo "Removing .replit and replit.md from git tracking..."
git rm --cached .replit 2>/dev/null && echo "  ✓ .replit untracked" || echo "  (already untracked)"
git rm --cached replit.md 2>/dev/null && echo "  ✓ replit.md untracked" || echo "  (already untracked)"

echo "Committing the change..."
git add .gitignore
git commit -m "Remove Replit config files from GitHub tracking"

echo "Pushing to GitHub..."
git push origin main

echo ""
echo "Done! .replit and replit.md are now removed from GitHub."
echo "They still exist locally for Replit to use."
