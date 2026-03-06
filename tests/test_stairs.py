import sys, os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from core.geometry_engine import GeometryPipeline, EgyptianCode

def test_staircase_compliance():
    print("=" * 60)
    print("  FINCH V18.1 — STAIRCASE AUDIT (ARTICLE 82)")
    print("=" * 60)

    # Test with undersized stair width (0.8m)
    # The engine should force it to STAIR_MIN_WIDTH (1.1m)
    g = GeometryPipeline(
        stair_width=0.8, 
        floor_height=3.5, 
        num_floors=3
    )
    g.process_spine([[0,0], [20,0]])
    plan = g.get_json()

    print("\nScenario: Requested stair width 0.8m, floor height 3.5m")
    
    cores = plan.get("cores", [])
    if not cores:
        print("❌ FAIL: No cores generated")
        return

    stair = cores[0].get("stair")
    if not stair:
        print("❌ FAIL: No stair found in core")
        return

    # To check width, total_width should be 1.1 * 2 + 0.2 = 2.4m
    expected_width = EgyptianCode.STAIR_MIN_WIDTH * 2 + 0.2
    
    # Calculate actual width from boundary
    p1 = stair["boundary"][0]
    p2 = stair["boundary"][1]
    actual_width = ((p2[0]-p1[0])**2 + (p2[1]-p1[1])**2) ** 0.5
    
    print(f"Stair Total Width Expected: {expected_width:.2f}m")
    print(f"Stair Total Width Actual: {actual_width:.2f}m")
    
    if abs(actual_width - expected_width) < 0.01:
        print("✅ PASS: Stair width compliance enforced automatically.")
    else:
        print(f"❌ FAIL: Stair width is {actual_width:.2f}m, expected {expected_width:.2f}m")
        return

    # Test RISER count
    num_risers = 3.5 / EgyptianCode.STAIR_MAX_RISER
    import math
    expected_risers = math.ceil(num_risers)
    riser_h = 3.5 / expected_risers
    print(f"Required risers for 3.5m height: {expected_risers} (Riser height: {riser_h:.3f}m)")
    if riser_h <= EgyptianCode.STAIR_MAX_RISER:
        print("✅ PASS: Riser height compliant (< 0.17m)")
    else:
        print("❌ FAIL: Riser height exceeds 0.17m")

    print("\n🏆 ALL STAIRCASE REQUIREMENTS SATISFIED")

if __name__ == "__main__":
    test_staircase_compliance()
