#!/bin/bash
git remote set-url origin https://devndesigner6:${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/devndesigner6/unsubly.git
git push origin main --force
echo "Done! Check https://github.com/devndesigner6/unsubly"
