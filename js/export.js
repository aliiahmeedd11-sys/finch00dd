/* export.js - Finch Parametric Architecture Engine */

document.getElementById('btn-export-dxf').addEventListener('click', () => {
    if (!S.data) return;
    const d = S.data;
    let dxf = `0\nSECTION\n2\nENTITIES\n`;

    // Helper to draw lines in DXF (Y is inverted for CAD standard)
    const addLine = (p1, p2, layer, color) => {
        dxf += `0\nLINE\n8\n${layer}\n62\n${color}\n10\n${p1[0].toFixed(3)}\n20\n${-p1[1].toFixed(3)}\n11\n${p2[0].toFixed(3)}\n21\n${-p2[1].toFixed(3)}\n`;
    };

    // Export Rooms (Layer: A-WALL)
    d.rooms.forEach(r => {
        for (let i = 0; i < r.boundary.length; i++) {
            addLine(r.boundary[i], r.boundary[(i + 1) % r.boundary.length], 'A-WALL', 7);
        }
    });

    // Export Corridors (Layer: A-CIRC)
    d.corridors.forEach(c => {
        for (let i = 0; i < c.length; i++) addLine(c[i], c[(i + 1) % c.length], 'A-CIRC', 8);
    });

    // Export Doors & Windows (Layers: A-DOOR, A-GLAZ)
    if (d.doors) d.doors.forEach(dr => addLine(dr.p1, dr.p2, 'A-DOOR', 2));
    if (d.windows) d.windows.forEach(w => addLine(w.p1, w.p2, 'A-GLAZ', 4));

    dxf += `0\nENDSEC\n0\nEOF\n`;

    // Trigger Download
    const blob = new Blob([dxf], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Finch_Generated_Plan.dxf';
    a.click();
    URL.revokeObjectURL(url);
});

// --- Init ---
resize();
canvas.style.cursor = 'default';
updateSpineDisplay();
draw();
