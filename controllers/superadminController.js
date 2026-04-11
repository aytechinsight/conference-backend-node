const User = require('../models/User');
const Article = require('../models/Article');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const emailUtils = require('../utils/emailUtils');
const notifUtils = require('../utils/notificationUtils');

const REVIEWER_ROLES = ['reviewer 1', 'reviewer 2', 'technical reviewer'];

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

const ROLE_LABELS = {
    'reviewer 1': 'Reviewer 1',
    'reviewer 2': 'Reviewer 2',
    'technical reviewer': 'Technical Reviewer',
};

// GET /api/superadmin/stats
exports.getStats = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments({ role: 'user' });
        const totalReviewers = await User.countDocuments({ role: { $in: REVIEWER_ROLES } });
        const totalAdmins = await User.countDocuments({ role: 'admin' });
        const profileComplete = await User.countDocuments({ role: 'user', profileComplete: true });

        res.json({
            totalUsers,
            totalReviewers,
            totalAdmins,
            profileComplete,
            profileIncomplete: totalUsers - profileComplete,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET /api/superadmin/users
exports.getAllUsers = async (req, res) => {
    try {
        const { role, page = 1, limit = 20 } = req.query;
        const filter = {};
        if (role) filter.role = role;
        else filter.role = { $in: ['user', 'admin', ...REVIEWER_ROLES] };

        const users = await User.find(filter)
            .select('-password -otp -otpExpiry')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await User.countDocuments(filter);

        res.json({ users, total, page: parseInt(page), pages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// POST /api/superadmin/create-reviewer
exports.createReviewer = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        if (!REVIEWER_ROLES.includes(role)) {
            return res.status(400).json({ message: 'Invalid role. Must be a reviewer role.' });
        }

        const exists = await User.findOne({ email });
        if (exists) return res.status(400).json({ message: 'A user with this email already exists.' });

        const user = await User.create({
            name, email, password, role,
            isEmailVerified: true, profileComplete: true, fullName: name,
        });

        // Auto-assign to papers if exactly 1 of each reviewer role now exists
        try {
            const [r1List, r2List, trList] = await Promise.all([
                User.find({ role: 'reviewer 1' }),
                User.find({ role: 'reviewer 2' }),
                User.find({ role: 'technical reviewer' }),
            ]);

            if (r1List.length === 1 && trList.length >= 1) {
                // Active statuses where reviewers may still be needed
                const activeStatuses = ['Submitted', 'Plagiarism Check', 'Under Review', 'Review Revision'];

                const articlesToFix = await Article.find({
                    status: { $in: activeStatuses },
                    $or: [
                        { reviewer1: { $exists: false } },
                        { reviewer1: null },
                        { technicalReviewer: { $exists: false } },
                        { technicalReviewer: null },
                    ],
                });

                for (const article of articlesToFix) {
                    const wasFullyUnassigned = !article.reviewer1 && !article.technicalReviewer;

                    if (!article.reviewer1 && r1List[0]) article.reviewer1 = r1List[0]._id;
                    if (!article.technicalReviewer && trList[0]) article.technicalReviewer = trList[0]._id;
                    if (!article.reviewer2 && r2List.length === 1) article.reviewer2 = r2List[0]._id;

                    // Only bump to Plagiarism Check if was completely unassigned and submitted
                    if (wasFullyUnassigned && article.status === 'Submitted') {
                        article.status = 'Plagiarism Check';
                    }

                    await article.save();

                    // Notify newly assigned role
                    if (role === 'reviewer 1' && r1List[0]) {
                        emailUtils.sendAssignmentEmailToReviewer(r1List[0].email, 'Reviewer 1', article.articleId, article.title);
                    }
                    if (role === 'reviewer 2' && r2List[0]) {
                        emailUtils.sendAssignmentEmailToReviewer(r2List[0].email, 'Reviewer 2', article.articleId, article.title);
                    }
                    if (role === 'technical reviewer' && trList[0]) {
                        emailUtils.sendAssignmentEmailToReviewer(trList[0].email, 'Technical Reviewer', article.articleId, article.title);
                    }
                }

                if (articlesToFix.length > 0) {
                    console.log(`Patched ${articlesToFix.length} articles with missing reviewers after ${role} creation.`);
                }
            }
        } catch (assignErr) {
            console.error('Auto-assignment on create failed (non-blocking):', assignErr);
        }

        // Send credentials email
        const roleLabel = ROLE_LABELS[role] || role;
        const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;

        await transporter.sendMail({
            from: `"iCreate 2026 Conference" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `Your iCreate 2026 ${roleLabel} Account Credentials`,
            html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:560px;width:100%;">
        <tr><td style="background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);padding:36px 40px;text-align:center;">
          <h1 style="margin:0;color:#f59e0b;font-size:22px;font-weight:700;letter-spacing:1px;">iCreate 2026</h1>
          <p style="margin:6px 0 0;color:#94a3b8;font-size:12px;letter-spacing:2px;text-transform:uppercase;">International Conference on Research, Enhancement & Advancements in Technology and Engineering</p>
        </td></tr>
        <tr><td style="padding:32px 40px 0;text-align:center;">
          <span style="display:inline-block;background:#fef3c7;color:#92400e;font-size:13px;font-weight:700;padding:6px 20px;border-radius:100px;letter-spacing:0.5px;text-transform:uppercase;">${roleLabel}</span>
        </td></tr>
        <tr><td style="padding:24px 40px 0;">
          <h2 style="margin:0;color:#1e293b;font-size:20px;">Welcome, ${name}!</h2>
          <p style="margin:12px 0 0;color:#475569;font-size:15px;line-height:1.6;">
            You have been appointed as <strong>${roleLabel}</strong> for the <strong>iCreate 2026</strong> conference.
          </p>
        </td></tr>
        <tr><td style="padding:28px 40px;">
          <div style="background:#f1f5f9;border-radius:10px;padding:24px;border-left:4px solid #f59e0b;">
            <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Your Login Credentials</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
              <tr>
                <td style="padding:6px 0;color:#64748b;font-size:14px;width:90px;">Email</td>
                <td style="padding:6px 0;color:#1e293b;font-size:14px;font-weight:600;">${email}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#64748b;font-size:14px;">Password</td>
                <td style="padding:6px 0;color:#1e293b;font-size:14px;font-weight:600;font-family:monospace;letter-spacing:1px;">${password}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#64748b;font-size:14px;">Role</td>
                <td style="padding:6px 0;color:#1e293b;font-size:14px;font-weight:600;">${roleLabel}</td>
              </tr>
            </table>
          </div>
        </td></tr>
        <tr><td style="padding:0 40px 32px;text-align:center;">
          <a href="${loginUrl}" style="display:inline-block;background:#f59e0b;color:#1e293b;font-weight:700;font-size:15px;padding:14px 36px;border-radius:8px;text-decoration:none;letter-spacing:0.5px;">Sign In to Your Portal →</a>
        </td></tr>
        <tr><td style="padding:0 40px 32px;">
          <div style="background:#fff7ed;border-radius:8px;padding:16px;border:1px solid #fed7aa;">
            <p style="margin:0;color:#9a3412;font-size:13px;line-height:1.5;">
              🔒 <strong>Security Notice:</strong> Please change your password after your first login. Do not share these credentials.
            </p>
          </div>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:24px 40px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">© 2026 iCreate Conference. All rights reserved.</p>
          <p style="margin:6px 0 0;color:#cbd5e1;font-size:11px;">Vellore Institute of Technology</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
        });

        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            createdAt: user.createdAt,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// DELETE /api/superadmin/users/:id
exports.deleteUser = async (req, res) => {
    try {
        const target = await User.findById(req.params.id);
        if (!target) return res.status(404).json({ message: 'User not found' });
        if (target.role === 'superadmin') return res.status(403).json({ message: 'Cannot delete superadmin account.' });

        if (REVIEWER_ROLES.includes(target.role)) {
            const roleToField = {
                'reviewer 1': 'reviewer1',
                'reviewer 2': 'reviewer2',
                'technical reviewer': 'technicalReviewer',
            };
            const field = roleToField[target.role];

            const assignedArticles = await Article.find({ [field]: target._id });

            for (const article of assignedArticles) {
                article[field] = undefined;
                // Reset to a safe status based on what was removed
                if (target.role === 'technical reviewer' && article.status === 'Plagiarism Check') {
                    article.status = 'Submitted';
                } else if ((target.role === 'reviewer 1' || target.role === 'reviewer 2') &&
                    ['Under Review', 'Review Revision'].includes(article.status)) {
                    article.status = 'Plagiarism Check'; // Needs re-assignment
                }
                await article.save();
            }

            if (assignedArticles.length > 0) {
                console.log(`Unassigned ${assignedArticles.length} articles from deleted ${target.role}: ${target.email}`);
            }
        }

        await User.findByIdAndDelete(req.params.id);
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET /api/superadmin/payments — all completed payments
exports.getAllPayments = async (req, res) => {
    try {
        const payments = await Article.find({ paymentStatus: 'Completed' })
            .populate('submittedBy', 'fullName name email userId')
            .select('articleId title selectedPlan paymentAmount paymentCurrency razorpayPaymentId razorpayOrderId paidAt submittedBy authors numberOfAuthors authorCertificates publicationLink certificateAttachedAt certificateSentAt')
            .sort({ paidAt: -1 });

        let totalINR = 0, totalUSD = 0;
        for (const p of payments) {
            if (p.paymentCurrency === 'INR') totalINR += p.paymentAmount || 0;
            else totalUSD += p.paymentAmount || 0;
        }

        res.json({
            success: true,
            payments,
            summary: { totalINR, totalUSD, count: payments.length }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// PUT /api/superadmin/articles/:articleId/author-certificate
// Upload a certificate for a specific author (by index in the authors array)
exports.attachAuthorCertificate = async (req, res) => {
    try {
        const article = await Article.findOne({ articleId: req.params.articleId });
        if (!article) return res.status(404).json({ message: 'Article not found.' });

        const authorIndex = parseInt(req.body.authorIndex, 10);
        if (isNaN(authorIndex) || authorIndex < 0 || authorIndex >= article.authors.length) {
            return res.status(400).json({ message: 'Invalid author index.' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'Certificate file is required.' });
        }

        const normalizedPath = req.file.path.replace(/\\/g, '/');
        const uploadsIndex = normalizedPath.indexOf('uploads/');
        const certPath = uploadsIndex >= 0 ? normalizedPath.substring(uploadsIndex) : normalizedPath;

        const author = article.authors[authorIndex];

        // Find existing entry or create new one
        const existingIdx = article.authorCertificates.findIndex(
            c => c.authorEmail === author.email
        );

        if (existingIdx >= 0) {
            article.authorCertificates[existingIdx].certificateFile = certPath;
            article.authorCertificates[existingIdx].uploadedAt = new Date();
        } else {
            article.authorCertificates.push({
                authorName: author.name,
                authorEmail: author.email,
                certificateFile: certPath,
                uploadedAt: new Date(),
            });
        }

        article.certificateAttachedAt = new Date();
        await article.save();

        res.json({
            success: true,
            message: `Certificate uploaded for ${author.name}.`,
            authorCertificates: article.authorCertificates,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// PUT /api/superadmin/articles/:articleId/publication-link — save publication link only
exports.attachPublicationLink = async (req, res) => {
    try {
        const article = await Article.findOne({ articleId: req.params.articleId });
        if (!article) return res.status(404).json({ message: 'Article not found.' });

        const { publicationLink } = req.body;
        article.publicationLink = publicationLink?.trim() || undefined;
        article.certificateAttachedAt = new Date();
        await article.save();

        res.json({ success: true, message: 'Publication link saved.', article });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// POST /api/superadmin/articles/:articleId/send-certificates
// Send certificates to all authors who have one uploaded. Also sends publication link if set.
exports.sendCertificatesToAuthors = async (req, res) => {
    try {
        const article = await Article.findOne({ articleId: req.params.articleId })
            .populate('submittedBy', 'fullName name email');

        if (!article) return res.status(404).json({ message: 'Article not found.' });

        const hasCerts = article.authorCertificates && article.authorCertificates.some(c => c.certificateFile);
        const hasLink = !!article.publicationLink;

        if (!hasCerts && !hasLink) {
            return res.status(400).json({ message: 'Please upload at least one certificate or add a publication link before sending.' });
        }

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        let sentCount = 0;

        if (hasCerts) {
            // Send individual cert emails to each author
            for (const certEntry of article.authorCertificates) {
                if (!certEntry.certificateFile || !certEntry.authorEmail) continue;

                const certUrl = `${baseUrl}/${certEntry.certificateFile}`;
                try {
                    await emailUtils.sendCertificateEmail(
                        certEntry.authorEmail,
                        certEntry.authorName || 'Author',
                        article.articleId,
                        article.title,
                        article.publicationLink || null,
                        certUrl
                    );
                    certEntry.sentAt = new Date();
                    sentCount++;
                } catch (emailErr) {
                    console.error(`Failed to send cert to ${certEntry.authorEmail}:`, emailErr);
                }
            }
        } else if (hasLink) {
            // No per-author certs — send publication link to corresponding author
            const authorName = article.submittedBy?.fullName || article.submittedBy?.name || 'Author';
            const authorEmail = article.submittedBy?.email;
            if (authorEmail) {
                await emailUtils.sendCertificateEmail(
                    authorEmail,
                    authorName,
                    article.articleId,
                    article.title,
                    article.publicationLink,
                    null
                );
                sentCount++;
            }
        }

        article.certificateSentAt = new Date();
        article.status = 'Published';
        await article.save();

        // In-app notifications
        if (article.submittedBy?.email) {
            notifUtils.notifyCertificateReady(article.submittedBy.email, article.articleId, article.title);
            notifUtils.notifyPublished(article.submittedBy.email, article.articleId, article.title);
        }

        res.json({ success: true, message: `Certificates sent to ${sentCount} author(s). Paper marked as Published.` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
