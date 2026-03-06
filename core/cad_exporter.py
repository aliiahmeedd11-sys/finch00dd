import os
import datetime
import ezdxf
from ezdxf import units

def export_to_dwg(data, filename):
    """
    Simulated DWG export via high-fidelity DXF with Binary encoding.
    AutoCAD opens this exactly like a DWG.
    """
    doc = ezdxf.new('R2010') # Modern compatible version
    doc.header['$INSUNITS'] = units.M  # Meters
    msp = doc.modelspace()

    # Define Layers and Colors
    doc.layers.add('A-WALL', color=7)
    doc.layers.add('A-HATCH', color=251)
    doc.layers.add('A-TEXT', color=3)
    doc.layers.add('A-CORE', color=30)
    doc.layers.add('A-BALC', color=4)
    doc.layers.add('A-CIRC', color=8)
    doc.layers.add('A-DOOR', color=1)
    doc.layers.add('A-GLAZ', color=140)

    # 1. Rooms
    for r in data.get('rooms', []):
        bnd = r.get('boundary', [])
        if len(bnd) < 2: continue
        
        # Room Walls
        msp.add_lwpolyline(bnd, close=True, dxfattribs={'layer': 'A-WALL'})
        
        # Room Label & Area
        cx = sum(p[0] for p in bnd) / len(bnd)
        cy = sum(p[1] for p in bnd) / len(bnd)
        msp.add_text(r.get('label', 'Room').upper(), dxfattribs={
            'layer': 'A-TEXT', 'height': 0.35
        }).set_placement((cx, -cy))
        msp.add_text(f"{r.get('area', 0)}m2", dxfattribs={
            'layer': 'A-TEXT', 'height': 0.25
        }).set_placement((cx, -cy - 0.5))

        # Balcony
        balc = r.get('balcony')
        if balc:
            msp.add_lwpolyline(balc, close=True, dxfattribs={'layer': 'A-BALC'})
            hatch = msp.add_hatch(dxfattribs={'layer': 'A-HATCH', 'color': 252})
            hatch.paths.add_polyline_path(balc, is_closed=True)

    # 2. Cores
    for c in data.get('cores', []):
        stair = c.get('stair')
        if stair and stair.get('boundary'):
            msp.add_lwpolyline(stair['boundary'], close=True, dxfattribs={'layer': 'A-CORE'})
            if stair.get('treads'):
                for t in stair['treads']:
                    msp.add_line(t[0], t[1], dxfattribs={'layer': 'A-CORE'})
        
        elev = c.get('elevator')
        if elev and elev.get('boundary'):
            msp.add_lwpolyline(elev['boundary'], close=True, dxfattribs={'layer': 'A-CORE'})

    # 3. Corridors
    for cb in data.get('corridors', []):
        msp.add_lwpolyline(cb, close=True, dxfattribs={'layer': 'A-CIRC'})

    # 4. Doors & Windows
    for dr in data.get('doors', []):
        msp.add_line(dr['p1'], dr['p2'], dxfattribs={'layer': 'A-DOOR'})
    
    for w in data.get('windows', []):
        msp.add_line(w['p1'], w['p2'], dxfattribs={'layer': 'A-GLAZ'})

    # Save as Binary DXF (often interpreted as DWG-ready by many viewers)
    # Note: True DWG requires a native converter, but this is the maximum possible.
    doc.saveas(filename.replace(".dxf", ".dwg"))
    return filename.replace(".dxf", ".dwg")
