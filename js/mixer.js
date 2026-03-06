/* mixer.js - Finch Parametric Architecture Engine */

const typeLabels = { studio: 'Studio', bed1: '1 Bedroom', bed2: '2 Bedroom', bed3: '3 Bedroom' };
let mixCardIdCounter = 5;

function renderMixerCards() {
    const container = document.getElementById('mixer-cards-container');
    const addBtn = document.getElementById('btn-add-card');
    container.innerHTML = '';

    const totalMix = S.unitMixConfig.reduce((s, c) => s + c.mix, 0) || 100;

    S.unitMixConfig.forEach(c => {
        const card = document.createElement('div');
        card.className = 'mixer-card';
        card.style.setProperty('--card-accent', c.color);

        card.innerHTML = `
            <div class="mc-header">
                <div class="mc-title-group">
                    <div class="mc-dot" style="background:${c.color}"></div>
                    <div class="mc-title">Unit Configuration</div>
                </div>
                <button class="btn-del" style="background:transparent; border:none; color:#cf6679; cursor:pointer; font-size:10px; font-weight:700" onclick="deleteMixerCard(${c.id})">REMOVE</button>
            </div>
            
            <div class="mc-item">
                <label>Unit Type</label>
                <select class="mc-select" onchange="updateMixerVal(${c.id}, 'type', this.value)" style="border-left: 3.5px solid ${c.color}">
                    <option value="studio" ${c.type === 'studio' ? 'selected' : ''}>Studio</option>
                    <option value="bed1" ${c.type === 'bed1' ? 'selected' : ''}>1 Bedroom</option>
                    <option value="bed2" ${c.type === 'bed2' ? 'selected' : ''}>2 Bedroom</option>
                    <option value="bed3" ${c.type === 'bed3' ? 'selected' : ''}>3 Bedroom</option>
                </select>
            </div>

            <div class="mc-section-title">SPATIAL METRICS</div>
            <div class="mc-grid">
                <div class="mc-item">
                    <label>Target m²</label>
                    <input class="mc-input" type="number" value="${c.size}" onchange="updateMixerVal(${c.id}, 'size', this.value)" min="10" step="5">
                </div>
                <div class="mc-item">
                    <label>Mix %</label>
                    <input class="mc-input" type="number" value="${c.mix}" onchange="updateMixerVal(${c.id}, 'mix', this.value)" min="0" max="100" step="1">
                </div>
            </div>

            <div class="mc-section-title">BALCONY RULE</div>
            <div class="mc-item">
                <label>Alignment</label>
                <select class="mc-select" onchange="updateMixerVal(${c.id}, 'balcAlign', this.value)">
                    <option value="center" ${c.balcAlign === 'center' ? 'selected' : ''}>Center</option>
                    <option value="left" ${c.balcAlign === 'left' ? 'selected' : ''}>Left</option>
                    <option value="right" ${c.balcAlign === 'right' ? 'selected' : ''}>Right</option>
                    <option value="full" ${c.balcAlign === 'full' ? 'selected' : ''}>Full</option>
                    <option value="none" ${c.balcAlign === 'none' ? 'selected' : ''}>None</option>
                </select>
            </div>
            
            <div class="mc-grid">
                <div class="mc-item">
                    <label>Depth (m)</label>
                    <input class="mc-input" type="number" value="${c.balcLen}" onchange="updateMixerVal(${c.id}, 'balcLen', this.value)" min="0" step="0.1">
                </div>
                <div class="mc-item">
                    <label>Start Off.</label>
                    <input class="mc-input" type="number" value="${c.balcOffsetSt}" onchange="updateMixerVal(${c.id}, 'balcOffsetSt', this.value)" min="0" step="0.5">
                </div>
            </div>
        `;
        container.appendChild(card);
    });
    container.appendChild(addBtn);

    // --- Stats & Charts ---
    const statsList = document.getElementById('mixer-stats-list');
    statsList.innerHTML = '';

    const pieSvg = document.getElementById('mixer-pie-svg');
    pieSvg.innerHTML = '';

    let currentRotation = 0;
    let totalUnits = 0;
    if (S.data && S.data.rooms) {
        totalUnits = S.data.rooms.filter(r => r.label && !r.label.includes('Shaft') && !r.label.includes('Envelope')).length;
    }
    document.getElementById('pie-total-units').textContent = totalUnits;

    S.unitMixConfig.forEach(c => {
        const pct = (c.mix / totalMix) * 100;
        if (pct <= 0) return;

        // 1. Render Pie Segment
        const radius = 15.9155;
        const circumference = 2 * Math.PI * radius;
        const dashArray = `${(pct * circumference) / 100} ${circumference}`;

        const segment = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        segment.setAttribute('class', 'pie-segment');
        segment.setAttribute('cx', '21');
        segment.setAttribute('cy', '21');
        segment.setAttribute('r', radius.toString());
        segment.setAttribute('stroke', c.color);
        segment.setAttribute('stroke-dasharray', dashArray);
        segment.setAttribute('stroke-dashoffset', (-currentRotation * circumference / 100).toString());
        pieSvg.appendChild(segment);

        currentRotation += pct;

        // 2. Render Side Stat Row
        const row = document.createElement('div');
        row.className = 'side-stat-row';

        const typeName = typeLabels[c.type];
        const actualCount = S.data && S.data.rooms ? S.data.rooms.filter(r => r.label === typeName).length : 0;
        const actualPct = totalUnits > 0 ? (actualCount / totalUnits) * 100 : 0;

        row.innerHTML = `
            <div class="stat-top">
                <div class="stat-info">
                    <div class="stat-dot" style="background:${c.color}"></div>
                    <div>
                        <div class="stat-name">${typeName}</div>
                        <div class="stat-pct">Target: ${pct.toFixed(0)}%</div>
                    </div>
                </div>
                <div style="text-align:right">
                    <div class="stat-num" style="color:${c.color}">${actualCount} <span style="font-size:10px; opacity:0.6; font-family:var(--font-mono)">Units</span></div>
                    <div class="stat-pct">${actualPct.toFixed(1)}% Actual</div>
                </div>
            </div>
            <div class="actual-progress-container">
                <div class="actual-progress-fill" style="width:${Math.min(actualPct, 100)}%; background:${c.color}"></div>
            </div>
        `;
        statsList.appendChild(row);
    });

    // 3. Render Bottom Linear Tracker (Graph below it)
    const bar = document.getElementById('mix-track-bar');
    const labels = document.getElementById('mix-track-labels');
    bar.innerHTML = '';
    labels.innerHTML = '';

    S.unitMixConfig.forEach(c => {
        const pct = (c.mix / totalMix) * 100;
        if (pct > 0) {
            const seg = document.createElement('div');
            seg.className = 'track-seg';
            seg.style.width = `${pct}%`;
            seg.style.background = c.color;
            seg.title = `${typeLabels[c.type]} - ${pct.toFixed(1)}%`;
            bar.appendChild(seg);

            const lab = document.createElement('div');
            lab.className = 'track-label-item';
            lab.style.flex = `${pct}`;
            lab.innerHTML = `<span>${typeLabels[c.type].toUpperCase().replace(" BEDROOM", " BED")}</span><span>${pct.toFixed(0)}%</span>`;
            labels.appendChild(lab);
        }
    });
}

window.updateMixerVal = function (id, key, val) {
    const card = S.unitMixConfig.find(c => c.id === id);
    if (card) {
        card[key] = (key === 'type' || key === 'balcAlign') ? val : +val;
        if (key === 'type') {
            if (val === 'studio') card.color = '#FACC15'; // Studio Yellow
            if (val === 'bed1') card.color = '#4ADE80';   // 1B Green
            if (val === 'bed2') card.color = '#60A5FA';   // 2B Blue
            if (val === 'bed3') card.color = '#F472B6';   // 3B Pink
        }
        renderMixerCards();
        if (S.genMode === 'spine' && S.customSpine.length >= 2) generate();
    }
};

window.deleteMixerCard = function (id) {
    S.unitMixConfig = S.unitMixConfig.filter(c => c.id !== id);
    renderMixerCards();
    if (S.genMode === 'spine' && S.customSpine.length >= 2) generate();
};

// Attach listeners when DOM is ready
setTimeout(() => {
    const addBtn = document.getElementById('btn-add-card');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            S.unitMixConfig.push({
                id: ++mixCardIdCounter, type: 'studio', size: 45, mix: 10, balcAlign: 'center', balcLen: 2.0, balcOffsetSt: 0.0, balcOffsetEn: 0.0, color: '#ffebcd'
            });
            renderMixerCards();
        });
    }

    const modal = document.getElementById('unit-mixer-modal');
    const openBtn = document.getElementById('btn-open-mixer');
    const closeBtn = document.getElementById('btn-close-mixer');
    if (openBtn) {
        openBtn.addEventListener('click', () => {
            renderMixerCards();
            modal.classList.add('visible');
        });
    }
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('visible');
            generate(); // Apply changes back to model
        });
    }
    const btnResetMixer = document.getElementById('btn-reset-mixer');
    if (btnResetMixer) {
        btnResetMixer.addEventListener('click', () => {
            S.unitMixConfig = [
                { id: 1, type: 'studio', size: 45, mix: 26, balcAlign: 'center', balcLen: 2.0, balcOffsetSt: 0.0, balcOffsetEn: 0.0, color: '#FACC15' },
                { id: 2, type: 'bed1', size: 60, mix: 46, balcAlign: 'center', balcLen: 2.0, balcOffsetSt: 0.0, balcOffsetEn: 0.0, color: '#4ADE80' },
                { id: 3, type: 'bed2', size: 70, mix: 25, balcAlign: 'center', balcLen: 2.0, balcOffsetSt: 0.0, balcOffsetEn: 0.0, color: '#60A5FA' },
                { id: 4, type: 'bed3', size: 85, mix: 3, balcAlign: 'center', balcLen: 2.0, balcOffsetSt: 0.0, balcOffsetEn: 0.0, color: '#F472B6' }
            ];
            mixCardIdCounter = 5;
            renderMixerCards();
        });
    }

    // --- Server Config ---
    const hostInp = document.getElementById('api-host-url');
    const hostStatus = document.getElementById('host-status');
    if (hostInp) hostInp.value = S.serverUrl;

    document.getElementById('btn-update-host').addEventListener('click', () => {
        S.serverUrl = hostInp.value.trim() || 'http://localhost:8080';
        localStorage.setItem('finch_api_url', S.serverUrl);
        hostStatus.textContent = 'Status: Saved';
        hostStatus.style.color = 'var(--accent)';
    });

    document.getElementById('btn-test-host').addEventListener('click', async () => {
        hostStatus.textContent = 'Status: Pinging...';
        hostStatus.style.color = 'var(--text-muted)';
        try {
            const r = await fetch(S.serverUrl + '/health', { mode: 'cors' });
            if (r.ok) {
                hostStatus.textContent = 'Status: ONLINE (200 OK)';
                hostStatus.style.color = 'var(--success)';
            } else {
                hostStatus.textContent = `Status: ERROR (${r.status})`;
                hostStatus.style.color = 'var(--danger)';
            }
        } catch (e) {
            hostStatus.textContent = 'Status: UNREACHABLE';
            hostStatus.style.color = 'var(--danger)';
        }
    });
}, 500);
