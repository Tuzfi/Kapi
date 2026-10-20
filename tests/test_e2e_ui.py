import os
import sys
import time
import threading
from http.server import HTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright

if sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

WORKSPACE_DIR = r"c:\Users\yanteles\Documents\Kapi"
OUTPUT_DIR = r"C:\Users\yanteles\.gemini\antigravity\brain\57a4d79d-e4d7-4e20-8644-831bb1bc949c\screenshots"
os.makedirs(OUTPUT_DIR, exist_ok=True)

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

def run_server(port, stop_event):
    os.chdir(WORKSPACE_DIR)
    httpd = HTTPServer(('127.0.0.1', port), QuietHandler)
    while not stop_event.is_set():
        httpd.handle_request()

def run_ui_test():
    port = 8123
    stop_event = threading.Event()
    server_thread = threading.Thread(target=run_server, args=(port, stop_event), daemon=True)
    server_thread.start()
    time.sleep(0.5)

    print(f"Local server started on http://127.0.0.1:{port}")
    test_results = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1400, 'height': 900})
        page = context.new_page()

        # Listen to console errors
        page.on("console", lambda msg: print(f"Browser console [{msg.type}]: {msg.text}") if msg.type in ['error', 'warning'] else None)

        # 1. Load application
        print("\n[Step 1] Loading Kapi web application...")
        page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="networkidle")
        page.wait_for_selector("#cad-canvas")
        time.sleep(1)

        p1 = os.path.join(OUTPUT_DIR, "01_initial_dashboard.png")
        page.screenshot(path=p1)
        test_results.append(("01_initial_dashboard.png", "Carregamento inicial da UI com Canvas CAD, KPIs, Barra de Busca e Linha do Tempo 24h"))
        print(f" -> Screenshot saved: {p1}")

        # 2. Test Heatmap Toggle Button
        print("\n[Step 2] Testing Heatmap Toggle Button...")
        heatmap_btn = page.locator("#toggle-heatmap")
        is_active_before = "active" in heatmap_btn.get_attribute("class")
        heatmap_btn.click()
        time.sleep(0.3)
        is_active_after = "active" in heatmap_btn.get_attribute("class")
        assert is_active_before != is_active_after, "Heatmap button did not toggle active class"
        
        p2 = os.path.join(OUTPUT_DIR, "02_heatmap_toggled.png")
        page.screenshot(path=p2)
        test_results.append(("02_heatmap_toggled.png", "Botão Heatmap alternado (desativando o mapa de calor térmico e exibindo cores estruturais)"))
        print(f" -> Screenshot saved: {p2}")

        # Re-enable heatmap
        heatmap_btn.click()
        time.sleep(0.3)

        # 3. Test Rotation Controls (Map / True North Rotation)
        print("\n[Step 3] Testing Map / Building Rotation Controls (↻, ↺, Input)...")
        rot_input = page.locator("#input-building-rotation")
        btn_cw = page.locator("#btn-rot-cw")
        btn_ccw = page.locator("#btn-rot-ccw")

        # Click CW twice (+30 deg)
        btn_cw.click()
        time.sleep(0.2)
        btn_cw.click()
        time.sleep(0.2)
        val_after_cw = rot_input.input_value()
        print(f" -> Rotation after 2x ↻ (+30°): {val_after_cw}°")
        assert val_after_cw == "30", f"Expected 30, got {val_after_cw}"

        # Click CCW once (-15 deg)
        btn_ccw.click()
        time.sleep(0.2)
        val_after_ccw = rot_input.input_value()
        print(f" -> Rotation after 1x ↺ (-15°): {val_after_ccw}°")
        assert val_after_ccw == "15", f"Expected 15, got {val_after_ccw}"

        # Set custom rotation 60 degrees
        rot_input.fill("60")
        rot_input.dispatch_event("input")
        time.sleep(0.5)

        p3 = os.path.join(OUTPUT_DIR, "03_map_rotated_60deg.png")
        page.screenshot(path=p3)
        test_results.append(("03_map_rotated_60deg.png", "Orientação do mapa rotacionada para 60°: agulha da Rosa dos Ventos aponta a 60° e incidência solar nas paredes é recalculada"))
        print(f" -> Screenshot saved: {p3}")

        # 4. Test Right-Click Pan on 2D Canvas Area
        print("\n[Step 4] Testing Right-Click 2D Canvas Navigation (Pan)...")
        canvas = page.locator("#cad-canvas")
        box = canvas.bounding_box()
        start_x = box["x"] + box["width"] / 2
        start_y = box["y"] + box["height"] / 2

        # Right-click drag (button='right')
        page.mouse.move(start_x, start_y)
        page.mouse.down(button="right")
        page.mouse.move(start_x + 120, start_y + 80, steps=10)
        page.mouse.up(button="right")
        time.sleep(0.5)

        p4 = os.path.join(OUTPUT_DIR, "04_right_click_panned.png")
        page.screenshot(path=p4)
        test_results.append(("04_right_click_panned.png", "Locomoção com botão direito no Canvas 2D (offset deslocado suavemente)"))
        print(f" -> Screenshot saved: {p4}")

        # 5. Test Window Placement & Dimension Configuration Modal
        print("\n[Step 5] Testing Window Tool and Custom Dimension Modal...")
        # Select first space to display wall inspector
        page.click(".space-item:first-child")
        time.sleep(0.5)

        # Click the window configure gear button on wall 1
        page.locator(".btn-config-win").first.click()
        time.sleep(0.5)

        # Check modal
        modal = page.locator("#window-modal")
        modal_visible = not ("hidden" in modal.get_attribute("class"))
        print(f" -> Window modal opened: {modal_visible}")
        assert modal_visible, "Window modal should be visible after clicking gear button"

        # Edit window dimensions: 2.8m width x 1.8m height
        page.fill("#modal-win-width", "2.8")
        page.fill("#modal-win-height", "1.8")
        time.sleep(0.3)

        preview_text = page.locator("#window-modal-preview").inner_text()
        print(f" -> Modal preview text: {preview_text}")

        p5 = os.path.join(OUTPUT_DIR, "05_window_dimensions_modal.png")
        page.screenshot(path=p5)
        test_results.append(("05_window_dimensions_modal.png", "Modal de configuração de dimensões da janela com inputs de largura, altura e pré-visualização de área"))
        print(f" -> Screenshot saved: {p5}")

        # Click Save
        page.click("#btn-save-window")
        time.sleep(0.5)

        p6 = os.path.join(OUTPUT_DIR, "06_window_placed_custom_size.png")
        page.screenshot(path=p6)
        test_results.append(("06_window_placed_custom_size.png", "Janela renderizada com dimensão personalizada (tag 2.8x1.8m) na parede norte"))
        print(f" -> Screenshot saved: {p6}")

        # 6. Test Sidebar Walls Inspector
        print("\n[Step 6] Testing Sidebar Walls Inspector for Selected Space...")
        # Select first space
        page.click(".space-item:first-child")
        time.sleep(0.5)

        p7 = os.path.join(OUTPUT_DIR, "07_sidebar_walls_inspector.png")
        page.screenshot(path=p7)
        test_results.append(("07_sidebar_walls_inspector.png", "Painel Inspetor lateral com a lista completa de paredes da sala e controles de dimensões de janela"))
        print(f" -> Screenshot saved: {p7}")

        # 7. Test 24-Hour Timeline Play Button
        print("\n[Step 7] Testing 24-Hour Timeline Play/Pause Button...")
        play_btn = page.locator("#btn-play-timeline")
        play_btn.click() # Start playing
        time.sleep(2.0) # Wait for animation to cycle a few hours
        play_btn.click() # Pause

        p8 = os.path.join(OUTPUT_DIR, "08_timeline_playback_advancing.png")
        page.screenshot(path=p8)
        test_results.append(("08_timeline_playback_advancing.png", "Reprodução 24h avançando, atualizando a curva dinâmica de carga e a posição solar"))
        print(f" -> Screenshot saved: {p8}")

        # 8. Test Space Type Preset Selection (Carrier HAP Library)
        print("\n[Step 8] Testing Space Type Preset Dropdown (HAP 6.4 Model)...")
        # Select first space
        page.click(".space-item:first-child")
        time.sleep(0.5)

        space_type_select = page.locator("#prop-space-type")
        space_type_select.select_option("conference_room")
        time.sleep(0.5)

        occ_val = page.locator("#prop-occupants").input_value()
        light_val = page.locator("#prop-lighting").input_value()
        equip_val = page.locator("#prop-equipment").input_value()
        print(f" -> Preset 'conference_room' applied: Occupants={occ_val}, Lighting={light_val} W/m², Equip={equip_val} W/m²")
        assert float(light_val) == 11.5, f"Expected 11.5 W/m² for conference room, got {light_val}"

        p9 = os.path.join(OUTPUT_DIR, "09_hap_space_type_preset_applied.png")
        page.screenshot(path=p9)
        test_results.append(("09_hap_space_type_preset_applied.png", "Modelo de espaço Carrier HAP 'Sala de Reunião' aplicado automaticamente populando ocupantes, iluminação ASHRAE 90.1 e ventilação 62.1"))
        print(f" -> Screenshot saved: {p9}")

        # 9. Test Roof & Floor Assemblies & Wall Sol-Air Configuration
        print("\n[Step 9] Testing Roof & Floor Assemblies and Wall Sol-Air...")
        roof_chk = page.locator("#prop-has-roof")
        if not roof_chk.is_checked():
            roof_chk.check()
        time.sleep(0.3)
        roof_select = page.locator("#prop-roof-assembly")
        roof_select.select_option("uninsulated_concrete")
        time.sleep(0.5)

        # Change wall 1 to dark surface color
        wall_color_select = page.locator(".wall-color-select").first
        wall_color_select.select_option("dark")
        time.sleep(0.5)

        p10 = os.path.join(OUTPUT_DIR, "10_roof_and_wall_assemblies_configured.png")
        page.screenshot(path=p10)
        test_results.append(("10_roof_and_wall_assemblies_configured.png", "Configurações de cobertura e absorptância de parede escura (Sol-Air) refletidas em tempo real no cálculo"))
        print(f" -> Screenshot saved: {p10}")

        # 10. Test Window Configuration Modal with Glazing and Shading
        print("\n[Step 10] Testing Window Modal Glazing and Shading Selectors...")
        gear_btn = page.locator(".btn-config-win").first
        gear_btn.click()
        time.sleep(0.5)

        glazing_sel = page.locator("#modal-win-glazing")
        glazing_sel.select_option("double_low_e")
        shading_sel = page.locator("#modal-win-shading")
        shading_sel.select_option("blinds_light")
        time.sleep(0.3)

        p11 = os.path.join(OUTPUT_DIR, "11_window_glazing_shading_modal.png")
        page.screenshot(path=p11)
        test_results.append(("11_window_glazing_shading_modal.png", "Modal de configuração com seleção de vidro (Double Low-E) e proteção solar interna (Persiana clara IAC=0.65)"))
        print(f" -> Screenshot saved: {p11}")

        page.click("#btn-save-window")
        time.sleep(0.5)

        p12 = os.path.join(OUTPUT_DIR, "12_detailed_thermal_breakdown_card.png")
        page.screenshot(path=p12)
        test_results.append(("12_detailed_thermal_breakdown_card.png", "Detalhamento completo de carga térmica exibindo condução Sol-Ar, janelas, pessoas, iluminação e ventilação 62.1"))
        print(f" -> Screenshot saved: {p12}")

        browser.close()

    stop_event.set()
    print("\nAll UI tests completed successfully!")
    return test_results

if __name__ == '__main__':
    results = run_ui_test()
    print("\n--- Summary of Generated Screenshots ---")
    for fname, desc in results:
        print(f"- {fname}: {desc}")
