import sys, os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from core.geometry_engine import GeometryPipeline

def test_corner_area():
    print("=" * 60)
    print("  CORNER UNIT AREA VERIFICATION")
    print("=" * 60)

    # Standard settings
    module = 3.6
    depth = 10.8
    engine = GeometryPipeline(module=module, room_depth=depth)
    
    # Simple L-shape spine to trigger a corner unit
    spine = [[0, 0], [20, 0], [20, 20]]
    engine.process_spine(spine)
    res = engine.get_json()
    
    expected_area = round(depth**2, 1)
    print(f"Expected Area: {expected_area} m²")
    
    found_outer = False
    found_inner = False
    for r in res['rooms']:
        if r['unit_type'] == 'corner':
            if r.get('is_outer_corner'):
                found_outer = True
                print(f"Outer Room: {r['label']} ({r['id']}) - Area: {r['area']} m²")
            else:
                found_inner = True
                print(f"Inner Room: {r['label']} ({r['id']}) - Area: {r['area']} m²")
            assert abs(r['area'] - expected_area) < 0.5, f"Area mismatch! Got {r['area']}, expected {expected_area}"
    
    if found_outer and found_inner:
        print("\n✅ CORNER AREA VERIFICATION PASS")
    else:
        print(f"\n❌ FAIL: Outer:{found_outer}, Inner:{found_inner}")

if __name__ == "__main__":
    test_corner_area()
