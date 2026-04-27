// Print utility that avoids popup blockers by using a hidden iframe
export function printHTML(htmlContent, options = {}) {
  const { title = "Print", timeout = 100 } = options;
  
  // Create hidden iframe
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position: fixed; right: 0; bottom: 0; width: 1px; height: 1px; border: none; visibility: hidden;";
  document.body.appendChild(iframe);
  
  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; }
        @media print {
          body { padding: 0; }
          .no-print { display: none !important; }
        }
      </style>
    </head>
    <body>
      ${htmlContent}
      <script>
        // Auto-print when loaded
        window.onload = function() {
          setTimeout(function() {
            window.print();
            // Close after print dialog
            setTimeout(function() {
              window.parent.document.body.removeChild(window.frameElement);
            }, 100);
          }, ${timeout});
        };
        // Handle cancel/close
        window.onafterprint = function() {
          window.parent.document.body.removeChild(window.frameElement);
        };
      </script>
    </body>
    </html>
  `);
  doc.close();
}

// Alternative: Print current page content by cloning to hidden div
export function printElement(elementId, options = {}) {
  const { title = "Print", styles = "" } = options;
  const element = document.getElementById(elementId);
  if (!element) {
    console.error("Element not found:", elementId);
    return;
  }
  
  const content = element.innerHTML;
  printHTML(`
    <div class="print-container">
      ${content}
    </div>
    <style>
      .print-container { max-width: 800px; margin: 0 auto; }
      ${styles}
    </style>
  `, { title });
}
