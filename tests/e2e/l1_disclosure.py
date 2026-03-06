from playwright.sync_api import sync_playwright
import os

import os; output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'output'); os.makedirs(output_dir, exist_ok=True)
report = []
bug_list = []

def log(msg):
    report.append(msg)
    print(msg)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(e.message))

    page.goto("http://localhost:4103/dashboard/prices/configurator", wait_until="load", timeout=60000)
    page.wait_for_timeout(2000)

    # ============================================================
    log("=" * 60)
    log("T1: TRUNCATION - verify +N button appears for large sets")
    log("=" * 60)

    page.get_by_text("NFB").click()
    page.wait_for_timeout(3000)

    # Count visible chips per dimension before any selection
    dims = {"極數": 4, "框架": 15, "額定電流": 49}
    for dim_name, total in dims.items():
        label = page.locator(f"span.font-medium:has-text(\"{dim_name}\")")
        if label.count() == 0:
            log(f"  {dim_name}: SKIP - not found")
            continue
        parent = label.locator("..").locator("..")
        chips = parent.locator("button").all()
        chip_texts = [c.inner_text() for c in chips]
        more_btn = [t for t in chip_texts if "更多" in t]
        regular = [t for t in chip_texts if "更多" not in t]
        if total > 10:
            has_more = len(more_btn) > 0
            log(f"  {dim_name} ({total}): {len(regular)} visible + more={more_btn} -> {'OK' if has_more else 'FAIL'}")
            if not has_more:
                bug_list.append(f"T1: {dim_name} missing +N more button")
        else:
            log(f"  {dim_name} ({total}): {len(regular)} visible, no truncation needed -> OK")

    # ============================================================
    log("\n" + "=" * 60)
    log("T2: PROGRESSIVE DISCLOSURE - selected dim collapses")
    log("=" * 60)

    page.get_by_text("3P", exact=True).first.click()
    page.wait_for_timeout(3000)

    # Poles should collapse to single chip + "變更"
    poles_label = page.locator("span.font-medium:has-text(\"極數\")")
    poles_parent = poles_label.locator("..").locator("..")
    poles_chips = poles_parent.locator("button").all()
    poles_texts = [c.inner_text() for c in poles_chips]
    change_btn = page.locator("button:has-text(\"變更\")")

    log(f"  After selecting 3P:")
    log(f"    Poles chips: {poles_texts}")
    log(f"    Change button visible: {change_btn.count() > 0}")

    # Should show only "3P" chip (with checkmark) + "變更"
    has_only_selected = len([t for t in poles_texts if "3P" in t]) == 1
    has_no_others = all("P" not in t or "3P" in t for t in poles_texts)
    log(f"    Only selected shown: {has_only_selected and has_no_others}")
    if not (has_only_selected and has_no_others):
        bug_list.append(f"T2: poles not collapsed after selection, showing {poles_texts}")

    # ============================================================
    log("\n" + "=" * 60)
    log("T3: CHANGE BUTTON - clicking '變更' deselects")
    log("=" * 60)

    change_btn.first.click()
    page.wait_for_timeout(3000)

    # Should expand back to show all poles
    poles_chips2 = poles_parent.locator("button").all()
    poles_texts2 = [c.inner_text() for c in poles_chips2]
    all_poles_back = all(p in poles_texts2 for p in ["1P", "2P", "3P", "4P"])
    log(f"  After clicking '變更': chips = {poles_texts2}")
    log(f"  All poles visible again: {all_poles_back}")
    if not all_poles_back:
        bug_list.append(f"T3: poles not expanded after '變更', showing {poles_texts2}")

    # Summary bar should be gone (no filters)
    summary_gone = page.locator("text=已選：").count() == 0
    log(f"  Summary bar cleared: {summary_gone}")
    if not summary_gone:
        bug_list.append("T3: summary bar still visible after deselect via '變更'")

    # ============================================================
    log("\n" + "=" * 60)
    log("T4: EXPAND +N MORE - shows all values")
    log("=" * 60)

    # Click +39 more on AT
    more_at = page.locator("button:has-text('+39')")
    if more_at.count() > 0:
        more_at.click()
        page.wait_for_timeout(1000)
        at_label = page.locator("span.font-medium:has-text(\"額定電流\")")
        at_parent = at_label.locator("..").locator("..")
        at_chips = at_parent.locator("button").all()
        at_texts = [c.inner_text() for c in at_chips]
        more_remaining = [t for t in at_texts if "更多" in t]
        log(f"  After expanding AT: {len(at_texts)} chips, more button remaining: {len(more_remaining)}")
        log(f"  All 49 visible: {'OK' if len(at_texts) >= 49 else 'FAIL'}")
        if len(at_texts) < 49:
            bug_list.append(f"T4: AT expanded but only {len(at_texts)} visible, expected 49")
    else:
        log(f"  FAIL: +39 more button not found")
        bug_list.append("T4: +39 more button not found for AT")

    # ============================================================
    log("\n" + "=" * 60)
    log("T5: SELECTED VALUE ALWAYS VISIBLE in truncated list")
    log("=" * 60)

    # Reload to reset expand state
    page.reload(wait_until="load", timeout=30000)
    page.wait_for_timeout(2000)
    page.get_by_text("NFB").click()
    page.wait_for_timeout(3000)

    # AF has 15 values, truncated to 10. Select value #12 (e.g., "800")
    # First expand AF to see "800", then collapse and verify
    af_more = page.locator("button:has-text('+5')")
    if af_more.count() > 0:
        af_more.click()
        page.wait_for_timeout(500)

    # Now select 800 (which is beyond position 10)
    btn_800 = page.locator("button:has-text(\"800\")").first
    if btn_800.count() > 0:
        btn_800.click()
        page.wait_for_timeout(3000)

        # AF should now be collapsed to just "800" + 變更
        af_label = page.locator("span.font-medium:has-text(\"框架\")")
        af_parent = af_label.locator("..").locator("..")
        af_chips = af_parent.locator("button").all()
        af_texts = [c.inner_text() for c in af_chips]
        log(f"  Selected AF=800 (was hidden): chips = {af_texts}")
        has_800 = any("800" in t for t in af_texts)
        log(f"  800 visible: {has_800} -> {'OK' if has_800 else 'FAIL'}")
        if not has_800:
            bug_list.append("T5: selected value 800 not visible in collapsed AF")

        # Deselect 800
        page.locator("button:has-text(\"800\")").first.click()
        page.wait_for_timeout(2000)
    else:
        log(f"  SKIP: 800 button not found")

    # ============================================================
    log("\n" + "=" * 60)
    log("T6: EDGE CASE - select value at position 10 (boundary)")
    log("=" * 60)

    # AF truncated at 10: positions 0-9 visible. Select pos 9 (last visible)
    af_label = page.locator("span.font-medium:has-text(\"框架\")")
    af_parent = af_label.locator("..").locator("..")
    af_chips = af_parent.locator("button").all()
    af_texts = [c.inner_text() for c in af_chips]
    visible_af = [t for t in af_texts if "更多" not in t]

    if len(visible_af) >= 10:
        last_visible = visible_af[9]
        log(f"  Last visible AF value (pos 9): {last_visible}")
        page.locator(f"button:has-text(\"{last_visible}\")").first.click()
        page.wait_for_timeout(3000)

        # Should collapse correctly
        af_chips2 = af_parent.locator("button").all()
        af_texts2 = [c.inner_text() for c in af_chips2]
        log(f"  After selecting boundary value: {af_texts2}")
        log(f"  OK" if any(last_visible in t for t in af_texts2) else "  FAIL")

        # Deselect
        page.locator(f"button:has-text(\"{last_visible}\")").first.click()
        page.wait_for_timeout(2000)
    else:
        log(f"  SKIP: less than 10 AF values visible")

    # ============================================================
    log("\n" + "=" * 60)
    log("T7: RAPID SELECT/DESELECT across collapsed dimensions")
    log("=" * 60)

    stress_errors = 0
    for i in range(15):
        try:
            # Select 3P
            page.get_by_text("3P", exact=True).first.click()
            page.wait_for_timeout(400)
            # Deselect via 變更
            change = page.locator("button:has-text(\"變更\")").first
            if change.count() > 0:
                change.click()
                page.wait_for_timeout(400)
        except Exception:
            stress_errors += 1

    log(f"  15 rapid select/deselect cycles, errors: {stress_errors}")
    log(f"  {'PASS' if stress_errors == 0 else 'FAIL'}")
    if stress_errors > 0:
        bug_list.append(f"T7: {stress_errors} errors in rapid toggle")

    # ============================================================
    log("\n" + "=" * 60)
    log("T8: ALL CATEGORIES - truncation + collapse consistency")
    log("=" * 60)

    cats = ["電纜", "漏電斷路器", "電磁接觸器", "變壓器", "EMT 導管",
            "PVC 管", "RSG 導管", "不鏽鋼管", "熱動過載電驛"]
    for cat in cats:
        try:
            page.get_by_text(cat, exact=False).first.click()
            page.wait_for_timeout(3000)

            # Get first dimension
            first_dim = page.locator("span.font-medium").first
            dim_name = first_dim.inner_text() if first_dim.count() > 0 else "?"
            parent = first_dim.locator("..").locator("..")
            chips = parent.locator("button").all()
            texts = [c.inner_text() for c in chips]
            more = [t for t in texts if "更多" in t]
            regular = [t for t in texts if "更多" not in t and "變更" not in t]

            # Click first value
            if len(regular) > 0:
                chips[0].click()
                page.wait_for_timeout(2000)
                chips_after = parent.locator("button").all()
                texts_after = [c.inner_text() for c in chips_after]
                collapsed = len(texts_after) <= 2  # selected chip + 變更
                change_visible = page.locator("button:has-text(\"變更\")").count() > 0
                log(f"  {cat} [{dim_name}]: {len(regular)} vals, more={len(more)>0}, collapsed={collapsed}, change={change_visible} -> {'OK' if collapsed and change_visible else 'CHECK'}")

                if not collapsed:
                    bug_list.append(f"T8: {cat} not collapsed after selection")

                # Deselect
                chips_after[0].click()
                page.wait_for_timeout(1500)
            else:
                log(f"  {cat} [{dim_name}]: no values")
        except Exception as e:
            log(f"  {cat}: ERROR {str(e)[:60]}")
            bug_list.append(f"T8: {cat} error: {str(e)[:40]}")

    # ============================================================
    log("\n" + "=" * 60)
    log("T9: MOBILE - truncation + collapse on 375px")
    log("=" * 60)

    page.set_viewport_size({"width": 375, "height": 812})
    page.reload(wait_until="load", timeout=30000)
    page.wait_for_timeout(2000)
    page.get_by_text("NFB", exact=False).first.click()
    page.wait_for_timeout(3000)
    page.get_by_text("3P", exact=True).first.click()
    page.wait_for_timeout(3000)
    page.get_by_text("50", exact=True).first.click()
    page.wait_for_timeout(3000)

    body_w = page.evaluate("document.body.scrollWidth")
    vp_w = page.evaluate("window.innerWidth")
    overflow = body_w > vp_w
    log(f"  Body: {body_w}px, Viewport: {vp_w}px -> {'OVERFLOW BUG' if overflow else 'OK'}")
    if overflow:
        bug_list.append(f"T9: mobile overflow {body_w} > {vp_w}")

    page.screenshot(path=os.path.join(output_dir, "v2-mobile-collapsed.png"), full_page=True)
    log(f"  Screenshot saved")

    # ============================================================
    log("\n" + "=" * 60)
    log("T10: SUMMARY BAR vs COLLAPSE interaction")
    log("=" * 60)

    page.set_viewport_size({"width": 1280, "height": 900})
    page.reload(wait_until="load", timeout=30000)
    page.wait_for_timeout(2000)
    page.get_by_text("NFB", exact=False).first.click()
    page.wait_for_timeout(3000)

    # Select 3P then 50AF
    page.get_by_text("3P", exact=True).first.click()
    page.wait_for_timeout(3000)
    page.get_by_text("50", exact=True).first.click()
    page.wait_for_timeout(3000)

    # Now remove "極數: 3P" from summary bar
    summary_poles = page.locator("button:has-text(\"極數: 3P\")")
    if summary_poles.count() > 0:
        summary_poles.click()
        page.wait_for_timeout(3000)

        # Poles dimension should expand back (no longer selected)
        poles_label = page.locator("span.font-medium:has-text(\"極數\")")
        poles_parent = poles_label.locator("..").locator("..")
        poles_chips = poles_parent.locator("button").all()
        poles_texts = [c.inner_text() for c in poles_chips]
        expanded_back = len([t for t in poles_texts if "P" in t and "更多" not in t]) >= 3
        log(f"  Removed 極數 from summary -> poles chips: {poles_texts}")
        log(f"  Poles expanded back: {expanded_back}")
        if not expanded_back:
            bug_list.append("T10: poles not expanded after removing from summary bar")

        # AF should still be collapsed (still selected)
        af_label = page.locator("span.font-medium:has-text(\"框架\")")
        af_parent = af_label.locator("..").locator("..")
        af_chips = af_parent.locator("button").all()
        af_texts = [c.inner_text() for c in af_chips]
        af_collapsed = len(af_texts) <= 2
        log(f"  AF still collapsed: {af_collapsed} -> chips: {af_texts}")
        if not af_collapsed:
            bug_list.append(f"T10: AF expanded unexpectedly after removing poles: {af_texts}")
    else:
        log(f"  FAIL: summary chip '極數: 3P' not found")
        bug_list.append("T10: summary chip for poles not found")

    page.screenshot(path=os.path.join(output_dir, "v2-summary-interaction.png"), full_page=True)

    # ============================================================
    log("\n" + "=" * 60)
    log("FINAL SUMMARY")
    log("=" * 60)
    log(f"Console errors: {len(errors)}")
    for e in errors[:3]:
        log(f"  {e[:120]}")
    log(f"Bugs found: {len(bug_list)}")
    for b in bug_list:
        log(f"  BUG: {b}")
    log(f"\nVerdict: {'ALL CLEAR' if len(bug_list) == 0 else f'{len(bug_list)} BUGS FOUND'}")

    browser.close()

with open(os.path.join(output_dir, "test-v2-report.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(report))
print("\nReport -> tests/e2e/output/l1-disclosure-report.txt")
