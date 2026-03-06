"""
User-Centric Test Suite v4
===========================
不測像素、不測延遲、不測 API contract
只測：用戶能不能順利完成任務？

Scenario 1: 任務完成時間 — 從進入到完成一次完整比價要幾步？
Scenario 2: 認知負荷 — 每一步有多少選項要消化？
Scenario 3: 錯誤復原 — 選錯後能不能輕鬆改回來？
Scenario 4: 資訊氣味 — 品類名稱是否自解釋？
Scenario 5: 漏斗分析 — 模擬 10 種真實比價場景的成功率
Scenario 6: 漸進揭露認知測試 — collapse 後用戶是否迷失？
"""

from playwright.sync_api import sync_playwright
import os, time

import os; output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'output'); os.makedirs(output_dir, exist_ok=True)
report = []
findings = []

def log(msg):
    report.append(msg)
    print(msg)

BASE = "http://localhost:4103/dashboard/prices/configurator"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    page.goto(BASE, wait_until="load", timeout=60000)
    page.wait_for_timeout(2000)

    # ================================================================
    # S1: 任務完成步驟數 + 決策點計數
    # 任務：找出 NFB 3P 50AF 的最低價
    # ================================================================
    log("=" * 60)
    log("S1: TASK COMPLETION — NFB 3P 50AF 最低價要幾步？")
    log("=" * 60)

    clicks = 0
    decisions = []  # 每步要從幾個選項中選

    # Step 1: 選品類
    cat_buttons = page.locator("button").filter(has_text="NFB").count()
    all_cats = page.evaluate("""() => {
        const cards = document.querySelectorAll('button');
        return Array.from(cards).filter(b => {
            const rect = b.getBoundingClientRect();
            return rect.top > 100 && rect.top < 400 && rect.width > 30;
        }).map(b => b.innerText.trim()).filter(t => t.length > 0 && t.length < 20);
    }""")
    decisions.append({"step": "選品類", "options": len(all_cats), "items": all_cats})
    page.get_by_text("NFB").click()
    clicks += 1
    page.wait_for_timeout(3000)

    # Step 2: 選極數
    poles_vals = page.evaluate("""() => {
        const labels = document.querySelectorAll('span.font-medium');
        for (const l of labels) {
            if (l.textContent.includes('極數')) {
                const parent = l.parentElement.parentElement;
                const btns = parent.querySelectorAll('button');
                return Array.from(btns).map(b => b.innerText.trim());
            }
        }
        return [];
    }""")
    decisions.append({"step": "選極數", "options": len(poles_vals), "items": poles_vals})
    page.get_by_text("3P", exact=True).first.click()
    clicks += 1
    page.wait_for_timeout(3000)

    # Step 3: 選框架
    af_vals = page.evaluate("""() => {
        const labels = document.querySelectorAll('span.font-medium');
        for (const l of labels) {
            if (l.textContent.includes('框架')) {
                const parent = l.parentElement.parentElement;
                const btns = parent.querySelectorAll('button');
                return Array.from(btns).map(b => b.innerText.trim());
            }
        }
        return [];
    }""")
    decisions.append({"step": "選框架(AF)", "options": len(af_vals), "items": af_vals})
    page.get_by_text("50", exact=True).first.click()
    clicks += 1
    page.wait_for_timeout(3000)

    # 結果出來了嗎？
    has_results = page.locator("text=比價結果").count() > 0
    has_lowest = page.locator("text=最低").count() > 0

    log(f"\n  任務：找 NFB 3P 50AF 最低價")
    log(f"  總點擊次數：{clicks}")
    log(f"  結果出現：{has_results}")
    log(f"  最低價標記：{has_lowest}")
    log(f"\n  每步決策負荷：")
    total_cognitive = 0
    for d in decisions:
        total_cognitive += d["options"]
        log(f"    {d['step']}: 從 {d['options']} 個選項中選 1")
        if d["options"] > 10:
            log(f"      ⚠️ 選項過多，可能造成選擇疲勞")
    log(f"  總認知負荷：{total_cognitive} 個選項需消化")

    if clicks <= 3 and has_results:
        log(f"  ✓ 3 步完成比價，流程合理")
    else:
        findings.append(f"S1: 完成比價需要 {clicks} 步，{'有' if has_results else '無'}結果")

    # ================================================================
    # S2: 認知負荷 — 每個品類的維度 × 選項矩陣
    # ================================================================
    log("\n" + "=" * 60)
    log("S2: COGNITIVE LOAD — 每個品類用戶要消化多少資訊？")
    log("=" * 60)

    page.reload(wait_until="load", timeout=30000)
    page.wait_for_timeout(2000)

    cat_names = ["NFB", "漏電斷路器", "電磁接觸器", "變壓器", "電纜",
                 "EMT 導管", "PVC 管", "RSG 導管", "不鏽鋼管", "熱動過載電驛"]

    cognitive_scores = []
    for cat in cat_names:
        try:
            page.get_by_text(cat, exact=False).first.click()
            page.wait_for_timeout(3000)

            dims = page.evaluate("""() => {
                const labels = document.querySelectorAll('span.font-medium');
                const results = [];
                for (const l of labels) {
                    const parent = l.parentElement?.parentElement;
                    if (!parent) continue;
                    const btns = parent.querySelectorAll('button');
                    const vals = Array.from(btns).map(b => b.innerText.trim()).filter(t => t.length > 0);
                    if (vals.length > 0) {
                        results.push({ name: l.textContent.trim(), count: vals.length });
                    }
                }
                return results;
            }""")

            total = sum(d["count"] for d in dims)
            dim_count = len(dims)
            cognitive_scores.append({"cat": cat, "dims": dim_count, "total_options": total, "details": dims})

            status = "⚠️ 高" if total > 30 else "✓ 適中" if total > 10 else "✓ 簡單"
            log(f"  {cat}: {dim_count} 維度, {total} 選項 [{status}]")
            for d in dims:
                flag = " ← 過多" if d["count"] > 15 else ""
                log(f"    {d['name']}: {d['count']}{flag}")

        except Exception as e:
            log(f"  {cat}: ERROR {str(e)[:50]}")

    # Hick's Law: 決策時間 = a + b × log2(n)
    log(f"\n  Hick's Law 預測（決策時間正比於 log2(選項數)）：")
    for cs in cognitive_scores:
        import math
        hick_score = sum(math.log2(d["count"] + 1) for d in cs["details"])
        log(f"    {cs['cat']}: Hick score = {hick_score:.1f} {'⚠️ 高認知' if hick_score > 15 else '✓'}")
        if hick_score > 15:
            findings.append(f"S2: {cs['cat']} Hick score {hick_score:.1f}，選項過多可能導致放棄")

    # ================================================================
    # S3: 錯誤復原 — 選錯後改回來的成本
    # ================================================================
    log("\n" + "=" * 60)
    log("S3: ERROR RECOVERY — 選錯後能輕鬆改嗎？")
    log("=" * 60)

    page.reload(wait_until="load", timeout=30000)
    page.wait_for_timeout(2000)
    page.get_by_text("NFB").click()
    page.wait_for_timeout(3000)

    # Scenario A: 選了 2P，發現要 3P，要幾步改？
    log("\n  場景 A：選了 2P，要改成 3P")
    page.get_by_text("2P", exact=True).first.click()
    page.wait_for_timeout(3000)
    recovery_clicks_a = 0

    # 方法 1: 點「變更」再選 3P
    change_btn = page.locator("button:has-text('變更')").first
    if change_btn.count() > 0:
        # 極數 collapsed，需要先點變更
        change_btn.click()
        recovery_clicks_a += 1
        page.wait_for_timeout(2000)

        # 現在能直接選 3P 嗎？
        three_p = page.get_by_text("3P", exact=True).first
        if three_p.count() > 0:
            three_p.click()
            recovery_clicks_a += 1
            page.wait_for_timeout(2000)
            log(f"    透過「變更」→ 重選: {recovery_clicks_a} 步 {'✓' if recovery_clicks_a <= 2 else '⚠️'}")
        else:
            log(f"    ⚠️ 變更後 3P 不可見")
            findings.append("S3: 變更後選項未展開")
    else:
        log(f"    ⚠️ 變更按鈕不存在")
        findings.append("S3: 變更按鈕缺失")

    # Scenario B: 選了 3P + 50AF，要改品類到漏電斷路器
    log("\n  場景 B：NFB 3P 50AF 選到一半，改品類")
    page.get_by_text("50", exact=True).first.click()
    page.wait_for_timeout(3000)
    recovery_clicks_b = 0

    page.get_by_text("漏電斷路器", exact=False).first.click()
    recovery_clicks_b += 1
    page.wait_for_timeout(3000)

    # 舊的篩選是否清除？
    old_filters = page.locator("text=已選：").count()
    old_nfb_selected = page.locator("text=極數: 3P").count()
    log(f"    切換品類後: 舊篩選殘留={old_filters > 0}, 極數:3P 殘留={old_nfb_selected > 0}")
    if old_filters > 0 or old_nfb_selected > 0:
        findings.append("S3: 切換品類後舊篩選未清除")
        log(f"    ⚠️ 品類切換後篩選未清除 — 用戶會看到混亂狀態")
    else:
        log(f"    ✓ 品類切換自動清除舊篩選，{recovery_clicks_b} 步完成")

    # Scenario C: 用摘要列移除篩選
    log("\n  場景 C：用已選摘要列移除單一篩選")
    page.get_by_text("NFB").click()
    page.wait_for_timeout(3000)
    page.get_by_text("3P", exact=True).first.click()
    page.wait_for_timeout(3000)
    page.get_by_text("50", exact=True).first.click()
    page.wait_for_timeout(3000)

    summary_chips = page.locator("text=已選：").count()
    if summary_chips > 0:
        # 點擊摘要列中的極數 chip 移除
        poles_chip = page.locator("button:has-text('極數: 3P')")
        if poles_chip.count() > 0:
            poles_chip.click()
            page.wait_for_timeout(2000)
            poles_removed = page.locator("button:has-text('極數: 3P')").count() == 0
            log(f"    從摘要列移除極數: {'✓ 成功' if poles_removed else '⚠️ 失敗'}")
            if not poles_removed:
                findings.append("S3: 摘要列移除篩選失敗")
        else:
            log(f"    摘要列無極數 chip")
    else:
        log(f"    ⚠️ 已選摘要列不存在")

    # Scenario D: 清除全部
    log("\n  場景 D：清除全部篩選")
    page.reload(wait_until="load", timeout=30000)
    page.wait_for_timeout(2000)
    page.get_by_text("NFB").click()
    page.wait_for_timeout(3000)
    page.get_by_text("3P", exact=True).first.click()
    page.wait_for_timeout(3000)
    page.get_by_text("50", exact=True).first.click()
    page.wait_for_timeout(3000)

    clear_all = page.locator("text=清除全部")
    if clear_all.count() > 0:
        clear_all.click()
        page.wait_for_timeout(2000)
        filters_gone = page.locator("text=已選：").count() == 0
        log(f"    清除全部: {'✓ 所有篩選已清' if filters_gone else '⚠️ 篩選殘留'}")
        if not filters_gone:
            findings.append("S3: 清除全部後篩選殘留")
    else:
        log(f"    ⚠️ 清除全部按鈕不存在")
        findings.append("S3: 清除全部按鈕缺失")

    # ================================================================
    # S4: 資訊氣味 — 品類名稱自解釋度
    # ================================================================
    log("\n" + "=" * 60)
    log("S4: INFORMATION SCENT — 品類與維度的自解釋度")
    log("=" * 60)

    # 檢查：品類名稱是否有歧義或需要專業知識
    terminology = {
        "NFB": {"full": "無熔線斷路器", "jargon": True, "note": "顯示全名 ✓ 但縮寫 NFB 仍需知識"},
        "漏電斷路器": {"full": "漏電斷路器", "jargon": False, "note": "自解釋"},
        "電磁接觸器": {"full": "電磁接觸器", "jargon": False, "note": "自解釋"},
        "EMT 導管": {"full": "EMT 導管", "jargon": True, "note": "EMT = Electrical Metallic Tubing，需知識"},
        "RSG 導管": {"full": "RSG 導管", "jargon": True, "note": "RSG = Rigid Steel Galvanized，需知識"},
        "PVC 管": {"full": "PVC 管", "jargon": False, "note": "普遍認知"},
    }

    dim_terminology = {
        "框架(AF)": {"jargon": True, "note": "AF = Ampere Frame，非電工不懂"},
        "額定電流(AT)": {"jargon": True, "note": "AT = Ampere Trip，非電工不懂"},
        "極數": {"jargon": True, "note": "1P/2P/3P/4P 需知道相數概念"},
        "管徑": {"jargon": False, "note": "自解釋"},
        "種類": {"jargon": False, "note": "自解釋"},
        "型式": {"jargon": False, "note": "自解釋"},
    }

    log("\n  品類名稱：")
    jargon_cats = 0
    for name, info in terminology.items():
        icon = "⚠️" if info["jargon"] else "✓"
        log(f"    {icon} {name}: {info['note']}")
        if info["jargon"]:
            jargon_cats += 1

    log(f"\n  維度名稱：")
    jargon_dims = 0
    for name, info in dim_terminology.items():
        icon = "⚠️" if info["jargon"] else "✓"
        log(f"    {icon} {name}: {info['note']}")
        if info["jargon"]:
            jargon_dims += 1

    log(f"\n  專業術語比例：品類 {jargon_cats}/{len(terminology)}, 維度 {jargon_dims}/{len(dim_terminology)}")
    log(f"  判斷：這是內部工具，用戶是電氣工程師/採購，術語合理")
    log(f"  但如果擴展給非專業用戶，需加 tooltip 說明")

    # 驗證：NFB 是否有顯示完整名稱？
    page.reload(wait_until="load", timeout=30000)
    page.wait_for_timeout(2000)
    nfb_full = page.locator("button:has-text('無熔線斷路器')").count()
    log(f"\n  NFB 顯示完整名稱：{'✓ 有' if nfb_full > 0 else '⚠️ 只有縮寫'}")
    if nfb_full == 0:
        findings.append("S4: NFB 只顯示縮寫，缺完整名稱")

    # ================================================================
    # S5: 漏斗模擬 — 10 種真實比價場景
    # ================================================================
    log("\n" + "=" * 60)
    log("S5: FUNNEL — 10 種真實場景的完成率")
    log("=" * 60)

    scenarios = [
        {"name": "NFB 3P 50AF", "cat": "NFB", "steps": [("3P", True), ("50", True)]},
        {"name": "NFB 1P 30AF", "cat": "NFB", "steps": [("1P", True), ("30", True)]},
        {"name": "NFB 4P 100AF", "cat": "NFB", "steps": [("4P", True), ("100", True)]},
        {"name": "漏電 2P", "cat": "漏電斷路器", "steps": [("2P", True)]},
        {"name": "電磁接觸器", "cat": "電磁接觸器", "steps": []},
        {"name": "變壓器", "cat": "變壓器", "steps": []},
        {"name": "EMT 導管", "cat": "EMT 導管", "steps": []},
        {"name": "PVC 管", "cat": "PVC 管", "steps": []},
        {"name": "電纜", "cat": "電纜", "steps": []},
        {"name": "不鏽鋼管", "cat": "不鏽鋼管", "steps": []},
    ]

    success = 0
    fail = 0
    for sc in scenarios:
        try:
            page.reload(wait_until="load", timeout=30000)
            page.wait_for_timeout(2000)

            # Select category
            page.get_by_text(sc["cat"], exact=False).first.click()
            page.wait_for_timeout(3000)

            step2_visible = page.locator("text=Step 2").count() > 0
            if not step2_visible:
                log(f"  ✗ {sc['name']}: Step 2 未出現")
                fail += 1
                findings.append(f"S5: {sc['name']} Step 2 未出現")
                continue

            # Select dimension values
            step_ok = True
            for val, exact in sc["steps"]:
                btn = page.get_by_text(val, exact=exact).first
                if btn.count() > 0:
                    btn.click()
                    page.wait_for_timeout(3000)
                else:
                    log(f"  ✗ {sc['name']}: 值 '{val}' 找不到")
                    step_ok = False
                    fail += 1
                    findings.append(f"S5: {sc['name']} 值 '{val}' 不可見")
                    break

            if not step_ok:
                continue

            # Check results
            if len(sc["steps"]) > 0:
                has_result = page.locator("text=比價結果").count() > 0
                has_data = page.locator("text=目前條件無符合").count() == 0
                has_products = page.locator("table").count() > 0 or page.locator("text=筆產品").count() > 0

                if has_result and (has_data or has_products):
                    log(f"  ✓ {sc['name']}: 有結果")
                    success += 1
                elif has_result and not has_data:
                    log(f"  △ {sc['name']}: 有結果區但無資料（可能是正常）")
                    success += 1
                else:
                    log(f"  ✗ {sc['name']}: 無結果區")
                    fail += 1
            else:
                # Just category selected, check dims loaded
                dims_loaded = page.locator("span.font-medium").count() > 0
                log(f"  {'✓' if dims_loaded else '✗'} {sc['name']}: 維度{'已載入' if dims_loaded else '未載入'}")
                if dims_loaded:
                    success += 1
                else:
                    fail += 1

        except Exception as e:
            log(f"  ✗ {sc['name']}: ERROR {str(e)[:50]}")
            fail += 1

    completion_rate = success / len(scenarios) * 100
    log(f"\n  漏斗完成率: {success}/{len(scenarios)} = {completion_rate:.0f}%")
    log(f"  {'✓ 合格' if completion_rate >= 80 else '⚠️ 需改善'}")
    if completion_rate < 80:
        findings.append(f"S5: 漏斗完成率只有 {completion_rate:.0f}%")

    # ================================================================
    # S6: 漸進揭露認知測試 — collapse 後用戶是否迷失？
    # ================================================================
    log("\n" + "=" * 60)
    log("S6: PROGRESSIVE DISCLOSURE — collapse 後的資訊可見性")
    log("=" * 60)

    page.reload(wait_until="load", timeout=30000)
    page.wait_for_timeout(2000)
    page.get_by_text("NFB").click()
    page.wait_for_timeout(3000)

    # 選 3P 後，檢查：
    page.get_by_text("3P", exact=True).first.click()
    page.wait_for_timeout(3000)

    log("\n  選了 3P 後的頁面狀態：")

    # Q1: 用戶能看到自己選了什麼嗎？
    selected_visible = page.locator("button:has-text('3P')").count() > 0
    summary_visible = page.locator("text=已選：").count() > 0
    log(f"  Q1 選擇可見性: chip={selected_visible}, 摘要列={summary_visible}")
    log(f"      {'✓ 雙重確認（chip + 摘要列）' if selected_visible and summary_visible else '⚠️ 不足'}")
    if not (selected_visible and summary_visible):
        findings.append("S6: 選擇後缺少雙重確認（chip 或摘要列缺失）")

    # Q2: 用戶知道還有哪些選項嗎？（collapse 隱藏了其他極數）
    other_poles = page.locator("button:has-text('1P')").count() + \
                  page.locator("button:has-text('2P')").count() + \
                  page.locator("button:has-text('4P')").count()
    change_btn_visible = page.locator("button:has-text('變更')").count() > 0
    log(f"  Q2 其他選項可見: 1P/2P/4P={other_poles > 0}, 變更按鈕={change_btn_visible}")
    if other_poles > 0:
        log(f"      ⚠️ collapse 後其他選項仍可見 — 沒有真正收合")
        findings.append("S6: collapse 後其他極數仍可見")
    elif change_btn_visible:
        log(f"      ✓ 收合正確，有「變更」提供返回路徑")
    else:
        log(f"      ⚠️ 收合了但沒有返回路徑")
        findings.append("S6: 收合後無返回路徑（變更按鈕缺失）")

    # Q3: 下一步清楚嗎？
    next_dim = page.evaluate("""() => {
        const labels = document.querySelectorAll('span.font-medium');
        for (const l of labels) {
            const parent = l.parentElement?.parentElement;
            if (!parent) continue;
            const btns = parent.querySelectorAll('button');
            const hasMultiple = btns.length > 2;
            if (hasMultiple) return l.textContent.trim();
        }
        return null;
    }""")
    log(f"  Q3 下一步引導: 下個展開的維度 = '{next_dim}'")
    log(f"      {'✓ 自然引導到下一步' if next_dim else '⚠️ 無法判斷下一步'}")

    # Q4: 選兩步後（3P + 50AF），用戶還記得之前選了什麼嗎？
    page.get_by_text("50", exact=True).first.click()
    page.wait_for_timeout(3000)

    all_selected = page.evaluate("""() => {
        const summary = document.querySelector('[class*="bg-muted"]');
        if (!summary) return [];
        const chips = summary.querySelectorAll('button');
        return Array.from(chips).map(c => c.innerText.trim());
    }""")
    log(f"\n  Q4 多步選擇後的記憶輔助：")
    log(f"      摘要列內容: {all_selected}")
    log(f"      {'✓ 摘要列清楚顯示所有選擇' if len(all_selected) >= 2 else '⚠️ 摘要列資訊不足'}")
    if len(all_selected) < 2:
        findings.append("S6: 多步選擇後摘要列未顯示完整選擇歷史")

    # Q5: 頁面捲動需求 — 結果在視窗內嗎？
    results_in_view = page.evaluate("""() => {
        const el = document.querySelector('h3, [class*="CardTitle"]');
        if (!el) return null;
        const texts = document.querySelectorAll('h3, [class*="CardTitle"]');
        for (const t of texts) {
            if (t.textContent.includes('比價結果')) {
                const rect = t.getBoundingClientRect();
                return { top: Math.round(rect.top), inView: rect.top < window.innerHeight };
            }
        }
        return null;
    }""")
    if results_in_view:
        log(f"\n  Q5 結果可見性: top={results_in_view['top']}px, 視窗內={results_in_view['inView']}")
        if not results_in_view["inView"]:
            log(f"      ⚠️ 比價結果在摺疊下方，用戶可能不知道已有結果")
            findings.append("S6: 比價結果在視窗外，需捲動才能看到")
        else:
            log(f"      ✓ 結果在視窗內可見")
    else:
        log(f"\n  Q5: 找不到比價結果區")

    page.screenshot(path=os.path.join(output_dir, "v4-user-centric-final.png"), full_page=True)

    # ================================================================
    # FINDINGS SUMMARY
    # ================================================================
    log("\n" + "=" * 60)
    log("USER-CENTRIC FINDINGS — 用戶視角問題清單")
    log("=" * 60)

    if not findings:
        log("  沒有發現用戶層面問題")
    else:
        for i, f in enumerate(findings, 1):
            log(f"  {i}. {f}")

    log(f"\n  問題數: {len(findings)}")
    log(f"  判定: {'用戶流程順暢' if len(findings) <= 2 else '需要改善用戶體驗'}")

    browser.close()

with open(os.path.join(output_dir, "test-v4-report.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(report))
print("\nReport -> tests/e2e/output/l3-user-centric-report.txt")
