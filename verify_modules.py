
import sys
import os
# Add the project directory to sys.path
sys.path.append(os.path.abspath('.'))

from core.geometry_engine import GeometryPipeline

def test_modular_packing():
    pipeline = GeometryPipeline()
    # Simple 20m linear spine
    spine = [[0, 0], [20, 0]]
    print(f"Module size: {pipeline.module}")
    print(f"Room depth: {pipeline.room_depth}")
    
    pipeline.process_spine(spine)
    result = pipeline.get_json()
    rooms = result.get('rooms', [])
    
    print(f"Total rooms: {len(rooms)}")
    all_modular = True
    for r in rooms:
        utype = r.get('unit_type', '')
        if utype not in ['studio', 'bed1', 'bed2', 'bed3']:
            continue
            
        area = r['area']
        depth = pipeline.room_depth
        # The true "width" is stored in the modules field now
        modules = r.get('modules', 0)
        width = modules * pipeline.module
        
        expected_widths = [3.6, 7.2, 10.8, 14.4]
        is_mod = any(abs(width - m) < 0.05 for m in expected_widths)
        
        print(f"Room {r['id']} ({r['label']}): Area={area} m2, Width={width:.2f}m, Modules={modules}, IsModular={is_mod}")
        
        if not is_mod:
            all_modular = False
        if "~~" in r['label']:
            print(f"ERROR: Found '~~' in label for room {r['id']}")
            all_modular = False
            
    if all_modular:
        print("VERIFICATION SUCCESS: All units are modular and labels are clean!")
    else:
        print("VERIFICATION FAILURE: Some units are non-modular or labels are dirty.")

if __name__ == "__main__":
    test_modular_packing()
