import nodemailer from "nodemailer";
import { pool } from "../config/db.js";
import { env } from "../config/env.js";

// ── Lazy transporter — created on first use ───────────────────────────────────
let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;
  if (!env.smtpUser || !env.smtpPass) return null;
  _transporter = nodemailer.createTransport({
    host:   env.smtpHost,
    port:   env.smtpPort,
    secure: env.smtpPort === 465,
    auth:   { user: env.smtpUser, pass: env.smtpPass },
    tls:    { rejectUnauthorized: false },
  });
  return _transporter;
}

export function isEmailConfigured() {
  return Boolean(env.smtpUser && env.smtpPass);
}

// ── Send one email, log result to sms_logs table ─────────────────────────────
export async function sendEmail({ to, subject, html, schoolId, sentByUserId = null }) {
  const transporter = getTransporter();
  const recipients  = Array.isArray(to) ? to : [to];
  let sent = 0, failed = 0, queued = 0;

  for (const addr of recipients) {
    let status = "queued";
    let providerResponse = null;

    if (transporter) {
      try {
        await transporter.sendMail({
          from:    `"${env.smtpFromName}" <${env.smtpFrom}>`,
          to:      addr,
          subject,
          html,
          text:    html.replace(/<[^>]+>/g, ""),
        });
        status = "sent";
        sent++;
      } catch (err) {
        console.error("[email] Send error:", err.message);
        status = "failed";
        failed++;
        providerResponse = err.message;
      }
    } else {
      queued++;
    }

    await pool.query(
      `INSERT INTO sms_logs
         (school_id, recipient, message, channel, status, sent_by_user_id, sent_at, provider_response)
       VALUES (?, ?, ?, 'email', ?, ?, NOW(), ?)`,
      [schoolId, addr, subject, status, sentByUserId, providerResponse]
    ).catch(() => {});
  }

  return { sent, failed, queued };
}

// ── Bulk send to array of { email, name } ─────────────────────────────────────
export async function sendBulkEmail({ recipients, subject, htmlFn, schoolId, sentByUserId = null }) {
  let sent = 0, failed = 0, queued = 0;
  for (const r of recipients) {
    if (!r.email) continue;
    const html   = typeof htmlFn === "function" ? htmlFn(r) : htmlFn;
    const result = await sendEmail({ to: r.email, subject, html, schoolId, sentByUserId });
    sent   += result.sent;
    failed += result.failed;
    queued += result.queued;
  }
  return { sent, failed, queued, total: recipients.length };
}

// ── HTML email templates ──────────────────────────────────────────────────────
const wrap = body => `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  body { font-family: 'Segoe UI', Arial, sans-serif; background:#f4f4f4; margin:0; padding:0; }
  .w  { max-width:560px; margin:32px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,.08); }
  .hd { background:linear-gradient(135deg,#0F2040,#1a3a6b); padding:26px 30px; }
  .hd h1 { color:#C9A84C; margin:0; font-size:21px; }
  .hd p  { color:rgba(255,255,255,.55); margin:4px 0 0; font-size:12px; }
  .bd { padding:26px 30px; color:#333; line-height:1.7; }
  .bd h2 { color:#0F2040; margin-top:0; font-size:17px; }
  .hi { background:#f0f6ff; border-left:4px solid #3B82F6; padding:12px 16px; border-radius:0 8px 8px 0; margin:14px 0; }
  .am { font-size:26px; font-weight:800; color:#0F2040; }
  .ft { background:#f8f8f8; padding:16px 30px; font-size:11px; color:#999; border-top:1px solid #eee; }
</style></head>
<body><div class="w">
  <div class="hd"><h1>Greenfield Academy</h1><p>School Management Portal</p></div>
  <div class="bd">${body}</div>
  <div class="ft">Automated message from Greenfield Academy portal. Do not reply.</div>
</div></body></html>`;

export const templates = {
  paymentReceived: ({ parentName, studentName, amount, term, balance }) => wrap(`
    <h2>Payment Received ✅</h2>
    <p>Dear ${parentName},</p>
    <p>We have received a fee payment for <strong>${studentName}</strong>.</p>
    <div class="hi">
      Amount Paid: <span class="am">KES ${Number(amount).toLocaleString()}</span><br>
      <small>Term: ${term} &nbsp;·&nbsp; Outstanding Balance: KES ${Number(balance || 0).toLocaleString()}</small>
    </div>
    <p>Thank you for keeping up with school fee obligations. Your payment has been recorded.</p>
  `),

  invoiceCreated: ({ parentName, studentName, amountDue, term, dueDate }) => wrap(`
    <h2>New Fee Invoice 📄</h2>
    <p>Dear ${parentName},</p>
    <p>A new invoice has been generated for <strong>${studentName}</strong> — <strong>${term}</strong>.</p>
    <div class="hi">
      Amount Due: <span class="am">KES ${Number(amountDue).toLocaleString()}</span><br>
      ${dueDate ? `<small>Due: ${dueDate}</small>` : ""}
    </div>
    <p>Log in to the parent portal to pay via M-Pesa or card.</p>
  `),

  resultsPublished: ({ parentName, studentName, term, className }) => wrap(`
    <h2>Exam Results Published 📊</h2>
    <p>Dear ${parentName},</p>
    <p>Results for <strong>${term}</strong> are now available for <strong>${studentName}</strong> (${className}).</p>
    <p>Log in to the parent portal to view the full results and report card.</p>
  `),

  admissionApproved: ({ parentName, studentName, admissionNumber, className }) => wrap(`
    <h2>Admission Confirmed 🎓</h2>
    <p>Dear ${parentName},</p>
    <p>We are pleased to confirm admission of <strong>${studentName}</strong> to <strong>${className}</strong>.</p>
    <div class="hi">Admission Number: <strong>${admissionNumber}</strong></div>
    <p>Welcome to the Greenfield Academy family!</p>
  `),

  custom: ({ recipientName, subject, message }) => wrap(`
    <h2>${subject}</h2>
    <p>Dear ${recipientName},</p>
    <div style="white-space:pre-line">${message}</div>
  `),
};
