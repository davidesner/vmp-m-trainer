#!/usr/bin/env python3
"""
Načte otázku z public/data/questions-{testId}.json podle qid + testId
a vypíše vše, co skill potřebuje v Kroku 1.

Použití:
    python3 .claude/skills/explain-vmp-question/scripts/load_question.py <qid>            # default test M
    python3 .claude/skills/explain-vmp-question/scripts/load_question.py <qid> --test C   # test C
    python3 .claude/skills/explain-vmp-question/scripts/load_question.py <qid> --json

Bez --json vypisuje human-readable formát. S --json čistý JSON pro další parsing.
"""
import json
import sys
from pathlib import Path


def find_repo_root(start: Path, test_id: str) -> Path:
    cur = start.resolve()
    for _ in range(10):
        if (cur / "public" / "data" / f"questions-{test_id}.json").exists():
            return cur
        if cur.parent == cur:
            break
        cur = cur.parent
    return Path.cwd()


def load_question(qid: int, repo_root: Path, test_id: str) -> dict:
    qpath = repo_root / "public" / "data" / f"questions-{test_id}.json"
    if not qpath.exists():
        raise SystemExit(f"questions-{test_id}.json nenalezen: {qpath}")
    with qpath.open(encoding="utf-8") as f:
        data = json.load(f)
    questions = data.get("questions", []) if isinstance(data, dict) else data
    for q in questions:
        if q.get("id") == qid:
            return q
    raise SystemExit(f"Otázka qid={qid} nenalezena v testu {test_id} (celkem {len(questions)} otázek)")


def main() -> None:
    args = sys.argv[1:]
    as_json = "--json" in args
    test_id = "M"
    i = 0
    pos = []
    while i < len(args):
        a = args[i]
        if a == "--test" and i + 1 < len(args):
            test_id = args[i + 1].upper()
            i += 2
            continue
        if a.startswith("--test="):
            test_id = a.split("=", 1)[1].upper()
            i += 1
            continue
        if a.startswith("--"):
            i += 1
            continue
        pos.append(a)
        i += 1

    if not pos:
        print("usage: load_question.py <qid> [--test M|C] [--json]", file=sys.stderr)
        sys.exit(2)
    try:
        qid = int(pos[0])
    except ValueError:
        print(f"qid musí být číslo, dostal: {pos[0]}", file=sys.stderr)
        sys.exit(2)

    if test_id not in ("M", "C"):
        print(f"--test musí být M nebo C, dostal: {test_id}", file=sys.stderr)
        sys.exit(2)

    script_dir = Path(__file__).resolve().parent
    repo_root = find_repo_root(script_dir, test_id)
    q = load_question(qid, repo_root, test_id)

    image_field = q.get("image")
    image_resolved = None
    image_exists = False
    if image_field:
        rel = image_field.lstrip("/")
        candidate = repo_root / "public" / rel
        image_resolved = str(candidate)
        image_exists = candidate.exists()
    else:
        for ext in ("jpg", "png", "jpeg", "svg"):
            candidate = repo_root / "public" / "data" / "images" / test_id / f"q-{qid}.{ext}"
            if candidate.exists():
                image_resolved = str(candidate)
                image_exists = True
                break

    expl_dir = repo_root / "public" / "explanations" / test_id
    expl_html = expl_dir / f"q-{qid}.html"
    expl_meta = expl_dir / f"q-{qid}.meta.json"

    payload = {
        "qid": qid,
        "test_id": test_id,
        "repo_root": str(repo_root),
        "question": {
            "id": q.get("id"),
            "zkratka": q.get("zkratka"),
            "group": q.get("group"),
            "text": q.get("text"),
            "options": q.get("options"),
            "correct": q.get("correct"),
        },
        "image": {
            "field": image_field,
            "resolved_path": image_resolved,
            "exists": image_exists,
        },
        "existing_explanation": {
            "html_path": str(expl_html),
            "html_exists": expl_html.exists(),
            "meta_path": str(expl_meta),
            "meta_exists": expl_meta.exists(),
        },
    }

    if as_json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return

    qd = payload["question"]
    print(f"Otázka #{qd['id']} [Test {test_id}] ({qd['zkratka']}, skupina: {qd['group']})")
    print()
    print(qd["text"])
    print()
    for opt in qd["options"] or []:
        marker = "✓" if opt["key"] == qd["correct"] else " "
        print(f"  [{marker}] {opt['key']}) {opt['text']}")
    print()
    img = payload["image"]
    if img["resolved_path"]:
        status = "EXISTUJE — přečíst Read toolem" if img["exists"] else "CHYBÍ"
        print(f"Obrázek: {img['resolved_path']}  [{status}]")
    else:
        print("Obrázek: žádný")
    ex = payload["existing_explanation"]
    if ex["html_exists"]:
        print(f"Existující vysvětlení: {ex['html_path']}  ← přečíst před začátkem konverzace")
    else:
        print(f"Existující vysvětlení: žádné (uloží se do {ex['html_path']})")


if __name__ == "__main__":
    main()
