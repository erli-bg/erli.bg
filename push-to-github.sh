#!/usr/bin/env bash
# push-to-github.sh
# One-shot setup: clean leftovers, initialize the local Git repo, commit,
# and push everything to https://github.com/erli-bg/erli.bg.
#
# Run this once from inside the erli.bg folder:
#   chmod +x push-to-github.sh
#   ./push-to-github.sh
#
# Authentication: easiest path is the GitHub CLI.
#   brew install gh && gh auth login
# After that, future git pushes just work, no password prompts.
# Otherwise git will ask for a username + a Personal Access Token
# (https://github.com/settings/tokens). macOS Keychain remembers it.

set -e

echo "==> Cleaning up any leftover .git folders from previous attempts"
for d in .git .git.broken .git.broken2; do
  if [ -e "$d" ]; then
    if rm -rf "$d" 2>/dev/null; then
      echo "    removed $d"
    else
      echo "    $d is owned by another user, using sudo to remove it"
      sudo rm -rf "$d"
    fi
  fi
done

echo "==> Initializing fresh git repository"
git init -b main
git config user.email "info@erli.bg"
git config user.name "erli.bg"

echo "==> Staging and committing"
git add .
git commit -m "Initial commit: site scaffold, 10 placeholder lessons, build script"

echo "==> Adding remote and pushing"
git remote add origin https://github.com/erli-bg/erli.bg.git 2>/dev/null || \
  git remote set-url origin https://github.com/erli-bg/erli.bg.git
git push -u origin main

echo
echo "Done. Confirm at https://github.com/erli-bg/erli.bg"
