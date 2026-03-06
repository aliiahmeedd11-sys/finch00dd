import sys, os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from core.geometry_engine import GeometryPipeline

def complex_test():
    engine = GeometryPipeline()
    # L-Shaped Lot
    lot = [[0,0], [30,0], [30,10], [15,10], [15,20], [0,20]]
    engine.process_boundary(lot, setbacks=3.0)
    res = engine.get_json()
    print(f"Lot Test: L-Shape")
    print(f"Rooms: {len(res['rooms'])}")
    print(f"Labels: {[r['label'] for r in res['rooms']]}")
    # Check if we have corridors
    print(f"Corridors: {len(res['corridors'])}")

if __name__ == "__main__":
    complex_test()
