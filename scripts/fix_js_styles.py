import os

filepath = 'd:/work/finch/index.html'

with open(filepath, 'r', encoding='utf-8') as f:
    html = f.read()

# Fix 1: select tag inline style
html = html.replace(
    '''<select class="mc-select" onchange="updateMixerVal(${c.id}, 'type', this.value)" style="width: 130px; border-color:${c.color}; border-width: 2px;">''',
    '''<select class="mc-select mc-select-color" onchange="updateMixerVal(${c.id}, 'type', this.value)" id="mc-sel-${c.id}">'''
)

html = html.replace(
    '''        `;
                container.appendChild(card);
            });
            container.appendChild(addBtn);''',
    '''        `;
                container.appendChild(card);
                const sel = document.getElementById(`mc-sel-${c.id}`);
                if (sel) sel.style.borderColor = c.color;
            });
            container.appendChild(addBtn);'''
)

# Fix 2: violation-card inline style
# Replace the one-liner with actual element generation for d.violations
old_violations = '''            else { list.innerHTML = d.violations.map((v, i) => `<div class="violation-card" style="animation-delay:${i * 60}ms"><div class="v-header"><span>⚠</span><span class="v-room">${v.subject || 'Room'}</span><span class="v-severity ${v.type || 'warning'}">${v.type || 'WARNING'}</span></div><div class="v-message">${v.msg || v.message || ''}</div><div class="v-options">${(v.options || []).map(o => `<button class="v-option-btn">${o}</button>`).join('')}</div></div>`).join(''); }'''

new_violations = '''            else { 
                list.innerHTML = '';
                d.violations.forEach((v, i) => {
                    const card = document.createElement('div');
                    card.className = 'violation-card';
                    card.style.animationDelay = `${i * 60}ms`;
                    card.innerHTML = `<div class="v-header"><span>⚠</span><span class="v-room">${v.subject || 'Room'}</span><span class="v-severity ${v.type || 'warning'}">${v.type || 'WARNING'}</span></div><div class="v-message">${v.msg || v.message || ''}</div><div class="v-options">${(v.options || []).map(o => `<button class="v-option-btn">${o}</button>`).join('')}</div>`;
                    list.appendChild(card);
                });
            }'''
html = html.replace(old_violations, new_violations)

# Fix 3: room-color-swatch inline style
old_rooms = '''            document.getElementById('room-list').innerHTML = d.rooms.map(r => `<div class="room-list-item"><div class="room-color-swatch" style="background:${Array.isArray(r.fill) ? 'rgb(' + r.fill.join(',') + ')' : (r.fill || '#ccc')}"></div><span class="room-info">${r.label}</span><span class="room-meta">${r.area} m²</span></div>`).join('');'''

new_rooms = '''            const rList = document.getElementById('room-list');
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
            });'''
html = html.replace(old_rooms, new_rooms)

# Add .mc-select-color CSS if we don't already have it
if ".mc-select-color" not in html:
    html = html.replace("</style>", ".mc-select-color { width: 130px; border-width: 2px; }\n    </style>")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(html)
