#!/bin/bash
set -e

echo "Rewriting all commit authors to devndesigner6..."

FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch -f --env-filter '
export GIT_AUTHOR_NAME="devndesigner6"
export GIT_AUTHOR_EMAIL="peddadahemanth6@gmail.com"
export GIT_COMMITTER_NAME="devndesigner6"
export GIT_COMMITTER_EMAIL="peddadahemanth6@gmail.com"
' -- --all

echo ""
echo "Done! All commits rewritten to devndesigner6."
echo "Now run: git push origin main --force"
