/* ui.js - Finch Parametric Architecture Engine */

function updateUI() {
    if (!S.data) return; const d = S.data;
    console.log("Updating UI with data:", d);

    // --- Live Unit Mix Dashboard ---
    try {
        const unitCounts = {};
        const unitAreas = {};
        let totalUnits = 0;

        (d.rooms || []).forEach(r => {
            const label = r.label || "";
            if (label.includes("Bedroom") || label.includes("Studio") || label.startsWith("Unit")) {
                // Normalize generic Unit labels for sorting if they don't have Bedroom/Studio names yet
                const displayLabel = (label.includes("Bedroom") || label.includes("Studio")) ? label : "Unmapped Unit";
                unitCounts[displayLabel] = (unitCounts[displayLabel] || 0) + 1;
                unitAreas[displayLabel] = (unitAreas[displayLabel] || 0) + (r.area || 0);
                totalUnits++;
            }
        });

        const dashboardBody = document.getElementById('unit-dashboard-body');
        if (dashboardBody) {
            if (totalUnits === 0) {
                dashboardBody.innerHTML = '<tr><td colspan="4" class="table-waiting-cell">No residential units found</td></tr>';
            } else {
                const rows = [];
                const sortOrder = ["Studio", "1 Bedroom", "2 Bedroom", "3 Bedroom"];
                const foundLabels = Object.keys(unitCounts).sort((a, b) => {
                    const idxA = sortOrder.indexOf(a);
                    const idxB = sortOrder.indexOf(b);
                    if (idxA === -1 && idxB === -1) return a.localeCompare(b);
                    if (idxA === -1) return 1;
                    if (idxB === -1) return -1;
                    return idxA - idxB;
                });

                foundLabels.forEach(label => {
                    const count = unitCounts[label];
                    const avg = (unitAreas[label] / count).toFixed(1);
                    const pct = ((count / totalUnits) * 100).toFixed(0);
                    const typeMap = { "Studio": "studio", "1 Bedroom": "bed1", "2 Bedroom": "bed2", "3 Bedroom": "bed3" };
                    const typeKey = typeMap[label];
                    const mixArr = Array.isArray(S.unitMixConfig) ? S.unitMixConfig : [];
                    const targetConfig = mixArr.find(c => c.type === typeKey);
                    const targetPct = targetConfig ? targetConfig.mix : '—';

                    rows.push(`
                        <tr>
                            <td>${label}</td>
                            <td>${count}</td>
                            <td><span class="mix-actual">${pct}%</span> <span class="mix-target">(${targetPct}%)</span></td>
                            <td>${avg}</td>
                        </tr>
                    `);
                });
                dashboardBody.innerHTML = rows.join('');
            }
        }
    } catch (err) {
        console.error("Unit Mix Dashboard Error:", err);
    }

    document.getElementById('stat-rooms').textContent = d.rooms.length;
    document.getElementById('stat-hubs').textContent = d.hubs.length;
    document.getElementById('stat-violations').textContent = d.violations.length;
    document.getElementById('stat-area').textContent = d.rooms.filter(r => r.label !== 'Shaft').reduce((s, r) => s + r.area, 0).toFixed(0);
    const badge = document.getElementById('violation-badge');
    if (badge) {
        badge.textContent = d.violations.length; 
        badge.className = 'violation-count ' + (d.violations.length === 0 ? 'clean' : '');
    }
    const list = document.getElementById('violations-list');
    if (list) {
        if (d.violations.length === 0) { 
            list.innerHTML = `<div class="empty-state"><div class="big-icon">✅</div><p>All rooms comply with Egyptian Building Code.</p></div>`; 
        } else {
            list.innerHTML = '';
            d.violations.forEach((v, i) => {
                const card = document.createElement('div');
                card.className = 'violation-card';
                card.style.animationDelay = `${i * 60}ms`;
                card.innerHTML = `<div class="v-header"><span>⚠</span><span class="v-room">${v.subject || 'Room'}</span><span class="v-severity ${v.type || 'warning'}">${v.type || 'WARNING'}</span></div><div class="v-message">${v.msg || v.message || ''}</div><div class="v-options">${(v.options || []).map(o => `<button class="v-option-btn">${o}</button>`).join('')}</div>`;
                list.appendChild(card);
            });
        }
    }
    const rList = document.getElementById('room-list');
    if (rList) {
        rList.innerHTML = '';
        d.rooms.forEach(r => {
            const item = document.createElement('div');
            item.className = 'room-list-item';
            const swatch = document.createElement('div');
            swatch.className = 'room-color-swatch';
            swatch.style.background = Array.isArray(r.fill) ? 'rgb(' + r.fill.join(',') + ')' : (r.fill || '#ccc');
            const info = document.createElement('span');
            info.className = 'room-info';
            info.textContent = r.label;
            const meta = document.createElement('span');
            meta.className = 'room-meta';
            meta.textContent = `${r.area} m²`;
            item.appendChild(swatch);
            item.appendChild(info);
            item.appendChild(meta);
            rList.appendChild(item);
        });
    }
    // Staircase info panel — Full Egyptian Code
    if (d.staircase) {
        const sc = d.staircase, el = document.getElementById('stair-info');
        const cd = sc.code || {};
        const rOk = sc.riserOk !== undefined ? sc.riserOk : (sc.riser <= 0.17);
        const tOk = sc.treadOk !== undefined ? sc.treadOk : (sc.tread >= 0.27);
        const bOk = sc.blondelOk !== undefined ? sc.blondelOk : true;
        const wOk = sc.widthOk !== undefined ? sc.widthOk : (sc.stairWidth >= 1.10);
        const fOk = sc.maxRisersOk !== undefined ? sc.maxRisersOk : true;
        const blondel = sc.blondel || (2 * (sc.riser || 0) + (sc.tread || 0));

        const flArr = sc.flights || [];
        const flightsStr = flArr.length > 0 ? flArr.join('+') : 'Auto';
        const sW = sc.stairWidth || (sc.total_width / 2) || 1.1;

        el.innerHTML = `
            <div class="si-row si-row-stairs">🏛 السلم — الكود المصري</div>
            <div class="si-row"><span class="si-label">Risers (درجات)</span><span class="si-val">${sc.numRisers || '-'} (${flightsStr})</span></div>
            <div class="si-row"><span class="si-label">Riser H (القائمة)</span><span class="si-val ${rOk ? 'si-ok' : 'si-warn'}">${((sc.riser || 0.17) * 100).toFixed(1)}cm ${rOk ? '✓' : '⚠'} <small>max ${cd.maxRiser || 17}cm</small></span></div>
            <div class="si-row"><span class="si-label">Tread D (النائمة)</span><span class="si-val ${tOk ? 'si-ok' : 'si-warn'}">${((sc.tread || 0.27) * 100).toFixed(1)}cm ${tOk ? '✓' : '⚠'} <small>min ${cd.minTread || 27}cm</small></span></div>
            <div class="si-row"><span class="si-label">2R+T (Blondel)</span><span class="si-val ${bOk ? 'si-ok' : 'si-warn'}">${((blondel || 0.62) * 100).toFixed(1)}cm ${bOk ? '✓' : '⚠'} <small>target 62cm</small></span></div>
            <div class="si-row"><span class="si-label">Flights (قلبات)</span><span class="si-val ${fOk ? 'si-ok' : 'si-warn'}">${sc.numFlights || flArr.length || 2} ${fOk ? '✓' : '⚠'} <small>max 14/flight</small></span></div>
            <div class="si-row"><span class="si-label">Width (عرض)</span><span class="si-val ${wOk ? 'si-ok' : 'si-warn'}">${(sW * 100).toFixed(0)}cm ${wOk ? '✓' : '⚠'} <small>min ${cd.minWidth || 120}cm</small></span></div>
            <div class="si-row"><span class="si-label">Landing (بسطة)</span><span class="si-val">${sc.landingDepth ? (sc.landingDepth * 100).toFixed(0) + 'cm' : '—'} <small>≥ stair width</small></span></div>
            <div class="si-row"><span class="si-label">Headroom</span><span class="si-val">${sc.headroom || 2.10}m <small>min 2.10m</small></span></div>
            <div class="si-row"><span class="si-label">Handrail</span><span class="si-val">${cd.handrailHeight || 90}cm <small>min 90cm</small></span></div>
            <div class="si-row"><span class="si-label">Max Travel</span><span class="si-val">${cd.maxTravelDist || 25}m <small>fire code</small></span></div>
            <div class="si-row"><span class="si-label">Type</span><span class="si-val">${sc.type || 'u-shape'}</span></div>
            <div class="si-row"><span class="si-label">Area</span><span class="si-val">${sc.area || '—'} m²</span></div>`;
    }
    // Elevator info panel
    const elevEl = document.getElementById('elevator-info');
    if (d.elevator) {
        const ev = d.elevator;
        elevEl.innerHTML = `
            <div class="si-row si-row-elev">🛗 المصعد — الكود المصري</div>
            <div class="si-row"><span class="si-label">Required</span><span class="si-val ${ev.required !== false ? 'si-ok' : 'si-warn'}">${ev.required !== false ? 'YES ✓' : 'NO'} <small>>&thinsp;4 floors</small></span></div>
            <div class="si-row"><span class="si-label">Type</span><span class="si-val">${ev.type || 'passenger-ebc'}</span></div>
            <div class="si-row"><span class="si-label">Shaft</span><span class="si-val">${ev.shaftW || 1.6}m × ${ev.shaftD || 1.8}m</span></div>
            <div class="si-row"><span class="si-label">Cabin</span><span class="si-val">${ev.cabinW || 1.1}m × ${ev.cabinD || 1.4}m</span></div>
            <div class="si-row"><span class="si-label">Pit Depth</span><span class="si-val">${ev.pitDepth || 1.20}m <small>min 1.20m</small></span></div>
            <div class="si-row"><span class="si-label">Overhead</span><span class="si-val">${ev.overhead || 3.60}m <small>min 3.60m</small></span></div>
            <div class="si-row"><span class="si-label">Area</span><span class="si-val">${ev.area || '—'} m²</span></div>`;
    } else {
        elevEl.innerHTML = '<div class="si-row si-row-elev-muted">🛗 Elevator not required (≤4 floors)</div>';
    }
    // === URBAN METRICS PANEL ===
    if (d.economics && d.economics.grossBUA !== undefined) {
        const e = d.economics;
        const g = e.grossBUA || 1;

        // 1. Top Highlights
        document.getElementById('econ-gross').textContent = e.grossBUA.toFixed(0) + ' m²';
        document.getElementById('econ-net').textContent = e.netUsable.toFixed(0) + ' m²';

        // 2. Category Progress Bars
        const updateCategory = (id, val, barId) => {
            const el = document.getElementById(id);
            const bar = document.getElementById(barId);
            if (el) el.textContent = val.toFixed(0) + ' m²';
            if (bar) bar.style.width = Math.min(100, (val / g) * 100) + '%';
        };

        updateCategory('econ-stair', e.stairArea, 'bar-core');
        updateCategory('econ-units', e.unitsArea || e.netUsable, 'bar-units');
        updateCategory('econ-circ', e.circArea, 'bar-corridor');
        updateCategory('econ-balc', e.balconyArea || 0, 'bar-balcony');

        // 3. Urban Visualization
        const nfValue = document.getElementById('num-floors').value;
        const fhValue = document.getElementById('floor-height').value;
        const hDisp = document.getElementById('nf-val-display');
        if (hDisp) hDisp.textContent = (nfValue * fhValue).toFixed(1) + ' m';

        const fPrint = document.getElementById('econ-footprint');
        if (fPrint) fPrint.textContent = (e.footprintArea || e.grossBUA).toFixed(0) + ' m²';

        // 4. Residential Donut Mix
        const unitCounts = {};
        let totalRes = 0;
        (d.rooms || []).forEach(r => {
            const lab = r.label || "";
            if (lab.includes("Studio") || lab.includes("Bedroom") || lab.startsWith("Unit")) {
                const type = lab.includes("Studio") ? "Studio" :
                    lab.includes("1 Bedroom") ? "1 Bedroom" :
                        lab.includes("2 Bedroom") ? "2 Bedroom" :
                            lab.includes("3 Bedroom") ? "3 Bedroom" : "Studio";
                unitCounts[type] = (unitCounts[type] || 0) + 1;
                totalRes++;
            }
        });

        const legend = document.getElementById('donut-legend');
        const donutSeg = document.getElementById('donut-segment');
        if (legend && totalRes > 0) {
            let html = '';
            const types = ["Studio", "1 Bedroom", "2 Bedroom", "3 Bedroom"];
            const colors = ["var(--color-studio)", "var(--color-1bed)", "var(--color-2bed)", "var(--color-3bed)"];

            let cumPct = 0;
            types.forEach((t, i) => {
                if (unitCounts[t]) {
                    const pct = Math.round((unitCounts[t] / totalRes) * 100);
                    html += `<div class="legend-item"><span><i class="legend-dot" style="background:${colors[i]}"></i> ${t}</span> <b>${pct}%</b></div>`;
                    // Match dominant segment color/width
                    if (pct > cumPct) {
                        if (donutSeg) {
                            donutSeg.setAttribute('stroke-dasharray', `${pct} ${100 - pct}`);
                            donutSeg.setAttribute('stroke', colors[i]);
                            cumPct = pct;
                        }
                    }
                }
            });
            legend.innerHTML = html;
        }
    }
    // === DECISION MATRIX ===
    const dSec = document.getElementById('section-advisor');
    const dList = document.getElementById('decision-list');
    if (d.decisions && d.decisions.length > 0) {
        if (dSec) {
            dSec.classList.remove('decision-hidden');
            dSec.style.display = 'block';
        }
        dList.innerHTML = d.decisions.map(dec => `
            <div class="decision-card">
                <div class="dc-title">${dec.title}</div>
                <div class="dc-context">${dec.context}</div>
                ${dec.options.map(opt => `
                    <div class="dc-option">
                        <div>
                            <div class="dc-opt-label">${opt.label}</div>
                            <div class="dc-opt-desc">${opt.desc}</div>
                            <span class="dc-opt-tag ${opt.tagClass}">${opt.tag}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `).join('');
    } else {
        dSec.style.display = 'none';
        dList.innerHTML = '';
    }
}

// --- AutoFit ---
