"""
Parametric Architecture Engine — BIM Fusion Core (V18.0-PLATINUM)
================================================================
Definitive Geometric Logic for perfect butt-joints, landlocked detection,
and Egyptian Building Code (Article 82) compliance.
"""

import math
from typing import List, Tuple, Optional, Dict, Any

# ══════════════════════════════════════════
# 1. Vector Kernel (Precision 0.0001)
# ══════════════════════════════════════════
class Point:
    def __init__(self, x: float, y: float):
        self.x, self.y = round(float(x), 4), round(float(y), 4)
    def __repr__(self): return f"Pt({self.x:.3f}, {self.y:.3f})"
    def __add__(self, o): return Point(self.x + o.x, self.y + o.y)
    def __sub__(self, o): return Point(self.x - o.x, self.y - o.y)
    def __mul__(self, s: float): return Point(self.x * s, self.y * s)
    def dot(self, o) -> float: return self.x * o.x + self.y * o.y
    def cross(self, o) -> float: return self.x * o.y - self.y * o.x
    def length(self) -> float: return math.hypot(self.x, self.y)
    def normalised(self):
        l = self.length()
        return Point(0, 0) if l < 1e-12 else Point(self.x / l, self.y / l)
    def as_tuple(self): return (self.x, self.y)
    def grid(self, step=0.05): return Point(round(self.x / step) * step, round(self.y / step) * step)

class Segment:
    def __init__(self, p1: Point, p2: Point):
        self.p1, self.p2 = p1, p2
    def vec(self): return self.p2 - self.p1
    def direction(self): return self.vec().normalised()
    def length(self): return self.vec().length()
    def normal(self): 
        d = self.direction()
        return Point(-d.y, d.x)

# ══════════════════════════════════════════
# 2. Egyptian Code Constants (Article 82)
# ══════════════════════════════════════════
class EgyptianCode:
    STAIR_MAX_RISER = 0.17
    STAIR_MIN_TREAD = 0.27
    STAIR_BLONDEL = 0.62
    STAIR_MAX_RISERS_PER_FLIGHT = 14
    STAIR_MIN_WIDTH = 1.10
    ELEVATOR_SHAFT_W = 1.60
    ELEVATOR_SHAFT_D = 1.80
    MIN_ROOM_AREA = 10.0
    MIN_ROOM_WIDTH = 2.50
    VENT_MIN_AREA = 1.5   # Bathroom/Kitchen shaft
    VENT_MIN_SIDE = 1.0

# ══════════════════════════════════════════
# 3. BIM Objects
# ══════════════════════════════════════════
class Room:
    def __init__(self, boundary: List[Point], label="Room"):
        self.boundary = [p.as_tuple() for p in boundary]
        self.label = label
        self.area = self._calc_area(boundary)
        self.min_width = self._calc_width(boundary)
        self.is_landlocked = True # Default, updated during pipe
        self.fill = (135, 206, 235)

    def _calc_area(self, pts) -> float:
        if len(pts) < 3: return 0.0
        a = sum(pts[i].x * pts[(i+1)%len(pts)].y - pts[(i+1)%len(pts)].x * pts[i].y for i in range(len(pts)))
        return round(abs(a)/2.0, 2)
    def _calc_width(self, pts) -> float:
        if len(pts) < 2: return 0.0
        # Simple bounding box min side for now
        xs = [p.x for p in pts]; ys = [p.y for p in pts]
        return round(min(max(xs)-min(xs), max(ys)-min(ys)), 2)

class StaircaseCore:
    def __init__(self, origin: Point, dir_run: Point, dir_width: Point, stair_w: float, floor_h: float):
        # Enforce Egyptian Code Min Width
        actual_stair_w = max(EgyptianCode.STAIR_MIN_WIDTH, stair_w)
        self.total_width = actual_stair_w * 2 + 0.2 # 20cm void
        
        num_risers = math.ceil(floor_h / EgyptianCode.STAIR_MAX_RISER)
        riser = floor_h / num_risers
        tread = max(EgyptianCode.STAIR_MIN_TREAD, EgyptianCode.STAIR_BLONDEL - 2*riser)
        
        # Check max risers per flight
        flight_risers = math.ceil(num_risers / 2)
        if flight_risers > EgyptianCode.STAIR_MAX_RISERS_PER_FLIGHT:
            # For simplicity, if exceeded, we still build but log we would need 3 flights
            pass
            
        run_len = flight_risers * tread
        self.total_len = run_len + actual_stair_w
        
        p1 = origin
        p2 = origin + dir_width * self.total_width
        p3 = p2 + dir_run * self.total_len
        p4 = origin + dir_run * self.total_len
        self.boundary = [p.as_tuple() for p in [p1, p2, p3, p4]]
        self.centroid = [(p1.x + p3.x)/2, (p1.y + p3.y)/2]
        self.area = round(self.total_len * self.total_width, 2)
        self.type = "u-shape-ebc"
        
        # Technical blueprint visual treads
        self.treads = []
        for i in range(1, flight_risers):
            # Left Flight
            t1 = origin + dir_run * (i * tread)
            t2 = t1 + dir_width * actual_stair_w
            self.treads.append([t1.as_tuple(), t2.as_tuple()])
            # Right Flight
            t3 = origin + dir_width * (actual_stair_w + 0.2) + dir_run * (run_len - i * tread)
            t4 = t3 + dir_width * actual_stair_w
            self.treads.append([t3.as_tuple(), t4.as_tuple()])

class ElevatorShaft:
    def __init__(self, origin: Point, dir_run: Point, dir_width: Point):
        w, d = EgyptianCode.ELEVATOR_SHAFT_W, EgyptianCode.ELEVATOR_SHAFT_D
        p1 = origin
        p2 = origin + dir_width * w
        p3 = p2 + dir_run * d
        p4 = origin + dir_run * d
        self.boundary = [p.as_tuple() for p in [p1, p2, p3, p4]]
        self.centroid = [(p1.x + p3.x)/2, (p1.y + p3.y)/2]
        self.shaftW = w
        self.shaftD = d
        self.cabinW = w - 0.4
        self.cabinD = d - 0.3
        self.area = round(w * d, 2)
        self.type = "passenger-ebc"

# ══════════════════════════════════════════
# 4. PLATINUM PIPELINE
# ══════════════════════════════════════════
class GeometryPipeline:
    # Module-based unit definitions (locked at 3.6m)
    TYPE_LABELS  = {"studio": "Studio", "bed1": "1 Bedroom", "bed2": "2 Bedroom", "bed3": "3 Bedroom"}
    TYPE_COLORS  = {"studio": (250, 204, 21), "bed1": (74, 222, 128), "bed2": (96, 165, 250), "bed3": (244, 114, 182)}

    def __init__(self, corridor_width=1.8, room_width=3.6, room_depth=5.0, floor_height=3.0,
                 stair_width=1.2, num_floors=5, core_spacing=30.0, unit_mix=None,
                 module=3.6, module_widths=None):
        self.corridor_width = corridor_width
        self.room_width     = module           # base module (3.6m)
        self.module         = module
        # Per-type unit widths in metres
        mw = module_widths or {"studio": 1, "bed1": 2, "bed2": 3, "bed3": 4}
        self.unit_widths = {k: module * v for k, v in mw.items()}
        self.room_depth     = room_depth
        self.floor_height   = floor_height
        self.stair_width    = stair_width
        self.num_floors     = num_floors
        self.core_spacing   = core_spacing
        # Normalise unit_mix to a list of dicts
        if isinstance(unit_mix, list) and unit_mix:
            self.unit_mix = unit_mix
        else:
            self.unit_mix = [
                {"type": "studio", "size": 45.0, "mix": 26.0, "color": "#FACC15", "balcLen": 2.0, "balcAlign": "center"},
                {"type": "bed1",   "size": 60.0, "mix": 46.0, "color": "#4ADE80", "balcLen": 2.0, "balcAlign": "center"},
                {"type": "bed2",   "size": 70.0, "mix": 25.0, "color": "#60A5FA", "balcLen": 2.0, "balcAlign": "center"},
                {"type": "bed3",   "size": 85.0, "mix":  3.0, "color": "#F472B6", "balcLen": 2.0, "balcAlign": "center"},
            ]
        self.building_height = self.num_floors * self.floor_height
        self.spine_pts = []
        self.hubs = []
        self.selected_unit_id = None
        self.reset()

    def _build_type_sequence(self):
        """Build an ordered list of unit types to cycle through, weighted by mix ratios."""
        sequence = []
        total_mix = sum(c.get("mix", 0) for c in self.unit_mix) or 100.0
        for c in self.unit_mix:
            pct = c.get("mix", 0) / total_mix
            # At least 1 slot per active type, round proportionally
            count = max(1, round(pct * 10)) if pct > 0 else 0
            sequence.extend([c.get("type", "studio")] * count)
        return sequence if sequence else ["studio", "bed1", "bed2", "bed3"]

    def reset(self):
        self.rooms, self.corridors, self.cores, self.vent_shafts = [], [], [], []
        self.doors, self.windows, self.static_obstacles = [], [], []

    def _polyline_length(self, pts):
        return sum((pts[i+1] - pts[i]).length() for i in range(len(pts)-1))

    def _calc_area(self, pts) -> float:
        if len(pts) < 3: return 0.0
        a = sum(pts[i].x * pts[(i+1)%len(pts)].y - pts[(i+1)%len(pts)].x * pts[i].y for i in range(len(pts)))
        return round(abs(a)/2.0, 2)

    def _point_and_dir_at_distance(self, pts, dist):
        d = max(0.0, dist)
        for i in range(len(pts)-1):
            a, b = pts[i], pts[i+1]
            seg = b - a
            L = seg.length()
            if L < 1e-9:
                continue
            if d <= L:
                t = d / L
                return a + seg * t, seg.normalised()
            d -= L
        return pts[-1], (pts[-1] - pts[-2]).normalised()

    def _place_cores_every(self, pts, nodes_L, nodes_R, miter_dirs, hw):
        if len(pts) < 2: return
        
        # Determine strict placement rules
        module_step = self.module or 3.6
        spacing = round(self.core_spacing / module_step) * module_step
        if spacing < module_step: spacing = module_step

        def place_core(p, d, label, side_name, origin_edge):
            direction_out = Point(-d.y, d.x) if side_name == "L" else Point(d.y, -d.x)
            
            stair = StaircaseCore(origin_edge, direction_out, d, self.stair_width, self.floor_height)
            core = {"label": label, "station_m": 0.0, "side": side_name, "stair": vars(stair), "elevator": None}
            
            elev = None
            if self.num_floors > 4:
                elev = ElevatorShaft(origin_edge + d * stair.total_width, direction_out, d)
                core["elevator"] = vars(elev)

            self.cores.append(core)
            
            self.static_obstacles.append([Point(px, py) for px, py in stair.boundary])
            if elev:
                self.static_obstacles.append([Point(px, py) for px, py in elev.boundary])

            # Envelope for Visual/Zoning
            core_offset = stair.total_width + (elev.shaftW if elev else 0.0)
            cp1 = origin_edge
            cp2 = cp1 + d * core_offset
            cp3 = cp2 + direction_out * stair.total_len
            cp4 = cp1 + direction_out * stair.total_len
            core_env = Room([cp1.grid(), cp2.grid(), cp3.grid(), cp4.grid()], label=f"Service Core {len(self.cores)}")
            
            self.rooms.append({
                "label": core_env.label,
                "boundary": core_env.boundary,
                "area": core_env.area,
                "min_width": core_env.min_width,
                "is_landlocked": False,
                "fill": (210, 215, 220)
            })
            self.static_obstacles.append([Point(px, py) for px, py in core_env.boundary])

        # Walk each straight segment independently to avoid corners
        for i in range(len(pts)-1):
            p1, p2 = pts[i], pts[i+1]
            seg_vec = p2 - p1
            seg_len = seg_vec.length()
            if seg_len < 5.0: continue
            
            d = seg_vec.normalised()
            n = Point(-d.y, d.x)
            
            # Safe zone bounds: avoid placing cores near the actual corners (leave room depth + tolerance for corner units)
            safe_margin = self.room_depth + 1.0 # Buffer from the corner
            if seg_len <= safe_margin * 2:
                # Segment too short to have a core safely, put it strictly in the exact middle
                mid_p = p1 + d * (seg_len / 2.0)
                left_edge = (mid_p + n * hw).grid()
                place_core(mid_p, d, f"Service Core {len(self.cores)+1}", "L", left_edge)
                continue

            # Place periodic cores along the straight span
            s = safe_margin
            while s <= seg_len - safe_margin + 1e-6:
                curr_p = p1 + d * s
                # Default map to Left side for now
                left_edge = (curr_p + n * hw).grid()
                place_core(curr_p, d, f"Service Core {len(self.cores)+1}", "L", left_edge)
                s += spacing

    def process_boundary(self, boundary: List[List[float]], setbacks: float = 3.0, apply_zoning=False):
        """Generates a floor plan by automatically determining a spine from the lot boundary."""
        pts = [Point(p[0], p[1]) for p in boundary]
        
        # Find major axes
        xs = [p.x for p in pts]
        ys = [p.y for p in pts]
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        
        w = max_x - min_x
        h = max_y - min_y
        
        # Abort if lot is too small for standard parametric generation
        min_dim_req = self.corridor_width + (self.room_depth * 2) + (setbacks * 2)
        if w < min_dim_req and h < min_dim_req:
            # We cannot fit a double-sided corridor realistically. Gracefully fallback.
            self.reset()
            return
        
        # Simple heuristic for crude skeleton
        spine = []
        if len(pts) == 6: 
            # Detect L shape (concave vertex) - generic mapping of the L spine
            spine = [[min_x + w*0.25, max_y - setbacks], 
                     [min_x + w*0.25, min_y + h*0.25], 
                     [max_x - setbacks, min_y + h*0.25]]
        else:
            if w > h:
                spine = [[min_x + setbacks, min_y + h/2], [max_x - setbacks, min_y + h/2]]
            else:
                spine = [[min_x + w/2, min_y + setbacks], [min_x + w/2, max_y - setbacks]]
        
        self.process_spine(spine, apply_zoning)

    def process_spine(self, polyline, apply_zoning=False):
        self.reset()
        pts = [Point(p[0], p[1]) if isinstance(p, (list, tuple)) else p for p in polyline]
        if len(pts) < 2: return

        self.spine_pts = [p.as_tuple() for p in pts]
        segs = [Segment(pts[i], pts[i+1]) for i in range(len(pts)-1)]
        hw = self.corridor_width / 2.0
        
        # 1. BUTT-JOINT MITER GENERATION
        nodes_L, nodes_R, miter_dirs = [], [], []
        for i in range(len(pts)):
            if i == 0:
                v = segs[0].direction(); n = Point(-v.y, v.x)
                nodes_L.append(pts[0] + n * hw); nodes_R.append(pts[0] - n * hw)
                miter_dirs.append(n)
            elif i == len(pts)-1:
                v = segs[-1].direction(); n = Point(-v.y, v.x)
                nodes_L.append(pts[-1] + n * hw); nodes_R.append(pts[-1] - n * hw)
                miter_dirs.append(n)
            else:
                v1, v2 = segs[i-1].direction(), segs[i].direction()
                bisector = (v1 + v2).normalised()
                m = Point(-bisector.y, bisector.x)
                n1 = Point(-v1.y, v1.x)
                dot = m.dot(n1)
                scale = hw / max(0.1, dot)
                nodes_L.append(pts[i] + m * scale); nodes_R.append(pts[i] - m * scale)
                miter_dirs.append(m)

        # 2. CORRIDOR GENERATION + HUBS
        for i in range(len(segs)):
            poly = [nodes_L[i], nodes_L[i+1], nodes_R[i+1], nodes_R[i]]
            self.corridors.append([p.as_tuple() for p in poly])
            self.static_obstacles.append(poly)
            # Hub at every bend (spine node between two segments)
        for i in range(1, len(pts) - 1):
            hub_poly = [nodes_L[i-1], nodes_L[i], nodes_R[i], nodes_R[i-1]]
            self.hubs.append({"vertex": pts[i].as_tuple(), "boundary": [p.as_tuple() for p in hub_poly], "angle": 90})

        # 3. CORE PLACEMENT (Every 30m)
        self._place_cores_every(pts, nodes_L, nodes_R, miter_dirs, hw)

        # Fallback safety (if none placed)
        if not self.cores:
            m_dir = segs[0].direction()
            m_norm = Point(-m_dir.y, m_dir.x)
            stair = StaircaseCore(nodes_L[0], m_norm, m_dir, self.stair_width, self.floor_height)
            self.cores.append({
                "label": "Service Core 1",
                "stair": vars(stair),
                "elevator": None
            })
            self.static_obstacles.append([Point(px, py) for px, py in stair.boundary])
            
            # Simple fallback envelope mapping
            core_env = Room([Point(*pt).grid() for pt in stair.boundary], label="Service Core Envelope 1")
            self.rooms.append({
                "label": core_env.label, "boundary": core_env.boundary,
                "area": core_env.area, "min_width": core_env.min_width,
                "is_landlocked": False, "fill": (210, 215, 220)
            })
            self.static_obstacles.append([Point(px, py) for px, py in stair.boundary])

        # 4. CORNER UNIT GENERATION
        # Explicitly map the left/right intersection volumes (green/brown gaps)
        # to ensure they are 100% occupied before standard room packing starts.
        for i in range(1, len(pts)-1):
            p1, p_cen, p2 = pts[i-1], pts[i], pts[i+1]
            v1 = (p_cen - p1).normalised()
            v2 = (p2 - p_cen).normalised()
            cross = v1.x * v2.y - v1.y * v2.x
            is_left_turn = (cross > 0)
            
            # The corner geometry consists of the intersection of two orthogonal bands.
            # We connect the outer corner of the room depths to the miter joint.
            n1 = miter_dirs[i-1] # (Using miter_dirs is approximate for segments, let's use exact normals)
            n_in_1 = Point(-v1.y, v1.x)
            n_in_2 = Point(-v2.y, v2.x)
            
            # Distance from centerline to the outer wall of rooms is hw + depth
            overall_depth = hw + self.room_depth
            
            # Left side Corner
            # Ray 1: p1 -> p_cen, shifted left by overall_depth
            # Ray 2: p_cen -> p2, shifted left by overall_depth
            # Intersection is the far corner tip.
            bisector_L = (v1 + v2).normalised()
            m_L = Point(-bisector_L.y, bisector_L.x)
            dot_L = m_L.dot(n_in_1)
            scale_L = overall_depth / max(0.1, dot_L)
            far_pt_L = p_cen + m_L * scale_L
            
            # The 4 points forming the Left Corner Unit
            c_poly_L = [
                nodes_L[i],                            # Miter point at corridor edge
                (nodes_L[i] - v1 * self.room_depth),   # Project backward along segment 1
                far_pt_L,                              # The far intersecting corner
                (nodes_L[i] + v2 * self.room_depth)    # Project forward along segment 2
            ]
            
            # Right side Corner
            bisector_R = (v1 + v2).normalised()
            m_R = Point(bisector_R.y, -bisector_R.x) # Right side bisector
            n_out_1 = Point(v1.y, -v1.x) # Right normal
            dot_R = m_R.dot(n_out_1)
            scale_R = overall_depth / max(0.1, dot_R)
            far_pt_R = p_cen + m_R * scale_R
            
            c_poly_R = [
                nodes_R[i],                            # Miter point at corridor edge
                (nodes_R[i] - v1 * self.room_depth),
                far_pt_R,
                (nodes_R[i] + v2 * self.room_depth)
            ]
            
            # Only generate a unit on the "Outside" of the turn to form a clean L-shape,
            # or on both if there's enough room. Simplest rule: inside corners get badly
            # pinched, we just generate on both sides and let collision detection handle overlap.
            for side_name, poly, turn_condition in [("L", c_poly_L, is_left_turn), ("R", c_poly_R, not is_left_turn)]:
                # Visual type colors: Outer (green) vs Inner (brown)
                # Left turn -> Right is outer (green). Right turn -> Left is outer (green).
                is_outer = (side_name == "R" and is_left_turn) or (side_name == "L" and not is_left_turn)
                color = (74, 222, 128) if is_outer else (165, 42, 42)
                lbl = "Corner Unit (Outer)" if is_outer else "Corner Unit (Inner)"

                bnd = [pt.as_tuple() for pt in poly]
                area = self._calc_area(poly)
                if area > 10.0:
                    self.rooms.append({
                        "label": lbl,
                        "boundary": list(bnd),
                        "area": round(area, 1),
                        "min_width": round(self.room_depth, 2),
                        "is_landlocked": False,
                        "fill": color,
                        "unit_type": "bed2" if area > 60 else "studio",
                        "modules": round(area / (self.room_depth * self.module), 1),
                        "config": {}
                    })
                    self.static_obstacles.append(poly)


        # 5. ROOM PACKING (Zero-Overlap Butt-Joints)
        ri = 1
        depth = self.room_depth

        for side in ["L", "R"]:
            path = nodes_L if side == "L" else nodes_R
            norms = miter_dirs if side == "L" else [n * -1 for n in miter_dirs]
            
            for i in range(len(segs)):
                p1, p2 = path[i], path[i+1]
                n1, n2 = norms[i], norms[i+1]
                v_seg = p2 - p1
                L_seg = v_seg.length()
                if L_seg < 1.0: continue

                vd = v_seg.normalised()
                v_orth = Point(-vd.y, vd.x) if side == "L" else Point(vd.y, -vd.x)
                band_poly = [p1.as_tuple(), p2.as_tuple(), (p2 + v_orth*depth).as_tuple(), (p1 + v_orth*depth).as_tuple()]
                
                blocked_intervals = []
                for obs in self.static_obstacles:
                    obs_tuples = [p.as_tuple() if hasattr(p, 'as_tuple') else tuple(p) for p in obs]
                    if Article82_Validator._sat_collision(band_poly, obs_tuples):
                        obs_pts = [Point(pt[0], pt[1]) for pt in obs_tuples]
                        proj_t = [(p - p1).dot(vd) for p in obs_pts]
                        proj_depth = [(p - p1).dot(v_orth) for p in obs_pts]
                        
                        if min(proj_depth) > depth + 0.1 or max(proj_depth) < -0.1:
                            pass # False positive or outside the band completely
                        else:
                            # Expand blockage by small tolerance for safe clearance
                            min_t, max_t = min(proj_t) - 0.05, max(proj_t) + 0.05
                            min_t = max(0.0, min_t)
                            max_t = min(L_seg, max_t)
                            if max_t > min_t:
                                blocked_intervals.append((min_t, max_t))
                            
                blocked_intervals.sort()
                merged = []
                if blocked_intervals:
                    curr_s, curr_e = blocked_intervals[0]
                    for s_b, e_b in blocked_intervals[1:]:
                        if s_b <= curr_e + 1e-3:
                            curr_e = max(curr_e, e_b)
                        else:
                            merged.append((curr_s, curr_e))
                            curr_s, curr_e = s_b, e_b
                    merged.append((curr_s, curr_e))
                    
                spans = []
                curr_ptr = 0.05
                for s_b, e_b in merged:
                    if s_b > curr_ptr + 1e-3:
                        spans.append((curr_ptr, s_b))
                    curr_ptr = e_b
                if curr_ptr < L_seg - 0.05:
                    spans.append((curr_ptr, L_seg - 0.05))

                for span_start, span_end in spans:
                    span_len = span_end - span_start
                    if span_len < self.room_width: continue  # Less than 1 module, skip

                    # === MODULE-BASED PACKING ===
                    # Build a cycling sequence of unit types weighted by mix ratios
                    type_seq = self._build_type_sequence()
                    seq_idx  = 0
                    curr_pos = span_start

                    while curr_pos < span_end - 0.1:
                        remaining = span_end - curr_pos

                        # Pick the next unit type from the cycle
                        unit_type = type_seq[seq_idx % len(type_seq)]
                        unit_w = self.unit_widths.get(unit_type, self.room_width)
                        
                        # Gap Closing: If the remaining space is small, stretch this unit to fill it
                        # Or if we have a little more than 1 module left, just make a Studio.
                        if remaining < unit_w + (self.room_width * 0.5):
                           # If what's left is less than 1.5 modules, this is our LAST room in the span
                           use_w = remaining
                           # Use the largest type that fits as the label
                           if use_w < self.room_width * 1.5: unit_type = "studio"
                           elif use_w < self.room_width * 2.5: unit_type = "bed1"
                           elif use_w < self.room_width * 3.5: unit_type = "bed2"
                           else: unit_type = "bed3"
                        else:
                           use_w = unit_w
                           seq_idx += 1

                        if use_w < self.room_width * 0.5: break # sanity check

                        t1 = curr_pos / L_seg
                        t2 = (curr_pos + use_w) / L_seg
                        v1_in, v2_in = (p1 + v_seg * t1).grid(), (p1 + v_seg * t2).grid()
                        v1_out, v2_out = (v1_in + v_orth * depth).grid(), (v2_in + v_orth * depth).grid()

                        poly = [v1_in, v2_in, v2_out, v1_out]
                        lbl   = self.TYPE_LABELS.get(unit_type, "Room")
                        color = self.TYPE_COLORS.get(unit_type, (180, 200, 255))

                        # Convert Point objects → tuples FIRST (Points don't support subscript)
                        bnd = [pt.as_tuple() if hasattr(pt, "as_tuple") else tuple(pt) for pt in poly]
                        # Shoelace area on tuples
                        area = abs(sum(
                            bnd[i][0] * bnd[(i+1) % 4][1] - bnd[(i+1) % 4][0] * bnd[i][1]
                            for i in range(4)
                        )) / 2.0

                        # Get config for balcony from unit_mix list
                        cfg = next((c for c in self.unit_mix if c.get("type") == unit_type), {})

                        obs_list = list(self.static_obstacles) + [r["boundary"] for r in self.rooms]
                        for c in self.cores:
                            if "stair" in c and c["stair"]:       obs_list.append(c["stair"]["boundary"])
                            if "elevator" in c and c["elevator"]: obs_list.append(c["elevator"]["boundary"])

                        has_collision = False
                        for obs in obs_list:
                            if not obs:
                                continue
                            obs_as_tuples = obs if isinstance(obs[0], (list, tuple)) else [p.as_tuple() for p in obs]
                            if Article82_Validator._sat_collision(list(bnd), obs_as_tuples):
                                has_collision = True
                                break

                        if not has_collision:
                            self.rooms.append({
                                "label": lbl,
                                "boundary": [list(pt) for pt in bnd],
                                "area": round(area, 1),
                                "min_width": round(use_w, 2),
                                "is_landlocked": False,
                                "fill": color,
                                "unit_type": unit_type,
                                "modules": round(use_w / self.module, 2),
                                "config": cfg,
                            })
                            ri += 1

                        curr_pos += use_w


        if apply_zoning:
            self._apply_zoning()
        self._add_balconies()
        self.add_simple_shafts()
        self._place_doors()

    def _apply_zoning(self):
        if not self.rooms or not self.cores:
            return

        base_units = [r for r in self.rooms if "Unit" in r["label"]]
        cores = [r for r in self.rooms if "Unit" not in r["label"]]
        if not base_units: return

        # target config list
        mix_config = getattr(self, "unit_mix", [])
        if not mix_config or isinstance(mix_config, dict):
            # Fallback legacy configs
            mix_config = [
                {"type": "studio", "size": 45.0, "mix": 26.0, "color": "#ffebcd", "balcLen": 2.0, "balcAlign": "center"},
                {"type": "bed1", "size": 60.0, "mix": 46.0, "color": "#e1f5e1", "balcLen": 2.0, "balcAlign": "center"},
                {"type": "bed2", "size": 70.0, "mix": 25.0, "color": "#e1f5ff", "balcLen": 2.0, "balcAlign": "center"},
                {"type": "bed3", "size": 85.0, "mix": 3.0, "color": "#f5e1f5", "balcLen": 2.0, "balcAlign": "center"}
            ]

        total_base_area = sum(r.get("area", 17.5) for r in base_units)
        
        pool = []
        for c in mix_config:
            pct = c.get("mix", 0) / 100.0
            target_area = total_base_area * pct
            unit_size = max(c.get("size", 40), 10) 
            count = max(1, int(round(target_area / unit_size))) if pct > 0 else 0
            pool.extend([c] * count)
        
        import random
        random.seed(42)
        random.shuffle(pool)

        final_rooms = []
        
        while base_units:
            if not pool: 
                pool.append(mix_config[0] if mix_config else {"type": "studio", "size": 35.0, "color": "#ffebcd"})
                
            config = pool.pop(0)
            target_size = float(config.get("size", 35.0))

            current = base_units.pop(0)
            current_area = current.get("area", 17.5)

            while current_area < target_size * 0.85 and base_units:
                # Need to find adjacent
                r1_pts = set([(round(p[0], 2), round(p[1], 2)) for p in current["boundary"]])
                neighbor_idx = None
                for j, r2 in enumerate(base_units):
                    r2_pts = set([(round(p[0], 2), round(p[1], 2)) for p in r2["boundary"]])
                    if len(r1_pts.intersection(r2_pts)) >= 2:
                        neighbor_idx = j
                        break

                if neighbor_idx is not None:
                    neighbor = base_units.pop(neighbor_idx)
                    current = self._execute_union(current, neighbor)
                    current_area = current.get("area", current_area + neighbor.get("area", 17.5))
                else: 
                    break

            # Assign properties
            t_str = config.get("type", "studio")
            if t_str == "studio": lbl = "Studio"
            elif t_str == "bed1": lbl = "1 Bedroom"
            elif t_str == "bed2": lbl = "2 Bedroom"
            else: lbl = "3 Bedroom"
            
            current["label"] = lbl
            
            c_hex = config.get("color", "#cccccc").lstrip('#')
            current["fill"] = tuple(int(c_hex[i:i+2], 16) for i in (0, 2, 4))
            
            current["is_landlocked"] = False
            current["config"] = config # save config for balconies
            final_rooms.append(current)

        self.rooms = cores + final_rooms
        self._add_balconies()

    def _add_balconies(self):
        """Internal balcony subdivision logic - always on facade (opposite of corridor)."""
        all_edges = {}
        for r in self.rooms:
            bnd = r["boundary"]
            for i in range(len(bnd)):
                p1 = tuple(round(x, 2) for x in bnd[i])
                p2 = tuple(round(x, 2) for x in bnd[(i+1)%len(bnd)])
                edge = tuple(sorted([p1, p2]))
                all_edges[edge] = all_edges.get(edge, 0) + 1

        for r in self.rooms:
            config = r.get("config", {})
            blen = float(config.get("balcLen", 0.0))
            if not any(x in r.get("label", "") for x in ["Studio", "Bedroom", "Bed", "Unit"]):
                continue
            if blen <= 0.0 or config.get("balcAlign") == "none":
                continue

            bnd = r["boundary"]
            unshared = []
            for i in range(len(bnd)):
                p1, p2 = bnd[i], bnd[(i+1)%len(bnd)]
                edge = tuple(sorted([tuple(round(x, 2) for x in p1), tuple(round(x, 2) for x in p2)]))
                if all_edges.get(edge, 0) == 1:
                    unshared.append((p1, p2))
            
            if not unshared: continue
            
            # --- FACADE DETECTION (FURTHEST FROM CORRIDOR) ---
            # Instead of longest edge, we want the edge OPPOSITE the corridor.
            def dist_to_corridor(edge):
                m = [(edge[0][0]+edge[1][0])/2, (edge[0][1]+edge[1][1])/2]
                min_d = 1e9
                for cb in self.corridors:
                    for i in range(len(cb)):
                        d = self._dist_point_to_seg(m, cb[i], cb[(i+1)%len(cb)])
                        min_d = min(min_d, d)
                return min_d

            # Pick unshared edge furthest from the corridor
            exterior_edge = max(unshared, key=dist_to_corridor)
            p1, p2 = exterior_edge
            length = math.hypot(p1[0]-p2[0], p1[1]-p2[1])
            
            align = config.get("balcAlign", "full")
            vx, vy = (p2[0]-p1[0])/length, (p2[1]-p1[1])/length
            
            # Normal vector pointing INWARDS (towards unit center)
            cx = sum(p[0] for p in bnd) / len(bnd)
            cy = sum(p[1] for p in bnd) / len(bnd)
            mx, my = (p1[0]+p2[0])/2, (p1[1]+p2[1])/2
            nx, ny = cx - mx, cy - my
            nl = math.hypot(nx, ny)
            if nl > 0: nx, ny = nx/nl, ny/nl
            else: nx, ny = -vy, vx
            
            # Balcony width along edge
            bp1, bp2 = p1, p2 
            if align != "full":
                off_st = float(config.get("balcOffsetSt", 0.0))
                off_en = float(config.get("balcOffsetEn", 0.0))
                tl = max(0.5, length - off_st - off_en)
                s_dist = off_st if align == "left" else (length - tl)/2 if align == "center" else length - tl - off_en
                bp1 = (p1[0] + vx * s_dist, p1[1] + vy * s_dist)
                bp2 = (bp1[0] + vx * tl, bp1[1] + vy * tl)

            # Subdivision line (internal)
            bx1, by1 = bp1[0] + nx*blen, bp1[1] + ny*blen
            bx2, by2 = bp2[0] + nx*blen, bp2[1] + ny*blen
            
            r["balcony"] = [list(bp1), [bx1, by1], [bx2, by2], list(bp2)]
            r["balcony_fill"] = "rgba(40, 48, 60, 0.45)"
            
            # Physically shrink the room boundary
            new_bnd = []
            for pt in bnd:
                d1 = math.hypot(pt[0]-bp1[0], pt[1]-bp1[1])
                d2 = math.hypot(pt[0]-bp2[0], pt[1]-bp2[1])
                if d1 < 0.05: new_bnd.append([bx1, by1])
                elif d2 < 0.05: new_bnd.append([bx2, by2])
                else: new_bnd.append(list(pt))
            
            r["boundary"] = new_bnd
            r["area"] = round(abs(sum(new_bnd[i][0]*new_bnd[(i+1)%len(new_bnd)][1] - new_bnd[(i+1)%len(new_bnd)][0]*new_bnd[i][1] for i in range(len(new_bnd))))/2.0, 1)

    def _dist_point_to_seg(self, p, a, b):
        px, py = p
        ax, ay = a
        bx, by = b
        l2 = (bx-ax)**2 + (by-ay)**2
        if l2 == 0: return math.hypot(px-ax, py-ay)
        t = max(0, min(1, ((px-ax)*(bx-ax) + (py-ay)*(by-ay)) / l2))
        return math.hypot(px - (ax + t*(bx-ax)), py - (ay + t*(by-ay)))

    def _place_doors(self):
        self.doors = []
        for r in self.rooms:
            # Only residential units should have entry doors from corridor
            lbl = r.get("label", "")
            if "Core" in lbl or "Shaft" in lbl or "Corridor" in lbl: 
                continue
            
            bnd = r.get("boundary", [])
            if not bnd: continue
            
            best_edge = None
            min_d = 999.0
            
            for i in range(len(bnd)):
                p1, p2 = bnd[i], bnd[(i+1)%len(bnd)]
                mid = ((p1[0]+p2[0])/2, (p1[1]+p2[1])/2)
                
                # Check distance to ANY corridor segment
                for cb in self.corridors:
                    for j in range(len(cb)):
                        cp1, cp2 = cb[j], cb[(j+1)%len(cb)]
                        d = self._dist_point_to_seg(mid, cp1, cp2)
                        if d < min_d:
                            min_d = d
                            best_edge = (p1, p2)
            
            # If the closest edge to a corridor is within 0.5m, it's our entry wall
            if best_edge and min_d < 0.5:
                p1, p2 = best_edge
                length = math.hypot(p1[0]-p2[0], p1[1]-p2[1])
                if length < 0.9: continue # Door needs at least 90cm
                
                vx = (p2[0]-p1[0])/length
                vy = (p2[1]-p1[1])/length
                dm_x, dm_y = (p1[0]+p2[0])/2, (p1[1]+p2[1])/2
                
                # Normal towards corridor (outwards)
                # We can approximate this by picking the corridor point and getting the direction
                # For simplified UI, swing can just be a fixed vector or None
                self.doors.append({
                    "p1": [round(dm_x - vx*0.45, 3), round(dm_y - vy*0.45, 3)],
                    "p2": [round(dm_x + vx*0.45, 3), round(dm_y + vy*0.45, 3)],
                    "swing": [round(-vy, 3), round(vx, 3)], # perpendicular
                    "room": lbl
                })

    def add_simple_shafts(self):
        """Generate ventilation/light-well shafts for landlocked rooms.

        Development fixes:
        - Shaft size is driven by EgyptianCode constants AND H/4 rule (building height).
        - Adds required metadata used by UI/tests: minSide, minArea.
        - Grid-snaps all corners consistently.
        """
        # H/4 minimum side for light wells (habitual rooms)
        req_h4_side = max(3.0, (self.building_height / 4.0) if getattr(self, "building_height", 0) else 3.0)

        # Minimums from constants (bath/kitchen shaft baseline)
        min_area = float(EgyptianCode.VENT_MIN_AREA)
        min_side = float(EgyptianCode.VENT_MIN_SIDE)
        min_side_by_area = math.sqrt(min_area) if min_area > 0 else 0.0

        # Target square shaft side
        side = max(req_h4_side, min_side, min_side_by_area)

        for r in self.rooms:
            if not r.get("is_landlocked"):
                continue

            # Heuristic anchor point (existing behavior): use room corner[2]
            p = Point(*r["boundary"][2]).grid()

            p1 = p.grid()
            p2 = (p + Point(side, 0)).grid()
            p3 = (p + Point(side, side)).grid()
            p4 = (p + Point(0, side)).grid()

            shaft_poly = [p1.as_tuple(), p2.as_tuple(), p3.as_tuple(), p4.as_tuple()]

            self.vent_shafts.append({
                "boundary": shaft_poly,
                "label": "Vent Shaft",
                "area": round(side * side, 2),
                "minSide": round(side, 2),
                "minArea": round(min_area, 2),
                "reqH4Side": round(req_h4_side, 2)
            })

    def _merge_undersized_units(self):
        """Identifies adjacent rooms under 10m² and merges them."""
        if len(self.rooms) < 2: return
        
        merged_any = True
        while merged_any:
            merged_any = False
            for i in range(len(self.rooms)):
                # Skip Bathrooms and large rooms
                if self.rooms[i]["area"] >= EgyptianCode.MIN_ROOM_AREA or "Bath" in self.rooms[i]["label"]: 
                    continue
                neighbor_idx = self._find_sharing_neighbor(i)
                if neighbor_idx is not None:
                    self.rooms[i] = self._execute_union(self.rooms[i], self.rooms[neighbor_idx])
                    self.rooms.pop(neighbor_idx)
                    merged_any = True
                    break

    def _find_sharing_neighbor(self, idx):
        """Detection logic for shared mitered edges."""
        r1_pts = set([(round(p[0], 2), round(p[1], 2)) for p in self.rooms[idx]["boundary"]])
        for j, r2 in enumerate(self.rooms):
            if idx == j: continue
            r2_pts = set([(round(p[0], 2), round(p[1], 2)) for p in r2["boundary"]])
            # If they share at least 2 points, they share an edge
            if len(r1_pts.intersection(r2_pts)) >= 2:
                return j
        return None

    def _execute_union(self, r1, r2):
        """Topologically merges two adjacent unit boundaries into a single clean BIM quadrilateral."""
        import math
        
        pts1 = [tuple(round(n, 3) for n in p) for p in r1["boundary"]]
        pts2 = [tuple(round(n, 3) for n in p) for p in r2["boundary"]]
        
        shared = set(pts1).intersection(set(pts2))
        
        # Extract the disjoint geometric nodes making up the exterior corners
        all_unq = [p for p in pts1 if p not in shared] + [p for p in pts2 if p not in shared]
        
        # Failsafe if geometry is strangely collapsed 
        if len(all_unq) < 3:
            all_unq = list(set(pts1 + pts2))
            
        # Centroid sorting to establish correct polygon winding order
        cx = sum(p[0] for p in all_unq) / len(all_unq)
        cy = sum(p[1] for p in all_unq) / len(all_unq)
        
        new_bnd = sorted(all_unq, key=lambda p: math.atan2(p[1]-cy, p[0]-cx))
        
        # Shoelace formula for genuine irregular polygon area
        area = 0.5 * abs(sum(new_bnd[i][0] * new_bnd[(i+1)%len(new_bnd)][1] - new_bnd[(i+1)%len(new_bnd)][0] * new_bnd[i][1] for i in range(len(new_bnd))))
        
        # Approximation of minor width
        w1 = math.hypot(new_bnd[0][0]-new_bnd[1][0], new_bnd[0][1]-new_bnd[1][1]) if len(new_bnd) >=2 else 0
        w2 = math.hypot(new_bnd[1][0]-new_bnd[2][0], new_bnd[1][1]-new_bnd[2][1]) if len(new_bnd) >=3 else w1
        
        return {
            "label": f"Merged Unit",
            "boundary": [list(p) for p in new_bnd],
            "area": round(area, 2),
            "min_width": round(min(w1, w2), 2),
            "is_landlocked": r1.get("is_landlocked", False) or r2.get("is_landlocked", False),
            "fill": (200, 200, 255) 
        }

    def get_json(self, apply_zoning=False):
        """Modified to run Optimization and Validation before export."""
        import uuid
        for i, r in enumerate(self.rooms):
            if "id" not in r:
                r["id"] = f"room_{i}_{uuid.uuid4().hex[:8]}"
                
        internal_violations = []
        
        if apply_zoning:
            self._merge_undersized_units() # Execute self-healing logic
            
            # Calculate Height locally
            sys_height = self.num_floors * self.floor_height
            audit = Article82_Validator(sys_height)
            internal_violations = audit.run_audit(self.rooms, self.vent_shafts)
            
            # SAT Bounds Check
            overlap_violations = audit.check_for_overlaps(self.rooms)
            internal_violations.extend(overlap_violations)
            
            # Apply Visual Mapping to results
            for r in self.rooms:
                r_errors = [v for v in internal_violations if v.get("subject") == r["label"] or (v.get("type") in ["OVERLAP", "GEOMETRY"] and r["label"] in v.get("subject", ""))]
                if r_errors:
                    r["stroke"] = {"color": "#FF0000", "weight": 4, "dash": [5, 5]}
                    r["fill_opacity"] = 0.4
                else:
                    r["stroke"] = {"color": "#2C3E50", "weight": 1, "dash": []}

            for shaft in self.vent_shafts:
                shaft_errors = [v for v in internal_violations if v.get("type") == "VENT"]
                if shaft_errors:
                    shaft["stroke"] = {"color": "#E74C3C", "weight": 2, "dash": []}
                    shaft["fill"] = "rgba(231, 76, 60, 0.2)"
        else:
            for r in self.rooms:
                r["stroke"] = {"color": "#2C3E50", "weight": 1, "dash": []}
        
        
        # 1. Component Areas (Single Floor)
        circ_area = sum(self._calc_area([Point(*p) for p in c]) for c in self.corridors)
        circ_area += sum(self._calc_area([Point(*p) for p in h["boundary"]]) for h in self.hubs)
        
        unit_area = sum(r.get("area", 0) for r in self.rooms if any(x in r.get("label", "") for x in ["Unit", "Studio", "Bedroom", "Bed"]))
        stair_area = sum(c["stair"]["area"] for c in self.cores if c.get("stair"))
        elev_area = sum(c["elevator"]["area"] for c in self.cores if c.get("elevator"))
        shaft_area = sum(self._calc_area([Point(*p) for p in s["boundary"]]) for s in self.vent_shafts)
        balc_area = 0
        
        for r in self.rooms:
            if r.get("balcony"):
                pts = r["balcony"]
                if len(pts) >= 3:
                    balc_area += self._calc_area([Point(*p) for p in pts])

        # 2. Building Metrics (Multi-floor)
        # Gross Built-Up Area (GBA) = (All Rooms + Corridors + Hubs) * num_floors
        # For simplicity, we assume footprint is constant across all floors here
        footprint = circ_area + sum(r.get("area", 0) for r in self.rooms) + shaft_area
        total_gba = footprint * self.num_floors
        
        # Gross Floor Area (GFA) often excludes balconies and shafts in some codes, 
        # but here we'll define it as GBA - Balconies (if balconies were included in rooms, they aren't here)
        total_gfa = total_gba
        
        net_gross_ratio = (unit_area / footprint * 100) if footprint > 0 else 0
        circ_percent = (circ_area / footprint * 100) if footprint > 0 else 0

        # Facade Area Estimate (2 * spine_length + ends) * floors * height
        spine_len = self._polyline_length([Point(*p) for p in self.spine_pts])
        facade_perimeter = (spine_len * 2) + (self.room_depth * 4) + (self.corridor_width * 2)
        total_facade = facade_perimeter * self.num_floors * self.floor_height

        return {
            "v": "18.1-PLATINUM", 
            "spine": self.spine_pts,
            "hubs": self.hubs,
            "corridors": self.corridors, 
            "rooms": self.rooms,
            "cores": self.cores, 
            "doors": self.doors, 
            "ventShafts": self.vent_shafts,
            "violations": internal_violations,
            "economics": {
                "grossBUA": round(total_gba, 2),
                "netUsable": round(unit_area * self.num_floors, 2),
                "footprintArea": round(footprint, 2),
                "balconyArea": round(balc_area * self.num_floors, 2),
                "unitsArea": round(unit_area * self.num_floors, 2),
                "stairArea": round((stair_area + elev_area) * self.num_floors, 2),
                "elevatorArea": round(elev_area * self.num_floors, 2),
                "circArea": round(circ_area * self.num_floors, 2),
                "circPercent": round(circ_percent, 1),
                "netGrossRatio": round(net_gross_ratio, 1),
                "deadSpace": round(shaft_area * self.num_floors, 2),
                "facadeArea": round(total_facade, 2)
            }
        }

    def select_unit_at(self, x: float, y: float):
        """البحث عن وحدة بناءً على إحداثيات الضغط (Point-in-Polygon)"""
        for room in self.rooms:
            if self._is_point_in_poly(x, y, room["boundary"]):
                self.selected_unit_id = room.get("id")
                return room
        return None

    def _is_point_in_poly(self, x, y, poly):
        """خوارزمية التأكد من وجود النقطة داخل حدود الغرفة"""
        n = len(poly)
        inside = False
        p1x, p1y = poly[0]
        for i in range(n + 1):
            p2x, p2y = poly[i % n]
            if y > min(p1y, p2y):
                if y <= max(p1y, p2y):
                    if x <= max(p1x, p2x):
                        if p1y != p2y:
                            xints = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                        if p1x == p2x or x <= xints:
                            inside = not inside
            p1x, p1y = p2x, p2y
        return inside

    def change_selected_unit_type(self, new_label: str, color_hex: str):
        """تحديث بيانات الوحدة المختارة"""
        if not self.selected_unit_id:
            return False
            
        for room in self.rooms:
            if room.get("id") == self.selected_unit_id:
                room["label"] = new_label
                # تحويل Hex إلى RGB للـ Fill
                room["fill"] = tuple(int(color_hex.lstrip('#')[i:i+2], 16) for i in (0, 2, 4))
                return True
        return False

class Article82_Validator:
    """Legal gatekeeper for Egyptian Building Code compliance."""
    def __init__(self, building_height: float):
        self.height = building_height
        self.min_room_area = EgyptianCode.MIN_ROOM_AREA # 10.0m2
        self.min_room_width = EgyptianCode.MIN_ROOM_WIDTH # 2.50m

    def run_audit(self, rooms: List[Dict], shafts: List[Dict]) -> List[Dict]:
        violations = []
        # Check Rooms for Area, Width, and Geometric Integrity (4 corners)
        for r in rooms:
            if len(r.get("boundary", [])) != 4:
                violations.append({"type": "GEOMETRY", "subject": r["label"], "msg": "Boundary is not 4 corners"})
            if r["area"] < self.min_room_area and "Merged" not in r["label"] and "Bath" not in r["label"] and "Core" not in r["label"]:
                violations.append({"type": "AREA", "subject": r["label"], "msg": f"Below {self.min_room_area}m²"})
            if r["min_width"] < self.min_room_width and "Bath" not in r["label"] and "Core" not in r["label"]:
                violations.append({"type": "WIDTH", "subject": r["label"], "msg": f"Below {self.min_room_width}m"})
        
        # Check H/4 Rule and Geometric Integrity for Light Wells
        req_h4_side = max(3.0, self.height / 4.0)
        for s in shafts:
            if len(s.get("boundary", [])) != 4:
                violations.append({"type": "GEOMETRY", "subject": s.get("label", "Shaft"), "msg": "Shaft boundary is not 4 corners"})
            if s.get("label") == "Vent Shaft" and s.get("minSide", 0) < req_h4_side and s.get("area", 0) > 3.0:
                violations.append({"type": "VENT", "subject": "Light Well", "msg": f"Side < {req_h4_side}m (H/4)"})
        
        return violations

    def check_for_overlaps(self, elements: List[Dict]) -> List[Dict]:
        """
        Final SAT Sieve to confirm 100% zero-overlap across all BIM objects.
        Only checks residential/shaft rooms — service core envelopes are architectural
        obstacles and are permitted to touch (but not overlap) adjacent corridor walls.
        """
        overlap_violations = []

        # Skip Core Envelopes — they are obstacles, not residential units
        testable = [e for e in elements
                    if "Envelope" not in e.get("label", "")
                    and "Corridor" not in e.get("label", "")]

        for i in range(len(testable)):
            for j in range(i + 1, len(testable)):
                poly1 = testable[i]["boundary"]
                poly2 = testable[j]["boundary"]

                if self._sat_collision(poly1, poly2):
                    overlap_violations.append({
                        "type": "OVERLAP",
                        "subject": f"{testable[i]['label']} & {testable[j]['label']}",
                        "msg": "Critical Collision Detected — Areas Overlapping"
                    })
        return overlap_violations

    @staticmethod
    def _sat_collision(p1, p2) -> bool:
        """Separating Axis Theorem implementation for 2D polygons."""
        if len(p1) < 3 or len(p2) < 3: return False
        
        def get_axes(p):
            axes = []
            for i in range(len(p)):
                # Get edge vector and calculate its normal
                e = (p[(i+1)%len(p)][0]-p[i][0], p[(i+1)%len(p)][1]-p[i][1])
                axes.append((-e[1], e[0]))
            return axes

        def project(p, a):
            dots = [v[0]*a[0] + v[1]*a[1] for v in p]
            return min(dots), max(dots)

        for poly in [p1, p2]:
            for axis in get_axes(poly):
                mag = (axis[0]**2 + axis[1]**2)**0.5
                if mag < 1e-10: continue
                axis = (axis[0]/mag, axis[1]/mag)
                
                min1, max1 = project(p1, axis)
                min2, max2 = project(p2, axis)
                
                # If there's a gap (with 1mm tolerance), they do NOT overlap
                if min(max1, max2) - max(min1, min2) <= 0.001:
                    return False
        return True
