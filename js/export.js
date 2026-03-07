/* export.js - Finch Parametric Architecture Engine */

document
  .getElementById("btn-export-cad")
  .addEventListener("click", async () => {
    if (!S.data) return;
    const btn = document.getElementById("btn-export-cad");
    const oldTxt = btn.textContent;
    btn.textContent = "⏳ Exporting CAD...";
    btn.disabled = true;

    try {
      const resp = await fetch(S.serverUrl + "/api/export_dwg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(S.data),
      });

      if (!resp.ok) throw new Error("Export failed on server.");

      const blob = await resp.blob();
      btn.textContent = "✅ Downloaded";

      // Extract filename from header if possible
      const disposition = resp.headers.get("Content-Disposition");
      let filename = "Finch_CAD_Export.dxf";
      if (disposition && disposition.indexOf("filename=") !== -1) {
        filename = disposition.split("filename=")[1].replace(/"/g, "");
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Back-end export failed:", e);
      alert("Failed to generate CAD. Please check server connection.");
      btn.textContent = "❌ Failed";
    }

    setTimeout(() => {
      btn.textContent = oldTxt;
      btn.disabled = false;
    }, 2000);
  });

// --- Init ---
resize();
canvas.style.cursor = "default";
updateSpineDisplay();
