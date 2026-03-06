"""
artifacts-builder 前端檢修流程（統一入口）
==========================================
三級測試，逐級遞進，任一級失敗即停：

  Level 0 — Smoke（< 30s）：伺服器活著 + 8 頁能開
  Level 1 — Regression（< 3min）：配置器功能 + 互動正確性
  Level 2 — Deep（< 10min）：工程品質 + 用戶中心 + 全頁面

用法：
  python tests/e2e/run.py              # 預設跑 L0 + L1
  python tests/e2e/run.py --level 0    # 只跑 Smoke
  python tests/e2e/run.py --level 2    # 跑全套 L0→L1→L2
  python tests/e2e/run.py --dry-run    # 列出會跑什麼，不實際執行

參考：
  - Playwright best practices (playwright.dev/docs/best-practices)
  - Smoke test < 15min 快速回饋 (circleci.com/blog/smoke-tests-in-cicd-pipelines)
  - 維護腳本規範 (CardQM/scripts/維護腳本規範.md)
"""

import argparse
import subprocess
import sys
import time
import os
from pathlib import Path

BASE_URL = "http://localhost:4103"
E2E_DIR = Path(__file__).parent.resolve()
OUTPUT_DIR = E2E_DIR / "output"


def check_server() -> bool:
    """L0 前置：伺服器是否活著"""
    import urllib.request
    try:
        urllib.request.urlopen(f"{BASE_URL}/dashboard/prices/configurator", timeout=10)
        return True
    except Exception:
        return False


def run_script(name: str, script: Path, timeout: int = 120) -> tuple[bool, float]:
    """執行單支測試腳本，回傳 (成功, 耗時秒)"""
    print(f"\n{'─'*50}")
    print(f"  Running: {name}")
    print(f"{'─'*50}")
    t0 = time.time()
    result = subprocess.run(
        [sys.executable, str(script)],
        cwd=str(E2E_DIR),
        timeout=timeout,
        capture_output=False,
    )
    elapsed = time.time() - t0
    ok = result.returncode == 0
    status = "PASS" if ok else "FAIL"
    print(f"  [{status}] {name} ({elapsed:.1f}s)")
    return ok, elapsed


# ─── Test Definitions ──────────────────────────────────────────────

LEVELS = {
    0: {
        "name": "Smoke",
        "description": "伺服器 + 8 頁可開",
        "budget": "30s",
        "tests": [
            # L0 uses inline check, no script
        ],
    },
    1: {
        "name": "Regression",
        "description": "配置器功能 + 互動正確性",
        "budget": "3min",
        "tests": [
            ("L1 配置器功能", E2E_DIR / "l1_configurator.py", 120),
            ("L1 截斷/揭露", E2E_DIR / "l1_disclosure.py", 120),
        ],
    },
    2: {
        "name": "Deep",
        "description": "工程品質 + 用戶中心 + 全頁面",
        "budget": "10min",
        "tests": [
            ("L2 工程品質", E2E_DIR / "l2_engineering.py", 180),
            ("L3 用戶中心", E2E_DIR / "l3_user_centric.py", 180),
            ("全頁面通測", E2E_DIR / "all_pages.py", 300),
        ],
    },
}


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--level", type=int, default=1, choices=[0, 1, 2],
                        help="最高測試級別（預設 1，會跑 0→1）")
    parser.add_argument("--dry-run", action="store_true",
                        help="只印出會跑什麼，不實際執行")
    args = parser.parse_args()

    OUTPUT_DIR.mkdir(exist_ok=True)

    print("=" * 60)
    print(f"  artifacts-builder 前端檢修 (Level 0→{args.level})")
    print("=" * 60)

    if args.dry_run:
        for lvl in range(args.level + 1):
            info = LEVELS[lvl]
            print(f"\n[L{lvl}] {info['name']} — {info['description']} ({info['budget']})")
            if lvl == 0:
                print("  - Server health check")
                print("  - 8 pages smoke (inline)")
            for name, script, timeout in info["tests"]:
                print(f"  - {name} ({script.name}, timeout={timeout}s)")
        print(f"\n[dry-run] 共 {sum(len(LEVELS[l]['tests']) for l in range(args.level+1))+1} 項測試")
        return

    total_pass = 0
    total_fail = 0
    t_start = time.time()

    # ── L0: Smoke ──────────────────────────────────────────────
    print(f"\n[L0] Smoke — 伺服器 + 頁面可達")
    if not check_server():
        print("  FAIL: Dev server not running on port 4103!")
        print("  Run: cd /c/workspace-claude/artifacts-builder && pnpm dev --port 4103")
        sys.exit(1)
    print("  Server: OK")

    # Quick page smoke
    import urllib.request
    pages = [
        "/dashboard/prices", "/dashboard/prices/configurator",
        "/dashboard/commodities", "/dashboard/rag",
        "/dashboard/tcc", "/dashboard/quotes",
        "/dashboard/kanban", "/dashboard/product",
    ]
    smoke_fail = 0
    for path in pages:
        try:
            code = urllib.request.urlopen(f"{BASE_URL}{path}", timeout=10).getcode()
            if code != 200:
                print(f"  {path}: HTTP {code}")
                smoke_fail += 1
            else:
                print(f"  {path}: OK")
        except Exception as e:
            print(f"  {path}: FAIL ({e})")
            smoke_fail += 1

    if smoke_fail > 0:
        print(f"\n  FAIL: {smoke_fail} pages unreachable")
        sys.exit(1)
    print(f"  [PASS] L0 Smoke ({time.time()-t_start:.1f}s)")
    total_pass += 1

    if args.level < 1:
        print(f"\nDone. L0 passed.")
        return

    # ── L1+: Script-based tests ────────────────────────────────
    for lvl in range(1, args.level + 1):
        info = LEVELS[lvl]
        print(f"\n{'='*60}")
        print(f"  [L{lvl}] {info['name']} — {info['description']}")
        print(f"{'='*60}")

        for name, script, timeout in info["tests"]:
            if not script.exists():
                print(f"  SKIP: {script.name} not found")
                total_fail += 1
                continue
            ok, elapsed = run_script(name, script, timeout)
            if ok:
                total_pass += 1
            else:
                total_fail += 1
                print(f"\n  GATE FAIL at L{lvl}: {name}")
                print(f"  Stopping — fix before running deeper tests.")
                break
        else:
            continue
        break  # break outer loop on gate failure

    # ── Summary ────────────────────────────────────────────────
    total_time = time.time() - t_start
    print(f"\n{'='*60}")
    print(f"  SUMMARY: {total_pass} passed, {total_fail} failed ({total_time:.1f}s)")
    print(f"{'='*60}")
    sys.exit(0 if total_fail == 0 else 1)


if __name__ == "__main__":
    main()
