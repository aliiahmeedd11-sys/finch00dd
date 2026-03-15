
import sys
import os
import math
# Add the project directory to sys.path
sys.path.append(os.path.abspath('.'))

from core.geometry_engine import GeometryPipeline, Vec, poly_area



def test_duct_dimensions():
    # Force a specific sequence for testing
    unit_mix = [
        {"type": "studio", "mix": 50.0},
        {"type": "bed1",   "mix": 50.0}
    ]
    # Corridor width is 1.8m by default. Rooms start at y = +/- 0.9
    pipeline = GeometryPipeline(unit_mix=unit_mix, corridor_width=1.8)
    hw = 0.9 # half-width
    
    # 50m linear spine to get plenty of units
    spine = [[0, 0], [50, 0]]
    pipeline.process_spine(spine)
    
    rooms = pipeline.rooms
    ducts = [r for r in rooms if r.get('unit_type') == 'duct']
    
    print(f"Total ducts found: {len(ducts)}")
    
    success = True
    for d in ducts:
        bnd = d['boundary']
        pts = [Vec(*p) for p in bnd]
        
        xs = [p.x for p in pts]
        ys = [p.y for p in pts]
        width = max(xs) - min(xs)
        # Depth relative to corridor wall (baseline y = 0.9 or -0.9)
        # We take max absolute distance from spine, then subtract hw
        total_depth = max([abs(p.y) for p in pts])
        relative_depth = round(total_depth - hw, 2)
        
        print(f"Duct at x={min(xs):.2f}: Width={width:.2f}m, Relative Depth={relative_depth:.2f}m, Points={len(pts)}")
        
        if len(pts) == 4:
            if abs(width - 1.2) < 0.05 and abs(relative_depth - 1.2) < 0.05:
                print("  PASS: Studio-Studio 1.2x1.2 detected.")
            elif abs(width - 5.0) < 0.05 and abs(relative_depth - 2.5) < 0.05:
                print("  PASS: Larger-Larger 5.0x2.5 detected.")
            else:
                print(f"  FAIL: Unexpected relative dimensions {width:.2f}x{relative_depth:.2f}")
                success = False
        elif len(pts) == 6:
            if abs(width - 1.2) < 0.05 and abs(relative_depth - 2.5) < 0.05:
                print("  PASS: Asymmetric Studio-Larger (6pts) detected.")
            else:
                print(f"  FAIL: Unexpected relative asymmetric dimensions {width:.2f}x{relative_depth:.2f}")
                success = False

    # Verify room boundary notches
    for r in rooms:
        if r.get('unit_type') == 'duct': continue
        utype = r.get('unit_type')
        if utype == 'core' or utype == 'corner': continue
        
        bnd = r['boundary']
        pts = [Vec(*p) for p in bnd]
        if len(pts) > 4:
            # Check the "inward" notched points. 
            # They should be at y distance 'notch_depth' from the wall.
            # So abs(p.y) - hw should be 1.2 or 2.5
            rel_depths = [round(abs(p.y) - hw, 2) for p in pts if abs(round(abs(p.y) - hw, 2)) > 0.01 and abs(round(abs(p.y) - hw, 2) - pipeline.room_depth) > 0.01]
            if rel_depths:
                actual_notch_depth = max(rel_depths)
                if utype == 'studio':
                    if abs(actual_notch_depth - 1.2) > 0.1:
                        print(f"  FAIL: Studio {r['id']} has incorrect relative notch depth {actual_notch_depth:.2f} (expected 1.2)")
                        success = False
                    else:
                        print(f"  PASS: Studio {r['id']} has correct 1.2m notch.")
                elif utype in ['bed1', 'bed2', 'bed3']:
                    if abs(actual_notch_depth - 2.5) > 0.1:
                        print(f"  FAIL: Larger {r['id']} has incorrect relative notch depth {actual_notch_depth:.2f} (expected 2.5)")
                        success = False
                    else:
                        print(f"  PASS: Larger {r['id']} has correct 2.5m notch.")

    if success:
        print("\nOVERALL DUCT VERIFICATION: SUCCESS")
    else:
        print("\nOVERALL DUCT VERIFICATION: FAILURE")

    if success:
        print("\nOVERALL DUCT VERIFICATION: SUCCESS")
    else:
        print("\nOVERALL DUCT VERIFICATION: FAILURE")

if __name__ == "__main__":
    test_duct_dimensions()
