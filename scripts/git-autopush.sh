#!/bin/bash
REPO="/Users/maslov/OBSIDIAN_ALL/BAZA/BAZA"
PASSWORD_FILE="$HOME/.baza-password"
cd "$REPO" || exit 1

# Пересоздаём зашифрованные версии если есть исходники и пароль
if [ -d "$REPO/docs-src" ] && [ -f "$PASSWORD_FILE" ]; then
  PASSWORD=$(cat "$PASSWORD_FILE")
  npx staticrypt "$REPO/docs-src/"*.html --password "$PASSWORD" --directory "$REPO/docs/" --remember 7 --short 2>/dev/null
fi

if git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
  exit 0
fi

git add -A
git commit -m "auto: $(date '+%Y-%m-%d %H:%M')"
git push origin main
