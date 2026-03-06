/* events.js - Finch Parametric Architecture Engine */

// --- Precision Functions ---
function applySnap(wx, wy) {
    if (!S.snapEnabled || S.altHeld) return [wx, wy];
    const r = S.snapRes;
    return [Math.round(wx / r) * r, Math.round(wy / r) * r];
}
function applyOrtho(wx, wy, lastPt) {
    if (!S.orthoEnabled || !lastPt || S.shiftHeld) return [wx, wy];
    const dx = Math.abs(wx - lastPt[0]), dy = Math.abs(wy - lastPt[1]);
    return dx >= dy ? [wx, lastPt[1]] : [lastPt[0], wy];
}
function applyPrecision(wx, wy) {
    let [sx, sy] = applySnap(wx, wy);
    const last = S.customSpine.length > 0 ? S.customSpine[S.customSpine.length - 1] : null;
    [sx, sy] = applyOrtho(sx, sy, last);
    return [sx, sy];
}
function alignSpineToStructGrid(spine, module) {
    if (!S.structGridEnabled) return spine;
    return spine.map(p => [Math.round(p[0] / module) * module, Math.round(p[1] / module) * module]);
}

// --- Sliders ---
const slCW = document.getElementById('corridor-width'), slRW = document.getElementById('room-width'), slRD = document.getElementById('room-depth');
const vCW = document.getElementById('cw-val'), vRW = document.getElementById('rw-val'), vRD = document.getElementById('rd-val');
slCW.addEventListener('input', () => { vCW.textContent = (+slCW.value).toFixed(2) + ' m'; generate(); });
slRW.addEventListener('input', () => { vRW.textContent = (+slRW.value).toFixed(2) + ' m'; generate(); });
slRD.addEventListener('input', () => { vRD.textContent = (+slRD.value).toFixed(2) + ' m'; generate(); });
const slFH = document.getElementById('floor-height'), slSW = document.getElementById('stair-width');
const slNF = document.getElementById('num-floors');
const vFH = document.getElementById('fh-val'), vSW = document.getElementById('sw-val'), vNF = document.getElementById('nf-val');
slFH.addEventListener('input', () => { vFH.textContent = (+slFH.value).toFixed(2) + ' m'; generate(); });
slSW.addEventListener('input', () => { vSW.textContent = (+slSW.value).toFixed(2) + ' m'; generate(); });
slNF.addEventListener('input', () => { vNF.textContent = slNF.value; generate(); });



// --- Presets ---
document.querySelectorAll('.preset-btn').forEach(b => {
    b.addEventListener('click', () => {
        document.querySelectorAll('.preset-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active'); S.preset = b.dataset.preset;
        S.customSpine = []; updateSpineDisplay();
        if (S.drawMode) toggleDrawMode();
    });
});

// --- Precision Controls ---
document.getElementById('prec-snap').addEventListener('click', function () { S.snapEnabled = !S.snapEnabled; this.classList.toggle('active'); draw(); });
document.getElementById('prec-ortho').addEventListener('click', function () { S.orthoEnabled = !S.orthoEnabled; this.classList.toggle('active'); draw(); });
document.getElementById('prec-sgrid').addEventListener('click', function () { S.structGridEnabled = !S.structGridEnabled; this.classList.toggle('active'); draw(); });
document.querySelectorAll('#snap-res button').forEach(b => {
    b.addEventListener('click', () => {
        document.querySelectorAll('#snap-res button').forEach(x => x.classList.remove('active'));
        b.classList.add('active'); S.snapRes = +b.dataset.res;
    });
});

// --- Toolbar ---
['tb-rooms', 'tb-spine', 'tb-cores', 'tb-ducts', 'tb-balconies', 'tb-labels', 'tb-dims', 'tb-circ', 'tb-grid'].forEach(id => {
    const key = { 'tb-rooms': 'showRooms', 'tb-spine': 'showSpine', 'tb-cores': 'showCores', 'tb-ducts': 'showDucts', 'tb-balconies': 'showBalconies', 'tb-labels': 'showLabels', 'tb-dims': 'showDims', 'tb-circ': 'showCirc', 'tb-grid': 'showGrid' }[id];
    document.getElementById(id).addEventListener('click', function () {
        S[key] = !S[key]; this.classList.toggle('active');
        if (id === 'tb-circ') document.getElementById('circ-legend').classList.toggle('visible', S.showCirc);
        draw();
    });
});

document.getElementById('tb-all').addEventListener('click', () => {
    ['tb-rooms', 'tb-spine', 'tb-cores', 'tb-ducts', 'tb-balconies', 'tb-labels', 'tb-dims', 'tb-circ', 'tb-grid'].forEach(id => {
        const key = { 'tb-rooms': 'showRooms', 'tb-spine': 'showSpine', 'tb-cores': 'showCores', 'tb-ducts': 'showDucts', 'tb-balconies': 'showBalconies', 'tb-labels': 'showLabels', 'tb-dims': 'showDims', 'tb-circ': 'showCirc', 'tb-grid': 'showGrid' }[id];
        S[key] = true;
        document.getElementById(id).classList.add('active');
    });
    document.getElementById('circ-legend').classList.add('visible');
    draw();
});

const btnZoning = document.getElementById('tb-zoning');
btnZoning.addEventListener('click', () => {
    S.zoningOn = !S.zoningOn;
    btnZoning.classList.toggle('active', S.zoningOn);
    generate(); // Trigger generate with new zoning flag
});

// --- Draw Mode ---
const btnDraw = document.getElementById('btn-draw');
const drawHint = document.getElementById('draw-hint');
const modeBadge = document.getElementById('mode-badge');

btnDraw.addEventListener('click', toggleDrawMode);
document.getElementById('btn-clear').addEventListener('click', () => {
    S.customSpine = []; S.data = null; S.hoverIdx = -1; S.dragIdx = -1;
    updateSpineDisplay();
    btnDraw.textContent = '✏️ Draw Spine';
    drawHint.classList.remove('visible');
    draw();
});

const btnLot = document.getElementById('btn-lot');
btnLot.addEventListener('click', toggleDrawMode);

function toggleDrawMode() {
    S.drawMode = !S.drawMode;
    if (S.drawMode) {
        if (S.genMode === 'lot') {
            btnLot.textContent = '⏹ Stop Drawing Lot';
        } else {
            btnDraw.textContent = '⏹ Stop Drawing Spine';
        }
    } else {
        btnDraw.textContent = S.customSpine.length > 0 ? '✏️ Edit Spine' : '✏️ Draw Spine';
        btnLot.textContent = S.landLot.length > 0 ? '🏛 Edit Land Lot' : '🏛 Draw Land Lot';
        // User requested manual generate on exit (no auto fire here)
    }
    btnDraw.classList.toggle('drawing', S.drawMode && S.genMode === 'spine');
    btnLot.classList.toggle('drawing', S.drawMode && S.genMode === 'lot');
    drawHint.classList.toggle('visible', S.drawMode || (S.genMode === 'spine' ? S.customSpine.length > 0 : S.landLot.length > 0));
    modeBadge.classList.toggle('draw', S.drawMode);
    modeBadge.textContent = S.drawMode ? (S.genMode === 'spine' ? '✏️ DRAW SPINE' : '🏛 DRAW LOT') : 'VIEW MODE';
    canvas.style.cursor = S.drawMode ? 'crosshair' : 'default';
    draw();
}

// --- Mode Switching (V17 Lot Mode) ---
const mSpine = document.getElementById('mode-spine-btn');
const mLot = document.getElementById('mode-lot-btn');

mSpine.addEventListener('click', () => {
    S.genMode = 'spine';
    mSpine.classList.add('active'); mLot.classList.remove('active');
    btnDraw.style.display = 'block'; btnLot.style.display = 'none';
    if (S.drawMode) toggleDrawMode(); // Exit draw mode on switch
    updateSpineDisplay(); draw();
});
mLot.addEventListener('click', () => {
    S.genMode = 'lot';
    mLot.classList.add('active'); mSpine.classList.remove('active');
    btnDraw.style.display = 'none'; btnLot.style.display = 'block';
    if (S.drawMode) toggleDrawMode(); // Exit draw mode on switch
    // Ensure lot UI clears spine display
    document.getElementById('spine-pts').textContent = S.landLot.length + " Boundary Points";
    draw();
});

function updateSpineDisplay() {
    const el = document.getElementById('spine-pts');
    if (S.genMode === 'lot') {
        el.textContent = S.landLot.length > 0 ? S.landLot.length + " Boundary Points" : "Draw a closed polygon";
        return;
    }
    if (S.customSpine.length === 0) { el.textContent = ''; return; }
    let totalLen = 0;
    for (let i = 0; i < S.customSpine.length - 1; i++) {
        const a = S.customSpine[i], b = S.customSpine[i + 1];
        totalLen += Math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2);
    }
    el.innerHTML = S.customSpine.map((p, i) => `<b>${i + 1}</b>(${p[0].toFixed(2)}, ${p[1].toFixed(2)})`).join(' → ') + `<br>Total: ${totalLen.toFixed(2)}m`;
}

// --- Canvas resize ---
function resize() {
    const r = canvas.parentElement.getBoundingClientRect();
    canvas.width = r.width * devicePixelRatio;
    canvas.height = r.height * devicePixelRatio;
    canvas.style.width = r.width + 'px';
    canvas.style.height = r.height + 'px';
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    draw();
}
window.addEventListener('resize', resize);

// --- Coordinate transforms ---
function toScreen(p) { return [p[0] * S.zoom + S.panX, p[1] * S.zoom + S.panY]; }
function toWorld(sx, sy) { return [(sx - S.panX) / S.zoom, (sy - S.panY) / S.zoom]; }
function canvasXY(e) {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
}

// --- Zoom (centered on mouse) ---
canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const [mx, my] = canvasXY(e);
    const [wx, wy] = toWorld(mx, my);
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    S.zoom = Math.max(0.5, Math.min(200, S.zoom * factor));
    // Re-center on mouse
    S.panX = mx - wx * S.zoom;
    S.panY = my - wy * S.zoom;
    document.getElementById('zoom-ind').textContent = Math.round(S.zoom * 100) + '%';
    draw();
}, { passive: false });

// --- Mouse events ---
let rightClickedRoom = null;
const ctxMenu = document.getElementById('unit-context-menu');
const ctxTypeOptions = document.getElementById('unit-type-options');

canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (S.drawMode) return;

    const [mx, my] = canvasXY(e);
    const [wx, wy] = toWorld(mx, my);
    rightClickedRoom = null;

    if (S.data && S.data.rooms) {
        for (let i = S.data.rooms.length - 1; i >= 0; i--) {
            const r = S.data.rooms[i];
            if (!r.boundary) continue;
            let inside = false;
            for (let j = 0, k = r.boundary.length - 1; j < r.boundary.length; k = j++) {
                let xi = r.boundary[j][0], yi = r.boundary[j][1];
                let xj = r.boundary[k][0], yj = r.boundary[k][1];
                let intersect = ((yi > wy) != (yj > wy))
                    && (wx < (xj - xi) * (wy - yi) / (yj - yi) + xi);
                if (intersect) inside = !inside;
            }
            if (inside) {
                rightClickedRoom = r;
                break;
            }
        }
    }

    if (rightClickedRoom && (rightClickedRoom.label.includes("Studio") || rightClickedRoom.label.includes("Bed") || rightClickedRoom.label.startsWith("Unit") || rightClickedRoom.label.startsWith("Room"))) {
        showUnitContextMenu(e.clientX, e.clientY);
    } else {
        ctxMenu.style.display = 'none';
    }
});

function showUnitContextMenu(x, y) {
    ctxTypeOptions.innerHTML = '';

    // Derive unit types dynamically from the Mixer Config
    const seenTypes = new Set();
    const types = [];

    S.unitMixConfig.forEach(c => {
        if (!seenTypes.has(c.type)) {
            seenTypes.add(c.type);
            types.push({ id: c.type, label: typeLabels[c.type], color: c.color, size: c.size });
        }
    });

    types.forEach(t => {
        const item = document.createElement('div');
        item.className = 'context-menu-item';
        item.innerHTML = `<i class="type-dot" style="background:${t.color}"></i> ${t.label}`;
        item.onclick = (event) => {
            event.stopPropagation();
            if (rightClickedRoom) {
                rightClickedRoom.label = t.label;
                const rgb = hexToRgb(t.color);
                if (rgb) rightClickedRoom.fill = [rgb.r, rgb.g, rgb.b];

                // SMART GEOMETRY UPDATE: Resize room to match mixer target
                if (t.size) {
                    smartResizeRoom(rightClickedRoom, t.size);
                }

                updateUI();
                draw();
            }
            ctxMenu.style.display = 'none';
        };
        ctxTypeOptions.appendChild(item);
    });

    // Position adjustment for viewport bounds
    const menuWidth = 180;
    const menuHeight = 220;
    let posX = x;
    let posY = y;
    if (posX + menuWidth > window.innerWidth) posX -= menuWidth;
    if (posY + menuHeight > window.innerHeight) posY -= menuHeight;

    ctxMenu.style.left = posX + 'px';
    ctxMenu.style.top = posY + 'px';
    ctxMenu.style.display = 'block';
}

document.getElementById('btn-delete-room').onclick = (e) => {
    e.stopPropagation();
    if (rightClickedRoom && S.data && S.data.rooms) {
        S.data.rooms = S.data.rooms.filter(r => r !== rightClickedRoom);
        updateUI();
        draw();
    }
    ctxMenu.style.display = 'none';
};

window.addEventListener('click', () => {
    if (ctxMenu.style.display === 'block') ctxMenu.style.display = 'none';
});

canvas.addEventListener('mousedown', e => {
    const [mx, my] = canvasXY(e);
    const pts = (S.genMode === 'spine') ? S.customSpine : S.landLot;
    const hasPts = pts.length > 0;

    if (S.drawMode && e.button === 2) { toggleDrawMode(); return; }

    if (hasPts && e.button === 0) {
        const hitIdx = findNearPoint(mx, my, pts, 14);
        if (hitIdx >= 0) {
            S.dragIdx = hitIdx;
            canvas.style.cursor = 'grabbing';
            return;
        }
    }

    if (S.drawMode && e.button === 0) {
        const [wx, wy] = toWorld(mx, my);
        const [sx, sy] = applyPrecision(wx, wy);
        pts.push([+sx.toFixed(2), +sy.toFixed(2)]);
        if (S.genMode === 'spine') updateSpineDisplay();
        draw();
        return;
    }

    if (e.button === 0) {
        S.dragging = true;
        S.lastMouse = { x: e.clientX, y: e.clientY };
        canvas.style.cursor = 'grabbing';
    }
});

// Double-click to delete a spine point (edit mode)
canvas.addEventListener('dblclick', async e => {
    const pts = (S.genMode === 'spine') ? S.customSpine : S.landLot;
    const hasPts = pts.length >= 2;
    const [mx, my] = canvasXY(e);
    const [wx, wy] = toWorld(mx, my);


    // 2. Fallback to point deletion
    if (hasPts) {
        const hitIdx = findNearPoint(mx, my, pts, 14);
        if (hitIdx >= 0) {
            pts.splice(hitIdx, 1);
            if (S.genMode === 'spine') updateSpineDisplay();
            draw();
        }
    }
});

// Click to change unit type (viewport selection)
canvas.addEventListener('click', e => {
    if (S.drawMode || S.dragging) return;
    const [mx, my] = canvasXY(e);
    const [wx, wy] = toWorld(mx, my);

    if (S.data && S.data.rooms) {
        let clickedRoom = null;
        for (let i = S.data.rooms.length - 1; i >= 0; i--) {
            const r = S.data.rooms[i];
            if (!r.boundary) continue;
            let inside = false;
            for (let j = 0, k = r.boundary.length - 1; j < r.boundary.length; k = j++) {
                let xi = r.boundary[j][0], yi = r.boundary[j][1];
                let xj = r.boundary[k][0], yj = r.boundary[k][1];
                let intersect = ((yi > wy) != (yj > wy))
                    && (wx < (xj - xi) * (wy - yi) / (yj - yi) + xi);
                if (intersect) inside = !inside;
            }
            if (inside) {
                clickedRoom = r;
                break;
            }
        }

        if (clickedRoom && (clickedRoom.label.includes("Studio") || clickedRoom.label.includes("Bed") || clickedRoom.label.includes("Unit"))) {
            const types = ["Studio", "1 Bedroom", "2 Bedroom", "3 Bedroom"];
            const colors = [[255, 235, 205], [225, 245, 225], [225, 245, 255], [245, 225, 245]];
            let tIdx = types.findIndex(t => clickedRoom.label.includes(t));
            if (tIdx < 0) tIdx = 0;
            tIdx = (tIdx + 1) % types.length;
            clickedRoom.label = types[tIdx];
            clickedRoom.fill = colors[tIdx];
            updateUI();
            draw();
        }
    }
});

window.addEventListener('mouseup', () => {
    S.dragging = false;
    S.dragIdx = -1;
    // Smart cursor: crosshair in draw, default otherwise
    canvas.style.cursor = S.drawMode ? 'crosshair' : 'default';
});

canvas.addEventListener('mousemove', e => {
    const [mx, my] = canvasXY(e);
    const [wx, wy] = toWorld(mx, my);
    S.cursorWorld = [wx, wy];
    const isEditing = S.drawMode || S.customSpine.length > 0;
    const [sx, sy] = isEditing ? applyPrecision(wx, wy) : [wx, wy];
    document.getElementById('cursor-coords').textContent = sx.toFixed(2) + ', ' + sy.toFixed(2);

    // Snap badge — visible when drawing or dragging a point
    const badge = document.getElementById('snap-badge');
    if (S.drawMode || S.dragIdx >= 0) {
        let txt = '';
        if (S.orthoEnabled && !S.shiftHeld) txt += '⊢ ORTHO ';
        if (S.snapEnabled && !S.altHeld) txt += '🧲 SNAP ';
        txt += ' ' + sx.toFixed(2) + ', ' + sy.toFixed(2);
        badge.textContent = txt; badge.classList.add('visible');
    } else { badge.classList.remove('visible'); }

    // V17: Points list for hover/drag
    const pts = (S.genMode === 'spine') ? S.customSpine : S.landLot;

    // Dragging a point — works in any mode
    if (S.dragIdx >= 0) {
        const [ds, dy2] = applyPrecision(wx, wy);
        pts[S.dragIdx] = [+ds.toFixed(2), +dy2.toFixed(2)];
        if (S.genMode === 'spine') updateSpineDisplay();
        draw(); return;
    }

    // Panning
    if (S.dragging) {
        S.panX += e.clientX - S.lastMouse.x;
        S.panY += e.clientY - S.lastMouse.y;
        S.lastMouse = { x: e.clientX, y: e.clientY };
        draw(); return;
    }

    // Hover detection
    if (pts.length > 0) {
        S.hoverIdx = findNearPoint(mx, my, pts, 14);
        if (S.hoverIdx >= 0) {
            canvas.style.cursor = 'grab';
        } else {
            canvas.style.cursor = S.drawMode ? 'crosshair' : 'default';
        }
    }
    draw();
});

document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && S.drawMode) toggleDrawMode();
    if ((e.key === 'z' || e.key === 'Z') && e.ctrlKey && S.drawMode && S.customSpine.length > 0) {
        S.customSpine.pop(); updateSpineDisplay(); draw();
    }
    if (e.key === 'Alt') { e.preventDefault(); S.altHeld = true; }
    if (e.key === 'Shift') { S.shiftHeld = true; }
});
document.addEventListener('keyup', e => {
    if (e.key === 'Alt') S.altHeld = false;
    if (e.key === 'Shift') S.shiftHeld = false;
});

function findNearPoint(mx, my, pts, threshold) {
    for (let i = 0; i < pts.length; i++) {
        const sp = toScreen(pts[i]);
        const dx = sp[0] - mx, dy = sp[1] - my;
        if (Math.sqrt(dx * dx + dy * dy) < threshold) return i;
    }
    return -1;
}

// --- Generate ---
