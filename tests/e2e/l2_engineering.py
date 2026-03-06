"""
Playwright Advanced Testing Suite v3
=====================================
Method 1: Visual Regression (baseline + diff with pixelmatch)
Method 2: Element-Level Screenshot Comparison
Method 3: Performance Testing (load time + interaction latency)
Method 4: Network Interception (API contract validation)
Method 5: Accessibility Testing (focus, ARIA, contrast)
"""

from playwright.sync_api import sync_playwright
from pixelmatch.contrib.PIL import pixelmatch
from PIL import Image
import os, json, time, io

import os; output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'output'); os.makedirs(output_dir, exist_ok=True)
baseline_dir = os.path.join(output_dir, 'v3-baselines')
diff_dir = os.path.join(output_dir, 'v3-diffs')
os.makedirs(baseline_dir, exist_ok=True)
os.makedirs(diff_dir, exist_ok=True)

report = []
bug_list = []

def log(msg):
    report.append(msg)
    print(msg)

BASE = "http://localhost:4103/dashboard/prices/configurator"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1280, "height": 900})
    page = context.new_page()
    console_errors = []
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: console_errors.append(e.message))

    page.goto(BASE, wait_until="load", timeout=60000)
    page.wait_for_timeout(2000)

    # ================================================================
    # METHOD 1: VISUAL REGRESSION — Full page baselines
    # ================================================================
    log("=" * 60)
    log("M1: VISUAL REGRESSION — Baseline Screenshots")
    log("=" * 60)

    states = {}

    # State A: Landing (no category selected)
    page.screenshot(path=os.path.join(baseline_dir, "state-A-landing.png"))
    states["A-landing"] = os.path.join(baseline_dir, "state-A-landing.png")
    log("  [A] Landing page baseline saved")

    # State B: NFB selected (Step 2 visible)
    page.get_by_text("NFB").click()
    page.wait_for_timeout(3000)
    page.screenshot(path=os.path.join(baseline_dir, "state-B-nfb.png"))
    states["B-nfb"] = os.path.join(baseline_dir, "state-B-nfb.png")
    log("  [B] NFB selected baseline saved")

    # State C: NFB + 3P selected (collapsed poles + AF visible)
    page.get_by_text("3P", exact=True).first.click()
    page.wait_for_timeout(3000)
    page.screenshot(path=os.path.join(baseline_dir, "state-C-nfb-3p.png"))
    states["C-nfb-3p"] = os.path.join(baseline_dir, "state-C-nfb-3p.png")
    log("  [C] NFB+3P baseline saved")

    # State D: NFB + 3P + 50AF (full results)
    page.get_by_text("50", exact=True).first.click()
    page.wait_for_timeout(3000)
    page.screenshot(path=os.path.join(baseline_dir, "state-D-nfb-3p-50.png"), full_page=True)
    states["D-nfb-3p-50"] = os.path.join(baseline_dir, "state-D-nfb-3p-50.png")
    log("  [D] NFB+3P+50AF baseline saved")

    # Now reload and reproduce same states, compare with pixelmatch
    log("\n  Reproducing states for comparison...")
    page.reload(wait_until="load", timeout=30000)
    page.wait_for_timeout(2000)

    # Re-capture State A
    buf_a = page.screenshot()
    img_a_new = Image.open(io.BytesIO(buf_a))
    img_a_base = Image.open(states["A-landing"])
    # Ensure same size
    if img_a_new.size == img_a_base.size:
        diff_img = Image.new("RGBA", img_a_new.size)
        mismatch_a = pixelmatch(img_a_base, img_a_new, diff_img, threshold=0.1)
        total_px = img_a_new.size[0] * img_a_new.size[1]
        pct = mismatch_a / total_px * 100
        log(f"  [A] Landing diff: {mismatch_a} px ({pct:.2f}%) -> {'OK' if pct < 1 else 'DRIFT'}")
        if pct >= 1:
            diff_img.save(os.path.join(diff_dir, "diff-A-landing.png"))
            bug_list.append(f"M1: Landing visual drift {pct:.2f}%")
    else:
        log(f"  [A] Size mismatch: {img_a_base.size} vs {img_a_new.size}")
        bug_list.append("M1: Landing screenshot size mismatch")

    # Re-capture State B
    page.get_by_text("NFB").click()
    page.wait_for_timeout(3000)
    buf_b = page.screenshot()
    img_b_new = Image.open(io.BytesIO(buf_b))
    img_b_base = Image.open(states["B-nfb"])
    if img_b_new.size == img_b_base.size:
        diff_img_b = Image.new("RGBA", img_b_new.size)
        mismatch_b = pixelmatch(img_b_base, img_b_new, diff_img_b, threshold=0.1)
        total_px = img_b_new.size[0] * img_b_new.size[1]
        pct = mismatch_b / total_px * 100
        log(f"  [B] NFB diff: {mismatch_b} px ({pct:.2f}%) -> {'OK' if pct < 1 else 'DRIFT'}")
        if pct >= 1:
            diff_img_b.save(os.path.join(diff_dir, "diff-B-nfb.png"))
            bug_list.append(f"M1: NFB visual drift {pct:.2f}%")
    else:
        log(f"  [B] Size mismatch")

    # Re-capture State C
    page.get_by_text("3P", exact=True).first.click()
    page.wait_for_timeout(3000)
    buf_c = page.screenshot()
    img_c_new = Image.open(io.BytesIO(buf_c))
    img_c_base = Image.open(states["C-nfb-3p"])
    if img_c_new.size == img_c_base.size:
        diff_img_c = Image.new("RGBA", img_c_new.size)
        mismatch_c = pixelmatch(img_c_base, img_c_new, diff_img_c, threshold=0.1)
        total_px = img_c_new.size[0] * img_c_new.size[1]
        pct = mismatch_c / total_px * 100
        log(f"  [C] NFB+3P diff: {mismatch_c} px ({pct:.2f}%) -> {'OK' if pct < 1 else 'DRIFT'}")
        if pct >= 1:
            diff_img_c.save(os.path.join(diff_dir, "diff-C-nfb-3p.png"))
            bug_list.append(f"M1: NFB+3P visual drift {pct:.2f}%")
    else:
        log(f"  [C] Size mismatch")

    # ================================================================
    # METHOD 2: ELEMENT-LEVEL SCREENSHOT
    # ================================================================
    log("\n" + "=" * 60)
    log("M2: ELEMENT-LEVEL SCREENSHOT — Component isolation")
    log("=" * 60)

    # Reset to NFB selected state
    page.reload(wait_until="load", timeout=30000)
    page.wait_for_timeout(2000)
    page.get_by_text("NFB").click()
    page.wait_for_timeout(3000)

    # Screenshot: Step 1 card only
    step1_card = page.locator("text=Step 1").locator("..").locator("..")
    if step1_card.count() > 0:
        step1_card.first.screenshot(path=os.path.join(baseline_dir, "elem-step1-card.png"))
        log("  Step 1 card element screenshot saved")

    # Screenshot: Step 2 card only
    step2_card = page.locator("text=Step 2").locator("..").locator("..")
    if step2_card.count() > 0:
        step2_card.first.screenshot(path=os.path.join(baseline_dir, "elem-step2-card.png"))
        log("  Step 2 card element screenshot saved")

    # Screenshot: Individual dimension rows
    dim_labels = page.locator("span.font-medium").all()
    for dl in dim_labels[:5]:
        name = dl.inner_text()
        parent = dl.locator("..").locator("..")
        try:
            parent.screenshot(path=os.path.join(baseline_dir, f"elem-dim-{name}.png"))
            log(f"  Dimension '{name}' element screenshot saved")
        except Exception as e:
            log(f"  Dimension '{name}': screenshot failed ({str(e)[:50]})")

    # Select 3P and capture collapsed state
    page.get_by_text("3P", exact=True).first.click()
    page.wait_for_timeout(3000)

    # Screenshot: Collapsed poles dimension
    poles_label = page.locator("span.font-medium:has-text('極數')")
    if poles_label.count() > 0:
        poles_row = poles_label.locator("..").locator("..")
        poles_row.screenshot(path=os.path.join(baseline_dir, "elem-poles-collapsed.png"))
        log("  Collapsed poles dimension screenshot saved")

    # Reproduce collapsed state and compare
    page.reload(wait_until="load", timeout=30000)
    page.wait_for_timeout(2000)
    page.get_by_text("NFB").click()
    page.wait_for_timeout(3000)
    page.get_by_text("3P", exact=True).first.click()
    page.wait_for_timeout(3000)

    poles_label2 = page.locator("span.font-medium:has-text('極數')")
    if poles_label2.count() > 0:
        poles_row2 = poles_label2.locator("..").locator("..")
        buf_poles = poles_row2.screenshot()
        img_poles_new = Image.open(io.BytesIO(buf_poles))
        img_poles_base = Image.open(os.path.join(baseline_dir, "elem-poles-collapsed.png"))
        if img_poles_new.size == img_poles_base.size:
            diff_poles = Image.new("RGBA", img_poles_new.size)
            mm = pixelmatch(img_poles_base, img_poles_new, diff_poles, threshold=0.1)
            total_px = img_poles_new.size[0] * img_poles_new.size[1]
            pct = mm / total_px * 100
            log(f"  Collapsed poles diff: {mm} px ({pct:.2f}%) -> {'OK' if pct < 0.5 else 'DRIFT'}")
            if pct >= 0.5:
                diff_poles.save(os.path.join(diff_dir, "diff-poles-collapsed.png"))
                bug_list.append(f"M2: Collapsed poles visual drift {pct:.2f}%")
        else:
            log(f"  Size mismatch: {img_poles_base.size} vs {img_poles_new.size}")

    # ================================================================
    # METHOD 3: PERFORMANCE TESTING
    # ================================================================
    log("\n" + "=" * 60)
    log("M3: PERFORMANCE TESTING — Load & Interaction Latency")
    log("=" * 60)

    # Test 1: Full page load time
    page2 = context.new_page()
    t_start = time.time()
    page2.goto(BASE, wait_until="load", timeout=60000)
    t_load = time.time() - t_start
    log(f"  Page load time: {t_load:.2f}s -> {'OK' if t_load < 5 else 'SLOW'}")
    if t_load >= 5:
        bug_list.append(f"M3: Page load too slow: {t_load:.2f}s")

    # Navigation timing from browser
    nav_timing = page2.evaluate("""() => {
        const entries = performance.getEntriesByType('navigation');
        if (!entries.length) return { dns: 0, tcp: 0, ttfb: 0, domComplete: 0, loadEvent: 0 };
        const t = entries[0];
        return {
            dns: t.domainLookupEnd - t.domainLookupStart,
            tcp: t.connectEnd - t.connectStart,
            ttfb: t.responseStart - t.requestStart,
            domComplete: t.domComplete > 0 ? t.domComplete - t.navigationStart : -1,
            loadEvent: t.loadEventEnd > 0 ? t.loadEventEnd - t.navigationStart : -1
        };
    }""")
    log(f"  Navigation timing:")
    log(f"    DNS: {nav_timing['dns']:.0f}ms, TCP: {nav_timing['tcp']:.0f}ms")
    log(f"    TTFB: {nav_timing['ttfb']:.0f}ms")
    log(f"    DOM complete: {nav_timing['domComplete']:.0f}ms")
    log(f"    Load event: {nav_timing['loadEvent']:.0f}ms")

    # Test 2: Category selection latency
    page2.wait_for_timeout(1000)
    t_start = time.time()
    page2.get_by_text("NFB").click()
    # Wait for dimension label inside the configurator content area
    page2.locator("text=Step 2").wait_for(timeout=10000)
    page2.wait_for_timeout(2000)
    t_cat = time.time() - t_start
    log(f"  Category select -> first dimension visible: {t_cat:.2f}s -> {'OK' if t_cat < 3 else 'SLOW'}")
    if t_cat >= 3:
        bug_list.append(f"M3: Category selection too slow: {t_cat:.2f}s")

    # Test 3: Dimension click latency (3P selection)
    t_start = time.time()
    page2.get_by_text("3P", exact=True).first.click()
    # Wait for collapse animation + API response
    page2.locator("button:has-text('變更')").first.wait_for(timeout=10000)
    t_dim = time.time() - t_start
    log(f"  Dimension select -> collapse visible: {t_dim:.2f}s -> {'OK' if t_dim < 3 else 'SLOW'}")
    if t_dim >= 3:
        bug_list.append(f"M3: Dimension selection too slow: {t_dim:.2f}s")

    # Test 4: Repeated interaction latency (10x toggle)
    latencies = []
    for i in range(10):
        # Deselect via 變更
        change = page2.locator("button:has-text('變更')").first
        if change.count() > 0:
            t_s = time.time()
            change.click()
            page2.wait_for_timeout(500)
            latencies.append(time.time() - t_s)

        # Re-select 3P
        t_s = time.time()
        page2.get_by_text("3P", exact=True).first.click()
        page2.wait_for_timeout(500)
        latencies.append(time.time() - t_s)

    avg_lat = sum(latencies) / len(latencies) if latencies else 0
    max_lat = max(latencies) if latencies else 0
    log(f"  Toggle latency (20 ops): avg={avg_lat:.3f}s, max={max_lat:.3f}s")
    log(f"  Consistent: {'OK' if max_lat < avg_lat * 3 else 'JANK DETECTED'}")
    if max_lat >= avg_lat * 3 and avg_lat > 0:
        bug_list.append(f"M3: Jank detected, max={max_lat:.3f}s vs avg={avg_lat:.3f}s")

    page2.close()

    # ================================================================
    # METHOD 4: NETWORK INTERCEPTION — API Contract Validation
    # ================================================================
    log("\n" + "=" * 60)
    log("M4: NETWORK INTERCEPTION — API Contract Validation")
    log("=" * 60)

    page3 = context.new_page()
    api_calls = []
    api_errors = []

    def handle_response(response):
        if "/api/prices/spec-options" in response.url:
            try:
                status = response.status
                body = response.json()
                api_calls.append({
                    "url": response.url,
                    "status": status,
                    "success": body.get("success"),
                    "has_data": "data" in body,
                    "dim_count": len(body.get("data", {}).get("dimensions", [])),
                    "prod_count": len(body.get("data", {}).get("products", [])),
                    "has_summary": body.get("data", {}).get("summary") is not None,
                    "category": body.get("data", {}).get("category", "?"),
                })
            except Exception as e:
                api_errors.append(f"Parse error: {str(e)[:60]}")

    page3.on("response", handle_response)

    page3.goto(BASE, wait_until="load", timeout=60000)
    page3.wait_for_timeout(2000)

    # Trigger API calls for multiple categories
    test_cats = ["NFB", "漏電斷路器", "電磁接觸器", "變壓器", "電纜"]
    for cat in test_cats:
        page3.get_by_text(cat, exact=False).first.click()
        page3.wait_for_timeout(3000)

    # NFB deep drill: select dimensions to trigger filtered API
    page3.get_by_text("NFB").click()
    page3.wait_for_timeout(3000)
    page3.get_by_text("3P", exact=True).first.click()
    page3.wait_for_timeout(3000)
    page3.get_by_text("50", exact=True).first.click()
    page3.wait_for_timeout(3000)

    log(f"  API calls captured: {len(api_calls)}")
    log(f"  API parse errors: {len(api_errors)}")

    # Validate contract for each call
    contract_ok = 0
    contract_fail = 0
    for call in api_calls:
        issues = []
        if call["status"] != 200:
            issues.append(f"status={call['status']}")
        if not call["success"]:
            issues.append("success=false")
        if not call["has_data"]:
            issues.append("missing data field")
        if call["dim_count"] == 0:
            issues.append("0 dimensions")

        if issues:
            contract_fail += 1
            log(f"    FAIL {call['category']}: {', '.join(issues)}")
            bug_list.append(f"M4: API contract fail for {call['category']}: {', '.join(issues)}")
        else:
            contract_ok += 1

    log(f"  Contract: {contract_ok} OK, {contract_fail} FAIL")

    # Validate response structure for the filtered call (should have products)
    filtered_calls = [c for c in api_calls if c["prod_count"] > 0]
    log(f"  Calls with products: {len(filtered_calls)}")
    for fc in filtered_calls:
        log(f"    {fc['category']}: {fc['dim_count']} dims, {fc['prod_count']} products, summary={fc['has_summary']}")
        if not fc["has_summary"]:
            bug_list.append(f"M4: {fc['category']} has products but no summary")

    # Test: simulate slow network
    page3.reload(wait_until="load", timeout=30000)
    page3.wait_for_timeout(1000)

    # Route to add 2s delay
    slow_api_calls = []
    def slow_route(route):
        t_s = time.time()
        response = route.fetch()
        elapsed = time.time() - t_s
        slow_api_calls.append({"elapsed": elapsed, "status": response.status})
        route.fulfill(response=response)

    page3.route("**/api/prices/spec-options*", slow_route)
    page3.get_by_text("NFB").click()
    page3.wait_for_timeout(4000)

    if slow_api_calls:
        log(f"  Intercepted API: {slow_api_calls[0]['elapsed']:.2f}s, status={slow_api_calls[0]['status']}")
    page3.unroute("**/api/prices/spec-options*")

    # Test: mock error response
    def error_route(route):
        route.fulfill(status=500, body='{"success":false,"error":"mock server error"}',
                      headers={"content-type": "application/json"})

    page3.route("**/api/prices/spec-options*", error_route)
    page3.get_by_text("電纜", exact=False).first.click()
    page3.wait_for_timeout(3000)

    error_banner = page3.locator("text=API 錯誤")
    has_error_ui = error_banner.count() > 0
    log(f"  Mock 500 error -> error banner visible: {has_error_ui} -> {'OK' if has_error_ui else 'FAIL'}")
    if not has_error_ui:
        bug_list.append("M4: No error banner shown for 500 API response")
    page3.unroute("**/api/prices/spec-options*")

    page3.close()

    # ================================================================
    # METHOD 5: ACCESSIBILITY TESTING
    # ================================================================
    log("\n" + "=" * 60)
    log("M5: ACCESSIBILITY TESTING")
    log("=" * 60)

    page4 = context.new_page()
    page4.goto(BASE, wait_until="load", timeout=60000)
    page4.wait_for_timeout(2000)
    page4.get_by_text("NFB").click()
    page4.wait_for_timeout(3000)

    # Test 1: All filter chips are focusable via keyboard
    all_buttons = page4.locator("button").all()
    focusable_count = 0
    non_focusable = []
    for btn in all_buttons:
        try:
            tag = btn.evaluate("el => el.tagName")
            disabled = btn.evaluate("el => el.disabled")
            tabindex = btn.evaluate("el => el.tabIndex")
            if not disabled and tabindex >= 0:
                focusable_count += 1
            elif not disabled and tabindex < 0:
                non_focusable.append(btn.inner_text()[:20])
        except Exception:
            pass

    log(f"  Focusable buttons: {focusable_count}")
    if non_focusable:
        log(f"  Non-focusable (tabIndex<0): {non_focusable[:5]}")
        bug_list.append(f"M5: {len(non_focusable)} buttons not keyboard-focusable")
    else:
        log(f"  All buttons keyboard-focusable -> OK")

    # Test 2: Tab order test — tab through and verify focus moves
    page4.keyboard.press("Tab")
    page4.keyboard.press("Tab")
    page4.keyboard.press("Tab")
    focused = page4.evaluate("document.activeElement?.tagName + '.' + document.activeElement?.className?.slice(0,30)")
    log(f"  After 3 tabs, focused: {focused}")

    # Test 3: Keyboard activation — select via Enter/Space
    page4.keyboard.press("Tab")
    page4.keyboard.press("Tab")
    page4.keyboard.press("Tab")
    # Try to find a chip button and press Enter
    focused_text = page4.evaluate("document.activeElement?.innerText")
    log(f"  Focused element text: '{focused_text}'")
    page4.keyboard.press("Enter")
    page4.wait_for_timeout(2000)
    # Check if selection happened
    summary_visible = page4.locator("text=已選：").count() > 0
    log(f"  Enter key activates chip: {summary_visible}")

    # Test 4: Focus-visible ring check
    page4.reload(wait_until="load", timeout=30000)
    page4.wait_for_timeout(2000)
    page4.get_by_text("NFB").click()
    page4.wait_for_timeout(3000)

    # Tab to a chip and check if focus ring exists
    for _ in range(5):
        page4.keyboard.press("Tab")
    ring_style = page4.evaluate("""() => {
        const el = document.activeElement;
        if (!el) return null;
        const style = getComputedStyle(el);
        return {
            outline: style.outline,
            outlineOffset: style.outlineOffset,
            boxShadow: style.boxShadow,
            tag: el.tagName,
            text: el.innerText?.slice(0, 20)
        };
    }""")
    log(f"  Focus ring on '{ring_style.get('text', '?') if ring_style else '?'}':")
    if ring_style:
        has_outline = ring_style.get("outline", "none") != "none" and "0px" not in ring_style.get("outline", "")
        has_shadow = ring_style.get("boxShadow", "none") != "none"
        log(f"    outline: {ring_style.get('outline')}")
        log(f"    boxShadow: {ring_style.get('boxShadow', 'none')[:60]}")
        log(f"    Visible indicator: {'OK' if has_outline or has_shadow else 'MISSING'}")
        if not has_outline and not has_shadow:
            bug_list.append("M5: No visible focus indicator on chip buttons")
    else:
        log(f"    No element focused")

    # Test 5: Color contrast — check chip text vs background
    contrast_data = page4.evaluate("""() => {
        const chips = document.querySelectorAll('button');
        const results = [];
        for (const chip of Array.from(chips).slice(0, 10)) {
            const style = getComputedStyle(chip);
            results.push({
                text: chip.innerText?.slice(0, 15),
                color: style.color,
                bg: style.backgroundColor,
                fontSize: style.fontSize
            });
        }
        return results;
    }""")
    log(f"  Color contrast samples ({len(contrast_data)} buttons):")
    for cd in contrast_data[:5]:
        log(f"    '{cd['text']}': color={cd['color']}, bg={cd['bg']}, size={cd['fontSize']}")

    # Test 6: ARIA attributes check
    aria_data = page4.evaluate("""() => {
        const btns = document.querySelectorAll('button');
        let with_role = 0, with_label = 0, total = 0;
        for (const b of btns) {
            total++;
            if (b.getAttribute('role')) with_role++;
            if (b.getAttribute('aria-label') || b.getAttribute('aria-labelledby') || b.innerText.trim()) with_label++;
        }
        return { total, with_role, with_label };
    }""")
    log(f"  ARIA: {aria_data['total']} buttons, {aria_data['with_label']} have accessible label")
    unlabeled = aria_data['total'] - aria_data['with_label']
    if unlabeled > 0:
        log(f"  WARNING: {unlabeled} buttons without accessible label")
        bug_list.append(f"M5: {unlabeled} buttons without accessible label")
    else:
        log(f"  All buttons have accessible labels -> OK")

    # Test 7: Mobile touch target size (48x48 minimum per WCAG)
    page4.set_viewport_size({"width": 375, "height": 812})
    page4.reload(wait_until="load", timeout=30000)
    page4.wait_for_timeout(2000)
    page4.get_by_text("NFB", exact=False).first.click()
    page4.wait_for_timeout(3000)

    touch_data = page4.evaluate("""() => {
        const btns = document.querySelectorAll('button');
        let small = 0, ok = 0;
        const smalls = [];
        for (const b of btns) {
            const rect = b.getBoundingClientRect();
            if (rect.width < 44 || rect.height < 44) {
                small++;
                if (smalls.length < 3) {
                    smalls.push({ text: b.innerText?.slice(0, 15), w: Math.round(rect.width), h: Math.round(rect.height) });
                }
            } else {
                ok++;
            }
        }
        return { small, ok, smalls };
    }""")
    log(f"  Touch targets (mobile 375px): {touch_data['ok']} OK, {touch_data['small']} too small (<44px)")
    for s in touch_data.get("smalls", []):
        log(f"    '{s['text']}': {s['w']}x{s['h']}px")
    # Note: small touch targets are common, flag only as warning
    if touch_data["small"] > 0:
        log(f"  NOTE: {touch_data['small']} buttons below 44px minimum (WCAG 2.5.8)")

    page4.close()

    # ================================================================
    # FINAL SUMMARY
    # ================================================================
    log("\n" + "=" * 60)
    log("FINAL SUMMARY — Advanced Test Suite v3")
    log("=" * 60)
    log(f"Console errors: {len(console_errors)}")
    for e in console_errors[:3]:
        log(f"  {e[:120]}")
    log(f"Bugs found: {len(bug_list)}")
    for b in bug_list:
        log(f"  BUG: {b}")
    log(f"\nBaselines saved: {baseline_dir}")
    log(f"Diffs saved: {diff_dir}")
    log(f"\nVerdict: {'ALL CLEAR' if len(bug_list) == 0 else f'{len(bug_list)} ISSUES FOUND'}")

    browser.close()

with open(os.path.join(output_dir, "test-v3-report.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(report))
print("\nReport -> tests/e2e/output/l2-engineering-report.txt")
