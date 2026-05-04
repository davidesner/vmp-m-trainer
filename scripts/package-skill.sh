#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/.claude/skills/explain-vmp-question"
OUT_DIR="$ROOT/dist-skill"
OUT_ZIP="$OUT_DIR/explain-vmp-question.zip"

mkdir -p "$OUT_DIR"
rm -f "$OUT_ZIP"

cd "$ROOT/.claude/skills"
zip -r "$OUT_ZIP" explain-vmp-question \
  -x '*/.DS_Store' \
  > /dev/null

echo "Wrote $OUT_ZIP"
