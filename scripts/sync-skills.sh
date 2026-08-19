#!/usr/bin/env bash
# Sync docs/skills into .claude/skills as loadable agent skills.
#
# Claude Code discovers skills at .claude/skills/<name>/SKILL.md — one level deep, with the
# directory name matching the frontmatter `name`. docs/skills nests the framework skills one level
# deeper, so this script flattens them and symlinks each skill rather than copying it: docs/skills
# stays the single source of truth and an edit there is live immediately.
#
# Framework skills are linked only when the workspace actually uses them, matching the detection
# rules in docs/skills/agentic-development/references/skill-map.md. Linking all eight would put
# Laravel and Django rules in front of an agent working on a NestJS API.
#
# Idempotent: safe to re-run after adding, renaming, or removing a skill.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/docs/skills"
DEST="$ROOT/.claude/skills"

# A framework skill is linked when its manifest marker is present in the workspace.
framework_in_use() {
  case "$1" in
    nestjs)  grep -q '"@nestjs/core"' "$ROOT"/apps/*/package.json 2>/dev/null ;;
    nextjs)  grep -q '"next"'         "$ROOT"/apps/*/package.json 2>/dev/null ;;
    react)   grep -q '"react"'        "$ROOT"/apps/*/package.json 2>/dev/null ;;
    flutter) compgen -G "$ROOT/apps/mobile/*/pubspec.yaml" >/dev/null ;;
    laravel) [ -f "$ROOT/composer.json" ] && grep -q 'laravel/framework' "$ROOT/composer.json" ;;
    django)  grep -rqi '^django' "$ROOT"/requirements*.txt "$ROOT/pyproject.toml" 2>/dev/null ;;
    fastapi) grep -rqi '^fastapi' "$ROOT"/requirements*.txt "$ROOT/pyproject.toml" 2>/dev/null ;;
    golang)  [ -f "$ROOT/go.mod" ] ;;
    *)       return 1 ;;
  esac
}

# Remove stale links first so a renamed or deleted skill does not linger.
if [ -d "$DEST" ]; then
  find "$DEST" -maxdepth 1 -type l -delete
fi
mkdir -p "$DEST"

linked=0
skipped=""

link_skill() {
  local skill_dir="$1" name
  name="$(basename "$skill_dir")"

  # The frontmatter name is authoritative; a mismatch means the skill will not load.
  local declared
  declared="$(sed -n 's/^name:[[:space:]]*//p' "$skill_dir/SKILL.md" | head -1)"
  if [ "$declared" != "$name" ]; then
    echo "  ! $name: frontmatter name is '$declared' — fix it before syncing" >&2
    return 1
  fi

  ln -sfn "$(realpath --relative-to="$DEST" "$skill_dir")" "$DEST/$name"
  linked=$((linked + 1))
}

for skill in "$SRC"/*/; do
  [ -f "$skill/SKILL.md" ] || continue
  link_skill "${skill%/}"
done

for skill in "$SRC"/frameworks/*/; do
  [ -f "$skill/SKILL.md" ] || continue
  name="$(basename "${skill%/}")"
  if framework_in_use "$name"; then
    link_skill "${skill%/}"
  else
    skipped="$skipped $name"
  fi
done

echo "Linked $linked skills into .claude/skills"
[ -n "$skipped" ] && echo "Skipped (not used by this workspace):$skipped"
exit 0
