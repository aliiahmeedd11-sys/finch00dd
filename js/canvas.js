/* canvas.js - Finch Parametric Architecture Engine */

function autoFit() {
  if (!S.data) return;
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  const expandBounds = (pts) => {
    for (const p of pts) {
      const px = Array.isArray(p) ? p[0] : p.x;
      const py = Array.isArray(p) ? p[1] : p.y;
      if (isFinite(px) && isFinite(py)) {
        x0 = Math.min(x0, px);
        y0 = Math.min(y0, py);
        x1 = Math.max(x1, px);
        y1 = Math.max(y1, py);
      }
    }
  };
  const d = S.data;
  if (d.rooms) for (const r of d.rooms) expandBounds(r.boundary);
  if (d.corridors) for (const c of d.corridors) expandBounds(c);
  if (d.spine && d.spine.length > 0) expandBounds(d.spine);
  if (!isFinite(x0) || !isFinite(y0) || !isFinite(x1) || !isFinite(y1)) return;
  const cw = canvas.width / devicePixelRatio,
    ch = canvas.height / devicePixelRatio;
  if (cw < 1 || ch < 1) return;
  const dw = Math.max(x1 - x0, 1),
    dh = Math.max(y1 - y0, 1);
  const padX = Math.min(40, cw * 0.05);
  const padY = Math.min(40, ch * 0.05);
  S.zoom = Math.min(
    50,
    Math.max(0.5, Math.min((cw - padX * 2) / dw, (ch - padY * 2) / dh)),
  );
  S.panX = cw / 2 - (x0 + dw / 2) * S.zoom;
  S.panY = ch / 2 - (y0 + dh / 2) * S.zoom;
  document.getElementById("zoom-ind").textContent =
    Math.round(S.zoom * 100) + "%";
}

// --- Background Grid ---
function drawGrid(cw, ch) {
  // 1. Solid dark background
  ctx.fillStyle = "#0d1117";
  ctx.fillRect(0, 0, cw, ch);

  if (!S.showGrid) return;

  // 2. Structural Grid (3m module) - Dynamic Dots + Lines
  const gridStep = 3.0; // 3-meter structural grid
  const topLeft = toWorld(0, 0),
    botRight = toWorld(cw, ch);
  const gx0 = Math.floor(topLeft[0] / gridStep) * gridStep;
  const gy0 = Math.floor(topLeft[1] / gridStep) * gridStep;
  const gx1 = Math.ceil(botRight[0] / gridStep) * gridStep;
  const gy1 = Math.ceil(botRight[1] / gridStep) * gridStep;

  // Subtle grid lines first
  ctx.strokeStyle = "#21262d55";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let gx = gx0; gx <= gx1; gx += gridStep) {
    const sx = toScreen([gx, 0]);
    ctx.moveTo(sx[0], 0);
    ctx.lineTo(sx[0], ch);
  }
  for (let gy = gy0; gy <= gy1; gy += gridStep) {
    const sy = toScreen([0, gy]);
    ctx.moveTo(0, sy[1]);
    ctx.lineTo(cw, sy[1]);
  }
  ctx.stroke();

  // Intersection Dots
  ctx.fillStyle = "#30363d";
  for (let gx = gx0; gx <= gx1; gx += gridStep) {
    for (let gy = gy0; gy <= gy1; gy += gridStep) {
      const sp = toScreen([gx, gy]);
      ctx.beginPath();
      ctx.arc(sp[0], sp[1], 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Grid Labels (meters)
  ctx.fillStyle = "#484f58";
  ctx.font = "9px JetBrains Mono";
  for (let gx = gx0; gx <= gx1; gx += gridStep) {
    const sx = toScreen([gx, 0]);
    if (sx[0] > 0 && sx[0] < cw)
      ctx.fillText(`${gx.toFixed(0)}m`, sx[0] + 4, 12);
  }
  for (let gy = gy0; gy <= gy1; gy += gridStep) {
    const sy = toScreen([0, gy]);
    if (sy[1] > 0 && sy[1] < ch)
      ctx.fillText(`${gy.toFixed(0)}m`, 4, sy[1] - 4);
  }
}

// --- 3. Draw Engine (Updated to render Fenestrations) ---
function draw() {
  const cw = canvas.width / devicePixelRatio,
    ch = canvas.height / devicePixelRatio;
  ctx.clearRect(0, 0, cw, ch);
  drawGrid(cw, ch);

  // --- Structural Grid Overlay ---
  if (S.structGridEnabled && S.drawMode) {
    const mod = +slRW.value || 3.0;
    const topLeft = toWorld(0, 0),
      botRight = toWorld(cw, ch);
    const x0 = Math.floor(topLeft[0] / mod) * mod,
      y0 = Math.floor(topLeft[1] / mod) * mod;
    const x1 = Math.ceil(botRight[0] / mod) * mod,
      y1 = Math.ceil(botRight[1] / mod) * mod;
    ctx.strokeStyle = "#3fb95015";
    ctx.lineWidth = 1;
    for (let gx = x0; gx <= x1; gx += mod) {
      const sx = toScreen([gx, 0]);
      ctx.beginPath();
      ctx.moveTo(sx[0], 0);
      ctx.lineTo(sx[0], ch);
      ctx.stroke();
    }
    for (let gy = y0; gy <= y1; gy += mod) {
      const sy = toScreen([0, gy]);
      ctx.beginPath();
      ctx.moveTo(0, sy[1]);
      ctx.lineTo(cw, sy[1]);
      ctx.stroke();
    }
    // Module intersection dots
    ctx.fillStyle = "#3fb95030";
    for (let gx = x0; gx <= x1; gx += mod) {
      for (let gy = y0; gy <= y1; gy += mod) {
        const sp = toScreen([gx, gy]);
        ctx.beginPath();
        ctx.arc(sp[0], sp[1], 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // === V17: RENDER SPINE OR LAND LOT ===
  const pts = S.genMode === "spine" ? S.customSpine : S.landLot;
  const ptColor = S.genMode === "spine" ? "#58a6ff" : "#a371f7";

  if (pts.length > 0) {
    // 1. Draw Polyline / Polygon
    ctx.strokeStyle = ptColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    const s0 = toScreen(pts[0]);
    ctx.moveTo(s0[0], s0[1]);
    for (let i = 1; i < pts.length; i++) {
      const si = toScreen(pts[i]);
      ctx.lineTo(si[0], si[1]);
    }
    if (S.genMode === "lot" && pts.length >= 3) {
      ctx.closePath();
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. Segment length labels
    ctx.font = "10px JetBrains Mono";
    ctx.textAlign = "center";
    for (let i = 0; i < pts.length; i++) {
      if (S.genMode === "spine" && i === pts.length - 1) continue;
      const a = pts[i],
        b = pts[(i + 1) % pts.length];
      const len = Math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2);
      const mid = toScreen([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
      ctx.fillStyle = ptColor + "aa";
      ctx.fillText(len.toFixed(2) + "m", mid[0], mid[1] - 8);
    }

    // 3. Points with index numbers
    const mod = +slRW.value || 3.0;
    pts.forEach((p, i) => {
      const sp = toScreen(p);
      const onGrid =
        S.structGridEnabled &&
        Math.abs(p[0] % mod) < 0.01 &&
        Math.abs(p[1] % mod) < 0.01;
      if (onGrid) {
        ctx.strokeStyle = "#3fb950";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sp[0], sp[1], 9, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = i === S.hoverIdx ? "#fff" : ptColor;
      ctx.beginPath();
      ctx.arc(sp[0], sp[1], i === S.hoverIdx ? 7 : 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0d1117";
      ctx.font = "bold 8px Inter";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(i + 1, sp[0], sp[1]);
      ctx.textBaseline = "alphabetic";
    });

    // 4. Rubber-band ghost line
    if (S.drawMode && pts.length > 0 && S.dragIdx < 0) {
      const last = pts[pts.length - 1];
      const [wx, wy] = applyPrecision(S.cursorWorld[0], S.cursorWorld[1]);
      const sLast = toScreen(last),
        sCur = toScreen([wx, wy]);
      ctx.strokeStyle = "#ffffff55";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(sLast[0], sLast[1]);
      ctx.lineTo(sCur[0], sCur[1]);
      if (S.genMode === "lot" && pts.length >= 3) {
        const s0p = toScreen(pts[0]);
        ctx.lineTo(s0p[0], s0p[1]);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  if (!S.data) return;
  const d = S.data;

  ctx.fillStyle = "#2d333b";
  ctx.strokeStyle = "#444c56";
  ctx.lineWidth = 1;
  d.corridors.forEach((c, idx) => {
    dPoly(c, true, true);
    if (S.showDims) {
      // Calculate corridor length (spine segment length)
      const p1 = d.spine[idx],
        p2 = d.spine[idx + 1];
      const len = Math.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2);
      const spMid = toScreen([(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2]);
      ctx.fillStyle = "#58a6ffaa";
      ctx.font = "10px JetBrains Mono";
      ctx.textAlign = "center";
      ctx.fillText(`${len.toFixed(2)}m (L)`, spMid[0], spMid[1] - 4);
      ctx.fillText(`${(+slCW.value).toFixed(2)}m (W)`, spMid[0], spMid[1] + 10);
    }
  });

  ctx.fillStyle = "#30404d";
  ctx.strokeStyle = "#58a6ff55";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < d.hubs.length; i++) {
    if (d.staircase && d.staircase.coreHubIdx === i) continue;
    if (d.hubs[i].boundary && d.hubs[i].boundary.length >= 3)
      dPoly(d.hubs[i].boundary, true, true);
  }

  if (S.showRooms) {
    for (const r of d.rooms) {
      if (r.fill) {
        ctx.fillStyle = r.fill_opacity
          ? `rgba(${r.fill[0]},${r.fill[1]},${r.fill[2]},${r.fill_opacity})`
          : `rgba(${r.fill[0]},${r.fill[1]},${r.fill[2]},0.35)`;
        dPoly(r.boundary, true, false);
      }

      if (r.stroke) {
        ctx.strokeStyle = r.stroke.color || "#444";
        ctx.lineWidth = r.stroke.weight || 1;
        if (r.stroke.dash) ctx.setLineDash(r.stroke.dash);
        else ctx.setLineDash([]);
        dPoly(r.boundary, false, true);
        ctx.setLineDash([]);
      } else if (r.fill) {
        ctx.strokeStyle = `rgba(${r.fill[0]},${r.fill[1]},${r.fill[2]},0.6)`;
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        dPoly(r.boundary, false, true);
      }

      // 🏠 Render Balcony
      if (S.showBalconies && r.balcony) {
        ctx.fillStyle =
          r.balcony_fill || `rgba(${r.fill[0]},${r.fill[1]},${r.fill[2]},0.15)`;
        ctx.strokeStyle = `rgba(${r.fill[0]},${r.fill[1]},${r.fill[2]},0.8)`;
        ctx.lineWidth = 1.0;
        dPoly(r.balcony, true, true);

        // Solid Divider Line (The "Wall/Window" between room and balcony)
        const b1 = toScreen(r.balcony[1]),
          b2 = toScreen(r.balcony[2]);
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(b1[0], b1[1]);
        ctx.lineTo(b2[0], b2[1]);
        ctx.stroke();
        // This line is inferred to be part of the S object's initialization.
        // For a real file, you'd find the 'const S = { ... }' definition and modify it.
        // const S = { data: null, zoom: 10, panX: 0, panY: 0, showRooms: true, showSpine: true, showCores: true, showDucts: true, showBalconies: true, showLabels: true, showDims: false, showCirc: false, showGrid: true, };
      }
    }

    // 🔲 Room Dimensions (Show when showDims is active)
    if (S.showDims) {
      ctx.fillStyle = "#8b949e";
      ctx.font = "9px JetBrains Mono";
      ctx.textAlign = "center";
      for (const r of d.rooms) {
        const b = r.boundary;
        for (let i = 0; i < b.length; i++) {
          const j = (i + 1) % b.length,
            sp1 = toScreen(b[i]),
            sp2 = toScreen(b[j]);
          const el = Math.sqrt(
            (b[j][0] - b[i][0]) ** 2 + (b[j][1] - b[i][1]) ** 2,
          ).toFixed(2);
          // Avoid overlapping dimensions for small segments
          if (el > 0.5)
            ctx.fillText(
              el + "m",
              (sp1[0] + sp2[0]) / 2,
              (sp1[1] + sp2[1]) / 2 - 6,
            );
        }
      }
    }

    // 🎨 Render Windows (Single Blue Line)
    if (d.windows) {
      ctx.strokeStyle = "#58a6ff";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      d.windows.forEach((w) => {
        const s1 = toScreen(w.p1),
          s2 = toScreen(w.p2);
        ctx.beginPath();
        ctx.moveTo(s1[0], s1[1]);
        ctx.lineTo(s2[0], s2[1]);
        ctx.stroke();
      });
    }

    // 🚪 Render Doors
    if (d.doors) {
      d.doors.forEach((dr) => {
        const s1 = toScreen(dr.p1),
          s2 = toScreen(dr.p2);
        const door_w = Math.sqrt((s2[0] - s1[0]) ** 2 + (s2[1] - s1[1]) ** 2);
        const angle = Math.atan2(s2[1] - s1[1], s2[0] - s1[0]);
        const s_swing = [
          s1[0] + dr.swing[0] * door_w,
          s1[1] + dr.swing[1] * door_w,
        ];
        const swing_angle = Math.atan2(s_swing[1] - s1[1], s_swing[0] - s1[0]);
        ctx.strokeStyle = "#dca83066";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(s1[0], s1[1], door_w, angle, swing_angle, angle > swing_angle);
        ctx.stroke();
        ctx.strokeStyle = "#dca830";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(s1[0], s1[1]);
        ctx.lineTo(s_swing[0], s_swing[1]);
        ctx.stroke();
      });
    }
  } // End showRooms block

  // 🔲 Shaft Hatching (Architectural X-Void)
  if (d.rooms) {
    d.rooms
      .filter((r) => r.label === "Shaft")
      .forEach((r) => {
        if (r.boundary.length < 4) return;
        const c1 = toScreen(r.boundary[0]),
          c2 = toScreen(r.boundary[1]);
        const c3 = toScreen(r.boundary[2]),
          c4 = toScreen(r.boundary[3]);
        ctx.strokeStyle = "rgba(255,255,255,0.15)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(c1[0], c1[1]);
        ctx.lineTo(c3[0], c3[1]);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(c2[0], c2[1]);
        ctx.lineTo(c4[0], c4[1]);
        ctx.stroke();
      });
  }

  if (S.showLabels) {
    const fs = Math.max(10, Math.min(14, S.zoom * 0.5));
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const r of d.rooms) {
      if (r.label === "Shaft" && r.area < 5.0) continue;
      if (r.label && r.label.includes("Envelope")) continue;
      const cx = r.boundary.reduce((s, p) => s + p[0], 0) / r.boundary.length;
      const cy = r.boundary.reduce((s, p) => s + p[1], 0) / r.boundary.length;
      const sp = toScreen([cx, cy]);
      ctx.fillStyle = "#e6edf3";
      ctx.font = `600 ${fs}px Inter`;
      ctx.fillText(r.label, sp[0], sp[1] - fs * 0.6);
      ctx.fillStyle = "#8b949e";
      ctx.font = `${fs - 2}px JetBrains Mono`;
      ctx.fillText(r.area + " m²", sp[0], sp[1] + fs * 0.5);
    }
  }

  // 🏛 RENDER CORES (Multiple Staircases & Elevators)
  if (S.showCores && d.cores && d.cores.length > 0) {
    d.cores.forEach((core) => {
      // 1. Draw Staircase
      if (core.stair && core.stair.boundary) {
        ctx.fillStyle = "rgba(210, 153, 34, 0.25)";
        dPoly(core.stair.boundary, true, false);
        ctx.strokeStyle = "#d29922";
        ctx.lineWidth = 2.5;
        dPoly(core.stair.boundary, false, true);

        // Draw Treads (Technical Detail)
        if (core.stair.treads) {
          ctx.strokeStyle = "#d2992266";
          ctx.lineWidth = 0.8;
          core.stair.treads.forEach((t) => {
            const s1 = toScreen(t[0]),
              s2 = toScreen(t[1]);
            ctx.beginPath();
            ctx.moveTo(s1[0], s1[1]);
            ctx.lineTo(s2[0], s2[1]);
            ctx.stroke();
          });
        }

        // Label
        const sp = toScreen(core.stair.centroid || [0, 0]);
        ctx.fillStyle = "#d29922";
        ctx.font = "bold 11px Inter";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(core.label.toUpperCase(), sp[0], sp[1] - 8);
        ctx.font = "8px JetBrains Mono";
        ctx.fillText("STAIRCASE", sp[0], sp[1] + 6);
      }

      // 2. Draw Elevator
      if (core.elevator && core.elevator.boundary) {
        const ev = core.elevator;
        ctx.fillStyle = "rgba(88, 166, 255, 0.15)";
        dPoly(ev.boundary, true, false);
        ctx.strokeStyle = "#58a6ff";
        ctx.lineWidth = 2;
        dPoly(ev.boundary, false, true);

        // Inner Cabin Rendering (Technical)
        if (ev.cabinW && ev.cabinD) {
          const scaleW = ev.cabinW / ev.shaftW,
            scaleD = ev.cabinD / ev.shaftD;
          const eb = ev.boundary,
            cx = ev.centroid[0],
            cy = ev.centroid[1];
          const cabinBnd = eb.map((p) => [
            cx + (p[0] - cx) * scaleW,
            cy + (p[1] - cy) * scaleD,
          ]);
          ctx.strokeStyle = "#58a6ff66";
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          dPoly(cabinBnd, false, true);
          ctx.setLineDash([]);
        }

        const sp = toScreen(core.elevator.centroid || [0, 0]);
        ctx.fillStyle = "#58a6ff";
        ctx.font = "bold 9px Inter";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🛗", sp[0], sp[1]);
      }
    });
  }

  // 🌬 RENDER VENTILATION SHAFTS (منور)
  if (S.showDucts && d.ventShafts) {
    d.ventShafts.forEach((v) => {
      ctx.fillStyle = v.fill || "rgba(100, 110, 120, 0.1)";
      dPoly(v.boundary, true, false);

      if (v.stroke) {
        ctx.strokeStyle = v.stroke.color || "#444c56";
        ctx.lineWidth = v.stroke.weight || 1;
        if (v.stroke.dash) ctx.setLineDash(v.stroke.dash);
        else ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = "#444c56";
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
      }
      dPoly(v.boundary, false, true);
      ctx.setLineDash([]);

      if (v.boundary.length >= 4) {
        const c1 = toScreen(v.boundary[0]),
          c2 = toScreen(v.boundary[1]);
        const c3 = toScreen(v.boundary[2]),
          c4 = toScreen(v.boundary[3]);
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(c1[0], c1[1]);
        ctx.lineTo(c3[0], c3[1]);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(c2[0], c2[1]);
        ctx.lineTo(c4[0], c4[1]);
        ctx.stroke();
      }
    });
  }

  // Spine (Show if toggled)
  if (S.showSpine && d.spine && d.spine.length >= 2) {
    ctx.strokeStyle = "#58a6ff";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    const s0 = toScreen(d.spine[0]);
    ctx.moveTo(s0[0], s0[1]);
    for (let i = 1; i < d.spine.length; i++) {
      const si = toScreen(d.spine[i]);
      ctx.lineTo(si[0], si[1]);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#58a6ff";
    for (const p of d.spine) {
      const sp = toScreen(p);
      ctx.beginPath();
      ctx.arc(sp[0], sp[1], 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // === Blueprint Metadata Overlay ===
  // Scale Bar
  const barWorld = 5; // 5m
  const barPx = barWorld * S.zoom;
  if (barPx > 20) {
    const bx = 20,
      by = ch - 18;
    ctx.strokeStyle = "#484f58";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + barPx, by);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx, by - 4);
    ctx.lineTo(bx, by + 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx + barPx, by - 4);
    ctx.lineTo(bx + barPx, by + 4);
    ctx.stroke();
    ctx.fillStyle = "#484f58";
    ctx.font = "9px JetBrains Mono";
    ctx.textAlign = "center";
    ctx.fillText(barWorld + "m", bx + barPx / 2, by - 6);
  }
  // Project Title
  ctx.textAlign = "right";
  ctx.fillStyle = "#58a6ff";
  ctx.font = "600 14px Inter";
  ctx.fillText(
    "FINCH GENERATIVE PLAN \u2014 V17.1.0-PLATINUM",
    cw - 20,
    ch - 50,
  );
  ctx.fillStyle = "#8b949e";
  ctx.font = "10px Inter";
  ctx.fillText("EGYPTIAN CODE \u00b7 PRECISION ENGINE", cw - 20, ch - 35);
  ctx.fillText(
    new Date().toLocaleDateString() +
      " \u00b7 " +
      new Date().toLocaleTimeString(),
    cw - 20,
    ch - 22,
  );
}

function drawOverlay(cw, ch) {
  // Minor grid (1m) when zoomed in
  const g1 = 1.0 * S.zoom;
  if (g1 > 12) {
    const sx1 = S.panX % g1,
      sy1 = S.panY % g1;
    ctx.strokeStyle = "#1c232f88";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let x = sx1; x <= cw; x += g1) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ch);
    }
    for (let y = sy1; y <= ch; y += g1) {
      ctx.moveTo(0, y);
      ctx.lineTo(cw, y);
    }
    ctx.stroke();
  }
}

function dPoly(pts, fill, stroke) {
  if (!pts || pts.length < 2) return;
  ctx.beginPath();
  const s0 = toScreen(pts[0]);
  ctx.moveTo(s0[0], s0[1]);
  for (let i = 1; i < pts.length; i++) {
    const si = toScreen(pts[i]);
    ctx.lineTo(si[0], si[1]);
  }
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

// --- 2. DXF Exporter Engine ---
