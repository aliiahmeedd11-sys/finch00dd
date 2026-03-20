/* unit_editor.js - Professional Unit Detail Editor */

const uModal = document.getElementById('unit-editor-modal');
const uCanvas = document.getElementById('unit-canvas');
const uCtx = uCanvas.getContext('2d');
const uLabel = document.getElementById('editing-room-label');
const uHint = document.getElementById('editor-hint');

let uZoom = 1;
let uPanX = 0;
let uPanY = 0;
let uOrigin = [0, 0];
let currentTool = 'wall';
let drawingWall = null;
let uDoors = []; // Contextual doors for this room

// --- Undo / Redo History ---
let historyStack = [];
let redoStack = [];

function pushHistory() {
    historyStack.push(JSON.parse(JSON.stringify(S.editorWalls || [])));
    redoStack = []; // Reset redo when new action is taken
    if (historyStack.length > 50) historyStack.shift(); // Max 50 levels
}

function undo() {
    if (historyStack.length === 0) return;
    redoStack.push(JSON.parse(JSON.stringify(S.editorWalls || [])));
    S.editorWalls = historyStack.pop();
    renderEditor();
}

function redo() {
    if (redoStack.length === 0) return;
    historyStack.push(JSON.parse(JSON.stringify(S.editorWalls || [])));
    S.editorWalls = redoStack.pop();
    renderEditor();
}

function openUnitEditor(room) {
    S.editingRoom = room;
    
    // Calculate Local Origin (Bottom-Left of AABB)
    let x0 = Infinity, y0 = Infinity;
    room.boundary.forEach(p => {
        x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]);
    });
    uOrigin = [x0, y0];

    // Load walls (convert from world to local if needed, but we'll store them as local now)
    // For migration: if walls have large coords, they are world. If small, likely local.
    // However, the request asks for transition, so we'll treat existing ones as local relative to origin.
    S.editorWalls = room.internalWalls ? JSON.parse(JSON.stringify(room.internalWalls)) : [];
    
    // Contextual Doors
    if (S.data && S.data.doors) {
        uDoors = S.data.doors.filter(dr => {
            // Check if door midpoint is near room boundary
            const mid = [(dr.p1[0] + dr.p2[0])/2, (dr.p1[1] + dr.p2[1])/2];
            return isPointInPoly(mid, room.boundary); 
            // Better: dist to polygon segment. But midpoint is usually enough for snapped designs.
        });
    } else {
        uDoors = [];
    }

    uLabel.textContent = room.label;
    uModal.classList.add('visible');
    
    // Ensure modal is laid out before calculating fit
    requestAnimationFrame(() => {
        resizeUnitCanvas();
        autoFitUnit();
        renderEditor();
        console.log("Unit Editor Opened for:", room.label);
        console.log("Origin:", uOrigin);
        console.log("Zoom:", uZoom, "Pan:", uPanX, uPanY);
    });
}

function resizeUnitCanvas() {
    const r = uCanvas.parentElement.getBoundingClientRect();
    uCanvas.width = r.width;
    uCanvas.height = r.height;
}

function autoFitUnit() {
    if (!S.editingRoom) return;
    
    // Collect ALL points for the bounding box (Room + Balcony + Corner Balcony)
    let allPts = [...S.editingRoom.boundary];
    if (S.editingRoom.balcony) allPts = allPts.concat(S.editingRoom.balcony);
    if (S.editingRoom.corner_balcony) allPts = allPts.concat(S.editingRoom.corner_balcony);

    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    allPts.forEach(p => {
        x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]);
        x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]);
    });
    
    const w = x1 - x0;
    const h = y1 - y0;
    
    // 5% Padding calculation for a larger, more professional fit
    const padX = uCanvas.width * 0.05;
    const padY = uCanvas.height * 0.05;
    
    uZoom = Math.min((uCanvas.width - padX * 2) / w, (uCanvas.height - padY * 2) / h);
    uPanX = uCanvas.width/2 - (x0 + w/2) * uZoom;
    uPanY = uCanvas.height/2 - (y0 + h/2) * uZoom;
}

function toUnitScreen(p) {
    return [p[0] * uZoom + uPanX, p[1] * uZoom + uPanY];
}

function toUnitWorld(sx, sy) {
    return [(sx - uPanX) / uZoom, (sy - uPanY) / uZoom];
}

function getSnappedPoint(wx, wy) {
    let snapPt = [wx, wy];
    let minDist = 0.3; // Snapping threshold in meters

    // 1. Snap to Boundary Edges
    const b = S.editingRoom.boundary;
    for (let i = 0; i < b.length; i++) {
        const p1 = b[i];
        const p2 = b[(i + 1) % b.length];
        const d = distToSegment([wx, wy], p1, p2);
        if (d < minDist) {
            // Project point onto segment
            const t = projectPointToSegment([wx, wy], p1, p2);
            snapPt = [p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])];
            minDist = d;
        }
    }

    // 2. Ortho Snapping (Horizontal/Vertical from start point)
    if (drawingWall) {
        const p1 = drawingWall.p1;
        const dx = Math.abs(wx - p1[0]);
        const dy = Math.abs(wy - p1[1]);
        if (dx < 0.2) snapPt[0] = p1[0];
        else if (dy < 0.2) snapPt[1] = p1[1];
    }

    return snapPt;
}

function projectPointToSegment(p, a, b) {
    const l2 = (a[0]-b[0])**2 + (a[1]-b[1])**2;
    if (l2 === 0) return 0;
    let t = ((p[0]-a[0])*(b[0]-a[0]) + (p[1]-a[1])*(b[1]-a[1])) / l2;
    return Math.max(0, Math.min(1, t));
}

function drawSubAreas() {
    if (!S.editingRoom || S.editorWalls.length === 0) return;
    
    // 1. Get Bounding Box
    let x0=Infinity, y0=Infinity, x1=-Infinity, y1=-Infinity;
    S.editingRoom.boundary.forEach(p => {
        x0=Math.min(x0,p[0]); y0=Math.min(y0,p[1]);
        x1=Math.max(x1,p[0]); y1=Math.max(y1,p[1]);
    });
    
    // 2. Sample Grid into a Spatial Map
    const step = 0.25;
    const grid = {}; // Key: "x,y"
    const samples = [];
    for (let x = x0 + step/2; x < x1; x += step) {
        for (let y = y0 + step/2; y < y1; y += step) {
            if (isPointInPoly([x, y], S.editingRoom.boundary)) {
                const s = { x, y, visited: false };
                const k = `${Math.round(x*100)},${Math.round(y*100)}`;
                grid[k] = s;
                samples.push(s);
            }
        }
    }
    
    if (samples.length === 0) return;
    
    // 3. Group samples (Flood Fill)
    const regions = [];
    for (let s of samples) {
        if (!s.visited) {
            const region = [];
            const stack = [s];
            s.visited = true;
            
            while(stack.length > 0) {
                const curr = stack.pop();
                region.push(curr);
                
                const neighbors = [
                    [curr.x + step, curr.y], [curr.x - step, curr.y],
                    [curr.x, curr.y + step], [curr.x, curr.y - step]
                ];
                
                neighbors.forEach(n => {
                    const k = `${Math.round(n[0]*100)},${Math.round(n[1]*100)}`;
                    const target = grid[k];
                    if (target && !target.visited) {
                        if (!isBlockedByWall(curr, {x:n[0], y:n[1]})) {
                            target.visited = true;
                            stack.push(target);
                        }
                    }
                });
            }
            if (region.length > 5) regions.push(region);
        }
    }
    
    // 4. Render Area Tags
    const totalArea = polyArea(S.editingRoom.boundary);
    regions.forEach(reg => {
        const area = (reg.length / samples.length) * totalArea;
        let cx = 0, cy = 0;
        reg.forEach(r => { cx += r.x; cy += r.y; });
        cx /= reg.length; cy /= reg.length;
        
        const sc = toUnitScreen([cx, cy]);
        uCtx.save();
        uCtx.font = 'bold 11px Inter';
        const txt = area.toFixed(1) + ' m²';
        const tw = uCtx.measureText(txt).width;
        
        // Glassmorphic Tag
        uCtx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        uCtx.beginPath();
        uCtx.roundRect(sc[0] - tw/2 - 6, sc[1] - 10, tw + 12, 20, 4);
        uCtx.fill();
        uCtx.strokeStyle = 'rgba(255,255,255,0.1)';
        uCtx.stroke();
        
        uCtx.fillStyle = '#fff';
        uCtx.textAlign = 'center';
        uCtx.textBaseline = 'middle';
        uCtx.fillText(txt, sc[0], sc[1]);
        uCtx.restore();
    });
}

function isBlockedByWall(p1, p2) {
    for (let w of S.editorWalls) {
        const w1 = [w.p1[0] + uOrigin[0], w.p1[1] + uOrigin[1]];
        const w2 = [w.p2[0] + uOrigin[0], w.p2[1] + uOrigin[1]];
        if (doSegmentsIntersect(p1, p2, {x: w1[0], y: w1[1]}, {x: w2[0], y: w2[1]})) return true;
    }
    return false;
}

function doSegmentsIntersect(p1, p2, p3, p4) {
    const crossover = (a, b, c) => (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
    return crossover(p1, p3, p4) !== crossover(p2, p3, p4) && crossover(p1, p2, p3) !== crossover(p1, p2, p4);
}

function renderEditor() {
    if (!S.editingRoom) return;
    uCtx.clearRect(0, 0, uCanvas.width, uCanvas.height);
    
    // New: Calculate and Draw Sub-Areas
    drawSubAreas();

    // 1. Draw Balconies (Lower layer)
    if (S.editingRoom.balcony || S.editingRoom.corner_balcony) {
        uCtx.beginPath();
        const balcs = [S.editingRoom.balcony, S.editingRoom.corner_balcony].filter(b => b && b.length > 0);
        balcs.forEach(b => {
            const s0 = toUnitScreen(b[0]);
            uCtx.moveTo(s0[0], s0[1]);
            for(let i=1; i<b.length; i++) {
                const si = toUnitScreen(b[i]);
                uCtx.lineTo(si[0], si[1]);
            }
            uCtx.closePath();
        });
        uCtx.fillStyle = 'rgba(88, 166, 255, 0.12)';
        uCtx.fill();
        uCtx.strokeStyle = 'rgba(88, 166, 255, 0.3)';
        uCtx.lineWidth = 1.5;
        uCtx.setLineDash([4, 4]);
        uCtx.stroke();
        uCtx.setLineDash([]);
    }

    // 2. Draw Room Boundary (Exterior Walls)
    uCtx.beginPath();
    const b = S.editingRoom.boundary;
    const s0 = toUnitScreen(b[0]);
    uCtx.moveTo(s0[0], s0[1]);
    for(let i=1; i<b.length; i++) {
        const si = toUnitScreen(b[i]);
        uCtx.lineTo(si[0], si[1]);
    }
    uCtx.closePath();
    uCtx.fillStyle = '#161b22';
    uCtx.fill();
    uCtx.strokeStyle = '#444c56';
    uCtx.lineWidth = 5;
    uCtx.stroke();
    
    // 3. Draw Contextual Doors (Entrance)
    uDoors.forEach(dr => {
        const s1 = toUnitScreen(dr.p1);
        const s2 = toUnitScreen(dr.p2);
        uCtx.strokeStyle = '#e3b341';
        uCtx.lineWidth = 6;
        uCtx.beginPath();
        uCtx.moveTo(s1[0], s1[1]);
        uCtx.lineTo(s2[0], s2[1]);
        uCtx.stroke();
    });

    // 4. Draw Internal Walls + Dimensions
    uCtx.lineCap = 'round';
    S.editorWalls.forEach(w => {
        const p1w = [w.p1[0] + uOrigin[0], w.p1[1] + uOrigin[1]];
        const p2w = [w.p2[0] + uOrigin[0], w.p2[1] + uOrigin[1]];
        const s1 = toUnitScreen(p1w);
        const s2 = toUnitScreen(p2w);
        
        uCtx.strokeStyle = '#fff';
        uCtx.lineWidth = 3;
        uCtx.beginPath();
        uCtx.moveTo(s1[0], s1[1]);
        uCtx.lineTo(s2[0], s2[1]);
        uCtx.stroke();

        // Draw Dimension Label
        const d = Math.sqrt((w.p1[0]-w.p2[0])**2 + (w.p1[1]-w.p2[1])**2);
        drawDimLabel(s1, s2, d);
    });
    
    // 5. Drawing Wall + Snapping Feedback
    if (drawingWall) {
        uCtx.strokeStyle = 'rgba(88, 166, 255, 0.6)';
        uCtx.setLineDash([5, 5]);
        const p1s = toUnitScreen(drawingWall.p1);
        const p2s = toUnitScreen(drawingWall.p2);
        uCtx.beginPath();
        uCtx.moveTo(p1s[0], p1s[1]);
        uCtx.lineTo(p2s[0], p2s[1]);
        uCtx.stroke();
        uCtx.setLineDash([]);

        // Real-time Dimension
        const d = Math.sqrt((drawingWall.p1[0]-drawingWall.p2[0])**2 + (drawingWall.p1[1]-drawingWall.p2[1])**2);
        drawDimLabel(p1s, p2s, d, true);
    }
    
    requestAnimationFrame(renderEditor);
}

function drawDimLabel(s1, s2, dist, isDrawing = false) {
    if (dist < 0.1) return;
    const mid = [(s1[0] + s2[0]) / 2, (s1[1] + s2[1]) / 2];
    
    uCtx.font = 'bold 11px Inter, sans-serif';
    const txt = dist.toFixed(2) + 'm';
    const tw = uCtx.measureText(txt).width;
    
    uCtx.fillStyle = isDrawing ? '#58a6ff' : 'rgba(0,0,0,0.6)';
    uCtx.fillRect(mid[0] - tw/2 - 4, mid[1] - 8, tw + 8, 16);
    
    uCtx.fillStyle = '#fff';
    uCtx.textAlign = 'center';
    uCtx.textBaseline = 'middle';
    uCtx.fillText(txt, mid[0], mid[1]);
}

// Interacting with Canvas
uCanvas.addEventListener('mousedown', e => {
    const r = uCanvas.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    const [wx, wy] = toUnitWorld(mx, my);
    
    if (currentTool === 'wall') {
        // Snapping
        const snapped = getSnappedPoint(wx, wy);
        if (!isPointInPoly(snapped, S.editingRoom.boundary)) return;
        drawingWall = { p1: snapped, p2: snapped };
    } else if (currentTool === 'remove') {
        const hitIdx = findNearWall(wx, wy);
        if (hitIdx >= 0) {
            pushHistory();
            S.editorWalls.splice(hitIdx, 1);
        }
    }
});

uCanvas.addEventListener('mousemove', e => {
    if (!drawingWall) return;
    const r = uCanvas.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    const [wx, wy] = toUnitWorld(mx, my);
    
    // Constraint: must be inside boundary
    const snapped = getSnappedPoint(wx, wy);
    if (isPointInPoly(snapped, S.editingRoom.boundary)) {
        drawingWall.p2 = snapped;
    }
});

uCanvas.addEventListener('mouseup', () => {
    if (drawingWall) {
        // Convert to local coordinates relative to uOrigin before saving
        const l1 = [drawingWall.p1[0] - uOrigin[0], drawingWall.p1[1] - uOrigin[1]];
        const l2 = [drawingWall.p2[0] - uOrigin[0], drawingWall.p2[1] - uOrigin[1]];
        
        const d = Math.sqrt((l1[0]-l2[0])**2 + (l1[1]-l2[1])**2);
        if (d > 0.1) {
            pushHistory();
            S.editorWalls.push({ p1: l1, p2: l2 });
        }
        drawingWall = null;
    }
});

function findNearWall(wx, wy) {
    for (let i = 0; i < S.editorWalls.length; i++) {
        const w = S.editorWalls[i];
        // Convert local back to world for distance check
        const p1w = [w.p1[0] + uOrigin[0], w.p1[1] + uOrigin[1]];
        const p2w = [w.p2[0] + uOrigin[0], w.p2[1] + uOrigin[1]];
        if (distToSegment([wx, wy], p1w, p2w) < 0.2) return i;
    }
    return -1;
}

function distToSegment(p, a, b) {
    const l2 = (a[0]-b[0])**2 + (a[1]-b[1])**2;
    if (l2 === 0) return Math.sqrt((p[0]-a[0])**2 + (p[1]-a[1])**2);
    let t = ((p[0]-a[0])*(b[0]-a[0]) + (p[1]-a[1])*(b[1]-a[1])) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.sqrt((p[0]-(a[0]+t*(b[0]-a[0])))**2 + (p[1]-(a[1]+t*(b[1]-a[1])))**2);
}

// Tool Switching
document.getElementById('tool-wall').onclick = () => {
    currentTool = 'wall';
    document.querySelectorAll('.editor-tool').forEach(b => b.classList.remove('active'));
    document.getElementById('tool-wall').classList.add('active');
    uHint.textContent = "Click and drag to draw a wall. Snap to boundary enabled.";
};
document.getElementById('tool-remove').onclick = () => {
    currentTool = 'remove';
    document.querySelectorAll('.editor-tool').forEach(b => b.classList.remove('active'));
    document.getElementById('tool-remove').classList.add('active');
    uHint.textContent = "Click on any internal wall segment to delete it.";
};

// Global Actions
document.getElementById('btn-view-full-plan').onclick = () => {
    uModal.classList.remove('visible');
    S.editingRoom = null;
};

document.getElementById('btn-close-unit-editor').onclick = () => {
    uModal.classList.remove('visible');
    S.editingRoom = null;
};

document.getElementById('btn-clear-walls-v2').onclick = () => {
    if (confirm("Clear all internal walls for this unit?")) {
        pushHistory();
        S.editorWalls = [];
    }
};

// Undo/Redo Button Listeners
document.getElementById('btn-undo').onclick = undo;
document.getElementById('btn-redo').onclick = redo;

// Keyboard Shortcuts
window.addEventListener('keydown', e => {
    if (!uModal.classList.contains('visible')) return;
    if (e.ctrlKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
    }
    if (e.ctrlKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
    }
});

document.getElementById('btn-save-edits').onclick = () => {
    if (!S.editingRoom) return;

    const walls = [...S.editorWalls];
    const targetLabel = S.editingRoom.label;
    const targetArea = Math.round(S.editingRoom.area);

    // Propagation logic: find all rooms with same label and area
    if (S.data && S.data.rooms) {
        S.data.rooms.forEach(r => {
            if (r.label === targetLabel && Math.round(r.area) === targetArea) {
                // IMPORTANT: Since we use axis-aligned bounding box local origin,
                // this propagation ONLY works perfectly for same-orientation units.
                // However, given the current app structure, this is the requested logic.
                r.internalWalls = JSON.parse(JSON.stringify(walls));
            }
        });
    }

    draw(); // Update main canvas
    uModal.classList.remove('visible');
    S.editingRoom = null;
};
