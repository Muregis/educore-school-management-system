/**
 * Print Document Utility for EduCore
 * Fetches school branding and generates properly branded print documents
 * 
 * Usage:
 * import { printDocument } from '../utils/printDocument';
 * printDocument({ type: 'receipt', data: {...}, authToken });
 */

import { apiFetch } from '../lib/api';

// Cache school settings to avoid repeated fetches
let cachedSchool = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch school branding/settings
 * @param {string} authToken - JWT auth token
 * @returns {Promise<Object>} School settings object
 */
async function fetchSchoolBranding(authToken) {
  const now = Date.now();
  if (cachedSchool && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedSchool;
  }

  try {
    const data = await apiFetch('/settings/school', { token: authToken });
    cachedSchool = {
      name: data.name || data.school_name || 'School',
      logoUrl: data.logo_url || data.logoUrl || '',
      motto: data.motto || data.tagline || '',
      address: data.address || '',
      phone: data.phone || data.school_phone || '',
      email: data.email || data.school_email || '',
      primaryColor: data.primary_color || '#c9a84c',
      secondaryColor: data.secondary_color || '#1f2937',
      term: data.term || data.current_term || '',
      year: data.year || data.academic_year || new Date().getFullYear(),
    };
    cacheTimestamp = now;
    return cachedSchool;
  } catch (err) {
    console.warn('Failed to fetch school branding:', err);
    // Return default branding
    return {
      name: 'School',
      logoUrl: '',
      motto: '',
      address: '',
      phone: '',
      email: '',
      primaryColor: '#c9a84c',
      secondaryColor: '#1f2937',
      term: '',
      year: new Date().getFullYear(),
    };
  }
}

/**
 * Generate print header HTML with school branding
 * @param {Object} school - School branding object
 * @param {string} title - Document title
 * @returns {string} HTML string
 */
function generatePrintHeader(school, title = '') {
  const hasContact = school.address || school.phone || school.email;
  
  return `
    <div class="print-header">
      <div class="print-header-content">
        ${school.logoUrl ? `
          <div class="print-header-logo">
            <img src="${school.logoUrl}" alt="${school.name} logo" onerror="this.style.display='none'" />
          </div>
        ` : ''}
        <div class="print-header-info ${!school.logoUrl ? 'print-header-info-full' : ''}">
          <h1 class="print-header-school-name" style="color: ${school.primaryColor}">${school.name}</h1>
          ${school.motto ? `<p class="print-header-motto">${school.motto}</p>` : ''}
          ${hasContact ? `
            <div class="print-header-contact">
              ${school.address ? `<span>${school.address}</span>` : ''}
              ${school.phone ? `<span>Tel: ${school.phone}</span>` : ''}
              ${school.email ? `<span>Email: ${school.email}</span>` : ''}
            </div>
          ` : ''}
        </div>
      </div>
      ${title ? `<div class="print-header-title">${title}</div>` : ''}
      ${school.term ? `<div class="print-header-term">${school.term} ${school.year}</div>` : ''}
      <div class="print-header-divider" style="background: linear-gradient(90deg, transparent, ${school.primaryColor}, transparent)"></div>
    </div>
  `;
}

/**
 * Generate print styles with school branding
 * @param {Object} school - School branding object
 * @returns {string} CSS string
 */
function generatePrintStyles(school) {
  return `
    <style>
      @page { size: A4; margin: 15mm; }
      .print-document {
        font-family: 'Segoe UI', Arial, sans-serif;
        padding: 20px;
        max-width: 210mm;
        margin: auto;
        color: #1f2937;
        background: white;
        line-height: 1.5;
      }
      .print-header { margin-bottom: 20px; width: 100%; }
      .print-header-content {
        display: flex;
        align-items: center;
        gap: 20px;
        padding-bottom: 16px;
      }
      .print-header-logo { flex-shrink: 0; }
      .print-header-logo img {
        max-width: 80px;
        max-height: 80px;
        object-fit: contain;
        border-radius: 4px;
      }
      .print-header-info { flex: 1; text-align: center; }
      .print-header-info-full { text-align: left; }
      .print-header-school-name {
        font-size: 22px;
        font-weight: 800;
        margin: 0 0 4px 0;
        line-height: 1.2;
      }
      .print-header-motto {
        font-size: 13px;
        font-style: italic;
        color: #6b7280;
        margin: 0 0 8px 0;
      }
      .print-header-contact {
        font-size: 11px;
        color: #6b7280;
        display: flex;
        justify-content: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      .print-header-info-full .print-header-contact { justify-content: flex-start; }
      .print-header-title {
        text-align: center;
        font-size: 16px;
        font-weight: 700;
        color: #374151;
        margin: 12px 0;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      .print-header-term {
        text-align: center;
        font-size: 12px;
        color: #6b7280;
        margin-bottom: 8px;
      }
      .print-header-divider {
        height: 3px;
        margin: 12px 0;
      }
      .print-section { margin: 16px 0; }
      .print-section-title {
        font-size: 14px;
        font-weight: 600;
        color: ${school.primaryColor};
        border-bottom: 1px solid #e5e7eb;
        padding-bottom: 4px;
        margin-bottom: 8px;
      }
      .print-row {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid #f3f4f6;
        font-size: 13px;
      }
      .print-row-label { color: #6b7280; }
      .print-row-value { font-weight: 600; color: #111827; }
      .print-table {
        width: 100%;
        border-collapse: collapse;
        margin: 12px 0;
        font-size: 12px;
      }
      .print-table th {
        background: ${school.primaryColor}15;
        color: ${school.primaryColor};
        font-weight: 600;
        text-align: left;
        padding: 8px;
        border-bottom: 2px solid ${school.primaryColor};
      }
      .print-table td {
        padding: 8px;
        border-bottom: 1px solid #e5e7eb;
      }
      .print-table tr:last-child td { border-bottom: none; }
      .print-footer {
        margin-top: 40px;
        text-align: center;
        font-size: 11px;
        color: #9ca3af;
        border-top: 1px solid #e5e7eb;
        padding-top: 16px;
      }
      .print-stamp {
        margin-top: 24px;
        padding: 8px 16px;
        border: 2px solid ${school.primaryColor};
        border-radius: 4px;
        display: inline-block;
        color: ${school.primaryColor};
        font-weight: 600;
        font-size: 12px;
        text-transform: uppercase;
      }
      .print-signature-line {
        margin-top: 40px;
        display: flex;
        justify-content: space-between;
        gap: 40px;
      }
      .print-signature-box {
        flex: 1;
        text-align: center;
      }
      .print-signature-line-hr {
        border-top: 1px solid #374151;
        margin-bottom: 4px;
        width: 80%;
        margin-left: auto;
        margin-right: auto;
      }
      .print-signature-label {
        font-size: 11px;
        color: #6b7280;
      }
      @media print {
        .print-document { padding: 0; }
        .no-print { display: none !important; }
        .print-header-divider {
          background: ${school.primaryColor} !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .print-stamp {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .print-table th {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        body { background: white !important; color: black !important; }
      }
    </style>
  `;
}

/**
 * Print document using iframe technique (avoids popup blockers)
 * @param {Object} options
 * @param {string} options.type - Document type: 'receipt', 'payslip', 'reportcard', 'statement', 'invoice'
 * @param {Object} options.data - Document data
 * @param {string} options.authToken - JWT auth token
 * @param {string} options.title - Document title
 */
export async function printDocument({ type, data, authToken, title = '' }) {
  const school = await fetchSchoolBranding(authToken);
  
  let content = '';
  switch (type) {
    case 'receipt':
      content = generateReceiptContent(data, school);
      break;
    case 'payslip':
      content = generatePayslipContent(data, school);
      break;
    case 'reportcard':
      content = generateReportCardContent(data, school);
      break;
    case 'statement':
      content = generateStatementContent(data, school);
      break;
    case 'invoice':
      content = generateInvoiceContent(data, school);
      break;
    default:
      content = data?.html || '';
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title || type}</title>
      ${generatePrintStyles(school)}
    </head>
    <body>
      <div class="print-document">
        ${generatePrintHeader(school, title)}
        ${content}
        <div class="print-footer">
          <p>Generated by EduCore School Management System</p>
          <p>${new Date().toLocaleString()}</p>
        </div>
      </div>
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
            setTimeout(function() {
              window.parent.document.body.removeChild(window.frameElement);
            }, 100);
          }, 200);
        };
        window.onafterprint = function() {
          window.parent.document.body.removeChild(window.frameElement);
        };
      </script>
    </body>
    </html>
  `;

  // Create hidden iframe and print
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position: fixed; right: 0; bottom: 0; width: 1px; height: 1px; border: none; visibility: hidden;';
  document.body.appendChild(iframe);
  
  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
}

// Template generators
function generateReceiptContent(data, school) {
  const money = (n) => `KES ${Number(n || 0).toLocaleString()}`;
  
  return `
    <div class="print-section">
      <div class="print-row">
        <span class="print-row-label">Receipt No:</span>
        <span class="print-row-value">${data.receiptNo || data.id || 'N/A'}</span>
      </div>
      <div class="print-row">
        <span class="print-row-label">Date:</span>
        <span class="print-row-value">${data.date || new Date().toLocaleDateString()}</span>
      </div>
      <div class="print-row">
        <span class="print-row-label">Student:</span>
        <span class="print-row-value">${data.studentName || data.student || 'N/A'}</span>
      </div>
      <div class="print-row">
        <span class="print-row-label">Class:</span>
        <span class="print-row-value">${data.className || data.class || 'N/A'}</span>
      </div>
      <div class="print-row">
        <span class="print-row-label">Admission No:</span>
        <span class="print-row-value">${data.admissionNo || data.admission || 'N/A'}</span>
      </div>
    </div>
    
    <div class="print-section">
      <div class="print-section-title">Payment Details</div>
      <table class="print-table">
        <tr>
          <th>Description</th>
          <th style="text-align: right;">Amount (KES)</th>
        </tr>
        <tr>
          <td>${data.description || data.feeType || 'School Fees Payment'}</td>
          <td style="text-align: right; font-weight: 600;">${money(data.amount)}</td>
        </tr>
      </table>
    </div>
    
    <div class="print-section">
      <div class="print-row">
        <span class="print-row-label">Payment Method:</span>
        <span class="print-row-value">${data.method || 'Cash'}</span>
      </div>
      ${data.reference ? `
        <div class="print-row">
          <span class="print-row-label">Reference:</span>
          <span class="print-row-value">${data.reference}</span>
        </div>
      ` : ''}
      ${data.balance !== undefined ? `
        <div class="print-row">
          <span class="print-row-label">Balance:</span>
          <span class="print-row-value">${money(data.balance)}</span>
        </div>
      ` : ''}
    </div>
    
    <div style="text-align: center; margin-top: 30px;">
      <div class="print-stamp">Official Receipt</div>
    </div>
    
    <div class="print-signature-line">
      <div class="print-signature-box">
        <div class="print-signature-line-hr"></div>
        <div class="print-signature-label">Received by</div>
      </div>
      <div class="print-signature-box">
        <div class="print-signature-line-hr"></div>
        <div class="print-signature-label">Parent/Guardian</div>
      </div>
    </div>
  `;
}

function generatePayslipContent(data, school) {
  const money = (n) => `KES ${Number(n || 0).toLocaleString()}`;
  
  return `
    <div class="print-section">
      <div class="print-row">
        <span class="print-row-label">Staff Name:</span>
        <span class="print-row-value">${data.staffName || data.name || 'N/A'}</span>
      </div>
      <div class="print-row">
        <span class="print-row-label">Staff ID:</span>
        <span class="print-row-value">${data.staffId || data.id || 'N/A'}</span>
      </div>
      <div class="print-row">
        <span class="print-row-label">Department:</span>
        <span class="print-row-value">${data.department || 'N/A'}</span>
      </div>
      <div class="print-row">
        <span class="print-row-label">Period:</span>
        <span class="print-row-value">${data.month || ''} ${data.year || ''}</span>
      </div>
    </div>
    
    <div class="print-section">
      <div class="print-section-title">Earnings</div>
      <table class="print-table">
        <tr>
          <th>Description</th>
          <th style="text-align: right;">Amount (KES)</th>
        </tr>
        <tr>
          <td>Basic Salary</td>
          <td style="text-align: right;">${money(data.basicSalary)}</td>
        </tr>
        ${data.allowances ? `
          <tr>
            <td>Allowances</td>
            <td style="text-align: right;">${money(data.allowances)}</td>
          </tr>
        ` : ''}
        <tr style="font-weight: 600;">
          <td>Gross Pay</td>
          <td style="text-align: right;">${money(data.grossPay || (Number(data.basicSalary || 0) + Number(data.allowances || 0)))}</td>
        </tr>
      </table>
    </div>
    
    <div class="print-section">
      <div class="print-section-title">Deductions</div>
      <table class="print-table">
        <tr>
          <th>Description</th>
          <th style="text-align: right;">Amount (KES)</th>
        </tr>
        ${data.paye ? `
          <tr><td>PAYE</td><td style="text-align: right;">${money(data.paye)}</td></tr>
        ` : ''}
        ${data.nhif ? `
          <tr><td>NHIF</td><td style="text-align: right;">${money(data.nhif)}</td></tr>
        ` : ''}
        ${data.nssf ? `
          <tr><td>NSSF</td><td style="text-align: right;">${money(data.nssf)}</td></tr>
        ` : ''}
        ${data.otherDeductions ? `
          <tr><td>Other Deductions</td><td style="text-align: right;">${money(data.otherDeductions)}</td></tr>
        ` : ''}
        <tr style="font-weight: 600;">
          <td>Total Deductions</td>
          <td style="text-align: right;">${money(data.totalDeductions || data.deductions)}</td>
        </tr>
      </table>
    </div>
    
    <div class="print-section" style="margin-top: 20px; padding: 12px; background: ${school.primaryColor}10; border-radius: 4px;">
      <div class="print-row" style="border: none;">
        <span class="print-row-label" style="font-size: 14px; font-weight: 700;">NET PAY:</span>
        <span class="print-row-value" style="font-size: 16px; color: ${school.primaryColor};">${money(data.netPay)}</span>
      </div>
    </div>
    
    <div class="print-signature-line">
      <div class="print-signature-box">
        <div class="print-signature-line-hr"></div>
        <div class="print-signature-label">Authorized Signature</div>
      </div>
      <div class="print-signature-box">
        <div class="print-signature-line-hr"></div>
        <div class="print-signature-label">Employee Signature</div>
      </div>
    </div>
  `;
}

function generateReportCardContent(data, school) {
  const money = (n) => `KES ${Number(n || 0).toLocaleString()}`;
  
  return `
    <div class="print-section">
      <div class="print-row">
        <span class="print-row-label">Student Name:</span>
        <span class="print-row-value">${data.studentName || data.name || 'N/A'}</span>
      </div>
      <div class="print-row">
        <span class="print-row-label">Admission No:</span>
        <span class="print-row-value">${data.admissionNo || 'N/A'}</span>
      </div>
      <div class="print-row">
        <span class="print-row-label">Class:</span>
        <span class="print-row-value">${data.className || data.class || 'N/A'}</span>
      </div>
      <div class="print-row">
        <span class="print-row-label">Term:</span>
        <span class="print-row-value">${data.term || school.term || 'N/A'}</span>
      </div>
    </div>
    
    <div class="print-section">
      <div class="print-section-title">Academic Performance</div>
      <table class="print-table">
        <tr>
          <th>Subject</th>
          <th style="text-align: center;">Marks</th>
          <th style="text-align: center;">Grade</th>
          <th style="text-align: center;">Remarks</th>
        </tr>
        ${(data.grades || []).map(g => `
          <tr>
            <td>${g.subject}</td>
            <td style="text-align: center;">${g.marks}/${g.total || 100}</td>
            <td style="text-align: center; font-weight: 700; color: ${getGradeColor(g.grade, school)};">${g.grade}</td>
            <td style="text-align: center;">${g.remarks || getGradeRemark(g.grade)}</td>
          </tr>
        `).join('')}
      </table>
    </div>
    
    ${data.attendance ? `
      <div class="print-section">
        <div class="print-section-title">Attendance</div>
        <div class="print-row">
          <span class="print-row-label">Days Present:</span>
          <span class="print-row-value">${data.attendance.present} / ${data.attendance.total} days</span>
        </div>
        <div class="print-row">
          <span class="print-row-label">Attendance Rate:</span>
          <span class="print-row-value">${Math.round((data.attendance.present / data.attendance.total) * 100)}%</span>
        </div>
      </div>
    ` : ''}
    
    <div class="print-section">
      <div class="print-section-title">Comments</div>
      <div style="margin: 8px 0; padding: 12px; border: 1px solid #e5e7eb; border-radius: 4px; min-height: 60px;">
        ${data.teacherComment || data.comments || '<em>No comments provided</em>'}
      </div>
    </div>
    
    <div class="print-signature-line">
      <div class="print-signature-box">
        <div class="print-signature-line-hr"></div>
        <div class="print-signature-label">Class Teacher</div>
      </div>
      <div class="print-signature-box">
        <div class="print-signature-line-hr"></div>
        <div class="print-signature-label">Principal</div>
      </div>
      <div class="print-signature-box">
        <div class="print-signature-line-hr"></div>
        <div class="print-signature-label">Parent/Guardian</div>
      </div>
    </div>
  `;
}

function generateStatementContent(data, school) {
  const money = (n) => `KES ${Number(n || 0).toLocaleString()}`;
  
  return `
    <div class="print-section">
      <div class="print-row">
        <span class="print-row-label">Student:</span>
        <span class="print-row-value">${data.studentName || data.name || 'N/A'}</span>
      </div>
      <div class="print-row">
        <span class="print-row-label">Class:</span>
        <span class="print-row-value">${data.className || data.class || 'N/A'}</span>
      </div>
      <div class="print-row">
        <span class="print-row-label">Statement Date:</span>
        <span class="print-row-value">${new Date().toLocaleDateString()}</span>
      </div>
    </div>
    
    <div class="print-section">
      <div class="print-section-title">Transaction History</div>
      <table class="print-table">
        <tr>
          <th>Date</th>
          <th>Description</th>
          <th style="text-align: right;">Debit</th>
          <th style="text-align: right;">Credit</th>
          <th style="text-align: right;">Balance</th>
        </tr>
        ${(data.transactions || []).map(t => `
          <tr>
            <td>${t.date}</td>
            <td>${t.description}</td>
            <td style="text-align: right;">${t.type === 'charge' ? money(t.amount) : '-'}</td>
            <td style="text-align: right;">${t.type === 'payment' ? money(t.amount) : '-'}</td>
            <td style="text-align: right; font-weight: 600;">${money(t.balance)}</td>
          </tr>
        `).join('')}
      </table>
    </div>
    
    <div class="print-section" style="margin-top: 20px; padding: 12px; background: ${school.primaryColor}10; border-radius: 4px;">
      <div class="print-row" style="border: none;">
        <span class="print-row-label" style="font-size: 14px; font-weight: 700;">Current Balance:</span>
        <span class="print-row-value" style="font-size: 16px; color: ${Number(data.balance) > 0 ? '#dc2626' : school.primaryColor};">
          ${money(data.balance)} ${Number(data.balance) > 0 ? '(Outstanding)' : '(Credit)'}
        </span>
      </div>
    </div>
  `;
}

function generateInvoiceContent(data, school) {
  const money = (n) => `KES ${Number(n || 0).toLocaleString()}`;
  
  return `
    <div class="print-section">
      <div class="print-row">
        <span class="print-row-label">Invoice No:</span>
        <span class="print-row-value">${data.invoiceNo || data.id || 'N/A'}</span>
      </div>
      <div class="print-row">
        <span class="print-row-label">Date:</span>
        <span class="print-row-value">${data.date || new Date().toLocaleDateString()}</span>
      </div>
      <div class="print-row">
        <span class="print-row-label">Due Date:</span>
        <span class="print-row-value">${data.dueDate || 'N/A'}</span>
      </div>
    </div>
    
    <div class="print-section">
      <div class="print-row">
        <span class="print-row-label">Bill To:</span>
        <span class="print-row-value">${data.customerName || data.studentName || 'N/A'}</span>
      </div>
      ${data.customerAddress ? `
        <div class="print-row">
          <span class="print-row-label">Address:</span>
          <span class="print-row-value">${data.customerAddress}</span>
        </div>
      ` : ''}
    </div>
    
    <div class="print-section">
      <div class="print-section-title">Invoice Items</div>
      <table class="print-table">
        <tr>
          <th>Description</th>
          <th style="text-align: center;">Qty</th>
          <th style="text-align: right;">Unit Price</th>
          <th style="text-align: right;">Amount</th>
        </tr>
        ${(data.items || []).map(item => `
          <tr>
            <td>${item.description}</td>
            <td style="text-align: center;">${item.quantity || 1}</td>
            <td style="text-align: right;">${money(item.unitPrice)}</td>
            <td style="text-align: right;">${money(item.amount || (item.quantity || 1) * (item.unitPrice || 0))}</td>
          </tr>
        `).join('')}
      </table>
    </div>
    
    <div class="print-section" style="margin-top: 20px;">
      <div class="print-row">
        <span class="print-row-label">Subtotal:</span>
        <span class="print-row-value">${money(data.subtotal)}</span>
      </div>
      ${data.tax ? `
        <div class="print-row">
          <span class="print-row-label">Tax:</span>
          <span class="print-row-value">${money(data.tax)}</span>
        </div>
      ` : ''}
      <div class="print-row" style="font-size: 16px; font-weight: 700; border-top: 2px solid ${school.primaryColor}; padding-top: 8px;">
        <span class="print-row-label">Total:</span>
        <span class="print-row-value" style="color: ${school.primaryColor};">${money(data.total)}</span>
      </div>
    </div>
    
    <div style="text-align: center; margin-top: 30px;">
      <div class="print-stamp">${data.status === 'paid' ? 'PAID' : 'PENDING PAYMENT'}</div>
    </div>
  `;
}

// Helper functions
function getGradeColor(grade, school) {
  const colors = {
    'EE': '#16a34a', // Excellent - green
    'ME': '#2563eb', // Meeting Expectations - blue
    'AE': '#ea580c', // Approaching Expectations - orange
    'BE': '#dc2626', // Below Expectations - red
    'A': '#16a34a',
    'B': '#2563eb',
    'C': '#ea580c',
    'D': '#dc2626',
    'E': '#7c2d12',
  };
  return colors[grade?.toUpperCase()] || school.primaryColor;
}

function getGradeRemark(grade) {
  const remarks = {
    'EE': 'Excellent',
    'ME': 'Good',
    'AE': 'Fair',
    'BE': 'Needs Improvement',
    'A': 'Excellent',
    'B': 'Good',
    'C': 'Satisfactory',
    'D': 'Needs Improvement',
    'E': 'Unsatisfactory',
  };
  return remarks[grade?.toUpperCase()] || '';
}

// Backward compatibility: export printHTML as alias
export { printHTML } from '../lib/print';
