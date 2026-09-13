#!/usr/bin/env bash
# 轮询远端分支；backend/docker-compose 有变更时自动 fast-forward 并重建容器。
# 由 cron 定时调用，不做交互，所有输出写入日志。
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH="main"
LOG="$HOME/.knowyou-deploy.log"
LOCK="/tmp/knowyou-deploy.lock"

export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export GIT_SSH_COMMAND="ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new"

log() { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >>"$LOG"; }

# 同一时间只允许一个实例，避免并发重建
exec 9>"$LOCK"
flock -n 9 || exit 0

cd "$REPO" || { log "repo not found: $REPO"; exit 1; }

if ! git fetch --quiet origin "$BRANCH"; then
  log "fetch failed (offline?)"
  exit 0
fi

local_rev="$(git rev-parse HEAD)"
remote_rev="$(git rev-parse "origin/$BRANCH")"
[ "$local_rev" = "$remote_rev" ] && exit 0

# 服务器上有未提交改动时不覆盖，留给人处理
if ! git diff --quiet || ! git diff --cached --quiet; then
  log "skip: working tree dirty (local=$local_rev remote=$remote_rev)"
  exit 0
fi

changed="$(git diff --name-only "$local_rev" "$remote_rev")"
log "update $local_rev -> $remote_rev | changed: $(echo "$changed" | tr '\n' ' ')"

if ! git merge --ff-only "origin/$BRANCH" >>"$LOG" 2>&1; then
  log "merge --ff-only failed; manual intervention needed"
  exit 1
fi

if echo "$changed" | grep -qE '^(backend/|docker-compose\.yml)'; then
  log "rebuilding backend..."
  if docker compose up -d --build backend >>"$LOG" 2>&1; then
    log "backend rebuilt"
  else
    log "backend rebuild FAILED"
  fi
fi

# 线上前端在 Vercel，这里只刷新本地预览容器
if echo "$changed" | grep -qE '^web/'; then
  log "rebuilding web (local preview)..."
  if docker compose up -d --build web >>"$LOG" 2>&1; then
    log "web rebuilt"
  else
    log "web rebuild FAILED"
  fi
fi
