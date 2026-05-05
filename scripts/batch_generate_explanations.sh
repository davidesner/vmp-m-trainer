#!/usr/bin/env bash
# Batch generátor explanations přes Claude Code CLI.
#
# Pro každou otázku, která ještě nemá explanations/q-{id}.html, spustí
# headless `claude -p` session se skillem explain-vmp-question. Sessions
# běží paralelně (worker pool přes xargs -P). Opakuje v kolech, dokud
# nejsou všechny otázky pokryté nebo dokud nedosáhne MAX_ROUNDS.
#
# Použití:
#   bash scripts/batch_generate_explanations.sh [CONCURRENCY] [MAX_ROUNDS]
#
# Příklady:
#   bash scripts/batch_generate_explanations.sh            # 3 paralelní, 5 kol
#   bash scripts/batch_generate_explanations.sh 4 3        # 4 paralelní, 3 kola
#   ONLY_WITH_IMAGE=1 bash scripts/batch_generate_explanations.sh
#       — jen otázky s obrázkem (162 ks, vysoký vizualizační payoff)
#   LIMIT=10 bash scripts/batch_generate_explanations.sh
#       — vezme jen prvních 10 chybějících (test run)
#
# Vyžaduje:
#   - claude CLI v PATH (Claude Code, přihlášený)
#   - python3
#   - skill v .claude/skills/explain-vmp-question/
#
# Logy: dist-skill/batch-logs/q-{id}.log
#
# Pozn.: používá `--permission-mode auto`, takže Claude rozhoduje
# autonomně (žádné permission prompts). Skill explicitně dostává
# povolení uložit HTML přímo přes prompt.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CONCURRENCY="${1:-3}"
MAX_ROUNDS="${2:-5}"
QUESTIONS_JSON="public/data/questions.json"
EXPLANATIONS_DIR="explanations"
LOG_DIR="dist-skill/batch-logs"

ONLY_WITH_IMAGE="${ONLY_WITH_IMAGE:-0}"
LIMIT="${LIMIT:-0}"

mkdir -p "$LOG_DIR"

# ---------- sanity ----------

if ! command -v claude > /dev/null; then
  echo "ERROR: 'claude' CLI nenalezen v PATH."
  echo "       Nainstaluj Claude Code: https://docs.claude.com/en/docs/claude-code"
  exit 1
fi

if [ ! -f "$QUESTIONS_JSON" ]; then
  echo "ERROR: $QUESTIONS_JSON neexistuje. Spusť nejdřív 'pnpm scrape'."
  exit 1
fi

if [ ! -f ".claude/skills/explain-vmp-question/SKILL.md" ]; then
  echo "ERROR: skill explain-vmp-question chybí v .claude/skills/."
  exit 1
fi

# ---------- helpers ----------

list_missing() {
  ONLY_WITH_IMAGE="$ONLY_WITH_IMAGE" \
  LIMIT="$LIMIT" \
  QUESTIONS_JSON="$QUESTIONS_JSON" \
  EXPLANATIONS_DIR="$EXPLANATIONS_DIR" \
  python3 - <<'PY'
import json
import os
from pathlib import Path

data = json.load(open(os.environ["QUESTIONS_JSON"]))
explanations = Path(os.environ["EXPLANATIONS_DIR"])
only_image = os.environ.get("ONLY_WITH_IMAGE", "0") == "1"
limit = int(os.environ.get("LIMIT", "0") or 0)

missing = []
for q in data["questions"]:
    if only_image and not q.get("image"):
        continue
    qid = q["id"]
    if not (explanations / f"q-{qid}.html").exists():
        missing.append(qid)

if limit > 0:
    missing = missing[:limit]

print("\n".join(str(m) for m in missing))
PY
}

generate_one() {
  local qid="$1"
  local html="$EXPLANATIONS_DIR/q-${qid}.html"

  # Race-safe re-check (jiný worker mohl mezitím dokončit)
  if [ -f "$html" ]; then
    echo "[$qid] skip (exists)"
    return 0
  fi

  local log="$LOG_DIR/q-${qid}.log"
  local start=$SECONDS

  local prompt="Vysvětli mi otázku #${qid} z VMP M testu (skill explain-vmp-question). Začni výkladem v chatu, vizualizací pokud pomůže (preferuj vizualizaci) — ulož do html rovnou. Na nic se neptej a dokonci task"

  # -p / --print            : non-interactive (vypíše a skončí)
  # --max-turns 20          : safety cap (typický run ~5-10 turns)
  # --permission-mode auto  : autonomní rozhodování (auto mode), bez prompts
  if claude \
      -p \
      --max-turns 20 \
      --permission-mode auto \
      "$prompt" \
      > "$log" 2>&1
  then
    local elapsed=$((SECONDS - start))
    if [ -f "$html" ]; then
      echo "[$qid] OK in ${elapsed}s"
      return 0
    else
      echo "[$qid] FAIL (no html) in ${elapsed}s — log: $log"
      return 1
    fi
  else
    local code=$?
    local elapsed=$((SECONDS - start))
    echo "[$qid] FAIL (exit $code) in ${elapsed}s — log: $log"
    return 1
  fi
}

export -f generate_one
export LOG_DIR EXPLANATIONS_DIR

# ---------- main loop ----------

filter_desc=""
[ "$ONLY_WITH_IMAGE" = "1" ] && filter_desc="$filter_desc only-with-image"
[ "$LIMIT" -gt 0 ] && filter_desc="$filter_desc limit=$LIMIT"
[ -n "$filter_desc" ] && echo "Filtry:$filter_desc"

round=0
while [ "$round" -lt "$MAX_ROUNDS" ]; do
  round=$((round + 1))

  missing=$(list_missing | grep -v '^$' || true)
  if [ -z "$missing" ]; then
    echo "✓ Všechny cílové otázky mají vysvětlení. Hotovo po $((round - 1)) kolech."
    exit 0
  fi

  count=$(printf '%s\n' "$missing" | wc -l | tr -d ' ')
  echo ""
  echo "=== Kolo $round/$MAX_ROUNDS · $count chybějících · concurrency=$CONCURRENCY ==="

  # xargs -P spustí až $CONCURRENCY paralelních volání generate_one.
  # `|| true` aby celkový skript nepadl při dílčí chybě (logujeme + pokračujeme).
  printf '%s\n' "$missing" \
    | xargs -n 1 -P "$CONCURRENCY" -I{} bash -c 'generate_one "$@"' _ {} \
    || true
done

remaining=$(list_missing | grep -v '^$' || true)
if [ -z "$remaining" ]; then
  echo ""
  echo "✓ Hotovo po $round kolech."
else
  count=$(printf '%s\n' "$remaining" | wc -l | tr -d ' ')
  echo ""
  echo "✗ Po $MAX_ROUNDS kolech zůstává $count nezpracovaných otázek."
  echo "  Zkontroluj logy v $LOG_DIR/ a případně pusť skript znovu."
  exit 2
fi
