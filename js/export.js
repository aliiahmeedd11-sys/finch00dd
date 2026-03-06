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

      const res = await resp.json();

      if (res.status === "success") {
        btn.textContent = "✅ Downloaded";
        // Download the perfectly formatted ezdxf file directly from the server
        const downloadUrl = S.serverUrl + "/" + res.filename;
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = res.filename.split("/").pop();
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        throw new Error(res.error || "Export failed on server.");
      }
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
