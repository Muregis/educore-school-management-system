import { apiFetch } from "../lib/api";
import { printHTML } from "../lib/print";

const DEFAULT_PRIMARY = "#c9a84c";
const DEFAULT_SECONDARY = "#1f2937";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeSchoolSettings(settings = {}, fallback = {}) {
  const source = { ...fallback, ...settings };
  const schoolUrl =
    source.school_url ||
    source.website_url ||
    source.website ||
    source.url ||
    source.domain ||
    "";

  return {
    name: source.name || source.school_name || "School",
    logoUrl: source.logo_url || source.logoUrl || "",
    motto: source.motto || source.tagline || "",
    address: source.address || "",
    phone: source.phone || source.school_phone || "",
    email: source.email || source.school_email || "",
    url: schoolUrl,
    primaryColor: source.primary_color || source.primaryColor || DEFAULT_PRIMARY,
    secondaryColor: source.secondary_color || source.secondaryColor || DEFAULT_SECONDARY,
    term: source.term || source.current_term || "",
    year: source.academic_year || source.year || "",
  };
}

async function getSchoolSettings(authToken, fallbackSchool) {
  if (!authToken) return normalizeSchoolSettings({}, fallbackSchool);

  try {
    const settings = await apiFetch("/settings/school", { token: authToken });
    return normalizeSchoolSettings(settings, fallbackSchool);
  } catch (err) {
    console.warn("Unable to fetch school settings for printout:", err);
    return normalizeSchoolSettings({}, fallbackSchool);
  }
}

function renderHeader(school, title, subtitle) {
  const contactItems = [
    school.address,
    school.phone ? `Tel: ${school.phone}` : "",
    school.email ? `Email: ${school.email}` : "",
    school.url ? `URL: ${school.url}` : "",
  ].filter(Boolean);

  return `
    <div class="print-header">
      <div class="print-header-content">
        ${school.logoUrl ? `
          <div class="print-header-logo">
            <img src="${escapeHtml(school.logoUrl)}" alt="${escapeHtml(school.name)} logo" onerror="this.style.display='none'" />
          </div>
        ` : ""}
        <div class="print-header-info ${!school.logoUrl ? "print-header-info-full" : ""}">
          <h1 class="print-header-school-name">${escapeHtml(school.name)}</h1>
          ${school.motto ? `<p class="print-header-motto">${escapeHtml(school.motto)}</p>` : ""}
          ${contactItems.length ? `
            <div class="print-header-contact">
              ${contactItems.map(item => `<span>${escapeHtml(item)}</span>`).join("")}
            </div>
          ` : ""}
        </div>
      </div>
      <div class="print-header-title">${escapeHtml(title)}</div>
      ${subtitle ? `<div class="print-header-term">${escapeHtml(subtitle)}</div>` : ""}
      <div class="print-header-divider"></div>
    </div>
  `;
}

function renderMeta(meta = []) {
  const items = meta.filter(item => item?.label || item?.value);
  if (!items.length) return "";

  return `
    <div class="print-meta">
      ${items.map(item => `
        <div class="print-meta-item">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function renderSummary(summary = []) {
  const items = summary.filter(item => item?.label || item?.value);
  if (!items.length) return "";

  return `
    <div class="print-summary">
      ${items.map(item => `
        <div class="print-summary-item">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function renderTable(columns = [], rows = []) {
  const normalizedRows = rows.length ? rows : [];

  return `
    <table class="print-table">
      <thead>
        <tr>
          ${columns.map(column => `<th class="${column.align === "right" ? "align-right" : ""}">${escapeHtml(column.label || column)}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${normalizedRows.length ? normalizedRows.map(row => `
          <tr>
            ${columns.map((column, index) => {
              const key = column.key ?? index;
              const value = Array.isArray(row) ? row[index] : row[key];
              return `<td class="${column.align === "right" ? "align-right" : ""}">${escapeHtml(value)}</td>`;
            }).join("")}
          </tr>
        `).join("") : `
          <tr>
            <td colspan="${columns.length}" class="empty-cell">No records found.</td>
          </tr>
        `}
      </tbody>
    </table>
  `;
}

function renderStyles(school) {
  return `
    <style>
      @page { size: A4; margin: 14mm; }
      .print-document {
        font-family: 'Segoe UI', Arial, sans-serif;
        max-width: 210mm;
        margin: auto;
        padding: 18px;
        color: #1f2937;
        background: #fff;
        line-height: 1.45;
      }
      .print-header { margin-bottom: 18px; width: 100%; }
      .print-header-content {
        display: flex;
        align-items: center;
        gap: 18px;
        padding-bottom: 14px;
      }
      .print-header-logo { flex-shrink: 0; }
      .print-header-logo img {
        max-width: 78px;
        max-height: 78px;
        object-fit: contain;
        border-radius: 4px;
      }
      .print-header-info { flex: 1; text-align: center; }
      .print-header-info-full { text-align: left; }
      .print-header-school-name {
        margin: 0 0 4px 0;
        color: ${school.primaryColor};
        font-size: 22px;
        font-weight: 800;
        line-height: 1.2;
      }
      .print-header-motto {
        margin: 0 0 8px 0;
        color: #6b7280;
        font-size: 13px;
        font-style: italic;
      }
      .print-header-contact {
        display: flex;
        justify-content: center;
        gap: 10px 14px;
        flex-wrap: wrap;
        color: #6b7280;
        font-size: 10.5px;
      }
      .print-header-info-full .print-header-contact { justify-content: flex-start; }
      .print-header-title {
        margin: 10px 0 4px;
        color: #374151;
        text-align: center;
        text-transform: uppercase;
        letter-spacing: 1px;
        font-size: 15px;
        font-weight: 700;
      }
      .print-header-term {
        margin-bottom: 8px;
        color: #6b7280;
        text-align: center;
        font-size: 12px;
      }
      .print-header-divider {
        height: 2px;
        margin: 12px 0;
        background: linear-gradient(90deg, transparent, ${school.primaryColor}, transparent);
      }
      .print-meta,
      .print-summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 8px;
        margin: 12px 0 16px;
      }
      .print-meta-item,
      .print-summary-item {
        border: 1px solid #e5e7eb;
        border-radius: 4px;
        padding: 8px 10px;
        background: #fafafa;
      }
      .print-meta-item span,
      .print-summary-item span {
        display: block;
        color: #6b7280;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
      }
      .print-meta-item strong,
      .print-summary-item strong {
        display: block;
        margin-top: 3px;
        color: #111827;
        font-size: 13px;
      }
      .print-table {
        width: 100%;
        border-collapse: collapse;
        margin: 12px 0;
        font-size: 11.5px;
      }
      .print-table th {
        padding: 8px;
        border-bottom: 2px solid ${school.primaryColor};
        background: ${school.primaryColor}15;
        color: ${school.primaryColor};
        text-align: left;
        font-weight: 700;
      }
      .print-table td {
        padding: 7px 8px;
        border-bottom: 1px solid #e5e7eb;
        vertical-align: top;
      }
      .print-table tr:last-child td { border-bottom: none; }
      .align-right { text-align: right !important; }
      .empty-cell { text-align: center; color: #9ca3af; padding: 18px !important; }
      .print-footer {
        margin-top: 30px;
        border-top: 1px solid #e5e7eb;
        padding-top: 12px;
        color: #9ca3af;
        text-align: center;
        font-size: 10.5px;
      }
      @media print {
        .print-document { padding: 0; }
        .print-header-divider,
        .print-table th,
        .print-meta-item,
        .print-summary-item {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
    </style>
  `;
}

export async function printFinancialReport({
  authToken,
  school: fallbackSchool,
  title,
  subtitle = "",
  meta = [],
  summary = [],
  columns = [],
  rows = [],
}) {
  const school = await getSchoolSettings(authToken, fallbackSchool);
  const generatedAt = new Date().toLocaleString();
  const html = `
    <div class="print-document">
      ${renderHeader(school, title, subtitle || [school.term, school.year].filter(Boolean).join(" "))}
      ${renderMeta(meta)}
      ${renderTable(columns, rows)}
      ${renderSummary(summary)}
      <div class="print-footer">
        Generated on ${escapeHtml(generatedAt)}${school.url ? ` | ${escapeHtml(school.url)}` : ""}
      </div>
    </div>
    ${renderStyles(school)}
  `;

  printHTML(html, { title });
}
