/* updates.js - Parametric Internal Wall Editor Feature */

/**
 * LayoutEditor Class
 * Manages the dedicated unit layout drawing viewport.
 */
class LayoutEditor {
    constructor() {
        // UP-3 FIX: defer canvas context acquisition until modal is actually opened
        // The layout-canvas may be inside a hidden modal not yet fully in the DOM.
        this.ctx = null;
        this.modal = document.getElementById('layout-editor-modal');
        this.currentRoom = null;
        this.walls = [];
        this.tool = 'draw'; // 'draw' or 'remove'
        
        this.isDrawing = false;
        this.startPoint = null;
        this.mousePos = [0, 0];
        
        // Scaling and Viewport
        this.scale = 40; // px per metre
        this.offset = { x: 0, y: 0 };
        
        this.setupListeners();
    }

    setupListeners() {
        const canvas = document.getElementById('layout-canvas');
        
        // UI Buttons
        document.getElementById('btn-wall-draw').addEventListener('click', () => this.setTool('draw'));
        document.getElementById('btn-wall-remove').addEventListener('click', () => this.setTool('remove'));
        document.getElementById('btn-editor-close').addEventListener('click', () => this.close());
        document.getElementById('btn-editor-save').addEventListener('click', () => this.save());

        // Mouse Interactions
        canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        
        window.addEventListener('resize', () => {
            if (this.modal.style.display === 'block') this.resize();
        });
    }

    setTool(tool) {
        this.tool = tool;
        document.getElementById('btn-wall-draw').classList.toggle('active', tool === 'draw');
        document.getElementById('btn-wall-remove').classList.toggle('active', tool === 'remove');
    }

    /**
     * Open Editor for a specific room instance
     */
    open(room) {
        this.currentRoom = room;
        const key = `${room.label}_${room.area}`;
        this.walls = S.unitLayouts[key] ? JSON.parse(JSON.stringify(S.unitLayouts[key])) : [];
        
        // Update UI
        document.getElementById('editor-unit-info').textContent = `${room.label} (${room.area}m²)`;
        // UP-3 FIX: acquire canvas context on first open
        if (!this.ctx) {
            const cvs = document.getElementById('layout-canvas');
            if (!cvs) { console.error('UP-3: layout-canvas element not found'); return; }
            this.ctx = cvs.getContext('2d');
        }
        this.modal.style.display = 'block';
        
        this.resize();
        this.autoFit();
        this.draw();
    }

    resize() {
        const container = document.querySelector('.editor-viewport');
        const canvas = document.getElementById('layout-canvas');
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
    }

    autoFit() {
        const bnd = this.currentRoom.boundary;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        bnd.forEach(p => {
            minX = Math.min(minX, p[0]); minY = Math.min(minY, p[1]);
            maxX = Math.max(maxX, p[0]); maxY = Math.max(maxY, p[1]);
        });
        
        const rw = maxX - minX;
        const rh = maxY - minY;
        const cw = this.ctx.canvas.width;
        const ch = this.ctx.canvas.height;
        
        this.scale = Math.min(cw / (rw * 1.3), ch / (rh * 1.3));
        this.offset.x = cw / 2;
        this.offset.y = ch / 2;
        
        // ORIGIN: Bottom-Left of the bounding box
        this.localOrigin = { x: minX, y: minY };
        this.roomCenter = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    }

    /**
     * Transforms Global (API) coordinates to Local Viewport pixels
     */
    toScreen(p) {
        return [
            (p[0] - this.roomCenter.x) * this.scale + this.offset.x,
            (p[1] - this.roomCenter.y) * this.scale + this.offset.y
        ];
    }

    /**
     * Transforms Local Viewport pixels to Global API space
     */
    toWorld(sx, sy) {
        return [
            (sx - this.offset.x) / this.scale + this.roomCenter.x,
            (sy - this.offset.y) / this.scale + this.roomCenter.y
        ];
    }

    onMouseDown(e) {
        const rect = this.ctx.canvas.getBoundingClientRect();
        const [wx, wy] = this.toWorld(e.clientX - rect.left, e.clientY - rect.top);
        
        if (this.tool === 'draw') {
            if (!this.isInside(wx, wy)) return;
            this.isDrawing = true;
            this.startPoint = [wx, wy];
        } else if (this.tool === 'remove') {
            this.removeWallAt(wx, wy);
        }
    }

    onMouseMove(e) {
        const rect = this.ctx.canvas.getBoundingClientRect();
        this.mousePos = [+e.clientX - rect.left, +e.clientY - rect.top];
        if (this.isDrawing) this.draw();
    }

    onMouseUp(e) {
        if (this.isDrawing) {
            const [wx, wy] = this.toWorld(this.mousePos[0], this.mousePos[1]);
            if (this.isInside(wx, wy)) {
                this.walls.push({ p1: [...this.startPoint], p2: [wx, wy] });
            }
        }
        this.isDrawing = false;
        this.startPoint = null;
        this.draw();
    }

    // UP-2: duplicate of isInside() in events.js — keep in sync if either changes
    isInside(wx, wy) {
        const bnd = this.currentRoom.boundary;
        let inside = false;
        for (let i = 0, j = bnd.length - 1; i < bnd.length; j = i++) {
            if (((bnd[i][1] > wy) != (bnd[j][1] > wy)) &&
                (wx < (bnd[j][0] - bnd[i][0]) * (wy - bnd[i][1]) / (bnd[j][1] - bnd[i][1]) + bnd[i][0])) {
                inside = !inside;
            }
        }
        return inside;
    }

    removeWallAt(wx, wy) {
        const threshold = 0.5; // metres
        this.walls = this.walls.filter(w => {
            const dist = this.distToSegment([wx, wy], w.p1, w.p2);
            return dist > threshold;
        });
        this.draw();
    }

    distToSegment(p, p1, p2) {
        const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
        if (dx === 0 && dy === 0) return Math.sqrt((p[0]-p1[0])**2 + (p[1]-p1[1])**2);
        const t = ((p[0] - p1[0]) * dx + (p[1] - p1[1]) * dy) / (dx * dx + dy * dy);
        const tClamped = Math.max(0, Math.min(1, t));
        const px = p1[0] + tClamped * dx;
        const py = p1[1] + tClamped * dy;
        return Math.sqrt((p[0] - px)**2 + (p[1] - py)**2);
    }

    close() {
        this.modal.style.display = 'none';
        this.currentRoom = null;
    }

    save() {
        if (!this.currentRoom) return;
        const key = `${this.currentRoom.label}_${this.currentRoom.area}`;
        
        const bnd = this.currentRoom.boundary;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        bnd.forEach(p => {
            minX = Math.min(minX, p[0]); minY = Math.min(minY, p[1]);
            maxX = Math.max(maxX, p[0]); maxY = Math.max(maxY, p[1]);
        });

        // Normalize to local coordinates relative to localOrigin (Bottom-Left)
        const normalizedWalls = this.walls.map(w => ({
            p1: [w.p1[0] - minX, w.p1[1] - minY],
            p2: [w.p2[0] - minX, w.p2[1] - minY]
        }));
        
        S.unitLayouts[key] = {
            walls: normalizedWalls,
            canonicalDim: [maxX - minX, maxY - minY]
        };
        
        this.close();
        // UP-1 FIX: close() nulls currentRoom, so call global draw() only (not this.draw())
        if (typeof draw === 'function') draw(); // Redraw main canvas
    }

    draw() {
        if (!this.currentRoom) return;
        const ctx = this.ctx;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        // Draw Room Boundary
        ctx.beginPath();
        this.currentRoom.boundary.forEach((p, i) => {
            const [sx, sy] = this.toScreen(p);
            if (i === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
        });
        ctx.closePath();
        ctx.strokeStyle = '#388bfd';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = '#161b22';
        ctx.fill();

        // Canvas Context: Draw Entrance Doors for Spatial Context
        if (S.data && S.data.doors) {
            S.data.doors.forEach(dr => {
                // Check if door is within the current room boundary (simplistic check)
                if (this.isInside(dr.p1[0], dr.p1[1]) || this.isInside(dr.p2[0], dr.p2[1])) {
                    const s1 = this.toScreen(dr.p1);
                    const s2 = this.toScreen(dr.p2);
                    ctx.strokeStyle = '#dca830';
                    ctx.lineWidth = 4;
                    ctx.beginPath();
                    ctx.moveTo(s1[0], s1[1]);
                    ctx.lineTo(s2[0], s2[1]);
                    ctx.stroke();
                    ctx.fillStyle = '#dca830';
                    ctx.font = 'bold 10px Inter';
                    ctx.textAlign = 'center';
                    ctx.fillText("ENTRANCE", (s1[0]+s2[0])/2, (s1[1]+s2[1])/2 - 10);
                }
            });
        }

        // Draw Walls
        ctx.strokeStyle = '#f0f6fc';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        this.walls.forEach(w => {
            const s1 = this.toScreen(w.p1);
            const s2 = this.toScreen(w.p2);
            ctx.beginPath();
            ctx.moveTo(s1[0], s1[1]);
            ctx.lineTo(s2[0], s2[1]);
            ctx.stroke();
        });

        // Drawing Preview
        if (this.isDrawing && this.startPoint) {
            const s1 = this.toScreen(this.startPoint);
            ctx.beginPath();
            ctx.moveTo(s1[0], s1[1]);
            ctx.lineTo(this.mousePos[0], this.mousePos[1]);
            ctx.setLineDash([10, 5]);
            ctx.strokeStyle = '#8b949e';
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }
}

// Global Instance
window.LayoutEditorManager = new LayoutEditor();
