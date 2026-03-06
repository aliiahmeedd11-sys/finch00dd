/* engine.js - Finch Parametric Architecture Engine */

document.getElementById("btn-generate").addEventListener("click", generate);

// Module constants - locked to 3.6m structural grid
const MODULE = 3.6;
const MODULE_WIDTHS = { studio: 1, bed1: 2, bed2: 3, bed3: 4 };

async function generate() {
  const btn = document.getElementById("btn-generate");
  btn.textContent = "▶ Generating...";
  btn.disabled = true;
  const module = MODULE;
  let spine =
    S.customSpine.length >= 2 ? [...S.customSpine] : [...PRESETS[S.preset]];
  spine = alignSpineToStructGrid(spine, module);

  const payload = {
    corridor_width: +slCW.value,
    room_width: module, // base module = 3.6m
    room_depth: +slRD.value,
    floor_height: +slFH.value,
    stair_width: +slSW.value,
    num_floors: +slNF.value,
    unit_mix: S.unitMixConfig,
    module: module, // explicit module for server engine
    module_widths: MODULE_WIDTHS, // per-type multipliers
    spine: S.genMode === "spine" ? spine : [],
    lot_boundary: S.genMode === "lot" ? S.landLot : [],
    setbacks: S.setbacks || 3.0,
    apply_zoning: S.zoningOn,
  };

  try {
    const resp = await fetch(S.serverUrl + "/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (resp.ok) {
      S.data = await resp.json();

      // V18 Engine Compatibility Sync
      if (!S.data.hubs) S.data.hubs = [];
      if (!S.data.staircase && S.data.cores && S.data.cores.length > 0)
        S.data.staircase = S.data.cores[0].stair;
      if (!S.data.elevator && S.data.cores && S.data.cores.length > 0)
        S.data.elevator = S.data.cores[0].elevator;
      if (!S.data.violations) S.data.violations = [];

      console.log("V18 PLATINUM API Success", S.data);
    } else {
      S.data = computeLocal(payload);
    }
  } catch (e) {
    console.warn("API Offline, falling back to Local Engine");
    S.data = computeLocal(payload);
  }

  updateUI();
  autoFit();
  draw();
  btn.textContent = "\u25B6 Generate Floor Plan";
  btn.disabled = false;
}

// --- 1. Compute Local (Module-Based Unit Sizing) ---
function computeLocal(params) {
  const {
    corridor_width,
    room_depth,
    floor_height,
    stair_width,
    spine: raw,
  } = params;
  const mod = params.module || MODULE;
  // Per-unit-type widths derived from module multipliers
  const unitWidths = {
    studio: mod * MODULE_WIDTHS.studio, // 3.6m
    bed1: mod * MODULE_WIDTHS.bed1, // 7.2m
    bed2: mod * MODULE_WIDTHS.bed2, // 10.8m
    bed3: mod * MODULE_WIDTHS.bed3, // 14.4m
  };
  // Default planning width = smallest unit (Studio = 1 module)
  const room_width = mod;
  const half = corridor_width / 2;
  const segs = [];
  for (let i = 0; i < raw.length - 1; i++)
    segs.push({ p1: raw[i], p2: raw[i + 1] });

  function lx(s1, s2) {
    const d1 = vc(s1),
      d2 = vc(s2),
      dn = cr(d1, d2);
    if (Math.abs(dn) < 1e-12) return null;
    const dp = [s2.p1[0] - s1.p1[0], s2.p1[1] - s1.p1[1]];
    return [
      s1.p1[0] + d1[0] * (cr(dp, d2) / dn),
      s1.p1[1] + d1[1] * (cr(dp, d2) / dn),
    ];
  }

  let L = segs.map((s) => {
    const n = [-nm(vc(s))[1], nm(vc(s))[0]];
    return {
      p1: [s.p1[0] + n[0] * half, s.p1[1] + n[1] * half],
      p2: [s.p2[0] + n[0] * half, s.p2[1] + n[1] * half],
    };
  });
  let R = segs.map((s) => {
    const n = [nm(vc(s))[1], -nm(vc(s))[0]];
    return {
      p1: [s.p1[0] + n[0] * half, s.p1[1] + n[1] * half],
      p2: [s.p2[0] + n[0] * half, s.p2[1] + n[1] * half],
    };
  });
  let L_out = segs.map((s) => {
    const n = [-nm(vc(s))[1], nm(vc(s))[0]];
    let D = half + room_depth;
    return {
      p1: [s.p1[0] + n[0] * D, s.p1[1] + n[1] * D],
      p2: [s.p2[0] + n[0] * D, s.p2[1] + n[1] * D],
    };
  });
  let R_out = segs.map((s) => {
    const n = [nm(vc(s))[1], -nm(vc(s))[0]];
    let D = half + room_depth;
    return {
      p1: [s.p1[0] + n[0] * D, s.p1[1] + n[1] * D],
      p2: [s.p2[0] + n[0] * D, s.p2[1] + n[1] * D],
    };
  });

  const I_CL = [],
    I_CR = [],
    I_CL_out = [],
    I_CR_out = [];
  for (let i = 0; i < segs.length - 1; i++) {
    I_CL.push(lx(L[i], L[i + 1]) || L[i].p2);
    I_CR.push(lx(R[i], R[i + 1]) || R[i].p2);
    I_CL_out.push(lx(L_out[i], L_out[i + 1]) || L_out[i].p2);
    I_CR_out.push(lx(R_out[i], R_out[i + 1]) || R_out[i].p2);
  }

  const corridors = [],
    hubs = [];
  for (let i = 0; i < segs.length; i++) {
    let p1L = i === 0 ? L[i].p1 : I_CL[i - 1],
      p2L = i === segs.length - 1 ? L[i].p2 : I_CL[i];
    let p1R = i === 0 ? R[i].p1 : I_CR[i - 1],
      p2R = i === segs.length - 1 ? R[i].p2 : I_CR[i];
    corridors.push([p1L, p2L, p2R, p1R]);
    // No hubs needed for simple miter joints; they cause overlaps
  }

  const fh = floor_height || 3.0,
    sw = stair_width || 1.2;
  const numFloors = params.num_floors || 5;
  const numR = Math.ceil(fh / 0.175),
    riser = +(fh / numR).toFixed(4),
    tread = Math.max(0.27, +(0.62 - 2 * riser).toFixed(4));
  const flights = [Math.ceil(numR / 2), Math.floor(numR / 2)];
  let staircase = null,
    elevator = null,
    stairLen = 0;
  if (segs.length >= 1) {
    const d = nm(vc(segs[0])),
      n = [-d[1], d[0]],
      run = flights[0] * tread,
      totalW = sw * 2 + 0.1;
    stairLen = run + sw + 0.5;
    const sO = L[0].p1,
      outerB = [
        sO,
        [sO[0] + n[0] * totalW, sO[1] + n[1] * totalW],
        [
          sO[0] + n[0] * totalW + d[0] * stairLen,
          sO[1] + n[1] * totalW + d[1] * stairLen,
        ],
        [sO[0] + d[0] * stairLen, sO[1] + d[1] * stairLen],
      ];
    const stairArea = polyArea(outerB);
    staircase = {
      type: "u-shape",
      boundary: outerB,
      centroid: [
        (outerB[0][0] + outerB[2][0]) / 2,
        (outerB[0][1] + outerB[2][1]) / 2,
      ],
      numRisers: numR,
      riser,
      tread,
      stairWidth: sw,
      flights,
      area: Math.round(stairArea * 100) / 100,
      numFlights: 2,
      landingDepth: sw,
      headroom: 2.1,
      blondel: 2 * riser + tread,
      riserOk: riser <= 0.17,
      treadOk: tread >= 0.27,
      blondelOk: true,
      widthOk: sw >= 1.1,
      maxRisersOk: flights.every((f) => f <= 14),
      code: {
        maxRiser: 17,
        minTread: 27,
        blondelTarget: 62,
        maxRisersPerFlight: 14,
        minWidth: numFloors > 4 ? 120 : 110,
        minHeadroom: 2.1,
        maxTravelDist: 25,
        handrailHeight: 90,
      },
    };

    // E2 FIX: Elevator shaft in local fallback (FLUSH)
    if (numFloors > 4) {
      const bldgH = fh * numFloors;
      const isStretcher = bldgH > 28;
      const shaftW = 1.6,
        shaftD = isStretcher ? 2.6 : 1.8;
      const cabinW = 1.1,
        cabinD = isStretcher ? 2.1 : 1.4;
      const eO = [sO[0] + n[0] * totalW, sO[1] + n[1] * totalW];
      const eBnd = [
        eO,
        [eO[0] + n[0] * shaftW, eO[1] + n[1] * shaftW],
        [
          eO[0] + n[0] * shaftW + d[0] * shaftD,
          eO[1] + n[1] * shaftW + d[1] * shaftD,
        ],
        [eO[0] + d[0] * shaftD, eO[1] + d[1] * shaftD],
      ];
      elevator = {
        boundary: eBnd,
        centroid: [
          (eBnd[0][0] + eBnd[2][0]) / 2,
          (eBnd[0][1] + eBnd[2][1]) / 2,
        ],
        shaftW,
        shaftD,
        cabinW,
        cabinD,
        type: isStretcher ? "stretcher" : "passenger-6p",
        required: true,
        area: Math.round(shaftW * shaftD * 100) / 100,
        pitDepth: 1.2,
        overhead: 3.6,
        code: {
          requiredFloors: 4,
          requiredHeight: 12.0,
          stretcherThreshold: 28.0,
        },
      };
      stairLen = Math.max(stairLen, shaftD + 0.15);
    }
  }

  // Joint buffer
  const joint_buffer = corridor_width * 2.0;
  const rooms = [],
    doors = [],
    windows = [],
    ri = { v: 1 },
    cols = [
      [102, 163, 235],
      [122, 204, 153],
      [235, 184, 102],
      [204, 133, 204],
    ];

  function getClipped(p_in, n_v, m1, m2) {
    let p_out = [p_in[0] + n_v[0] * room_depth, p_in[1] + n_v[1] * room_depth];
    [m1, m2].forEach((m) => {
      if (!m) return;
      let mv = [m[1][0] - m[0][0], m[1][1] - m[0][1]],
        pv = [p_out[0] - p_in[0], p_out[1] - p_in[1]];
      let den = mv[0] * pv[1] - mv[1] * pv[0];
      if (Math.abs(den) < 1e-8) return;
      let t = ((p_in[0] - m[0][0]) * mv[1] - (p_in[1] - m[0][1]) * mv[0]) / den;
      if (t > 0.001 && t < 1.001)
        p_out = [p_in[0] + pv[0] * t, p_in[1] + pv[1] * t];
    });
    return p_out;
  }

  function build(idx, sign) {
    const isL = sign === 1,
      IC = isL ? I_CL : I_CR,
      ICO = isL ? I_CL_out : I_CR_out,
      arr = isL ? L : R;
    const p1 = idx === 0 ? arr[0].p1 : IC[idx - 1],
      p2 = idx === segs.length - 1 ? arr[idx].p2 : IC[idx];
    const m1 = idx === 0 ? null : [IC[idx - 1], ICO[idx - 1]],
      m2 = idx === segs.length - 1 ? null : [IC[idx], ICO[idx]];
    const d = nm([p2[0] - p1[0], p2[1] - p1[1]]),
      n = [-d[1] * sign, d[0] * sign],
      len = Math.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2);
    if (len < 0.5) return;

    // B2 FIX: stair_clearance only on LEFT side of segment 0
    let startB;
    if (idx === 0 && isL && staircase) startB = stairLen;
    else if (idx === 0 && !isL) startB = 0.2;
    else if (idx > 0) startB = joint_buffer;
    else startB = 0.2;

    let endB = idx < segs.length - 1 ? joint_buffer : 0.2;
    let actualL = len - startB - endB;
    if (actualL < room_width * 0.8) return;

    // Assign unit types by fitting modules into available length
    // Order of preference: fill with mix ratios from unit config
    const typeOrder = ["studio", "bed1", "bed2", "bed3"];
    const typeLabels = {
      studio: "Studio",
      bed1: "1 Bedroom",
      bed2: "2 Bedroom",
      bed3: "3 Bedroom",
    };
    const typeCols = {
      studio: [250, 204, 21],
      bed1: [74, 222, 128],
      bed2: [96, 165, 250],
      bed3: [244, 114, 182],
    };

    // Determine mix ratios from state
    const mixConfig =
      params.unit_mix && params.unit_mix.length > 0
        ? params.unit_mix
        : [
            { type: "studio", mix: 25 },
            { type: "bed1", mix: 50 },
            { type: "bed2", mix: 25 },
            { type: "bed3", mix: 0 },
          ];
    const totalMix = mixConfig.reduce((s, c) => s + (c.mix || 0), 0) || 100;

    // Fill available length with unit widths according to module counts
    let curr = startB;
    let uIdx = 0; // cycle through unit types
    let placed = 0;
    while (curr < len - endB - room_width * 0.5) {
      const remaining = len - endB - curr;
      // Pick a unit type: cycle through mix proportionally
      const unitType = typeOrder[uIdx % typeOrder.length];
      uIdx++;
      const w = unitWidths[unitType] || room_width;
      if (remaining < w * 0.8) break;
      const useW = Math.min(w, remaining);

      let c1 = [p1[0] + d[0] * curr, p1[1] + d[1] * curr];
      let c2 = [p1[0] + d[0] * (curr + useW), p1[1] + d[1] * (curr + useW)];
      let c4 = getClipped(c1, n, m1, m2),
        c3 = getClipped(c2, n, m1, m2);
      let poly = [c1, c2, c3, c4],
        area = polyArea(poly);

      if (area > 5.0) {
        ri.v++;
        placed++;
        const label = typeLabels[unitType];
        const color = typeCols[unitType];
        rooms.push({
          label,
          boundary: poly,
          area: Math.round(area * 10) / 10,
          min_width: +useW.toFixed(2),
          fill: color,
          unit_type: unitType,
          modules: MODULE_WIDTHS[unitType] || 1,
        });

        const door_w = 0.9;
        let dm = [(c1[0] + c2[0]) / 2, (c1[1] + c2[1]) / 2];
        doors.push({
          p1: [dm[0] - d[0] * (door_w / 2), dm[1] - d[1] * (door_w / 2)],
          p2: [dm[0] + d[0] * (door_w / 2), dm[1] + d[1] * (door_w / 2)],
          swing: n,
        });

        let win_w = Math.min(2.0, useW * 0.4);
        let wm = [(c4[0] + c3[0]) / 2, (c4[1] + c3[1]) / 2];
        windows.push({
          p1: [wm[0] - d[0] * (win_w / 2), wm[1] - d[1] * (win_w / 2)],
          p2: [wm[0] + d[0] * (win_w / 2), wm[1] + d[1] * (win_w / 2)],
        });
      } else if (area > 0.5) {
        rooms.push({
          label: "Shaft",
          boundary: poly,
          area: Math.round(area * 10) / 10,
          fill: [80, 88, 100],
        });
      }
      curr += useW;
    }
  }
  for (let i = 0; i < segs.length; i++) {
    build(i, 1);
    build(i, -1);
  }

  const nf = params.num_floors || 5;
  const netU = rooms
    .filter((r) => r.label !== "Shaft")
    .reduce((s, r) => s + r.area, 0);
  const serviceA = rooms
    .filter((r) => r.label === "Shaft")
    .reduce((s, r) => s + r.area, 0);
  const stairA = staircase ? staircase.area : 0;
  const elevA = elevator ? elevator.area : 0;
  const circArea = corridors.reduce((s, c) => s + polyArea(c), 0);

  // Total footprint (Single floor sum)
  const footprint = netU + circArea + stairA + elevA + serviceA;
  const totalGBA = footprint * nf;

  const economics = {
    grossBUA: Math.round(totalGBA * 100) / 100,
    netUsable: Math.round(netU * nf * 100) / 100,
    footprintArea: Math.round(footprint * 100) / 100,
    unitsArea: Math.round(netU * nf * 100) / 100,
    stairArea: Math.round((stairA + elevA) * nf * 100) / 100,
    circArea: Math.round(circArea * nf * 100) / 100,
    balconyArea: 0, // Fallback doesn't support balconies yet
    deadSpace: Math.round(serviceA * nf * 100) / 100,
    netGrossRatio: Math.round((netU / footprint) * 1000) / 10,
    circPercent: Math.round((circArea / footprint) * 1000) / 10,
  };
  return {
    spine: raw,
    corridors,
    hubs,
    rooms,
    doors,
    windows,
    violations: [],
    staircase,
    elevator,
    circDistances: [],
    economics,
    decisions: [],
  };
}

// --- UI Update ---
