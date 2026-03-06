import sys, os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
"""
V16.1 — Ventilation Shaft Compliance Test (The "Duct Size" Audit)
Tests Egyptian Code Article 82 compliance for Light Wells / Vent Shafts.
"""
from core.geometry_engine import GeometryPipeline
from core.validator import VisualFeedbackValidator

def test_vent_shaft_scaling():
    print("=" * 60)
    print("  FINCH V16.1 — VENT SHAFT (DUCT) AUDIT")
    print("=" * 60)

    # Test case: 5 floors building (Ground + 4), 15m height
    # H/4 rule: 15 / 4 = 3.75m minimum side for habitual room shafts
    num_floors = 5
    floor_height = 3.0
    bldg_height = num_floors * floor_height
    
    print(f"\nScenario: {num_floors} floors, {bldg_height}m height")
    print(f"Required scale (H/4): {bldg_height/4}m")

    g = GeometryPipeline(
        corridor_width=1.8, 
        room_width=3.5, 
        room_depth=5.0, 
        floor_height=floor_height, 
        stair_width=1.2, 
        num_floors=num_floors
    )
    
    # Process a simple spine
    g.process_spine([[0,0], [30,0]])
    plan = g.get_json()
    
    print(f"\nVent Shafts generated: {len(plan['ventShafts'])}")
    
    validator = VisualFeedbackValidator()
    styles, violations = validator.validate_all(
        plan["rooms"], 
        plan.get("cores", []), 
        plan.get("ventShafts", [])
    )
    
    vent_v = [v for v in violations if "Shaft" in v.room_label]
    
    for vs in plan['ventShafts']:
        print(f"  - Shaft: Area={vs['area']}m², MinSide={vs['minSide']}m, ActualArea={vs['area']}m²")
        if vs['area'] < vs['minArea'] or vs['minSide'] < 1.0:
             print(f"    ❌ FAIL: Undersized ({vs['area']} < {vs['minArea']})")
        else:
             print(f"    ✅ PASS: Code Compliant")

    print(f"\nSide Panel Violations: {len(vent_v)}")
    for v in vent_v:
        print(f"  🔴 {v.room_label}: {v.message}")

    if not vent_v:
        print("\n🏆 ALL DUCT SIZES ARE CORRECT (ARTICLE 82 COMPLIANT)")
    else:
        print("\n⚠️  DUCT SIZE ISSUES DETECTED")

if __name__ == "__main__":
    test_vent_shaft_scaling()
