"""
Parametric Architecture Engine — REBUILD V2.0
==============================================
Clean ground-up rewrite. Key design principles:

  1. Rooms are ALWAYS axis-to-corridor rectangles — no mitered vertices.
  2. Service Cores are placed first, before any room packing.
  3. Balconies are stored as a SEPARATE sub-polygon — they NEVER mutate
     the room boundary.
  4. The overlap sieve (SAT) is run after packing, not during, for clarity.
  5. Egyptian Code Article 82 constants are enforced throughout.
"""

import math
from typing import List, Tuple, Optional, Dict, Any


# ══════════════════════════════════════════════════════════════
# 1. VECTOR KERNEL
# ══════════════════════════════════════════════════════════════
class Vec:
    """Immutable 2-D vector with 0.5mm precision."""
    __slots__ = ("x", "y")

    def __init__(self, x: float, y: float):
        self.x = round(float(x), 4)
        self.y = round(float(y), 4)

    def __add__(self, o):  return Vec(self.x + o.x, self.y + o.y)
    def __sub__(self, o):  return Vec(self.x - o.x, self.y - o.y)
    def __mul__(self, s):  return Vec(self.x * s,   self.y * s)
    def __neg__(self):     return Vec(-self.x, -self.y)
    def __repr__(self):    return f"Vec({self.x:.3f},{self.y:.3f})"

    def dot(self, o) -> float:   return self.x * o.x + self.y * o.y
    def cross(self, o) -> float: return self.x * o.y - self.y * o.x
    def length(self) -> float:   return math.hypot(self.x, self.y)
    def unit(self):
        l = self.length()
        return Vec(0, 0) if l < 1e-12 else Vec(self.x / l, self.y / l)

    def perp_left(self):
        """90° counter-clockwise rotation."""
        return Vec(-self.y, self.x)

    def perp_right(self):
        """90° clockwise rotation."""
        return Vec(self.y, -self.x)

    def snap(self, step=0.05):
        return Vec(round(self.x / step) * step, round(self.y / step) * step)

    def t(self) -> tuple:
        return (round(self.x, 4), round(self.y, 4))


def poly_area(pts: List[Vec]) -> float:
    n = len(pts)
    if n < 3:
        return 0.0
    a = sum(pts[i].x * pts[(i+1) % n].y - pts[(i+1) % n].x * pts[i].y
            for i in range(n))
    return round(abs(a) / 2.0, 3)


def rect_from_band(p1: Vec, p2: Vec, normal: Vec, depth: float) -> List[Vec]:
    """Build a quad: p1→p2 on the corridor wall, extruded *depth* outward."""
    return [p1, p2, (p2 + normal * depth).snap(), (p1 + normal * depth).snap()]


# ══════════════════════════════════════════════════════════════
# 2. EGYPTIAN CODE CONSTANTS  (Article 82)
# ══════════════════════════════════════════════════════════════
class EgyptianCode:
    MIN_ROOM_AREA   = 10.0   # m²
    MIN_ROOM_WIDTH  = 2.50   # m
    STAIR_MIN_WIDTH = 1.10   # m
    STAIR_MAX_RISER = 0.17   # m
    STAIR_MIN_TREAD = 0.27   # m
    STAIR_BLONDEL   = 0.62   # m  (2R + T = 62cm)
    STAIR_MAX_RISE_PER_FLIGHT = 14
    ELEVATOR_W      = 1.60   # shaft width  m
    ELEVATOR_D      = 1.80   # shaft depth  m
    VENT_MIN_AREA   = 1.50   # m²
    VENT_MIN_SIDE   = 1.00   # m


# ══════════════════════════════════════════════════════════════
# 3. SERVICE CORE BUILDER
# ══════════════════════════════════════════════════════════════
class Room:
    """Thin data object kept for backward-compat with validator.py."""
    def __init__(self, boundary: List[Vec], label="Room"):
        self.boundary = [p.t() for p in boundary]
        self.label = label
        self.area  = poly_area(boundary)
        self.min_width = self._calc_width(boundary)
        self.is_landlocked = False
        self.fill = (135, 206, 235)

    @staticmethod
    def _calc_width(pts: List[Vec]) -> float:
        if len(pts) < 2:
            return 0.0
        xs = [p.x for p in pts]; ys = [p.y for p in pts]
        return round(min(max(xs) - min(xs), max(ys) - min(ys)), 3)


def _build_stair_core(origin: Vec, run_dir: Vec, normal: Vec,
                       stair_w: float, floor_h: float):
    """
    Returns a dict matching the expected canvas.js core schema.
    run_dir  = direction ALONG the corridor wall (spine direction)
    normal   = direction pointing AWAY from the corridor (into the building)
    """
    sw = max(EgyptianCode.STAIR_MIN_WIDTH, stair_w)
    total_w = sw * 2 + 0.20   # two flights + 20-cm void

    n_risers = math.ceil(floor_h / EgyptianCode.STAIR_MAX_RISER)
    riser = floor_h / n_risers
    tread = max(EgyptianCode.STAIR_MIN_TREAD,
                EgyptianCode.STAIR_BLONDEL - 2 * riser)
    fl    = math.ceil(n_risers / 2)         # risers per flight
    run   = fl * tread
    total_len = run + sw + 0.10             # run + landing + clearance

    # Boundary: corridor wall side × run direction
    O  = origin
    p1 = O
    p2 = O + run_dir * total_w
    p3 = p2 + normal * total_len
    p4 = O  + normal * total_len
    boundary = [p.t() for p in [p1, p2, p3, p4]]
    centroid  = [(p1.x + p3.x) / 2, (p1.y + p3.y) / 2]

    # Stair treads for technical blueprint display
    treads = []
    for k in range(1, fl):
        # Left flight
        a = O + run_dir * (k * tread)
        b = a + run_dir * sw
        treads.append([a.t(), b.t()])
        # Right flight (going back)
        c = O + run_dir * (sw + 0.2) + normal * (run - k * tread)
        d = c + run_dir * sw
        treads.append([c.t(), d.t()])

    return {
        "type":       "u-shape-ebc",
        "boundary":   boundary,
        "centroid":   centroid,
        "area":       round(total_len * total_w, 2),
        "stairWidth": round(sw, 3),
        "numRisers":  n_risers,
        "riser":      round(riser, 4),
        "tread":      round(tread, 4),
        "treads":     treads,
        "total_w":    round(total_w, 3),
        "total_len":  round(total_len, 3),
    }


def _build_elevator(origin: Vec, run_dir: Vec, normal: Vec):
    """Elevator shaft placed adjacent to stair origin."""
    w, d = EgyptianCode.ELEVATOR_W, EgyptianCode.ELEVATOR_D
    p1 = origin
    p2 = origin + run_dir * w
    p3 = p2 + normal * d
    p4 = p1 + normal * d
    boundary = [p.t() for p in [p1, p2, p3, p4]]
    centroid  = [(p1.x + p3.x) / 2, (p1.y + p3.y) / 2]
    return {
        "boundary": boundary,
        "centroid": centroid,
        "shaftW":  w, "shaftD":  d,
        "cabinW":  round(w - 0.4, 2),
        "cabinD":  round(d - 0.3, 2),
        "area":    round(w * d, 2),
        "type":    "passenger-ebc",
        "required": True,
    }


# ══════════════════════════════════════════════════════════════
# 4. SAT COLLISION HELPER
# ══════════════════════════════════════════════════════════════
def sat_overlap(poly_a: list, poly_b: list, tol=0.01) -> bool:
    """True if the two convex polygons overlap beyond tolerance."""
    def edges(p):
        n = len(p)
        return [(p[(i+1)%n][0]-p[i][0], p[(i+1)%n][1]-p[i][1]) for i in range(n)]

    def project(poly, ax, ay):
        dots = [pt[0]*ax + pt[1]*ay for pt in poly]
        return min(dots), max(dots)

    for poly in [poly_a, poly_b]:
        for ex, ey in edges(poly):
            ax, ay = -ey, ex
            mag = math.hypot(ax, ay)
            if mag < 1e-12:
                continue
            ax /= mag; ay /= mag
            mna, mxa = project(poly_a, ax, ay)
            mnb, mxb = project(poly_b, ax, ay)
            if min(mxa, mxb) - max(mna, mnb) <= tol:
                return False
    return True


# ══════════════════════════════════════════════════════════════
# 5. MAIN PIPELINE
# ══════════════════════════════════════════════════════════════
class GeometryPipeline:
    # ── Unit type catalogue ──────────────────────────────────
    TYPE_LABELS  = {
        "studio": "Studio",
        "bed1":   "1 Bedroom",
        "bed2":   "2 Bedroom",
        "bed3":   "3 Bedroom",
    }
    TYPE_COLORS  = {
        "studio": (250, 204, 21),
        "bed1":   (74,  222, 128),
        "bed2":   (96,  165, 250),
        "bed3":   (244, 114, 182),
    }
    # module multipliers
    TYPE_MODULES = {"studio": 1, "bed1": 2, "bed2": 3, "bed3": 4}

    def __init__(
        self,
        corridor_width = 1.80,
        room_width     = 3.60,   # base module
        room_depth     = 5.00,
        floor_height   = 3.00,
        stair_width    = 1.20,
        num_floors     = 5,
        core_spacing   = 60.0,
        unit_mix       = None,
        module         = 3.60,
        module_widths  = None,
        **_kw                    # absorb unknown kwargs gracefully
    ):
        self.corridor_width = float(corridor_width)
        self.module         = float(module)
        mw = module_widths or {"studio": 1, "bed1": 2, "bed2": 3, "bed3": 4}
        self.unit_widths    = {k: self.module * v for k, v in mw.items()}
        self.room_depth     = float(room_depth)
        self.floor_height   = float(floor_height)
        self.stair_width    = float(stair_width)
        self.num_floors     = int(num_floors)
        self.core_spacing   = float(core_spacing)
        self.building_height = self.num_floors * self.floor_height

        # Unit-mix config list
        self.unit_mix = unit_mix if (isinstance(unit_mix, list) and unit_mix) else [
            {"type": "studio", "size": 45.0, "mix": 25.0, "color": "#FACC15",
             "balcLen": 1.2, "balcAlign": "full"},
            {"type": "bed1",   "size": 60.0, "mix": 50.0, "color": "#4ADE80",
             "balcLen": 1.2, "balcAlign": "full"},
            {"type": "bed2",   "size": 70.0, "mix": 20.0, "color": "#60A5FA",
             "balcLen": 1.2, "balcAlign": "full"},
            {"type": "bed3",   "size": 85.0, "mix":  5.0, "color": "#F472B6",
             "balcLen": 1.2, "balcAlign": "full"},
        ]

        self.spine_pts = []
        self._reset()

    # ── Helpers ────────────────────────────────────────────────
    def _reset(self):
        self.rooms       = []
        self.corridors   = []
        self.cores       = []
        self.doors       = []
        self.windows     = []
        self.vent_shafts = []
        self.hubs        = []
        self._obstacles  = []      # core + room envelopes only (NOT corridors)
        self._corr_bounds = []     # corridor polys, for door/balcony detection

    def _type_sequence(self) -> List[str]:
        """Weighted cycling list of unit types."""
        seq = []
        total = sum(c.get("mix", 0) for c in self.unit_mix) or 100.0
        for c in self.unit_mix:
            cnt = max(1, round(c.get("mix", 0) / total * 10)) if c.get("mix", 0) > 0 else 0
            seq.extend([c["type"]] * cnt)
        return seq or ["studio", "bed1", "bed2"]

    def _cfg_for(self, utype: str) -> dict:
        for c in self.unit_mix:
            if c.get("type") == utype:
                return c
        return {}

    def _intervals_free(self, blocked: List[Tuple], lo: float, hi: float
                        ) -> List[Tuple]:
        """Given merged blocked intervals, return free intervals in [lo, hi]."""
        free = []
        ptr = lo
        for bs, be in sorted(blocked):
            if bs > ptr + 1e-4:
                free.append((ptr, min(bs, hi)))
            ptr = max(ptr, be)
        if ptr < hi - 1e-4:
            free.append((ptr, hi))
        return free

    # ── Entry-points ───────────────────────────────────────────
    def process_boundary(self, boundary: List, setbacks: float = 3.0,
                         apply_zoning=False):
        pts = [Vec(p[0], p[1]) for p in boundary]
        xs  = [p.x for p in pts]; ys = [p.y for p in pts]
        w   = max(xs) - min(xs);   h = max(ys) - min(ys)
        if w > h:
            spine = [[min(xs)+setbacks, min(ys)+h/2],
                     [max(xs)-setbacks, min(ys)+h/2]]
        else:
            spine = [[min(xs)+w/2, min(ys)+setbacks],
                     [min(xs)+w/2, max(ys)-setbacks]]
        self.process_spine(spine, apply_zoning)

    def process_spine(self, polyline: List, apply_zoning=False):
        self._reset()
        raw = [Vec(p[0], p[1]) if isinstance(p, (list, tuple)) else p
               for p in polyline]
        if len(raw) < 2:
            return
        pts = raw
        self.spine_pts = [p.t() for p in pts]

        # ── 1. CORRIDOR WALLS ─────────────────────────────────
        hw = self.corridor_width / 2.0
        # For each spine node compute left/right wall points
        nodes_L = []   # left wall (normal = perp_left of direction)
        nodes_R = []   # right wall
        n_pts = len(pts)

        for i in range(n_pts):
            if i == 0:
                d = (pts[1] - pts[0]).unit()
            elif i == n_pts - 1:
                d = (pts[-1] - pts[-2]).unit()
            else:
                d1 = (pts[i] - pts[i-1]).unit()
                d2 = (pts[i+1] - pts[i]).unit()
                d  = (d1 + d2).unit()    # bisector

            nL = d.perp_left()
            # Project to achieve the correct offset even at bends
            if i == 0 or i == n_pts - 1:
                scale = hw
            else:
                d1 = (pts[i] - pts[i-1]).unit()
                cos_half = d1.perp_left().dot(nL)
                scale = hw / max(0.15, abs(cos_half))

            nodes_L.append(pts[i] + nL * scale)
            nodes_R.append(pts[i] - nL * scale)

        # Build corridor quads
        segs = len(pts) - 1
        for i in range(segs):
            quad = [nodes_L[i], nodes_L[i+1], nodes_R[i+1], nodes_R[i]]
            self.corridors.append([p.t() for p in quad])
            self._corr_bounds.append([p.t() for p in quad])   # for proximity checks only

        # Hub squares at bends (visual only)
        for i in range(1, n_pts - 1):
            hub = [nodes_L[i-1], nodes_L[i], nodes_R[i], nodes_R[i-1]]
            self.hubs.append({"vertex": pts[i].t(),
                               "boundary": [p.t() for p in hub]})

        # ── 2. SERVICE CORES ──────────────────────────────────
        #
        # Place one core at the very START of the spine (always),
        # then additional cores every core_spacing metres.
        #
        depth   = self.room_depth
        core_id = 1

        def _place_core(origin_wall: Vec, run_dir: Vec, outward: Vec, label: str):
            """Build stair + optional elevator and register everything."""
            stair = _build_stair_core(origin_wall, run_dir, outward,
                                       self.stair_width, self.floor_height)
            core_dict = {
                "label":    label,
                "stair":    stair,
                "elevator": None,
            }
            if self.num_floors >= 5:
                elev_origin = origin_wall + run_dir * stair["total_w"]
                elev = _build_elevator(elev_origin, run_dir, outward)
                core_dict["elevator"] = elev
                self._obstacles.append(elev["boundary"])

            self.cores.append(core_dict)

            # Register the whole stair footprint as obstacle
            self._obstacles.append(stair["boundary"])

            # Add a visible room envelope (yellow) so the core shows on canvas
            env_w = stair["total_w"] + (core_dict["elevator"]["shaftW"]
                                        if core_dict["elevator"] else 0.0)
            env_pts = [
                origin_wall,
                origin_wall + run_dir * env_w,
                origin_wall + run_dir * env_w + outward * stair["total_len"],
                origin_wall                    + outward * stair["total_len"],
            ]
            env_bnd = [p.snap().t() for p in env_pts]
            self.rooms.append({
                "id":      f"core-{label}",
                "label":   label,
                "boundary": env_bnd,
                "area":    round(poly_area([Vec(*p) for p in env_bnd]), 1),
                "min_width": round(stair["total_len"], 2),
                "is_landlocked": False,
                "fill":    (254, 240, 138),
                "unit_type": "core",
            })
            self._obstacles.append(env_bnd)
            return stair["total_len"]    # useful for packing clearance

        # Measure cumulative spine length at each node
        cum_len = [0.0]
        for i in range(segs):
            cum_len.append(cum_len[-1] + (pts[i+1] - pts[i]).length())
        total_spine = cum_len[-1]

        # Target distances for core placement
        core_targets = []
        t = 0.0
        while t <= total_spine + 0.1:
            core_targets.append(t)
            t += self.core_spacing

        placed_core_clearances = {}  # seg_idx -> list of (t_start, t_end)

        for dist in core_targets:
            # Find segment
            seg_idx = segs - 1
            local_t = 0.0
            acc = 0.0
            for si in range(segs):
                seg_len = (pts[si+1] - pts[si]).length()
                if acc + seg_len >= dist - 1e-4 or si == segs - 1:
                    seg_idx = si
                    local_t = dist - acc
                    local_t = max(0.0, min(local_t, seg_len))
                    break
                acc += seg_len

            seg_len = (pts[seg_idx+1] - pts[seg_idx]).length()
            if seg_len < 1.0:
                continue

            run_dir = (pts[seg_idx+1] - pts[seg_idx]).unit()
            outward = run_dir.perp_left()    # place on left wall

            t_frac = local_t / seg_len
            wall_pt = nodes_L[seg_idx] + (nodes_L[seg_idx+1] - nodes_L[seg_idx]) * t_frac

            lbl = f"Service Core {core_id}"
            env_depth = _place_core(wall_pt.snap(), run_dir, outward, lbl)
            core_id += 1

            # Record clearance band for room packing (same segment, left side)
            stair_total_w = self.unit_widths.get("studio", self.module)  # approx
            cl_start = local_t
            cl_end   = local_t + (2 * max(EgyptianCode.STAIR_MIN_WIDTH, self.stair_width) + 0.2
                                  + (EgyptianCode.ELEVATOR_W if self.num_floors >= 5 else 0.0))
            placed_core_clearances.setdefault(seg_idx, []).append((cl_start, cl_end))

        # ── 3. CORNER UNITS (at every bend) ───────────────────
        self._place_corner_units(pts, segs, nodes_L, nodes_R, depth)

        # ── 4. ROOM PACKING ───────────────────────────────────
        self.vent_shafts = []
        type_seq = self._type_sequence()
        seq_idx  = 0

        for side in ("L", "R"):
            wall_nodes = nodes_L if side == "L" else nodes_R
            # outward normal for this side
            for i in range(segs):
                p1  = wall_nodes[i]
                p2  = wall_nodes[i+1]
                seg_vec = p2 - p1
                seg_len = seg_vec.length()
                if seg_len < 0.5:
                    continue

                run_dir = seg_vec.unit()
                # Outward = away from corridor (left wall → perp_left, right → perp_right)
                if side == "L":
                    outward = run_dir.perp_left()
                else:
                    outward = run_dir.perp_right()

                # ── Collect blocked intervals from all registered obstacles ──
                blocked = []
                for obs_bnd in self._obstacles:
                    obs_pts = [Vec(*p) for p in obs_bnd]
                    # Project obstacle onto run_dir axis (along the wall edge)
                    projs_t = [(q - p1).dot(run_dir) for q in obs_pts]
                    projs_d = [(q - p1).dot(outward)  for q in obs_pts]
                    # Only count if obstacle is in the unit band (depth direction)
                    if max(projs_d) < -0.05 or min(projs_d) > depth + 0.05:
                        continue
                    t_lo = min(projs_t);  t_hi = max(projs_t)
                    if t_hi > t_lo:
                        blocked.append((t_lo, t_hi))

                # Merge overlapping intervals
                blocked.sort()
                merged = []
                for bs, be in blocked:
                    if merged and bs <= merged[-1][1] + 1e-4:
                        merged[-1] = (merged[-1][0], max(merged[-1][1], be))
                    else:
                        merged.append([bs, be])
                merged = [tuple(x) for x in merged]

                free_spans = self._intervals_free(merged, 0.0, seg_len)

                for span_s, span_e in free_spans:
                    span_len = span_e - span_s
                    if span_len < self.module * 0.7:
                        continue

                    curr = span_s
                    while curr < span_e - 0.01:
                        remaining = span_e - curr
                        utype = type_seq[seq_idx % len(type_seq)]
                        uw    = self.unit_widths.get(utype, self.module)

                        # If not enough room for another full module, use all remaining space
                        if remaining < uw + self.module * 0.4:
                            uw = remaining
                            if   uw < self.module * 1.5: utype = "studio"
                            elif uw < self.module * 2.5: utype = "bed1"
                            else:                        utype = "bed2"
                        else:
                            seq_idx += 1

                        if uw < self.module * 0.4:
                            break

                        # --- Packing Loop ---
                        # --- Improved Packing Loop (Zero Shift) ---
                        prev_was_shared_duct = False
                        while curr < span_e - 0.01:
                            remaining = span_e - curr
                            utype = type_seq[seq_idx % len(type_seq)]
                            uw    = self.unit_widths.get(utype, self.module)

                            if remaining < uw + self.module * 0.4:
                                uw = remaining
                                if   uw < self.module * 1.5: utype = "studio"
                                elif uw < self.module * 2.5: utype = "bed1"
                                else:                        utype = "bed2"
                            else:
                                seq_idx += 1

                            if uw < self.module * 0.4: break

                            # V3.2: Shared Duct Placement (Zero Shift)
                            # The duct is placed AT the joint (curr + uw).
                            # It is split: 2.5m inside this room, 2.5m inside the next room.
                            # ZERO horizontal space is added to 'curr'.
                            is_shared_duct = (utype in ["bed1", "bed2", "bed3"] and (span_e - (curr + uw)) >= 5.0)
                            duct_hw = 2.5 # 2.5m notch on each side of joint
                            d_depth = 2.5

                            # 1. BUILD ROOM BOUNDARY
                            pts = []
                            # Start Edge (Check if previous room left a notch)
                            if prev_was_shared_duct:
                                # Start at notch end
                                pts.append((p1 + run_dir * (curr + duct_hw)).snap())
                                pts.append((p1 + run_dir * (curr + duct_hw) + outward * d_depth).snap())
                                pts.append((p1 + run_dir * curr + outward * d_depth).snap())
                            else:
                                pts.append((p1 + run_dir * curr).snap())
                            
                            # Outward Envelope
                            pts.append((p1 + run_dir * curr + outward * depth).snap())
                            pts.append((p1 + run_dir * (curr + uw) + outward * depth).snap())
                            
                            # End Edge (Check if this room needs a notch for upcoming duct)
                            if is_shared_duct:
                                # End at notch start
                                pts.append((p1 + run_dir * (curr + uw) + outward * d_depth).snap())
                                pts.append((p1 + run_dir * (curr + uw - duct_hw) + outward * d_depth).snap())
                                pts.append((p1 + run_dir * (curr + uw - duct_hw)).snap())
                            else:
                                pts.append((p1 + run_dir * (curr + uw)).snap())

                            bnd = [p.t() for p in pts]
                            area = poly_area([Vec(*p) for p in bnd])

                            # 2. PLACE DUCT (Geometry only, no curr change)
                            if is_shared_duct:
                                joint_pos = curr + uw
                                dA = (p1 + run_dir * (joint_pos - duct_hw)).snap()
                                dB = (p1 + run_dir * (joint_pos + duct_hw)).snap()
                                dC = (dB + outward * d_depth).snap()
                                dD = (dA + outward * d_depth).snap()
                                dbnd = [dA.t(), dB.t(), dC.t(), dD.t()]
                                
                                duct = {
                                    "id":          f"D-{side}-{i}-{len(self.rooms)}",
                                    "label":       "Duct",
                                    "boundary":    dbnd,
                                    "area":        round(poly_area([Vec(*p) for p in dbnd]), 1),
                                    "unit_type":   "duct",
                                    "fill":        (30, 30, 35),
                                    "fill_opacity": 0.9,
                                    "is_landlocked": True,
                                    "side":        side,
                                    "stroke":      {"color": "#444c56", "weight": 1, "dash": []}
                                }
                                self.vent_shafts.append({"boundary": dbnd})
                                self.rooms.append(duct)
                                self._obstacles.append(dbnd)

                            # 3. PLACE ROOM
                            cfg   = self._cfg_for(utype)
                            color = self.TYPE_COLORS.get(utype, (200, 200, 200))
                            room  = {
                                "id":          f"R-{side}-{i}-{len(self.rooms)}",
                                "label":       self.TYPE_LABELS.get(utype, "Studio"),
                                "boundary":    bnd,
                                "area":        round(area, 1),
                                "min_width":   round(min(uw, depth), 2),
                                "is_landlocked": False,
                                "fill":        color,
                                "unit_type":   utype,
                                "modules":     round(uw / self.module, 2),
                                "config":      cfg,
                                "side":        side,
                            }
                            self.rooms.append(room)
                            self._obstacles.append(bnd)
                            
                            curr += uw # PERFECT ALIGNMENT: ONLY INCREMENT BY ROOM WIDTH
                            prev_was_shared_duct = is_shared_duct

        # ── 4. BALCONIES ──────────────────────────────────────
        # Non-destructive: balcony is a sibling polygon, room boundary UNCHANGED
        self._add_balconies()

        # ── 5. DOORS ─────────────────────────────────────────
        self._place_doors()

    # ── Corner Units ──────────────────────────────────────────
    def _place_corner_units(self, pts, segs, nodes_L, nodes_R, depth):
        """
        At every bend in the spine (interior nodes), place two square corner
        units — one on the outer (convex) corner with an L-shaped balcony,
        and one on the inner (concave) corner with a plain rectangular balcony.
        Each unit is registered as an obstacle before regular packing starts.
        """
        BALC_DEPTH = 1.2   # balcony projection depth

        for i in range(1, len(pts) - 1):
            v1 = (pts[i]   - pts[i-1]).unit()    # direction in from prev seg
            v2 = (pts[i+1] - pts[i]).unit()      # direction out to next seg

            # Cross product sign tells us which side is convex
            cross = v1.cross(v2)

            # Normal vectors perpendicular to each spine segment
            n1L = v1.perp_left();  n1R = v1.perp_right()
            n2L = v2.perp_left();  n2R = v2.perp_right()

            # Anchor points on each corridor wall at the bend
            anchor_L = nodes_L[i].snap()
            anchor_R = nodes_R[i].snap()

            #
            # Side-L outer corner = cross < 0 (spine turns right → L is convex)
            # Side-R outer corner = cross > 0
            #
            sides = [
                # (anchor, outward1, outward2, is_outer)
                (anchor_L, n1L, n2L, cross < 0),
                (anchor_R, n1R, n2R, cross > 0),
            ]

            for anchor, out1, out2, is_outer in sides:
                # V3.2: Final Alignment - Perfectly Aligned depth x depth Square
                # This ensures the facade line is continuous with adjacent units.
                A = anchor
                B = (A + out1 * depth).snap()
                C = (B + out2 * depth).snap()
                D = (A + out2 * depth).snap()

                bnd = [A.t(), B.t(), C.t(), D.t()]
                lbl = "Corner Suite"
                color = (180, 80, 80) if is_outer else (60, 140, 180)

                if is_outer:
                    # PROJECT OUTWARD: To match the "same line" as neighbors
                    # Neighbor balcony is at (B + out1*BALC_DEPTH). 
                    # So we project corner facade nodes B, C, D outward.
                    Bi = (B + out1 * BALC_DEPTH).snap()
                    Di = (D + out2 * BALC_DEPTH).snap()
                    # Corner of balcony is projected by both normals
                    Ci = (C + out1 * BALC_DEPTH + out2 * BALC_DEPTH).snap()
                    
                    # Balcony polygon: [B, C, D, Di, Ci, Bi]
                    corner_balcony = [B.t(), C.t(), D.t(), Di.t(), Ci.t(), Bi.t()]
                    
                    room = {
                        "id":             f"corner-outer-{i}",
                        "label":          lbl,
                        "boundary":       bnd,
                        "area":           round(poly_area([Vec(*p) for p in bnd]), 1),
                        "min_width":      round(depth, 2),
                        "is_landlocked":  False,
                        "fill":           color,
                        "unit_type":      "corner",
                        "is_outer_corner": True,
                        "corner_balcony":  corner_balcony,
                        "balcony_fill":   "rgba(96,165,250,0.30)",
                        "stroke":         {"color": "#e74c3c", "weight": 2, "dash": []},
                    }
                else:
                    # Inner corner: No balcony
                    room = {
                        "id":             f"corner-inner-{i}",
                        "label":          "(x corner)",
                        "boundary":       bnd,
                        "area":           round(poly_area([Vec(*p) for p in bnd]), 1),
                        "min_width":      round(depth, 2),
                        "is_landlocked":  False,
                        "fill":           color,
                        "unit_type":      "corner",
                        "is_outer_corner": False,
                        "stroke":         {"color": "#2980b9", "weight": 2, "dash": []},
                    }

                self.rooms.append(room)
                self._obstacles.append(bnd)

    # ── Balcony Generation ─────────────────────────────────────
    def _add_balconies(self):
        """
        For each residential unit find the FACADE edge (furthest from corridor)
        and attach a balcony polygon WITHOUT touching the room boundary.
        """
        for r in self.rooms:
            utype = r.get("unit_type", "")
            if utype in ("core", "corner"):
                continue
            if r.get("label", "") not in ("Studio", "1 Bedroom",
                                           "2 Bedroom", "3 Bedroom"):
                continue

            cfg  = r.get("config", {})
            blen = float(cfg.get("balcLen", 0.0))
            if blen <= 0.0 or cfg.get("balcAlign") == "none":
                continue

            bnd      = r["boundary"]
            n_pts    = len(bnd)
            fill_rgb = r.get("fill", (96, 165, 250))

            # Find the exterior (facade) edge = furthest from corridor
            best_edge  = None
            best_dist  = -1.0
            for ei in range(n_pts):
                A = bnd[ei]
                B = bnd[(ei+1) % n_pts]
                mx = (A[0]+B[0])/2; my = (A[1]+B[1])/2
                # Distance to nearest corridor point
                d_min = min(
                    self._pt_to_seg_dist((mx, my), cb[j], cb[(j+1)%len(cb)])
                    for cb in self._corr_bounds
                    for j in range(len(cb))
                ) if self._corr_bounds else 999.0
                if d_min > best_dist:
                    best_dist = d_min
                    best_edge = (A, B)

            if best_edge is None or best_dist < 0.1:
                continue

            p1, p2 = best_edge
            ex = p2[0] - p1[0]; ey = p2[1] - p1[1]
            el = math.hypot(ex, ey)
            if el < 0.5:
                continue
            ex /= el; ey /= el

            # Outward normal (away from room centroid)
            # Facade vector is (ex, ey). Perpendicular is (-ey, ex).
            nx, ny = -ey, ex
            # Midpoint to centroid vector
            cx = sum(p[0] for p in bnd) / n_pts
            cy = sum(p[1] for p in bnd) / n_pts
            mx = (p1[0]+p2[0])/2; my = (p1[1]+p2[1])/2
            vx, vy = cx - mx, cy - my
            # If dot product is positive, (nx, ny) points inward. Negate to get outward.
            if (nx * vx + ny * vy) > 0:
                nx, ny = -nx, -ny
            dx, dy = nx, ny

            # Alignment offset
            align  = cfg.get("balcAlign", "center")
            bp1    = list(p1)
            bp2    = list(p2)
            if align != "full":
                off_s = float(cfg.get("balcOffsetSt", 0.0))
                off_e = float(cfg.get("balcOffsetEn", 0.0))
                tl    = max(0.5, el - off_s - off_e)
                if   align == "left":   sd = off_s
                elif align == "right":  sd = el - tl - off_e
                else:                   sd = (el - tl) / 2
                bp1 = [p1[0]+ex*sd,      p1[1]+ey*sd]
                bp2 = [bp1[0]+ex*tl,     bp1[1]+ey*tl]

            # Balcony outer corners
            b3 = [bp2[0]+dx*blen, bp2[1]+dy*blen]
            b4 = [bp1[0]+dx*blen, bp1[1]+dy*blen]

            r["balcony"]      = [bp1, bp2, b3, b4]
            r["balcony_fill"] = f"rgba({fill_rgb[0]},{fill_rgb[1]},{fill_rgb[2]},0.20)"

    # ── Door Placement ─────────────────────────────────────────
    def _place_doors(self):
        self.doors = []
        for r in self.rooms:
            if r.get("unit_type") in ("core", "duct"):
                continue
            bnd = r.get("boundary", [])
            if not bnd:
                continue

            # Find edge closest to any corridor (entry wall)
            best_edge = None
            best_d    = 999.0
            for ei in range(len(bnd)):
                A = bnd[ei]; B = bnd[(ei+1)%len(bnd)]
                mx = (A[0]+B[0])/2; my = (A[1]+B[1])/2
                for cb in self.corridors:
                    for j in range(len(cb)):
                        d = self._pt_to_seg_dist((mx, my), cb[j], cb[(j+1)%len(cb)])
                        if d < best_d:
                            best_d = d; best_edge = (A, B)

            if best_edge and best_d < self.corridor_width * 1.2:
                A, B = best_edge
                el = math.hypot(B[0]-A[0], B[1]-A[1])
                if el < 0.9:
                    continue
                vx = (B[0]-A[0])/el; vy = (B[1]-A[1])/el
                # Door centred on the edge
                mx = (A[0]+B[0])/2; my = (A[1]+B[1])/2
                dw = 0.9
                self.doors.append({
                    "p1":   [round(mx-vx*dw/2, 3), round(my-vy*dw/2, 3)],
                    "p2":   [round(mx+vx*dw/2, 3), round(my+vy*dw/2, 3)],
                    "swing":[round(-vy, 3), round(vx, 3)],
                    "room": r.get("label", ""),
                })

    def _pt_to_seg_dist(self, p, a, b) -> float:
        px, py = p; ax, ay = a; bx, by = b
        l2 = (bx-ax)**2 + (by-ay)**2
        if l2 == 0:
            return math.hypot(px-ax, py-ay)
        t = max(0.0, min(1.0, ((px-ax)*(bx-ax)+(py-ay)*(by-ay))/l2))
        return math.hypot(px-(ax+t*(bx-ax)), py-(ay+t*(by-ay)))

    # ── Shaft Generation ───────────────────────────────────────
    def add_simple_shafts(self):
        self.vent_shafts = []   # nothing to do yet in V2

    # ── Audit helpers (kept for validator.py compatibility) ────
    @staticmethod
    def _calc_area(pts) -> float:
        return poly_area(pts)

    # ── JSON Export ────────────────────────────────────────────
    def get_json(self, apply_zoning=False) -> dict:
        """Return the full payload expected by canvas.js."""
        import uuid
        for i, r in enumerate(self.rooms):
            if "id" not in r:
                r["id"] = f"room_{i}_{uuid.uuid4().hex[:6]}"

        # Economics
        unit_labels = {"Studio", "1 Bedroom", "2 Bedroom", "3 Bedroom"}
        unit_area   = sum(r.get("area", 0) for r in self.rooms
                          if r.get("label") in unit_labels)
        circ_area   = sum(
            poly_area([Vec(*p) for p in c]) for c in self.corridors
        )
        stair_area  = sum(
            c["stair"]["area"] for c in self.cores if c.get("stair")
        )
        elev_area   = sum(
            c["elevator"]["area"] for c in self.cores if c.get("elevator")
        )
        balc_area   = sum(
            poly_area([Vec(*p) for p in r["balcony"]])
            for r in self.rooms if r.get("balcony")
        )
        footprint   = unit_area + circ_area + stair_area + elev_area
        total_gba   = footprint * self.num_floors

        # Apply default stroke so canvas renders outlines
        for r in self.rooms:
            if "stroke" not in r:
                r["stroke"] = {"color": "#2C3E50", "weight": 1, "dash": []}

        return {
            "v":          "2.0-REBUILD",
            "spine":      self.spine_pts,
            "hubs":       self.hubs,
            "corridors":  self.corridors,
            "rooms":      self.rooms,
            "cores":      self.cores,
            "doors":      self.doors,
            "ventShafts": self.vent_shafts,
            "violations": [],
            "economics": {
                "grossBUA":      round(total_gba,                    2),
                "netUsable":     round(unit_area * self.num_floors,   2),
                "footprintArea": round(footprint,                     2),
                "balconyArea":   round(balc_area * self.num_floors,   2),
                "unitsArea":     round(unit_area * self.num_floors,   2),
                "stairArea":     round((stair_area+elev_area) * self.num_floors, 2),
                "elevatorArea":  round(elev_area * self.num_floors,   2),
                "circArea":      round(circ_area * self.num_floors,   2),
                "circPercent":   round(circ_area / max(footprint,1)*100, 1),
                "netGrossRatio": round(unit_area / max(footprint,1)*100, 1),
                "deadSpace":     0.0,
                "facadeArea":    0.0,
            }
        }


# ══════════════════════════════════════════════════════════════
# 6. BACKWARD COMPAT  (Article82_Validator stub)
# ══════════════════════════════════════════════════════════════
class Article82_Validator:
    def __init__(self, building_height: float = 15.0):
        self.height = building_height

    def run_audit(self, rooms, shafts) -> list:
        violations = []
        for r in rooms:
            if r.get("unit_type") == "core":
                continue
            if r.get("area", 99) < EgyptianCode.MIN_ROOM_AREA:
                violations.append({
                    "type": "AREA", "subject": r.get("label", "?"),
                    "msg": f"Below {EgyptianCode.MIN_ROOM_AREA}m²"
                })
        return violations

    def check_for_overlaps(self, elements: list) -> list:
        out = []
        testable = [e for e in elements if "core" not in e.get("unit_type","")]
        for i in range(len(testable)):
            for j in range(i+1, len(testable)):
                if sat_overlap(testable[i]["boundary"], testable[j]["boundary"]):
                    out.append({
                        "type": "OVERLAP",
                        "subject": f"{testable[i]['label']} & {testable[j]['label']}",
                        "msg": "Collision detected"
                    })
        return out

    @staticmethod
    def _sat_collision(pa, pb) -> bool:
        return sat_overlap(pa, pb)
