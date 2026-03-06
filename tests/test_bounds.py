import sys, os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import json
from core.geometry_engine import GeometryPipeline

p = json.load(open('d:/work/finch/data/crash_payload.json'))
kargs = {k:v for k,v in p.items() if k in ['corridor_width','room_width','room_depth','floor_height','stair_width','num_floors','unit_mix']}
e = GeometryPipeline(**kargs)
spine = p['spine']
e.process_spine(spine, True)

with open('d:/work/finch/debug_custom.txt', 'w') as f:
    f.write("=== SPINE ===\n" + str(e.spine_pts) + "\n")
    f.write("\n=== CORRIDORS ===\n")
    for c in e.corridors: f.write(str(c) + "\n")
    f.write("\n=== CORES ===\n")
    for c in e.cores: f.write(c['label'] + " stair=" + str(c['stair']['boundary']) + "\n")
    f.write("\n=== SERVICE CORE ROOMS ===\n")
    for r in e.rooms:
        if 'Core' in r['label']: f.write(r['label'] + " bnd=" + str(r['boundary']) + "\n")

    f.write("\n=== COLLISIONS ===\n")
    from core.geometry_engine import Article82_Validator
    for ci, corr in enumerate(e.corridors):
        for c in e.cores:
            stair_bnd = c['stair']['boundary']
            overlap = Article82_Validator._sat_collision(corr, stair_bnd)
            if overlap:
                f.write(f"Overlap detected: Corridor {ci} vs {c['label']}\n")
print("Done")
