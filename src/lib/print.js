// Print utility — prefers a temporary window (works better on mobile than hidden iframes)
export function printHTML(htmlContent, options = {}) {
  const { title = "Print", timeout = 250 } = options;

  const docHtml = `<!DOCTYPE html>
<html>
<head>
  <title>${String(title).replace(/</g, "&lt;")}</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; color: #111; }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;

  // Try a real window first (user gesture required — callers must invoke from click handlers)
  let printWindow = null;
  try {
    printWindow = window.open("", "_blank", "noopener,noreferrer,width=800,height=900");
  } catch (_) {
    printWindow = null;
  }

  if (printWindow && printWindow.document) {
    printWindow.document.open();
    printWindow.document.write(docHtml);
    printWindow.document.close();
    const trigger = () => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch (e) {
        console.warn("[printHTML] window.print failed", e);
      }
    };
    if (printWindow.document.readyState === "complete") {
      setTimeout(trigger, timeout);
    } else {
      printWindow.onload = () => setTimeout(trigger, timeout);
      setTimeout(trigger, timeout + 200);
    }
    return;
  }

  // Fallback: hidden iframe (some browsers block window.open)
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", title);
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";
  document.body.appendChild(iframe);
  const idoc = iframe.contentWindow?.document;
  if (!idoc) {
    console.error("[printHTML] could not open print frame");
    return;
  }
  idoc.open();
  idoc.write(docHtml + `<script>
    window.onload = function() {
      setTimeout(function() {
        try { window.print(); } catch (e) {}
      }, ${timeout});
    };
  </script>`);
  idoc.close();
  setTimeout(() => {
    try { document.body.removeChild(iframe); } catch (_) {}
  }, 60000);
}

export function printElement(elementId, options = {}) {
  const { title = "Print", styles = "" } = options;
  const element = document.getElementById(elementId);
  if (!element) {
    console.error("Element not found:", elementId);
    return;
  }
  printHTML(
    `<div class="print-container">${element.innerHTML}</div>
     <style>.print-container{max-width:800px;margin:0 auto;} ${styles}</style>`,
    { title }
  );
}
