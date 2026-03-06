"""
Parametric Architecture Engine — Visual Feedback Validator (V17 GOLD)
===================================================================
Custom validation node that receives room data and outputs display
attributes based on Egyptian Building Code rules.

No structural elements. No pop-ups (errors go to Side Panel list).
"""
from typing import Tuple, List, Dict, Any
import math
from geometry_engine import Room, EgyptianCode

# ---------------------------------------------------------------------------
# Egyptian Building Code — Minimum Room Requirements (Article 82 Compliance)
# ---------------------------------------------------------------------------
MIN_ROOM_AREA = 10.0    # square metres (Egyptian Code Article 82)
MIN_ROOM_WIDTH = 2.50   # metres (Egyptian Code Article 82)

class _RoomProxy:
    """Wraps a plain dict so the validator can treat it like a Room object."""
    def __init__(self, d: dict):
        self.label = d.get("label", "?")
        self.area = d.get("area", 0.0)
        self.min_width = d.get("min_width", 0.0)
        fill = d.get("fill", (135, 206, 235))
        self.fill_color = tuple(fill) if isinstance(fill, (list, tuple)) else (135, 206, 235)
        self.is_landlocked: bool = d.get("is_landlocked", False)

    def get_inverted_color(self) -> Tuple[int, int, int]:
        r, g, b = self.fill_color
        return (255 - r, 255 - g, 255 - b)

class ViolationEntry:
    def __init__(self, room_label: str, severity: str, message: str, resolution_options: List[str]):
        self.room_label = room_label
        self.severity = severity           # "warning" | "error" | "critical"
        self.message = message
        self.resolution_options = resolution_options

    def to_dict(self) -> dict:
        return {"room": self.room_label, "severity": self.severity, "message": self.message, "options": self.resolution_options}

class StrokeStyle:
    def __init__(self):
        self.stroke_type: str = "none"
        self.stroke_color: Tuple[int, int, int] = (0, 0, 0)
        self.stroke_weight: float = 0.0
        self.dash_pattern: Tuple[float, float] = (0, 0)

    def to_dict(self) -> dict:
        return {"type": self.stroke_type, "color": self.stroke_color, "weight": round(self.stroke_weight, 2), "dash": self.dash_pattern}

class VisualFeedbackValidator:
    def __init__(self, base_weight: float = 1.5, multiplier: float = 2.0):
        self.base_weight = base_weight
        self.multiplier = multiplier

    def validate_all(self, rooms: List[Any], cores: List[Any] = None, vent_shafts: List[Any] = None) -> Tuple[Dict[str, StrokeStyle], List[ViolationEntry]]:
        styles: Dict[str, StrokeStyle] = {}
        violations: List[ViolationEntry] = []

        for raw in rooms:
            if raw.get("label") == "Shaft": continue
            room = _RoomProxy(raw) if isinstance(raw, dict) else raw
            style, room_violations = self._validate_single(room)
            styles[room.label] = style
            violations.extend(room_violations)

        # ZERO OVERLAP CHECK (V18 Sieve)
        overlap_violations = self._check_overlaps(rooms, cores)
        violations.extend(overlap_violations)

        if vent_shafts:
            violations.extend(self._validate_vent_shafts(vent_shafts))

        return styles, violations

    def _validate_vent_shafts(self, vent_shafts: List[Any]) -> List[ViolationEntry]:
        violations: List[ViolationEntry] = []
        for i, v in enumerate(vent_shafts):
            label = v.get("label", f"Shaft {i+1}")

            area = float(v.get("area", 0) or 0)
            min_area = float(v.get("minArea", EgyptianCode.VENT_MIN_AREA) or EgyptianCode.VENT_MIN_AREA)

            # If minSide not provided, estimate from area (square assumption)
            min_side_req = float(v.get("minSideReq", EgyptianCode.VENT_MIN_SIDE) or EgyptianCode.VENT_MIN_SIDE)
            side = v.get("minSide", None)
            if side is None:
                side = math.sqrt(area) if area > 0 else 0.0
            side = float(side or 0.0)

            # Optional H/4 requirement if provided by engine
            req_h4 = v.get("reqH4Side", None)
            if req_h4 is not None:
                min_side_req = max(min_side_req, float(req_h4))

            if area < min_area:
                violations.append(ViolationEntry(
                    label, "error",
                    f"Area {area:.2f}m² < {min_area:.2f}m²",
                    ["Increase shaft area", "Merge wet rooms to share one shaft"]
                ))

            if side < min_side_req:
                violations.append(ViolationEntry(
                    label, "error",
                    f"Min side {side:.2f}m < {min_side_req:.2f}m",
                    ["Increase shaft side", "Reduce building height / floors", "Reposition shaft"]
                ))

        return violations

    def _check_overlaps(self, rooms: List[Any], cores: List[Any] = None) -> List[ViolationEntry]:
        violations = []
        boundaries = []
        for raw in (rooms + (cores if cores else [])):
            if isinstance(raw, dict):
                # For collision detection, only check the outermost boundary envelope.
                # Internal stairs and elevators are guaranteed to be inside the envelope.
                if 'boundary' in raw: 
                    boundaries.append((raw.get('label', '?'), raw['boundary']))
            elif hasattr(raw, 'boundary'):
                boundaries.append((raw.label, raw.boundary))

        for i in range(len(boundaries)):
            for j in range(i + 1, len(boundaries)):
                lbl_a, poly_a = boundaries[i]
                lbl_b, poly_b = boundaries[j]
                if self._polygons_overlap(poly_a, poly_b):
                    violations.append(ViolationEntry(f"{lbl_a} \u2194 {lbl_b}", "critical", "OVERLAP DETECTED", ["Adjust wall position"]))
        return violations

    @staticmethod
    def _polygons_overlap(poly_a: list, poly_b: list) -> bool:
        if len(poly_a) < 3 or len(poly_b) < 3: return False
        def get_edges(p): return [(p[(i+1)%len(p)][0]-p[i][0], p[(i+1)%len(p)][1]-p[i][1]) for i in range(len(p))]
        def project(p, axis):
            dots = [x[0]*axis[0] + x[1]*axis[1] for x in p]
            return min(dots), max(dots)
        for p in [poly_a, poly_b]:
            for e in get_edges(p):
                axis = (-e[1], e[0])
                L = (axis[0]**2 + axis[1]**2)**0.5
                if L < 1e-12: continue
                axis = (axis[0]/L, axis[1]/L)
                min_a, max_a = project(poly_a, axis)
                min_b, max_b = project(poly_b, axis)
                if min(max_a, max_b) - max(min_a, min_b) <= 0.005: return False # 5mm tolerance for BIM
        return True

    def _validate_single(self, room) -> Tuple[StrokeStyle, List[ViolationEntry]]:
        style = StrokeStyle()
        violations = []
        inverted = room.get_inverted_color()
        area_deficit = max(0.0, EgyptianCode.MIN_ROOM_AREA - room.area)
        width_deficit = max(0.0, EgyptianCode.MIN_ROOM_WIDTH - room.min_width)

        if area_deficit > 0 or width_deficit > 0:
            style.stroke_type, style.stroke_color, style.stroke_weight = "solid", inverted, 3.0
            if area_deficit > 0: violations.append(ViolationEntry(room.label, "error", f"Area < {EgyptianCode.MIN_ROOM_AREA}m²", ["Shift wall"]))
            if width_deficit > 0: violations.append(ViolationEntry(room.label, "error", f"Width < {EgyptianCode.MIN_ROOM_WIDTH}m", ["Increase dimension"]))
        
        if room.is_landlocked:
            style.stroke_type, style.stroke_color, style.stroke_weight, style.dash_pattern = "dashed", inverted, 5.0, (10, 5)
            violations.append(ViolationEntry(room.label, "critical", "Landlocked Room", ["Add shaft"]))
        return style, violations
