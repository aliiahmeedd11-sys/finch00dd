import sys, os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from core.geometry_engine import GeometryPipeline

def test_boundaries():
    print("=" * 60)
    print("  FINCH V18.1 — BOUNDARY ROBUSTNESS CHECK")
    print("=" * 60)

    engine = GeometryPipeline()

    def run_check(name, lot, expected_spine_len):
        print(f"\n--- Testing Boundary: {name} ---")
        engine.process_boundary(lot, setbacks=3.0)
        res = engine.get_json()
        spine_derived = res.get("spine")  # Not currently in get_json output but could check corridors
        
        rooms = len(res['rooms'])
        corridors = len(res['corridors'])
        print(f"  Rooms generated: {rooms}")
        print(f"  Corridors generated: {corridors}")
        
        if rooms > 0 and corridors > 0:
            print("  ✅ BOUNDARY PASS (Generated geometries)")
        elif rooms == 0 and corridors == 0 and expected_spine_len == 0:
            print("  ✅ BOUNDARY PASS (Safe Abort)")
        else:
            print(f"  ❌ FAIL: Engine did not meet generation expectation (Expected {'geometries' if expected_spine_len > 0 else 'safe abort'})")

    # 1. Standard Rectangle (W > H)
    run_check("Wide Rectangle", [[0,0], [30,0], [30,15], [0,15]], expected_spine_len=2)

    # 2. Standard Rectangle (H > W)
    run_check("Tall Rectangle", [[0,0], [15,0], [15,30], [0,30]], expected_spine_len=2)

    # 3. Standard L-Shape (concave)
    lot_l = [[0,0], [30,0], [30,10], [15,10], [15,20], [0,20]]
    run_check("L-Shape Polygon", lot_l, expected_spine_len=3)

    # 4. Tiny Lot (edge case where setbacks consume entire lot)
    run_check("Tiny Lot (Should bypass or generate 0 rooms safely)", [[0,0], [5,0], [5,5], [0,5]], expected_spine_len=0)

    # 5. Very Narrow Lot
    run_check("Narrow Long Lot", [[0,0], [6,0], [6,40], [0,40]], expected_spine_len=2)

    print("\n" + "=" * 60)
    print("  🏁 ROBUSTNESS SCRIPT COMPLETE")
    print("=" * 60)

if __name__ == "__main__":
    test_boundaries()
