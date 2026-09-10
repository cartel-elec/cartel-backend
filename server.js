/**
 * CARTEL MULTI-ENGINEERING LTD – Quote Request Backend
 * ----------------------------------------------------
 * - Receives quote / contact form submissions
 * - Stores them in data/quotes.json
 * - Sends email notification to the company
 * - Sends confirmation email to the client
 * - Password-protected admin panel to view & manage requests
 *
 * Deploy free on: Render.com, Railway.app, Fly.io, or any Node host.
 */

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// ============== CONFIG ==============
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Cartel2026!';
const ADMIN_TOKEN_SECRET = process.env.ADMIN_TOKEN_SECRET || 'change-this-secret-key-to-something-long';

// Email settings (use environment variables in production)
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'roi.nipatrick@gmail.com';
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER || 'noreply@cartel-multi-engineering.com';

const ALLOWED_ORIGINS = [
  'https://cartel-max.github.io',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000'
];
// ====================================

const DATA_DIR = path.join(__dirname, 'data');
const QUOTES_FILE = path.join(DATA_DIR, 'quotes.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(QUOTES_FILE)) fs.writeFileSync(QUOTES_FILE, '[]', 'utf8');

// Middleware
app.use(express.json({ limit: '32kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || ALLOWED_ORIGINS.some(o => origin.startsWith(o))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many requests. Please try again later.' }
});

// ---------- Helpers ----------
function readQuotes() {
  try {
    return JSON.parse(fs.readFileSync(QUOTES_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeQuotes(quotes) {
  fs.writeFileSync(QUOTES_FILE, JSON.stringify(quotes, null, 2), 'utf8');
}

function createToken() {
  return crypto.createHmac('sha256', ADMIN_TOKEN_SECRET)
    .update(String(Date.now()))
    .digest('hex')
    .slice(0, 32);
}

const validTokens = new Set();

function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (token && validTokens.has(token)) return next();
  return res.status(401).json({ success: false, error: 'Unauthorized' });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const SUBJECT_MAP = {
  quote: 'Request a Quote',
  residential: 'Residential Electrical',
  commercial: 'Commercial Electrical',
  industrial: 'Industrial Electrical',
  solar: 'Solar Systems',
  maintenance: 'Maintenance / Repair',
  inspection: 'Inspection & Testing',
  other: 'Other Enquiry'
};

// ---------- Email setup ----------
let transporter = null;

function initMailer() {
  if (!SMTP_USER || !SMTP_PASS) {
    console.log('[EMAIL] SMTP not configured – email notifications disabled.');
    console.log('[EMAIL] Set SMTP_USER and SMTP_PASS environment variables to enable.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });

  transporter.verify(function (err) {
    if (err) {
      console.error('[EMAIL] SMTP connection failed:', err.message);
      transporter = null;
    } else {
      console.log('[EMAIL] SMTP ready – company notifications →', NOTIFY_EMAIL);
      console.log('[EMAIL] Client confirmation emails enabled');
    }
  });

  return transporter;
}

initMailer();

/** Email to the company (you) */
async function sendCompanyNotification(quote) {
  if (!transporter) return false;

  const subjectLabel = SUBJECT_MAP[quote.subject] || quote.subject;
  const dateStr = new Date(quote.createdAt).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  const html = `
    <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
      <div style="background: #0a1628; color: #fff; padding: 20px 24px; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 18px;">New Quote Request</h1>
        <p style="margin: 6px 0 0; opacity: 0.85; font-size: 14px;">CARTEL MULTI-ENGINEERING LTD</p>
      </div>
      <div style="border: 1px solid #e2e8f0; border-top: none; padding: 24px; border-radius: 0 0 12px 12px; background: #fff;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; width: 110px;">Name</td>
            <td style="padding: 8px 0; font-weight: 600;">${escapeHtml(quote.name)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Email</td>
            <td style="padding: 8px 0;"><a href="mailto:${escapeHtml(quote.email)}" style="color: #00a8e8;">${escapeHtml(quote.email)}</a></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Phone</td>
            <td style="padding: 8px 0;">${quote.phone ? '<a href="tel:' + escapeHtml(quote.phone) + '" style="color: #00a8e8;">' + escapeHtml(quote.phone) + '</a>' : '—'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Subject</td>
            <td style="padding: 8px 0; font-weight: 600;">${escapeHtml(subjectLabel)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Received</td>
            <td style="padding: 8px 0;">${dateStr}</td>
          </tr>
        </table>
        <div style="margin-top: 18px; padding: 14px 16px; background: #f1f5f9; border-radius: 8px; font-size: 14px; line-height: 1.55; white-space: pre-wrap;">${escapeHtml(quote.message)}</div>
        <p style="margin-top: 20px; font-size: 13px; color: #64748b;">
          Log in to the admin panel to update status or reply.
        </p>
      </div>
    </div>
  `;

  const text = `
New Quote Request – CARTEL MULTI-ENGINEERING LTD

Name: ${quote.name}
Email: ${quote.email}
Phone: ${quote.phone || '—'}
Subject: ${subjectLabel}
Received: ${dateStr}

Message:
${quote.message}
  `.trim();

  try {
    await transporter.sendMail({
      from: `"CARTEL MULTI-ENGINEERING" <${SMTP_FROM}>`,
      to: NOTIFY_EMAIL,
      replyTo: quote.email,
      subject: `[Quote] ${subjectLabel} – ${quote.name}`,
      text,
      html
    });
    console.log('[EMAIL] Company notification sent to', NOTIFY_EMAIL);
    return true;
  } catch (err) {
    console.error('[EMAIL] Company notification failed:', err.message);
    return false;
  }
}

/** Confirmation email to the client */
async function sendClientConfirmation(quote) {
  if (!transporter) return false;

  const subjectLabel = SUBJECT_MAP[quote.subject] || quote.subject;
  const firstName = quote.name.split(' ')[0] || quote.name;

  const html = `
    <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
      <div style="background: #0a1628; color: #fff; padding: 24px 28px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 20px; letter-spacing: 0.5px;">CARTEL MULTI-ENGINEERING LTD</h1>
        <p style="margin: 8px 0 0; opacity: 0.85; font-size: 13px;">Professional Electrical Installation &amp; Engineering</p>
      </div>
      <div style="border: 1px solid #e2e8f0; border-top: none; padding: 28px; border-radius: 0 0 12px 12px; background: #fff;">
        <p style="font-size: 16px; margin: 0 0 12px;">Dear ${escapeHtml(firstName)},</p>
        <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
          Thank you for contacting <strong>CARTEL MULTI-ENGINEERING LTD</strong>.
          We have received your request regarding <strong>${escapeHtml(subjectLabel)}</strong>.
        </p>
        <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
          Our team will review your enquiry and get back to you as soon as possible,
          usually within 1–2 business days.
        </p>
        <div style="background: #f0f9ff; border-left: 4px solid #00a8e8; padding: 14px 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
          <p style="margin: 0; font-size: 14px; color: #0c4a6e;">
            <strong>What happens next?</strong><br>
            We may contact you by phone or email to clarify details and prepare an accurate quotation.
          </p>
        </div>
        <p style="font-size: 15px; line-height: 1.6; margin: 0 0 8px;">
          If your request is urgent, please call us directly:
        </p>
        <p style="margin: 0 0 20px;">
          <a href="tel:+250788725620" style="color: #00a8e8; font-weight: 600; font-size: 16px; text-decoration: none;">+250 788 725 620</a>
        </p>
        <p style="font-size: 14px; color: #64748b; margin: 0;">
          Best regards,<br>
          <strong style="color: #0a1628;">CARTEL MULTI-ENGINEERING LTD</strong><br>
          Electrical Installation &amp; Engineering – Rwanda
        </p>
      </div>
      <div style="text-align: center; padding: 16px; font-size: 12px; color: #94a3b8;">
        This is an automated confirmation. Please do not reply to this email if you did not submit a request.
      </div>
    </div>
  `;

  const text = `
Dear ${firstName},

Thank you for contacting CARTEL MULTI-ENGINEERING LTD.
We have received your request regarding ${subjectLabel}.

Our team will review your enquiry and get back to you as soon as possible, usually within 1–2 business days.

If your request is urgent, please call us directly: +250 788 725 620

Best regards,
CARTEL MULTI-ENGINEERING LTD
Electrical Installation & Engineering – Rwanda
  `.trim();

  try {
    await transporter.sendMail({
      from: `"CARTEL MULTI-ENGINEERING LTD" <${SMTP_FROM}>`,
      to: quote.email,
      subject: 'We received your request – CARTEL MULTI-ENGINEERING LTD',
      text,
      html
    });
    console.log('[EMAIL] Client confirmation sent to', quote.email);
    return true;
  } catch (err) {
    console.error('[EMAIL] Client confirmation failed:', err.message);
    return false;
  }
}

/** Send both emails */
async function sendAllEmails(quote) {
  await Promise.all([
    sendCompanyNotification(quote),
    sendClientConfirmation(quote)
  ]);
}

// ---------- Public API: Receive quote request ----------
app.post('/api/quote', formLimiter, async (req, res) => {
  const { name, email, phone, subject, message } = req.body || {};

  if (!name || !email || !subject || !message) {
    return res.status(400).json({
      success: false,
      error: 'Please fill in name, email, subject and message.'
    });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      success: false,
      error: 'Please provide a valid email address.'
    });
  }

  const quotes = readQuotes();
  const newQuote = {
    id: crypto.randomUUID(),
    name: String(name).trim().slice(0, 120),
    email: String(email).trim().toLowerCase().slice(0, 120),
    phone: phone ? String(phone).trim().slice(0, 40) : '',
    subject: String(subject).trim().slice(0, 80),
    message: String(message).trim().slice(0, 3000),
    status: 'new',
    createdAt: new Date().toISOString(),
    ip: req.ip || req.headers['x-forwarded-for'] || ''
  };

  quotes.unshift(newQuote);
  writeQuotes(quotes);

  console.log(`[QUOTE] New request from ${newQuote.name} <${newQuote.email}> – ${newQuote.subject}`);

  // Send company notification + client confirmation (non-blocking)
  sendAllEmails(newQuote).catch(() => {});

  res.json({
    success: true,
    message: 'Thank you! Your quote request has been received. We will contact you soon.'
  });
});

// ---------- Admin login ----------
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (password === ADMIN_PASSWORD) {
    const token = createToken();
    validTokens.add(token);
    setTimeout(() => validTokens.delete(token), 12 * 60 * 60 * 1000);
    return res.json({ success: true, token });
  }
  res.status(401).json({ success: false, error: 'Wrong password' });
});

// ---------- Admin: list all quotes ----------
app.get('/api/admin/quotes', requireAdmin, (req, res) => {
  const quotes = readQuotes();
  res.json({ success: true, count: quotes.length, quotes });
});

// ---------- Admin: update status ----------
app.patch('/api/admin/quotes/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  const allowed = ['new', 'contacted', 'quoted', 'closed'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ success: false, error: 'Invalid status' });
  }

  const quotes = readQuotes();
  const idx = quotes.findIndex(q => q.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'Quote not found' });
  }

  quotes[idx].status = status;
  quotes[idx].updatedAt = new Date().toISOString();
  writeQuotes(quotes);

  res.json({ success: true, quote: quotes[idx] });
});

// ---------- Admin: delete a quote ----------
app.delete('/api/admin/quotes/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  let quotes = readQuotes();
  const before = quotes.length;
  quotes = quotes.filter(q => q.id !== id);
  if (quotes.length === before) {
    return res.status(404).json({ success: false, error: 'Quote not found' });
  }
  writeQuotes(quotes);
  res.json({ success: true });
});

// ---------- Serve admin page ----------
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'CARTEL MULTI-ENGINEERING Quote API',
    emailConfigured: Boolean(transporter)
  });
});

// Start
app.listen(PORT, () => {
  console.log(`CARTEL Quote Backend running on port ${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
  console.log(`API endpoint: POST http://localhost:${PORT}/api/quote`);
});
