const User = require('../models/User');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

/**
 * Generate a signed unsubscribe token for a user email.
 * Expires in 365 days so links in old emails still work.
 */
function makeUnsubscribeToken(email) {
    return jwt.sign({ email, purpose: 'newsletter-unsubscribe' }, process.env.JWT_SECRET, { expiresIn: '365d' });
}

/**
 * @desc  Compose and broadcast a newsletter to all opted-in `role:user` accounts
 * @route POST /api/superadmin/newsletter
 * @access Private — superadmin only
 */
exports.sendNewsletter = async (req, res) => {
    try {
        const { subject, html } = req.body;
        if (!subject?.trim() || !html?.trim()) {
            return res.status(400).json({ message: 'Subject and body are required.' });
        }

        // Derive the backend base URL from the incoming request so no extra env var is needed.
        // Works correctly with Cloudflare tunnels because trust proxy is enabled in server.js.
        const BACKEND_URL = `${req.protocol}://${req.get('host')}`;


        // Fetch all users with role 'user' who have not opted out
        const users = await User.find({ role: 'user', newsletterOptOut: { $ne: true } }).select('email fullName name');

        if (!users.length) {
            return res.json({ success: true, sent: 0, message: 'No subscribers to send to.' });
        }

        let sent = 0;
        const errors = [];

        await Promise.allSettled(
            users.map(async (u) => {
                const unsubToken = makeUnsubscribeToken(u.email);
                const unsubUrl = `${BACKEND_URL}/api/newsletter/unsubscribe?token=${unsubToken}`;
                const recipientName = u.fullName || u.name || 'Participant';

                const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: Inter, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 0; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #1e293b; border-radius: 16px; overflow: hidden; }
    .header { background: linear-gradient(135deg,#eab308,#ca8a04); padding: 28px 32px; }
    .header h1 { margin: 0; font-size: 22px; color: #0f172a; font-weight: 800; }
    .header p { margin: 4px 0 0; font-size: 13px; color: #1e293b; opacity: 0.8; }
    .body { padding: 32px; }
    .body h2 { font-size: 16px; color: #f8fafc; margin-top: 0; }
    .body p { color: #94a3b8; font-size: 14px; line-height: 1.7; }
    .footer { padding: 20px 32px; border-top: 1px solid #334155; text-align: center; }
    .footer p { font-size: 11px; color: #64748b; margin: 0; }
    .footer a { color: #eab308; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>iCreate 2026</h1>
      <p>International Conference Newsletter</p>
    </div>
    <div class="body">
      <h2>Hello, ${recipientName}!</h2>
      ${html}
    </div>
    <div class="footer">
      <p>
        You are receiving this because you registered for <strong>iCreate 2026</strong>.<br/>
        <a href="${unsubUrl}">Unsubscribe</a> to stop receiving these emails.
      </p>
    </div>
  </div>
</body>
</html>`;

                try {
                    await transporter.sendMail({
                        from: `"iCreate 2026" <${process.env.EMAIL_USER}>`,
                        to: u.email,
                        subject,
                        html: fullHtml,
                    });
                    sent++;
                } catch (err) {
                    errors.push({ email: u.email, error: err.message });
                }
            })
        );

        res.json({ success: true, sent, total: users.length, errors });
    } catch (err) {
        console.error('[newsletter] sendNewsletter error:', err);
        res.status(500).json({ message: 'Server error sending newsletter.' });
    }
};

/**
 * @desc  Unsubscribe a user from newsletters via signed JWT link in email
 * @route GET /api/newsletter/unsubscribe?token=<jwt>
 * @access Public
 */
exports.unsubscribe = async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) return res.status(400).send(renderPage('Invalid Link', 'No token provided.', false));

        let payload;
        try {
            payload = jwt.verify(token, process.env.JWT_SECRET);
        } catch {
            return res.status(400).send(renderPage('Link Expired', 'This unsubscribe link has expired or is invalid.', false));
        }

        if (payload.purpose !== 'newsletter-unsubscribe') {
            return res.status(400).send(renderPage('Invalid Link', 'This link cannot be used for unsubscribing.', false));
        }

        await User.findOneAndUpdate({ email: payload.email }, { newsletterOptOut: true });

        res.send(renderPage('Unsubscribed', `You've been successfully unsubscribed from iCreate 2026 newsletters. You will no longer receive promotional emails.`, true));
    } catch (err) {
        console.error('[newsletter] unsubscribe error:', err);
        res.status(500).send(renderPage('Error', 'Something went wrong. Please try again later.', false));
    }
};

function renderPage(title, message, success) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${title} — iCreate 2026</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Inter, sans-serif; background: #0f172a; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 20px; padding: 48px 40px; max-width: 440px; text-align: center; }
    .icon { width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px;
            background: ${success ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}; }
    .icon svg { width: 32px; height: 32px; stroke: ${success ? '#10b981' : '#ef4444'}; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    h1 { color: #f8fafc; font-size: 22px; font-weight: 800; margin-bottom: 12px; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.65; }
    a { display: inline-block; margin-top: 28px; padding: 12px 28px; background: #eab308; color: #0f172a; border-radius: 12px; font-weight: 700; text-decoration: none; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      ${success
        ? '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>'
        : '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'}
    </div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="/">Back to iCreate 2026</a>
  </div>
</body>
</html>`;
}
