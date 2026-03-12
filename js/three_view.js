/**
 * ThreeViewer - High-Fidelity 3D Architectural Viewer
 * Powered by Three.js r148
 */
class ThreeViewer {
    constructor(containerId) {
        console.log("3D Precision Engine Initializing...");
        this.container = document.getElementById(containerId);
        if (!this.container) return;
        
        this.active = false;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0f172a); 
        this.scene.fog = new THREE.FogExp2(0x0f172a, 0.002);

        this.camera = new THREE.PerspectiveCamera(40, 1, 1, 3000);
        this.camera.position.set(150, 120, 150);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        if (typeof THREE.OrbitControls === 'function') {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
        }

        this._addEnvironment();
        this.currentFloor = 'all';
        this.lastData = null;

        window.addEventListener('resize', () => this.onResize());
        this.animate();
    }

    _addEnvironment() {
        // 1. Sun Light (Main)
        const sun = new THREE.DirectionalLight(0xffffff, 1.0);
        sun.position.set(100, 200, 100);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        sun.shadow.camera.left = -200;
        sun.shadow.camera.right = 200;
        sun.shadow.camera.top = 200;
        sun.shadow.camera.bottom = -200;
        this.scene.add(sun);

        // 2. Ambient Fill
        const ambient = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambient);

        // 3. Hemisphere (Sky/Ground color)
        const hemi = new THREE.HemisphereLight(0x60a5fa, 0x0f172a, 0.3);
        this.scene.add(hemi);

        // 4. Ground Plane
        const groundGeo = new THREE.PlaneGeometry(2000, 2000);
        const groundMat = new THREE.MeshPhongMaterial({ 
            color: 0x1e293b, 
            shininess: 0 
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.6;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // 5. Ground Grid
        const grid = new THREE.GridHelper(1000, 100, 0x334155, 0x1e293b);
        grid.position.y = -0.55;
        this.scene.add(grid);
    }

    onResize() {
        if (!this.container || !this.active) return;
        const w = this.container.clientWidth;
        const h = this.container.clientHeight;
        if (w === 0 || h === 0) return;
        
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        if (this.active) {
            if (this.controls) this.controls.update();
            this.renderer.render(this.scene, this.camera);
        }
    }

    toggle(force) {
        this.active = force !== undefined ? force : !this.active;
        this.container.style.display = this.active ? 'block' : 'none';
        
        // Toggle Floor Selector UI
        const fs = document.getElementById('floor-selector');
        if (fs) fs.style.display = this.active ? 'flex' : 'none';

        if (this.active) {
            setTimeout(() => this.onResize(), 60);
            if (this.lastData) this.update(this.lastData);
        }
    }

    setFloor(f) {
        this.currentFloor = f; // 'all' or index 0,1,2...
        if (this.lastData) this.update(this.lastData);
    }

    update(data) {
        if (!data) return;
        this.lastData = data;
        if (!this.active) return;

        console.log("3D High-Fi Render Start...");
        
        // 1. Safe Cleanup: Remove all Groups (buildings)
        const toRemove = [];
        this.scene.children.forEach(child => {
            if (child.type === 'Group') toRemove.push(child);
        });
        toRemove.forEach(group => this.scene.remove(group));

        const group = new THREE.Group();
        // Fallback to slider value if economics is missing num_floors
        const numFloors = data.economics?.grossBUA ? Math.round(data.economics.grossBUA / data.economics.footprintArea) : (+document.getElementById("num-floors").value || 5);
        const floorHeight = 3.2; // Standard floor height including slab

        // Sync Floor Buttons in UI
        this._updateFloorButtons(numFloors);

        for (let f = 0; f < numFloors; f++) {
            // Isolation check
            if (this.currentFloor !== 'all' && parseInt(this.currentFloor) !== f) continue;

            const floorGroup = new THREE.Group();
            floorGroup.position.y = f * floorHeight;

            // 1. Rooms & Ceiling Slabs
            if (data.rooms) {
                data.rooms.forEach(room => {
                    const isCore = room.unit_type === 'stair' || room.unit_type === 'elevator';
                    const isDuct = room.unit_type === 'duct';
                    
                    const shape = this._pointsToShape(room.boundary);
                    const color = isCore ? 0xf59e0b : (isDuct ? 0x334155 : this._colorToHex(room.fill));
                    
                    // Walls / Mass (Extrusion happens in Z, we rotate to make Z be Y)
                    const wallGeo = new THREE.ExtrudeGeometry(shape, {
                        depth: floorHeight,
                        bevelEnabled: false
                    });
                    const wallMat = new THREE.MeshPhongMaterial({ 
                        color: color,
                        transparent: isDuct,
                        opacity: isDuct ? 0.3 : 1.0,
                        side: THREE.DoubleSide,
                        flatShading: true
                    });
                    const wallMesh = new THREE.Mesh(wallGeo, wallMat);
                    wallMesh.rotation.x = -Math.PI / 2;
                    wallMesh.castShadow = !isDuct;
                    wallMesh.receiveShadow = true;
                    floorGroup.add(wallMesh);

                    // Ceiling Slab (Top decoration)
                    if (!isDuct) {
                        const ceilGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: false });
                        const ceilMat = new THREE.MeshPhongMaterial({ color: 0x475569, side: THREE.DoubleSide });
                        const ceilMesh = new THREE.Mesh(ceilGeo, ceilMat);
                        ceilMesh.rotation.x = -Math.PI / 2;
                        ceilMesh.position.y = floorHeight;
                        floorGroup.add(ceilMesh);
                    }

                    // Balcony
                    if (room.balcony) {
                        const bShape = this._pointsToShape(room.balcony);
                        const bGeo = new THREE.ExtrudeGeometry(bShape, { depth: 0.15, bevelEnabled: false });
                        const bMat = new THREE.MeshPhongMaterial({ color: 0x64748b, side: THREE.DoubleSide });
                        const bMesh = new THREE.Mesh(bGeo, bMat);
                        bMesh.rotation.x = -Math.PI / 2;
                        bMesh.position.y = 0.1;
                        floorGroup.add(bMesh);
                    }
                });
            }

            // 2. Corridors
            if (data.corridors) {
                data.corridors.forEach(corridor => {
                    const shape = this._pointsToShape(corridor);
                    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: false });
                    const mat = new THREE.MeshPhongMaterial({ color: 0x1e293b, side: THREE.DoubleSide });
                    const mesh = new THREE.Mesh(geo, mat);
                    mesh.rotation.x = -Math.PI / 2;
                    floorGroup.add(mesh);
                });
            }

            group.add(floorGroup);
        }

        this.scene.add(group);

        // Focus & Fit (Auto-Framing)
        if (group.children.length > 0) {
            const box = new THREE.Box3().setFromObject(group);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());

            // 1. Set the rotation pivot to building center
            this.controls.target.copy(center);

            // 2. Calculate optimal distance based on FOV
            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = this.camera.fov * (Math.PI / 180);
            let cameraDist = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 2.2;
            
            // 3. Position camera at an architectural angle (Isometric-ish)
            this.camera.position.set(
                center.x + cameraDist * 0.5, 
                center.y + cameraDist * 0.6, 
                center.z + cameraDist * 0.5
            );
            
            this.controls.update();
            console.log("3D Scene Framed:", center);
        }
    }

    _updateFloorButtons(count) {
        const strip = document.getElementById('floor-selector');
        if (!strip) return;
        
        // Keep ALL and Divider
        const existing = strip.querySelectorAll('.floor-btn-gen');
        existing.forEach(e => e.remove());

        for (let i = 0; i < count; i++) {
            const btn = document.createElement('button');
            btn.className = 'floor-btn floor-btn-gen';
            if (this.currentFloor !== 'all' && parseInt(this.currentFloor) === i) btn.classList.add('active');
            btn.textContent = `F${i + 1}`;
            btn.onclick = () => {
                strip.querySelectorAll('.floor-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.setFloor(i);
            };
            strip.appendChild(btn);
        }

        const allBtn = strip.querySelector('[data-floor="all"]');
        if (allBtn) {
            allBtn.onclick = () => {
                strip.querySelectorAll('.floor-btn').forEach(b => b.classList.remove('active'));
                allBtn.classList.add('active');
                this.setFloor('all');
            };
            if (this.currentFloor === 'all') allBtn.classList.add('active');
        }
    }

    _pointsToShape(points) {
        const shape = new THREE.Shape();
        if (!points || points.length === 0) return shape;
        shape.moveTo(points[0][0], points[0][1]);
        for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
        shape.closePath();
        return shape;
    }

    _colorToHex(color) {
        if (!color) return 0xcccccc;
        if (Array.isArray(color)) return (color[0] << 16) + (color[1] << 8) + color[2];
        if (typeof color === 'string' && color.startsWith('#')) return parseInt(color.replace('#', ''), 16);
        return 0xcccccc;
    }
}

// Startup
window.viewer3d = null;
window.addEventListener('load', () => {
    window.viewer3d = new ThreeViewer('three-container');
});
