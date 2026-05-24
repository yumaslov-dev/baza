#!/bin/bash
REPO="/Users/maslov/OBSIDIAN_ALL/BAZA/BAZA"
cd "$REPO" || exit 1

if git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
  exit 0
fi

git add -A
git commit -m "auto: $(date '+%Y-%m-%d %H:%M')"
git push origin main
