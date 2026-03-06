import sys, os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import json
from core.geometry_engine import GeometryPipeline

def test_infinite_loop():
    cw = 1.8
    rw = 3.5
    rd = 5.0
    fh = 3.0
    sw = 1.2
    nf = 5
    raw_pts = [
      [637, 283.5],
      [714, 283.5],
      [714, 329],
      [619.5, 329]
    ]
    
    engine = GeometryPipeline(
        corridor_width=cw,
        room_width=rw,
        room_depth=rd,
        floor_height=fh,
        stair_width=sw,
        num_floors=nf,
    )
    
    print("Processing spine...")
    engine.process_spine(raw_pts, apply_zoning=False)
    print("Getting JSON...")
    result = engine.get_json(apply_zoning=False)
    with open("test_out.json", "w") as f:
        json.dump(result, f)
    print("DONE! Rooms generated:", len(result["rooms"]))

if __name__ == "__main__":
    test_infinite_loop()
