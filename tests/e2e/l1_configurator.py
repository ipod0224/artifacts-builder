from playwright.sync_api import sync_playwright
import os

import os; output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'output'); os.makedirs(output_dir, exist_ok=True)
report = []

def log(msg):
    report.append(msg)
    print(msg)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    errors = []
    page.on("console", lambda m: errors.append(f"[{m.type}] {m.text}") if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(f"[pageerror] {e.message}"))

    page.goto("http://localhost:4103/dashboard/prices/configurator", wait_until="load", timeout=60000)
    page.wait_for_timeout(2000)

    log("=" * 60)
    log("CROSS TEST: Every category -> first value -> verify")
    log("=" * 60)

    categories_map = {
        "NFB": {"first_dim": "極數"},
        "漏電斷路器": {"first_dim": "極數"},
        "電磁接觸器": {"first_dim": "額定電流(A)"},
        "變壓器": {"first_dim": "型式"},
        "EMT 導管": {"first_dim": "管徑"},
        "EMT 另件": {"first_dim": "管徑"},
        "PVC 管": {"first_dim": "管種"},
        "PVC 另件": {"first_dim": "管徑"},
        "RSG 導管": {"first_dim": "管徑"},
        "不鏽鋼管": {"first_dim": "管徑"},
        "不鏽鋼另件": {"first_dim": "管徑"},
        "電纜": {"first_dim": "種類"},
        "熱動過載電驛": {"first_dim": "額定電流(A)"},
    }

    pass_count = 0
    fail_count = 0
    bug_list = []

    for cat, info in categories_map.items():
        log(f"\n--- {cat} ---")
        try:
            btn = page.get_by_text(cat, exact=False)
            if btn.count() == 0:
                log(f"  SKIP: not found")
                continue
            btn.first.click()
            page.wait_for_timeout(3000)

            # 1. Checkmark
            cat_chip = page.locator(f"button:has-text(\"{cat}\")").first
            has_check = cat_chip.locator("svg").count() > 0
            log(f"  [1] Checkmark: {'OK' if has_check else 'FAIL'}")
            if not has_check:
                fail_count += 1
                bug_list.append(f"{cat}: no checkmark")

            # 2. Step 2
            step2 = page.locator("text=Step 2")
            s2_ok = step2.count() > 0
            log(f"  [2] Step 2 visible: {'OK' if s2_ok else 'FAIL'}")

            # 3. First dimension values
            dim_label = page.locator(f"span.font-medium:has-text(\"{info['first_dim']}\")")
            if dim_label.count() > 0:
                parent = dim_label.locator("..").locator("..")
                chip_btns = parent.locator("button").all()
                vals = [b.inner_text() for b in chip_btns]
                log(f"  [3] {info['first_dim']}: {len(vals)} vals -> {vals[:6]}{'...' if len(vals)>6 else ''}")

                if len(chip_btns) > 0:
                    first_val = vals[0]
                    chip_btns[0].click()
                    page.wait_for_timeout(3000)

                    # 4. Summary bar
                    has_summary = page.locator("text=已選：").count() > 0
                    log(f"  [4] Summary bar: {'OK' if has_summary else 'FAIL'}")
                    if not has_summary:
                        fail_count += 1
                        bug_list.append(f"{cat}: no summary after {first_val}")

                    # 5. Results section
                    has_results = page.locator("text=比價結果").count() > 0
                    has_nodata = page.locator("text=目前條件無符合").count() > 0
                    if has_results and not has_nodata:
                        lowest = page.locator("text=/最低/")
                        log(f"  [5] Results: data OK, lowest badge: {'OK' if lowest.count()>0 else 'MISSING'}")
                    elif has_nodata:
                        log(f"  [5] Results: no data (expected for some categories)")
                    else:
                        log(f"  [5] Results: FAIL - no results section")
                        bug_list.append(f"{cat}: no results section")

                    # 6. Deselect toggle
                    chip_btns2 = parent.locator("button").all()
                    for cb in chip_btns2:
                        if cb.inner_text() == first_val:
                            cb.click()
                            break
                    page.wait_for_timeout(2000)
                    summary_gone = page.locator("text=已選：").count() == 0
                    log(f"  [6] Deselect toggle: {'OK' if summary_gone else 'FAIL'}")
                    if not summary_gone:
                        fail_count += 1
                        bug_list.append(f"{cat}: deselect failed {first_val}")

                    pass_count += 1
                else:
                    log(f"  [3] No chip values for {info['first_dim']}")
                    bug_list.append(f"{cat}: 0 values in {info['first_dim']}")
            else:
                log(f"  [3] Dim '{info['first_dim']}' not found")
                bug_list.append(f"{cat}: dim '{info['first_dim']}' missing")

        except Exception as e:
            log(f"  ERROR: {str(e)[:80]}")
            fail_count += 1
            bug_list.append(f"{cat}: {str(e)[:60]}")

    # ========== NFB DEEP DRILL ==========
    log("\n" + "=" * 60)
    log("NFB DEEP DRILL: poles x AF cross matrix")
    log("=" * 60)

    page.get_by_text("NFB", exact=False).first.click()
    page.wait_for_timeout(3000)

    for pole in ["1P", "2P", "3P", "4P"]:
        try:
            page.get_by_text(pole, exact=True).first.click()
            page.wait_for_timeout(3000)
            af_label = page.locator("span.font-medium:has-text(\"框架\")")
            if af_label.count() > 0:
                af_parent = af_label.locator("..").locator("..")
                af_vals = [c.inner_text() for c in af_parent.locator("button").all()]
                log(f"  {pole} -> AF: {af_vals}")
            else:
                log(f"  {pole} -> no AF dim")
            # Deselect
            page.get_by_text(pole, exact=True).first.click()
            page.wait_for_timeout(1500)
        except Exception as e:
            log(f"  {pole}: ERROR {str(e)[:60]}")

    # ========== NFB 3P DEEP: each AF -> count results ==========
    log("\n" + "=" * 60)
    log("NFB 3P -> each AF -> result count")
    log("=" * 60)

    page.get_by_text("3P", exact=True).first.click()
    page.wait_for_timeout(3000)

    af_label = page.locator("span.font-medium:has-text(\"框架\")")
    af_parent = af_label.locator("..").locator("..")
    af_chips = af_parent.locator("button").all()
    af_values = [c.inner_text() for c in af_chips]

    for af in af_values:
        try:
            af_btn = af_parent.locator(f"button:has-text(\"{af}\")").first
            af_btn.click()
            page.wait_for_timeout(3000)

            # Count product rows
            products_badge = page.locator("span:has-text(\"筆產品\")")
            if products_badge.count() > 0:
                txt = products_badge.first.inner_text()
                log(f"  3P + {af}AF: {txt}")
            else:
                no_data = page.locator("text=目前條件無符合").count() > 0
                log(f"  3P + {af}AF: {'no data' if no_data else 'UNKNOWN'}")

            # Deselect AF
            af_btn2 = af_parent.locator(f"button:has-text(\"{af}\")").first
            af_btn2.click()
            page.wait_for_timeout(2000)
        except Exception as e:
            log(f"  3P + {af}AF: ERROR {str(e)[:60]}")

    # Deselect 3P
    page.get_by_text("3P", exact=True).first.click()
    page.wait_for_timeout(1500)

    # ========== MOBILE ==========
    log("\n" + "=" * 60)
    log("MOBILE: 375x812")
    log("=" * 60)

    page.set_viewport_size({"width": 375, "height": 812})
    page.reload(wait_until="load", timeout=30000)
    page.wait_for_timeout(2000)

    page.get_by_text("NFB", exact=False).first.click()
    page.wait_for_timeout(3000)
    page.get_by_text("3P", exact=True).first.click()
    page.wait_for_timeout(3000)

    body_w = page.evaluate("document.body.scrollWidth")
    vp_w = page.evaluate("window.innerWidth")
    overflow = body_w > vp_w
    log(f"  Body: {body_w}px, Viewport: {vp_w}px")
    log(f"  Horizontal overflow: {'BUG' if overflow else 'OK'}")
    if overflow:
        bug_list.append(f"Mobile overflow: {body_w} > {vp_w}")

    page.screenshot(path=os.path.join(output_dir, "test-mobile.png"), full_page=True)
    log("  Screenshot saved")

    # ========== RAPID SWITCH STRESS ==========
    log("\n" + "=" * 60)
    log("STRESS: Rapid category switching x20")
    log("=" * 60)

    page.set_viewport_size({"width": 1280, "height": 900})
    page.reload(wait_until="load", timeout=30000)
    page.wait_for_timeout(2000)

    cats = ["NFB", "電纜", "變壓器", "EMT 導管", "漏電斷路器",
            "PVC 管", "電磁接觸器", "RSG 導管", "不鏽鋼管", "熱動過載電驛"]
    stress_errors = 0
    for i in range(20):
        try:
            cat = cats[i % len(cats)]
            page.get_by_text(cat, exact=False).first.click()
            page.wait_for_timeout(500)
        except Exception:
            stress_errors += 1

    page.wait_for_timeout(3000)
    log(f"  20 rapid switches, errors: {stress_errors}")
    log(f"  {'PASS' if stress_errors == 0 else 'FAIL'}")
    if stress_errors > 0:
        bug_list.append(f"Stress: {stress_errors} errors in rapid switching")

    page.screenshot(path=os.path.join(output_dir, "test-stress.png"), full_page=True)

    # ========== SUMMARY ==========
    log("\n" + "=" * 60)
    log("FINAL SUMMARY")
    log("=" * 60)
    log(f"Categories tested: {len(categories_map)}")
    log(f"Passed: {pass_count}")
    log(f"Failed: {fail_count}")
    log(f"Console errors: {len(errors)}")
    for e in errors[:5]:
        log(f"  {e[:120]}")
    log(f"Bugs found: {len(bug_list)}")
    for b in bug_list:
        log(f"  BUG: {b}")
    log(f"\nVerdict: {'ALL CLEAR' if len(bug_list) == 0 else f'{len(bug_list)} BUGS FOUND'}")

    browser.close()

with open(os.path.join(output_dir, "test-report.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(report))
print("\nReport -> tests/e2e/output/l1-configurator-report.txt")
