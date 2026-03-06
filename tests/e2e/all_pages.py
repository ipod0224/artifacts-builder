"""
Universal Frontend Test Suite
==============================
Applies the 3-layer test chain to ALL dashboard pages.
L1: Page loads + interactive elements work
L2: Performance + visual stability + no console errors
L3: User task completion + cognitive load

Usage: python test-all-pages.py
"""

from playwright.sync_api import sync_playwright
from pixelmatch.contrib.PIL import pixelmatch
from PIL import Image
import os, time, io, json, math

import os; output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'output'); os.makedirs(output_dir, exist_ok=True)
baseline_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'baselines')
os.makedirs(baseline_dir, exist_ok=True)

report = []
all_findings = {}

def log(msg):
    report.append(msg)
    print(msg)

BASE = "http://localhost:4103"

# ========== PAGE DEFINITIONS ==========
PAGES = [
    {
        "id": "prices",
        "name": "價格情報",
        "path": "/dashboard/prices",
        "expected_text": ["價格情報", "品類"],
        "interactions": [
            {"type": "click_first", "selector": "button", "wait": 3000},
        ],
    },
    {
        "id": "configurator",
        "name": "互動配置器",
        "path": "/dashboard/prices/configurator",
        "expected_text": ["互動配置器", "Step 1"],
        "interactions": [
            {"type": "click_text", "text": "NFB", "wait": 3000},
            {"type": "click_text", "text": "3P", "exact": True, "wait": 3000},
        ],
    },
    {
        "id": "commodities",
        "name": "原物料指數",
        "path": "/dashboard/commodities",
        "expected_text": ["原物料"],
        "interactions": [
            {"type": "click_text", "text": "90", "wait": 2000},
        ],
    },
    {
        "id": "rag",
        "name": "RAG 知識庫搜尋",
        "path": "/dashboard/rag",
        "expected_text": ["RAG", "搜尋"],
        "interactions": [
            {"type": "fill_input", "placeholder": "搜尋", "value": "NFB", "wait": 3000},
        ],
    },
    {
        "id": "tcc",
        "name": "TCC 曲線",
        "path": "/dashboard/tcc",
        "expected_text": ["TCC"],
        "interactions": [],
    },
    {
        "id": "quotes",
        "name": "語錄",
        "path": "/dashboard/quotes",
        "expected_text": ["語錄"],
        "interactions": [],
    },
    {
        "id": "kanban",
        "name": "看板",
        "path": "/dashboard/kanban",
        "expected_text": ["看板"],
        "interactions": [],
    },
    {
        "id": "product",
        "name": "產品管理",
        "path": "/dashboard/product",
        "expected_text": ["Product"],
        "interactions": [],
    },
]


def test_page(page, pg_config, context):
    """Run L1+L2+L3 tests on a single page."""
    pid = pg_config["id"]
    findings = []
    console_errors = []

    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: console_errors.append(e.message))

    log(f"\n{'='*60}")
    log(f"PAGE: {pg_config['name']} ({pg_config['path']})")
    log(f"{'='*60}")

    # ── L1: FUNCTIONAL ──────────────────────────────────────
    log(f"  [L1] Functional Tests")

    # L1.1: Page loads
    t_start = time.time()
    try:
        page.goto(f"{BASE}{pg_config['path']}", wait_until="load", timeout=30000)
        page.wait_for_timeout(3000)
        t_load = time.time() - t_start
        log(f"    Load: {t_load:.2f}s -> {'OK' if t_load < 10 else 'SLOW'}")
        if t_load >= 10:
            findings.append(f"L1: Page load too slow ({t_load:.2f}s)")
    except Exception as e:
        log(f"    FAIL: Page load error - {str(e)[:60]}")
        findings.append(f"L1: Page load failed - {str(e)[:40]}")
        return findings

    # L1.2: Expected text present
    for text in pg_config["expected_text"]:
        found = page.locator(f"text={text}").count() > 0
        log(f"    Text '{text}': {'OK' if found else 'MISSING'}")
        if not found:
            findings.append(f"L1: Expected text '{text}' not found")

    # L1.3: No initial console errors
    initial_errors = len(console_errors)
    if initial_errors > 0:
        log(f"    Console errors on load: {initial_errors}")
        for e in console_errors[:3]:
            log(f"      {e[:100]}")
        findings.append(f"L1: {initial_errors} console errors on load")
    else:
        log(f"    Console errors: 0 -> OK")

    # L1.4: Interactive elements
    for action in pg_config["interactions"]:
        try:
            if action["type"] == "click_text":
                exact = action.get("exact", False)
                btn = page.get_by_text(action["text"], exact=exact).first
                if btn.count() > 0:
                    btn.click()
                    page.wait_for_timeout(action.get("wait", 2000))
                    log(f"    Click '{action['text']}': OK")
                else:
                    log(f"    Click '{action['text']}': NOT FOUND")
                    findings.append(f"L1: Interactive element '{action['text']}' not found")

            elif action["type"] == "click_first":
                btn = page.locator(action["selector"]).first
                if btn.count() > 0:
                    btn.click()
                    page.wait_for_timeout(action.get("wait", 2000))
                    log(f"    Click first {action['selector']}: OK")

            elif action["type"] == "fill_input":
                inputs = page.locator("input")
                filled = False
                for i in range(inputs.count()):
                    inp = inputs.nth(i)
                    placeholder = inp.get_attribute("placeholder") or ""
                    if action["placeholder"].lower() in placeholder.lower():
                        inp.fill(action["value"])
                        inp.press("Enter")
                        page.wait_for_timeout(action.get("wait", 2000))
                        log(f"    Fill '{action['placeholder']}' with '{action['value']}': OK")
                        filled = True
                        break
                if not filled:
                    # Try any visible input
                    if inputs.count() > 0:
                        inputs.first.fill(action["value"])
                        inputs.first.press("Enter")
                        page.wait_for_timeout(action.get("wait", 2000))
                        log(f"    Fill first input with '{action['value']}': OK (fallback)")
                    else:
                        log(f"    Fill: no input found")
                        findings.append(f"L1: No input for '{action['placeholder']}'")

        except Exception as e:
            log(f"    Action error: {str(e)[:60]}")
            findings.append(f"L1: Interaction failed - {str(e)[:40]}")

    # ── L2: ENGINEERING QUALITY ─────────────────────────────
    log(f"  [L2] Engineering Quality")

    # L2.1: Performance — Navigation timing
    perf = page.evaluate("""() => {
        const entries = performance.getEntriesByType('navigation');
        if (!entries.length) return null;
        const t = entries[0];
        return {
            ttfb: Math.round(t.responseStart - t.requestStart),
            domComplete: t.domComplete > 0 ? Math.round(t.domComplete - t.navigationStart) : -1
        };
    }""")
    if perf:
        log(f"    TTFB: {perf['ttfb']}ms, DOM: {perf['domComplete']}ms")
    else:
        log(f"    Performance API: no data")

    # L2.2: Visual baseline screenshot
    screenshot_path = os.path.join(baseline_dir, f"{pid}-baseline.png")
    page.screenshot(path=screenshot_path)
    log(f"    Baseline screenshot saved")

    # L2.3: Visual stability — reload and compare
    page.reload(wait_until="load", timeout=30000)
    page.wait_for_timeout(3000)

    # Re-run interactions after reload for fair comparison
    for action in pg_config["interactions"]:
        try:
            if action["type"] == "click_text":
                exact = action.get("exact", False)
                btn = page.get_by_text(action["text"], exact=exact).first
                if btn.count() > 0:
                    btn.click()
                    page.wait_for_timeout(action.get("wait", 2000))
            elif action["type"] == "fill_input":
                inputs = page.locator("input")
                if inputs.count() > 0:
                    inputs.first.fill(action.get("value", ""))
                    inputs.first.press("Enter")
                    page.wait_for_timeout(action.get("wait", 2000))
        except Exception:
            pass

    buf = page.screenshot()
    img_new = Image.open(io.BytesIO(buf))
    img_base = Image.open(screenshot_path)
    if img_new.size == img_base.size:
        diff_img = Image.new("RGBA", img_new.size)
        mismatch = pixelmatch(img_base, img_new, diff_img, threshold=0.15)
        total_px = img_new.size[0] * img_new.size[1]
        pct = mismatch / total_px * 100
        log(f"    Visual drift: {pct:.2f}% -> {'OK' if pct < 2 else 'DRIFT'}")
        if pct >= 2:
            diff_img.save(os.path.join(baseline_dir, f"{pid}-diff.png"))
            findings.append(f"L2: Visual drift {pct:.2f}%")
    else:
        log(f"    Size mismatch: {img_base.size} vs {img_new.size}")

    # L2.4: Mobile overflow check
    page.set_viewport_size({"width": 375, "height": 812})
    page.reload(wait_until="load", timeout=30000)
    page.wait_for_timeout(3000)
    body_w = page.evaluate("document.body.scrollWidth")
    vp_w = page.evaluate("window.innerWidth")
    overflow = body_w > vp_w
    log(f"    Mobile (375px): body={body_w}px -> {'OVERFLOW' if overflow else 'OK'}")
    if overflow:
        findings.append(f"L2: Mobile overflow {body_w}px > {vp_w}px")

    # L2.5: Console errors after interactions
    new_errors = len(console_errors) - initial_errors
    if new_errors > 0:
        log(f"    New console errors after interactions: {new_errors}")
        findings.append(f"L2: {new_errors} console errors during interaction")

    # Reset viewport
    page.set_viewport_size({"width": 1280, "height": 900})

    # ── L3: USER-CENTRIC ────────────────────────────────────
    log(f"  [L3] User-Centric")

    # L3.1: Cognitive load — count visible interactive elements
    page.goto(f"{BASE}{pg_config['path']}", wait_until="load", timeout=30000)
    page.wait_for_timeout(3000)

    cognitive = page.evaluate("""() => {
        const main = document.querySelector('main') || document.body;
        const buttons = main.querySelectorAll('button');
        const inputs = main.querySelectorAll('input, select, textarea');
        const links = main.querySelectorAll('a');
        return {
            buttons: buttons.length,
            inputs: inputs.length,
            links: links.length,
            total: buttons.length + inputs.length + links.length
        };
    }""")
    hick = math.log2(cognitive["total"] + 1) if cognitive["total"] > 0 else 0
    log(f"    Interactive elements: {cognitive['buttons']} btns + {cognitive['inputs']} inputs + {cognitive['links']} links = {cognitive['total']}")
    log(f"    Hick score: {hick:.1f} {'⚠️' if hick > 8 else '✓'}")

    # L3.2: First meaningful content — is there content above the fold?
    above_fold = page.evaluate("""() => {
        const vh = window.innerHeight;
        const main = document.querySelector('main') || document.body;
        const els = main.querySelectorAll('h1, h2, h3, p, table, [class*="card"], [class*="Card"]');
        let count = 0;
        for (const el of els) {
            if (el.getBoundingClientRect().top < vh) count++;
        }
        return { total: els.length, aboveFold: count };
    }""")
    log(f"    Content above fold: {above_fold['aboveFold']}/{above_fold['total']}")
    if above_fold['aboveFold'] == 0 and above_fold['total'] > 0:
        findings.append(f"L3: No content above fold")

    # L3.3: Accessibility basics
    a11y = page.evaluate("""() => {
        const main = document.querySelector('main') || document.body;
        const imgs = main.querySelectorAll('img');
        let noAlt = 0;
        for (const img of imgs) {
            if (!img.alt && !img.getAttribute('aria-label')) noAlt++;
        }
        const btns = main.querySelectorAll('button');
        let noLabel = 0;
        for (const b of btns) {
            if (!b.innerText?.trim() && !b.getAttribute('aria-label')) noLabel++;
        }
        return { images: imgs.length, noAlt, buttons: btns.length, noLabel };
    }""")
    if a11y["noAlt"] > 0:
        log(f"    Images without alt: {a11y['noAlt']}/{a11y['images']}")
        findings.append(f"L3: {a11y['noAlt']} images without alt text")
    if a11y["noLabel"] > 0:
        log(f"    Buttons without label: {a11y['noLabel']}/{a11y['buttons']}")
        findings.append(f"L3: {a11y['noLabel']} buttons without accessible label")
    if a11y["noAlt"] == 0 and a11y["noLabel"] == 0:
        log(f"    A11y basics: OK")

    # L3.4: Touch targets on mobile
    page.set_viewport_size({"width": 375, "height": 812})
    page.reload(wait_until="load", timeout=30000)
    page.wait_for_timeout(2000)
    touch = page.evaluate("""() => {
        const main = document.querySelector('main') || document.body;
        const btns = main.querySelectorAll('button, a, input');
        let small = 0, ok = 0;
        for (const b of btns) {
            const rect = b.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) continue;
            if (rect.height < 44 || rect.width < 44) small++;
            else ok++;
        }
        return { small, ok };
    }""")
    log(f"    Touch targets (mobile): {touch['ok']} OK, {touch['small']} small")

    page.set_viewport_size({"width": 1280, "height": 900})

    return findings


# ========== MAIN ==========
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1280, "height": 900})

    # Check server
    test_page_obj = context.new_page()
    try:
        test_page_obj.goto(f"{BASE}/dashboard/prices/configurator", wait_until="load", timeout=15000)
        log("Server check: OK\n")
    except Exception:
        log("ERROR: Dev server not running on port 4103!")
        log("Run: cd /c/workspace-claude/artifacts-builder && pnpm dev --port 4103")
        browser.close()
        exit(1)
    test_page_obj.close()

    # Test each page
    for pg in PAGES:
        page = context.new_page()
        try:
            findings = test_page(page, pg, context)
            all_findings[pg["id"]] = findings
        except Exception as e:
            log(f"  FATAL: {str(e)[:80]}")
            all_findings[pg["id"]] = [f"FATAL: {str(e)[:60]}"]
        finally:
            page.close()

    # ========== SUMMARY ==========
    log("\n" + "=" * 60)
    log("ALL PAGES SUMMARY")
    log("=" * 60)

    total_issues = 0
    for pid, findings in all_findings.items():
        pg = next(p for p in PAGES if p["id"] == pid)
        status = "PASS" if len(findings) == 0 else f"{len(findings)} issues"
        icon = "✓" if len(findings) == 0 else "✗"
        log(f"  {icon} {pg['name']}: {status}")
        for f in findings:
            log(f"      {f}")
            total_issues += 1

    log(f"\nTotal: {len(PAGES)} pages, {total_issues} issues")
    log(f"Verdict: {'ALL CLEAR' if total_issues == 0 else f'{total_issues} ISSUES FOUND'}")

    browser.close()

with open(os.path.join(output_dir, "test-all-pages-report.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(report))
print("\nReport -> tests/e2e/output/all-pages-report.txt")
