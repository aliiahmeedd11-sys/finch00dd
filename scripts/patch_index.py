import re

with open('d:/work/finch/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Pattern for style attribute matching anything except ${
# Actually, let's just use manual dictionary to be very secure.
replacements = [
    ('style="border: 1px solid var(--accent); margin: 12px 10px; border-radius: 8px; background: rgba(88, 166, 255, 0.03);"', 'class="section unit-mix-dashboard-container"'),
    ('style="width: 40%;"', 'class="col-type-width"'),
    ('style="text-align:center;color:var(--text-muted);padding:12px;"', 'class="table-waiting-cell"'),
    ('style="margin-bottom: 12px;"', 'class="prec-toggles prec-toggles-mb"'),
    ('style="display:none; background: linear-gradient(135deg, #a371f7, #58a6ff);"', 'class="btn-action btn-lot btn-lot-gradient"'),
    ('style="margin-top:14px"', 'class="section-title section-title-mt"'),
    ('style="margin-bottom: 8px;"', 'class="slider-group slider-group-mb"'),
    ('style="width: 100%; background: var(--bg-primary); border: 1px solid var(--border); color: var(--text-primary); padding: 8px; border-radius: 6px; font-family: var(--font-mono); font-size: 11px;"', 'class="api-host-input"'),
    ('style="display: flex; gap: 6px;"', 'class="d-flex-gap6"'),
    ('style="background: var(--bg-tertiary); font-size: 11px; padding: 6px; flex: 1; margin-top: 0;"', 'class="btn-action btn-tertiary-flex"'),
    ('style="font-size: 10px; margin-top: 6px; color: var(--text-muted); font-family: var(--font-mono);"', 'id="host-status" class="host-status-msg"'),
    ('style="margin-top:6px;border-top:1px solid var(--border);padding-top:6px"', 'class="stair-info elevator-info-mt"'),
    ('style="background: var(--bg-card); border: 1px solid var(--accent); color: var(--accent); margin-top: 0;"', 'class="btn-action btn-adv-mixer"'),
    ('style="margin-top: 8px;"', 'class="grid-info grid-info-mt"'),
    ('style="width:0%;background:var(--success)"', 'class="econ-bar-fill econ-bar-start"'),
    ('style="display:none"', 'class="section decision-hidden"'),
    ('style="border-color:var(--success); color:var(--success)"', 'class="tb-all-success"'),
    ('style="margin-left:8px; border-color:#d29922; color:#d29922;"', 'class="active tb-zoning-warn"'),
    ('style="color: #58a6ff; border-color: #58a6ff;"', 'class="btn-export-dxf-blue"'),
    ('style="background:#3fb950"', 'class="circ-dot circ-green"'),
    ('style="background:#d29922"', 'class="circ-dot circ-yellow"'),
    ('style="background:#f85149"', 'class="circ-dot circ-red"'),
    ('style="margin-top: 16px; border-top: 1px solid var(--border); padding-top: 12px;"', 'class="mc-group mc-group-mt"'),
    ('style="font-weight:600;color:var(--accent)"', 'class="si-row si-row-stairs"'),
    ('style="font-weight:600;color:#d29922"', 'class="si-row si-row-elev"'),
    ('style="color:var(--text-muted)"', 'class="si-row si-row-elev-muted"'),
    ('style="display: flex; justify-content: flex-end; padding: 0 20px 10px 0;"', 'class="d-flex-end-pad"'),
    ('style="width: auto; padding: 8px 16px; margin: 0;"', 'class="btn-reset-mix"'),
]

# Note: Some classes are combined with existing classes, so I will do exact string matching based on the previous lines.
file_replacements = [
    ('class="section" id="unit-mix-dashboard"\n            style="border: 1px solid var(--accent); margin: 12px 10px; border-radius: 8px; background: rgba(88, 166, 255, 0.03);"',
     'class="section unit-mix-dashboard-container" id="unit-mix-dashboard"'),
    ('<th style="width: 40%;">Type</th>', '<th class="col-type-width">Type</th>'),
    ('colspan="4" style="text-align:center;color:var(--text-muted);padding:12px;"', 'colspan="4" class="table-waiting-cell"'),
    ('class="prec-toggles" style="margin-bottom: 12px;"', 'class="prec-toggles prec-toggles-mb"'),
    ('class="btn-action btn-lot" id="btn-lot"\n                style="display:none; background: linear-gradient(135deg, #a371f7, #58a6ff);"', 'class="btn-action btn-lot btn-lot-gradient" id="btn-lot"'),
    ('class="section-title" style="margin-top:14px"', 'class="section-title section-title-mt"'),
    ('class="slider-group" style="margin-bottom: 8px;"', 'class="slider-group slider-group-mb"'),
    ('style="width: 100%; background: var(--bg-primary); border: 1px solid var(--border); color: var(--text-primary); padding: 8px; border-radius: 6px; font-family: var(--font-mono); font-size: 11px;"', 'class="api-host-input"'),
    ('<div style="display: flex; gap: 6px;">', '<div class="d-flex-gap6">'),
    ('class="btn-action" id="btn-update-host"\n                    style="background: var(--bg-tertiary); font-size: 11px; padding: 6px; flex: 1; margin-top: 0;"', 'class="btn-action btn-tertiary-flex" id="btn-update-host"'),
    ('class="btn-action" id="btn-test-host"\n                    style="background: var(--bg-tertiary); font-size: 11px; padding: 6px; flex: 1; margin-top: 0;"', 'class="btn-action btn-tertiary-flex" id="btn-test-host"'),
    ('id="host-status"\n                style="font-size: 10px; margin-top: 6px; color: var(--text-muted); font-family: var(--font-mono);"', 'id="host-status" class="host-status-msg"'),
    ('class="stair-info" id="elevator-info"\n                style="margin-top:6px;border-top:1px solid var(--border);padding-top:6px"', 'class="stair-info elevator-info-mt" id="elevator-info"'),
    ('class="btn-action" id="btn-open-mixer"\n                style="background: var(--bg-card); border: 1px solid var(--accent); color: var(--accent); margin-top: 0;"', 'class="btn-action btn-adv-mixer" id="btn-open-mixer"'),
    ('class="grid-info" style="margin-top: 8px;"', 'class="grid-info grid-info-mt"'),
    ('class="econ-bar-fill" id="econ-bar" style="width:0%;background:var(--success)"', 'class="econ-bar-fill econ-bar-start" id="econ-bar"'),
    ('class="section" id="decision-section" style="display:none"', 'class="section decision-hidden" id="decision-section"'),
    ('id="tb-all" style="border-color:var(--success); color:var(--success)"', 'id="tb-all" class="tb-all-success"'),
    ('id="tb-zoning" class="active" style="margin-left:8px; border-color:#d29922; color:#d29922;"', 'id="tb-zoning" class="active tb-zoning-warn"'),
    ('id="btn-export-dxf" style="color: #58a6ff; border-color: #58a6ff;"', 'id="btn-export-dxf" class="btn-export-dxf-blue"'),
    ('class="circ-dot" style="background:#3fb950"', 'class="circ-dot circ-green"'),
    ('class="circ-dot" style="background:#d29922"', 'class="circ-dot circ-yellow"'),
    ('class="circ-dot" style="background:#f85149"', 'class="circ-dot circ-red"'),
    ('class="mc-group" style="margin-top: 16px; border-top: 1px solid var(--border); padding-top: 12px;"', 'class="mc-group mc-group-mt"'),
    ('class="si-row" style="font-weight:600;color:var(--accent)"', 'class="si-row si-row-stairs"'),
    ('class="si-row" style="font-weight:600;color:#d29922"', 'class="si-row si-row-elev"'),
    ('class="si-row" style="color:var(--text-muted)"', 'class="si-row si-row-elev-muted"'),
    ('<div style="display: flex; justify-content: flex-end; padding: 0 20px 10px 0;">', '<div class="d-flex-end-pad">'),
    ('style="width: auto; padding: 8px 16px; margin: 0;"', 'class="btn-reset-mix"'),
]

css_block = """
        /* EXTRACTED INLINE STYLES */
        .unit-mix-dashboard-container { border: 1px solid var(--accent); margin: 12px 10px; border-radius: 8px; background: rgba(88, 166, 255, 0.03); }
        .col-type-width { width: 40%; }
        .table-waiting-cell { text-align:center; color:var(--text-muted); padding:12px; }
        .prec-toggles-mb { margin-bottom: 12px; }
        .btn-lot-gradient { display:none; background: linear-gradient(135deg, #a371f7, #58a6ff); }
        .section-title-mt { margin-top:14px; }
        .slider-group-mb { margin-bottom: 8px; }
        .api-host-input { width: 100%; background: var(--bg-primary); border: 1px solid var(--border); color: var(--text-primary); padding: 8px; border-radius: 6px; font-family: var(--font-mono); font-size: 11px; }
        .d-flex-gap6 { display: flex; gap: 6px; }
        .btn-tertiary-flex { background: var(--bg-tertiary); font-size: 11px; padding: 6px; flex: 1; margin-top: 0; }
        .host-status-msg { font-size: 10px; margin-top: 6px; color: var(--text-muted); font-family: var(--font-mono); }
        .elevator-info-mt { margin-top:6px; border-top:1px solid var(--border); padding-top:6px; }
        .btn-adv-mixer { background: var(--bg-card); border: 1px solid var(--accent); color: var(--accent); margin-top: 0; }
        .grid-info-mt { margin-top: 8px; }
        .econ-bar-start { width:0%; background:var(--success); }
        .decision-hidden { display:none; }
        .tb-all-success { border-color:var(--success); color:var(--success); }
        .tb-zoning-warn { margin-left:8px; border-color:#d29922; color:#d29922; }
        .btn-export-dxf-blue { color: #58a6ff; border-color: #58a6ff; }
        .circ-green { background:#3fb950; }
        .circ-yellow { background:#d29922; }
        .circ-red { background:#f85149; }
        .mc-group-mt { margin-top: 16px; border-top: 1px solid var(--border); padding-top: 12px; }
        .si-row-stairs { font-weight:600; color:var(--accent); }
        .si-row-elev { font-weight:600; color:#d29922; }
        .si-row-elev-muted { color:var(--text-muted); }
        .d-flex-end-pad { display: flex; justify-content: flex-end; padding: 0 20px 10px 0; }
        .btn-reset-mix { background: var(--bg-card); border: 1px solid var(--border); color: var(--text-primary); cursor: pointer; border-radius: 6px; width: auto; padding: 8px 16px; margin: 0; }
    </style>
"""

for old, new in file_replacements:
    html = html.replace(old, new)


# Insert CSS rules
html = html.replace('    </style>', css_block)

with open('d:/work/finch/index.html', 'w', encoding='utf-8') as f:
    f.write(html)
