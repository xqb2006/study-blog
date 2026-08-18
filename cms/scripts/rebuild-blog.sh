#!/bin/sh
set -eu

PROJECT_ROOT=$(cd "$(dirname "$0")/../.." && pwd)
LOCK_DIR="$PROJECT_ROOT/.cache/cms-rebuild.lock"
PENDING_FILE="$PROJECT_ROOT/.cache/cms-rebuild.pending"
LOG_DIR="$PROJECT_ROOT/.cache/cms"
LOG_FILE="$LOG_DIR/rebuild-blog.log"
NEXT_DIST="$LOG_DIR/dist-next"
PREVIOUS_DIST="$LOG_DIR/dist-previous"

run_install_if_needed() {
  if [ -d node_modules ]; then
    return 0
  fi

  if command -v pnpm >/dev/null 2>&1; then
    pnpm install --frozen-lockfile --prod=false
    return 0
  fi

  if command -v corepack >/dev/null 2>&1; then
    corepack enable
    corepack prepare pnpm@9.15.1 --activate
    pnpm install --frozen-lockfile --prod=false
    return 0
  fi

  printf '[%s] rebuild failed: pnpm/corepack not found and node_modules is missing\n' "$(date '+%Y-%m-%d %H:%M:%S')"
  exit 1
}

run_astro_build() {
  if [ -x ./node_modules/.bin/astro ]; then
    ./node_modules/.bin/astro build --outDir "$NEXT_DIST"
    return $?
  fi

  if command -v pnpm >/dev/null 2>&1; then
    pnpm exec astro build --outDir "$NEXT_DIST"
    return $?
  fi

  if command -v npm >/dev/null 2>&1; then
    npm exec -- astro build --outDir "$NEXT_DIST"
    return $?
  fi

  printf '[%s] rebuild failed: no pnpm, npm, or local astro binary found\n' "$(date '+%Y-%m-%d %H:%M:%S')"
  return 1
}

publish_dist() {
  rm -rf "$PREVIOUS_DIST"
  mkdir -p dist
  cp -a dist/. "$PREVIOUS_DIST" 2>/dev/null || true
  find dist -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  cp -a "$NEXT_DIST"/. dist/
  if [ -f "$PREVIOUS_DIST/deleted-posts.json" ]; then
    cp "$PREVIOUS_DIST/deleted-posts.json" dist/deleted-posts.json
  fi
  rm -rf "$NEXT_DIST"
  if ! BLOG_DIST_PATH="${CMS_HOST_PROJECT_ROOT:-$PROJECT_ROOT}/dist" docker compose --env-file ./.env -f docker/docker-compose.yml ps -q --status running astro-koharu | grep -q .; then
    BLOG_DIST_PATH="${CMS_HOST_PROJECT_ROOT:-$PROJECT_ROOT}/dist" docker compose --env-file ./.env -f docker/docker-compose.yml up -d
  fi
}

run_rebuild_once() {
  rm -f "$PENDING_FILE"
  printf '[%s] rebuild start\n' "$(date '+%Y-%m-%d %H:%M:%S')"
  cd "$PROJECT_ROOT"
  run_install_if_needed
  if [ "${CMS_REBUILD_CLEAN_CACHE:-0}" = "1" ]; then
    sh scripts/clean-astro-cache.sh
  fi
  rm -rf "$NEXT_DIST"
  if ! run_astro_build; then
    if [ ! -f "$NEXT_DIST/index.html" ]; then
      printf '[%s] rebuild failed before index.html was generated\n' "$(date '+%Y-%m-%d %H:%M:%S')"
      exit 1
    fi
    printf '[%s] build exited non-zero after index.html was generated; publishing generated HTML\n' "$(date '+%Y-%m-%d %H:%M:%S')"
  fi
  publish_dist
  printf '[%s] rebuild complete\n' "$(date '+%Y-%m-%d %H:%M:%S')"
}

mkdir -p "$LOG_DIR"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  printf '[%s] rebuild already running\n' "$(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE"
  exit 0
fi

cleanup() {
  rmdir "$LOCK_DIR" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

{
  while :; do
    run_rebuild_once
    if [ ! -f "$PENDING_FILE" ]; then
      break
    fi
    printf '[%s] pending rebuild detected; running again\n' "$(date '+%Y-%m-%d %H:%M:%S')"
  done
} >> "$LOG_FILE" 2>&1
