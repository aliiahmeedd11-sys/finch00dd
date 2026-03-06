/* geometry.js - Finch Parametric Architecture Engine */

// --- Geometry Helpers (Global) ---
const vc = (p1, p2) => p2 ? [p2[0] - p1[0], p2[1] - p1[1]] : [p1.p2[0] - p1.p1[0], p1.p2[1] - p1.p1[1]];
const nm = (v) => { const l = Math.sqrt(v[0] ** 2 + v[1] ** 2); return l < 1e-12 ? [0, 0] : [v[0] / l, v[1] / l]; };
const cr = (a, b) => a[0] * b[1] - a[1] * b[0];
const polyArea = (p) => {
    let a = 0;
    for (let i = 0; i < p.length; i++) {
        let n = (i + 1) % p.length;
        a += p[i][0] * p[n][1] - p[n][0] * p[i][1];
    }
    return Math.abs(a / 2);
};
const dist = (p1, p2) => Math.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2);
const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
};

/**
 * Smart Room Resize: Adjusts the geometry of the room to match a target area.
 * INTERPRETATION: "Make Red edges as they are" (Partitions) and "Blue shrink it" (facade depth).
 * This uses Variable Depth scaling, keeping the corridor width fixed and moving 
 * the facade wall to achieve the area.
 */
function smartResizeRoom(room, targetArea) {
    if (!S.data || !S.data.rooms || !room.boundary || room.boundary.length < 4) return;

    const currentArea = polyArea(room.boundary);
    if (currentArea < 1) return;

    // Base width (along corridor)
    const p0 = room.boundary[0], p1 = room.boundary[1];
    const w = dist(p0, p1);
    if (w < 0.1) return;

    // Target Depth needed to satisfy the area
    const targetDepth = targetArea / w;

    // Facade side points
    const p2 = room.boundary[2];
    const p3 = room.boundary[3];

    // Current depth vectors from corridor edge
    const v03 = vc(p0, p3);
    const v12 = vc(p1, p2);
    const d03 = dist(p0, p3);
    const d12 = dist(p1, p2);
    if (d03 < 0.1 || d12 < 0.1) return;

    // Scale facade points along their current rays to reach target depth
    // This preserves the lateral partition "pancakes" (red edges)
    p3[0] = p0[0] + (v03[0] / d03) * targetDepth;
    p3[1] = p0[1] + (v03[1] / d03) * targetDepth;
    p2[0] = p1[0] + (v12[0] / d12) * targetDepth;
    p2[1] = p1[1] + (v12[1] / d12) * targetDepth;

    // Update area calculation
    room.area = +polyArea(room.boundary).toFixed(1);
}
