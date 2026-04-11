#!/bin/bash
set -e

NEW_NAME="HemanthP06"
NEW_EMAIL="peddadahemanth6@gmail.com"

echo ""
echo "============================================"
echo " Rewriting all git commits"
echo " New identity: $NEW_NAME <$NEW_EMAIL>"
echo "============================================"
echo ""

FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch -f --env-filter "
export GIT_AUTHOR_NAME=\"$NEW_NAME\"
export GIT_AUTHOR_EMAIL=\"$NEW_EMAIL\"
export GIT_COMMITTER_NAME=\"$NEW_NAME\"
export GIT_COMMITTER_EMAIL=\"$NEW_EMAIL\"
" -- --all

echo ""
echo "============================================"
echo " Done! All commits rewritten to $NEW_NAME"
echo "============================================"
echo ""
echo "Next step: push to GitHub with force flag"
echo "  git push origin main --force"
echo ""
echo "WARNING: This rewrites public history."
echo "Anyone else who has cloned the repo will need to re-clone."
echo ""
