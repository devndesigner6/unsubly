#!/bin/bash
set -e

echo "Setting remote URL..."
git remote set-url origin https://github.com/devndesigner6/unsubly.git

echo "Rewriting all commit authors..."
git filter-branch --force --env-filter '
export GIT_AUTHOR_NAME="devndesigner6"
export GIT_AUTHOR_EMAIL="peddadahemanth6@gmail.com"
export GIT_COMMITTER_NAME="devndesigner6"
export GIT_COMMITTER_EMAIL="peddadahemanth6@gmail.com"
' --tag-name-filter cat -- --branches --tags

echo ""
echo "Done rewriting. Now pushing to GitHub..."
echo "When prompted, enter your GitHub username and Personal Access Token as password."
echo ""

git push origin main --force

echo ""
echo "All done! All commits are now under devndesigner6."
