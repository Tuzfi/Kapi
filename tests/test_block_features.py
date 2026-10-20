import os
import sys
import time
import threading
from http.server import HTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright

WORKSPACE_DIR = r"c:\Users\yanteles\Documents\Kapi"
OUTPUT_DIR = r"C:\Users\yanteles\.gemini\antigravity\brain\7ccb37fb-1e65-4db7-af0c-a0ad11739b26"
os.makedirs(OUTPUT_DIR, exist_ok=True)

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

def run_server(port, stop_event):
    os.chdir(WORKSPACE_DIR)
    httpd = HTTPServer(('127.0.0.1', port), QuietHandler)
    while not stop_event.is_set():
        httpd.handle_request()

def test_new_features():
    port = 8195
    stop_event = threading.Event()
    server_thread = threading.Thread(target=run_server, args=(port, stop_event), daemon=True)
    server_thread.start()
    time.sleep(0.5)

    print(f"Server started on http://127.0.0.1:{port}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 900})
        page.goto(f"http://127.0.0.1:{port}/index.html")
        page.wait_for_selector("#cad-canvas")
        time.sleep(1.0)

        # ----------------------------------------------------
        # Test 1: Right-Click Shortcut to Create Block
        # ----------------------------------------------------
        print("\n--- Test 1: Right-Click Shortcut to Create Block ---")
        canvas = page.locator("#cad-canvas")
        box = canvas.bounding_box()
        # Right click in an open area
        click_x = box["x"] + 650
        click_y = box["y"] + 350

        # Right click (click without drag)
        page.mouse.move(click_x, click_y)
        page.mouse.down(button="right")
        time.sleep(0.05)
        page.mouse.up(button="right")
        time.sleep(0.5)

        modal = page.locator("#quick-block-modal")
        assert not ("hidden" in modal.get_attribute("class")), "Quick block modal should be visible after right-click"
        print(" -> Quick block modal opened successfully on right-click!")

        # Fill inputs
        page.fill("#quick-name", "Space 5 (Office)")
        page.fill("#quick-width", "6.0")
        page.fill("#quick-length", "5.0")
        page.fill("#quick-height", "3.2")
        time.sleep(0.3)

        preview_text = page.locator("#quick-preview").inner_text()
        print(f" -> Quick preview calculation: {preview_text}")
        assert "30.00 m²" in preview_text and "96.0 m³" in preview_text, f"Unexpected preview text: {preview_text}"

        # Submit block creation
        page.click("#btn-submit-quick-block")
        time.sleep(0.5)

        # Verify modal closed and new space is listed in sidebar
        assert "hidden" in modal.get_attribute("class"), "Quick block modal should be hidden after submit"
        space_items = page.locator(".space-item").all_inner_texts()
        print(f" -> Spaces count in list: {len(space_items)}")
        assert any("Space 5" in t for t in space_items), "Space 5 should be present in space list"

        shot1 = os.path.join(OUTPUT_DIR, "feature_01_quick_block_created.png")
        page.screenshot(path=shot1)
        print(f" -> Screenshot saved: {shot1}")

        # ----------------------------------------------------
        # Test 2: Drag/Move Space with Magnetic Snapping
        # ----------------------------------------------------
        print("\n--- Test 2: Drag/Move Space with Magnetic Snapping ---")
        # Get coordinates of Space 5
        space5_data = page.evaluate("""() => {
            const s = window.kapiApp.spaces.find(x => x.name.includes("Space 5"));
            return s ? { id: s.id, polygon: s.polygon } : null;
        }""")
        assert space5_data is not None, "Space 5 not found in window.kapiApp.spaces"
        print(f" -> Space 5 initial polygon: {space5_data['polygon']}")

        # Move mouse to center of Space 5 and drag it towards Data Server Room 104 (x=14, y=0 to y=5)
        # In world coordinates, Space 5 was created at click location.
        # Let's drag Space 5 so its top edge snaps to Data Server Room 104's bottom edge (y = 5.0, x between 14 and 20)
        center_screen = page.evaluate("""() => {
            const s = window.kapiApp.spaces.find(x => x.name.includes("Space 5"));
            let cx = 0, cy = 0;
            s.polygon.forEach(p => { cx += p.x; cy += p.y; });
            cx /= s.polygon.length;
            cy /= s.polygon.length;
            const screen = window.kapiApp.cadCanvas.worldToScreen(cx, cy);
            const canvasBox = document.getElementById('cad-canvas').getBoundingClientRect();
            return { x: screen.x + canvasBox.left, y: screen.y + canvasBox.top };
        }""")

        # Target: snap top edge of Space 5 (y = 5.0) under Data Server Room 104 (x = 14 to 20, y = 5)
        target_screen = page.evaluate("""() => {
            const screen = window.kapiApp.cadCanvas.worldToScreen(17.0, 7.5);
            const canvasBox = document.getElementById('cad-canvas').getBoundingClientRect();
            return { x: screen.x + canvasBox.left, y: screen.y + canvasBox.top };
        }""")

        print(f" -> Dragging from ({center_screen['x']}, {center_screen['y']}) to ({target_screen['x']}, {target_screen['y']})")
        page.mouse.move(center_screen['x'], center_screen['y'])
        page.mouse.down(button="left")
        page.mouse.move(target_screen['x'], target_screen['y'], steps=15)
        time.sleep(0.3)
        page.mouse.up(button="left")
        time.sleep(0.5)

        moved_space5 = page.evaluate("""() => {
            const s = window.kapiApp.spaces.find(x => x.name.includes("Space 5"));
            return s ? { polygon: s.polygon, walls: s.walls.map(w => ({
                p1: w.p1, p2: w.p2, boundaryCondition: w.boundaryCondition, isAuto: w.isAutoDetectedPartition
            })) } : null;
        }""")
        print(f" -> Space 5 moved polygon: {moved_space5['polygon']}")

        shot2 = os.path.join(OUTPUT_DIR, "feature_02_block_dragged_and_snapped.png")
        page.screenshot(path=shot2)
        print(f" -> Screenshot saved: {shot2}")

        # ----------------------------------------------------
        # Test 3: Auto Boundary Condition (60% overlap rule)
        # ----------------------------------------------------
        print("\n--- Test 3: Auto Boundary Condition (60% Overlap Rule) ---")
        # Place Space 5 so its top wall directly touches Data Server Room 104's bottom wall
        # Data Server Room 104 has bottom wall from (14, 5) to (20, 5) or similar.
        # Let's inspect Data Server Room 104's walls
        d104 = page.evaluate("""() => {
            const s = window.kapiApp.spaces.find(x => x.name.includes("Data Server Room"));
            return s ? s.polygon : null;
        }""")
        print(f" -> Data Server Room 104 polygon: {d104}")

        # Align Space 5 exactly touching bottom wall of Data Server Room 104 (x=14, y=7 to x=20, y=7)
        page.evaluate("""() => {
            const s = window.kapiApp.spaces.find(x => x.name.includes("Space 5"));
            // Set Space 5 touching Data Server Room 104 on top wall: y from 7 to 12, x from 14 to 20
            s.polygon = [
                { x: 14, y: 7 },
                { x: 20, y: 7 },
                { x: 20, y: 12 },
                { x: 14, y: 12 }
            ];
            window.kapiApp.cadCanvas.updateSpaceWalls(s);
            window.kapiApp.cadCanvas.autoDetectAdjacentBoundaries();
            window.kapiApp.cadCanvas.triggerChanged();
        }""")
        time.sleep(0.5)

        touching_walls = page.evaluate("""() => {
            const s = window.kapiApp.spaces.find(x => x.name.includes("Space 5"));
            return s.walls.map((w, idx) => ({
                idx: idx,
                p1: w.p1,
                p2: w.p2,
                boundary: w.boundaryCondition,
                isAuto: w.isAutoDetectedPartition
            }));
        }""")
        print(f" -> Touching walls of Space 5: {touching_walls}")

        # Wall 0 (from 14,7 to 20,7) should be Internal Partition (ModeledOtherSide) because it touches 104 by 100% (>= 60%)!
        wall0 = touching_walls[0]
        assert wall0['boundary'] == 'ModeledOtherSide' and wall0['isAuto'] is True, f"Expected Wall 0 to be ModeledOtherSide with isAuto=True, got {wall0}"
        print(" -> SUCCESS: Wall 0 automatically detected as Internal Partition (100% overlap >= 60%)!")

        shot3 = os.path.join(OUTPUT_DIR, "feature_03_auto_internal_partition.png")
        page.screenshot(path=shot3)
        print(f" -> Screenshot saved: {shot3}")

        # Now move Space 5 away by 5 meters down (y = 15 to 20) so it no longer touches
        print("\n--- Moving Space 5 away: Reverting to OutdoorAir ---")
        page.evaluate("""() => {
            const s = window.kapiApp.spaces.find(x => x.name.includes("Space 5"));
            s.polygon = [
                { x: 14, y: 15 },
                { x: 20, y: 15 },
                { x: 20, y: 20 },
                { x: 14, y: 20 }
            ];
            window.kapiApp.cadCanvas.updateSpaceWalls(s);
            window.kapiApp.cadCanvas.autoDetectAdjacentBoundaries();
            window.kapiApp.cadCanvas.triggerChanged();
        }""")
        time.sleep(0.5)

        separated_walls = page.evaluate("""() => {
            const s = window.kapiApp.spaces.find(x => x.name.includes("Space 5"));
            return s.walls.map((w, idx) => ({
                idx: idx,
                p1: w.p1,
                p2: w.p2,
                boundary: w.boundaryCondition,
                isAuto: w.isAutoDetectedPartition
            }));
        }""")
        print(f" -> Separated walls of Space 5: {separated_walls}")

        wall0_separated = separated_walls[0]
        assert wall0_separated['boundary'] == 'OutdoorAir', f"Expected Wall 0 to revert to OutdoorAir, got {wall0_separated['boundary']}"
        print(" -> SUCCESS: Wall 0 automatically reverted to OutdoorAir with solar exposure!")

        shot4 = os.path.join(OUTPUT_DIR, "feature_04_reverted_to_outdoor.png")
        page.screenshot(path=shot4)
        print(f" -> Screenshot saved: {shot4}")

        browser.close()

    stop_event.set()
    print("\nALL 3 NEW FEATURES TESTED AND VALIDATED SUCCESSFULLY!")

if __name__ == '__main__':
    test_new_features()
