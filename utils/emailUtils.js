const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const getHtmlTemplate = (title, message) => `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:560px;width:100%;">
        <tr><td style="background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);padding:36px 40px;text-align:center;">
          <h1 style="margin:0;color:#f59e0b;font-size:22px;font-weight:700;letter-spacing:1px;">iCreate 2026</h1>
        </td></tr>
        <tr><td style="padding:40px 40px 20px;">
          <h2 style="margin:0;color:#1e293b;font-size:20px;">${title}</h2>
          <p style="margin:16px 0 0;color:#475569;font-size:15px;line-height:1.6;">${message}</p>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:24px 40px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">© 2026 iCreate Conference. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`;

exports.sendAssignmentEmailToAuthor = async (email, articleId, articleTitle) => {
    try {
        await transporter.sendMail({
            from: `"iCreate 2026" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `Paper Assignment Update: ${articleId}`,
            html: getHtmlTemplate(
                'Paper Assigned for Review',
                `Your paper titled <strong>"${articleTitle}"</strong> (${articleId}) has been assigned to reviewers and the review process has started. 
                 You will be notified of further updates as it progresses through the review stages.`
            )
        });
    } catch (error) {
        console.error('Failed to send assignment email to author:', error);
    }
};

exports.sendAssignmentEmailToReviewer = async (email, roleLabel, articleId, articleTitle) => {
    try {
        await transporter.sendMail({
            from: `"iCreate 2026" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `New Paper Assigned for Review: ${articleId}`,
            html: getHtmlTemplate(
                `New Review Assignment`,
                `You have been assigned as <strong>${roleLabel}</strong> for the paper titled <strong>"${articleTitle}"</strong> (${articleId}).
                 <br/><br/>Please log in to your reviewer dashboard to download and review the paper.`
            )
        });
    } catch (error) {
        console.error('Failed to send assignment email to reviewer:', error);
    }
};

exports.sendStatusUpdateEmailToAuthor = async (email, articleId, articleTitle, newStatus) => {
    try {
        await transporter.sendMail({
            from: `"iCreate 2026" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `Paper Status Update: ${articleId}`,
            html: getHtmlTemplate(
                'Status Update',
                `The review status for your paper titled <strong>"${articleTitle}"</strong> (${articleId}) has advanced.
                 <br/><br/>Current Status: <strong>${newStatus}</strong>`
            )
        });
    } catch (error) {
        console.error('Failed to send status update email to author:', error);
    }
};

exports.sendPlagiarismRejectionEmail = async (email, articleId, articleTitle, remark) => {
    try {
        await transporter.sendMail({
            from: `"iCreate 2026" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `Revision Required — Paper ${articleId}`,
            html: getHtmlTemplate(
                'Revision Required',
                `Your paper titled <strong>"${articleTitle}"</strong> (${articleId}) has been reviewed for plagiarism and AI similarity, and <strong>requires revision</strong>.
                 <br/><br/><strong>Admin Remark:</strong><br/>${remark || 'No additional remarks.'}
                 <br/><br/>Please log in to your dashboard to view the detailed reports and resubmit a revised version of your paper.`
            )
        });
    } catch (error) {
        console.error('Failed to send plagiarism rejection email:', error);
    }
};

exports.sendPlagiarismAcceptedEmail = async (email, articleId, articleTitle) => {
    try {
        await transporter.sendMail({
            from: `"iCreate 2026" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `Plagiarism Check Passed — Paper ${articleId}`,
            html: getHtmlTemplate(
                'Plagiarism Check Passed',
                `Your paper titled <strong>"${articleTitle}"</strong> (${articleId}) has <strong>passed the plagiarism and AI similarity check</strong>.
                 <br/><br/>Your paper has now been forwarded to the review panel. You will be notified of further updates as it progresses through the review stages.`
            )
        });
    } catch (error) {
        console.error('Failed to send plagiarism accepted email:', error);
    }
};

// ── NEW: Review Revision Email ──
exports.sendReviewRevisionEmail = async (email, articleId, articleTitle, decision, remark) => {
    try {
        await transporter.sendMail({
            from: `"iCreate 2026" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `Revision Required — Paper ${articleId}`,
            html: getHtmlTemplate(
                'Revision Required by Reviewer',
                `Your paper titled <strong>"${articleTitle}"</strong> (${articleId}) has been reviewed and the decision is: <strong>${decision}</strong>.
                 <br/><br/><strong>Reviewer Remark:</strong><br/>${remark || 'No additional remarks.'}
                 <br/><br/>Please log in to your dashboard, review the feedback, and upload a revised version of your paper.`
            )
        });
    } catch (error) {
        console.error('Failed to send review revision email:', error);
    }
};

// ── NEW: Review Rejection Email ──
exports.sendReviewRejectionEmail = async (email, articleId, articleTitle, remark) => {
    try {
        await transporter.sendMail({
            from: `"iCreate 2026" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `Paper Rejected — ${articleId}`,
            html: getHtmlTemplate(
                'Paper Rejected',
                `We regret to inform you that your paper titled <strong>"${articleTitle}"</strong> (${articleId}) has been <strong>rejected</strong> during the review process.
                 <br/><br/><strong>Reviewer Remark:</strong><br/>${remark || 'No additional remarks.'}
                 <br/><br/>You are welcome to submit a fresh revised paper. Please log in to your dashboard and resubmit.`
            )
        });
    } catch (error) {
        console.error('Failed to send review rejection email:', error);
    }
};

// ── NEW: Final Acceptance Email ──
exports.sendFinalAcceptanceEmail = async (email, articleId, articleTitle) => {
    try {
        await transporter.sendMail({
            from: `"iCreate 2026" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `Paper Accepted — ${articleId} 🎉`,
            html: getHtmlTemplate(
                'Congratulations! Paper Accepted',
                `We are pleased to inform you that your paper titled <strong>"${articleTitle}"</strong> (${articleId}) has been <strong>accepted</strong> after completing all review stages!
                 <br/><br/>Please log in to your dashboard and proceed with the registration payment to finalize your participation in iCreate 2026.`
            )
        });
    } catch (error) {
        console.error('Failed to send final acceptance email:', error);
    }
};

// ── Payment Receipt Email (auto-sent on payment verification) ──
exports.sendPaymentReceiptEmail = async (email, authorName, articleId, articleTitle, plan, amount, currency, paymentId, paidAt) => {
    try {
        const symbol = currency === 'INR' ? '₹' : '$';
        const receiptNo = `RCP-${articleId}-${Date.now()}`;
        const formattedDate = new Date(paidAt).toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true,
        });

        await transporter.sendMail({
            from: `"iCreate 2026 Conference" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `Payment Receipt — ${articleId} | iCreate 2026`,
            html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.12);max-width:600px;width:100%;">

        <!-- Header / Logo area -->
        <tr><td style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);padding:36px 40px;text-align:center;">
          <!-- TODO: Replace below with real logo <img> tag once design is provided -->
          <div style="display:inline-block;background:#f59e0b;border-radius:12px;padding:10px 24px;margin-bottom:12px;">
            <span style="color:#0f172a;font-size:22px;font-weight:900;letter-spacing:2px;font-family:Georgia,serif;">iCreate 2026</span>
          </div>
          <p style="margin:0;color:#94a3b8;font-size:11px;letter-spacing:2px;text-transform:uppercase;">International Conference on Research, Enhancement &amp; Advancements in Technology &amp; Engineering</p>
          <p style="margin:12px 0 0;color:#f59e0b;font-size:13px;font-weight:700;letter-spacing:1px;">PAYMENT RECEIPT</p>
        </td></tr>

        <!-- Success badge -->
        <tr><td style="padding:28px 40px 0;text-align:center;">
          <div style="display:inline-block;background:#d1fae5;border:2px solid #6ee7b7;border-radius:50px;padding:10px 28px;">
            <span style="color:#065f46;font-size:14px;font-weight:700;">✓ &nbsp;Payment Successful</span>
          </div>
        </tr></td>

        <!-- Greeting -->
        <tr><td style="padding:24px 40px 0;">
          <p style="margin:0;color:#1e293b;font-size:15px;">Dear <strong>${authorName}</strong>,</p>
          <p style="margin:10px 0 0;color:#475569;font-size:14px;line-height:1.7;">Thank you for completing your registration payment for <strong>iCreate 2026</strong>. Your payment has been successfully received. Please keep this receipt for your records.</p>
        </td></tr>  

        <!-- Receipt details box -->
        <tr><td style="padding:24px 40px;">
          <div style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
            <div style="background:#1e293b;padding:12px 20px;">
              <p style="margin:0;color:#f59e0b;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Transaction Details</p>
            </div>
            <table width="100%" cellpadding="0" cellspacing="0" style="padding:4px 0;">
              <tr>
                <td style="padding:12px 20px;color:#64748b;font-size:13px;width:45%;border-bottom:1px solid #f1f5f9;">Receipt No.</td>
                <td style="padding:12px 20px;color:#1e293b;font-size:13px;font-weight:700;font-family:monospace;border-bottom:1px solid #f1f5f9;">${receiptNo}</td>
              </tr>
              <tr style="background:#f8fafc;">
                <td style="padding:12px 20px;color:#64748b;font-size:13px;border-bottom:1px solid #f1f5f9;">Payment ID</td>
                <td style="padding:12px 20px;color:#1e293b;font-size:13px;font-weight:600;font-family:monospace;word-break:break-all;border-bottom:1px solid #f1f5f9;">${paymentId}</td>
              </tr>
              <tr>
                <td style="padding:12px 20px;color:#64748b;font-size:13px;border-bottom:1px solid #f1f5f9;">Article ID</td>
                <td style="padding:12px 20px;color:#1e293b;font-size:13px;font-weight:600;font-family:monospace;border-bottom:1px solid #f1f5f9;">${articleId}</td>
              </tr>
              <tr style="background:#f8fafc;">
                <td style="padding:12px 20px;color:#64748b;font-size:13px;border-bottom:1px solid #f1f5f9;">Paper Title</td>
                <td style="padding:12px 20px;color:#1e293b;font-size:13px;font-weight:500;border-bottom:1px solid #f1f5f9;">${articleTitle}</td>
              </tr>
              <tr>
                <td style="padding:12px 20px;color:#64748b;font-size:13px;border-bottom:1px solid #f1f5f9;">Registration Plan</td>
                <td style="padding:12px 20px;color:#1e293b;font-size:13px;font-weight:600;border-bottom:1px solid #f1f5f9;">${plan}</td>
              </tr>
              <tr style="background:#f8fafc;">
                <td style="padding:12px 20px;color:#64748b;font-size:13px;border-bottom:1px solid #f1f5f9;">Date &amp; Time</td>
                <td style="padding:12px 20px;color:#1e293b;font-size:13px;border-bottom:1px solid #f1f5f9;">${formattedDate}</td>
              </tr>
              <tr>
                <td style="padding:16px 20px;color:#0f172a;font-size:15px;font-weight:800;">Amount Paid</td>
                <td style="padding:16px 20px;color:#16a34a;font-size:20px;font-weight:900;">${symbol}${amount}</td>
              </tr>
            </table>
          </div>
        </td></tr>

        <!-- Notice -->
        <tr><td style="padding:0 40px 28px;">
          <div style="background:#fffbeb;border-radius:10px;padding:14px 18px;border-left:4px solid #f59e0b;">
            <p style="margin:0;color:#92400e;font-size:13px;line-height:1.6;">
              📋 <strong>Next Steps:</strong> Your paper has been successfully registered. The conference organizers will review and contact you with further details regarding certificate issuance and publication.
            </p>
          </div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">© 2026 iCreate Conference &nbsp;|&nbsp; Vellore Institute of Technology</p>
          <p style="margin:6px 0 0;color:#cbd5e1;font-size:11px;">This is an auto-generated receipt. Please do not reply to this email.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
            `
        });
    } catch (error) {
        console.error('Failed to send payment receipt email:', error);
    }
};

// Keep the old function as an alias for backward compatibility
exports.sendPaymentConfirmationEmail = exports.sendPaymentReceiptEmail;

// ── Certificate & Publication Email (manually triggered by superadmin) ──
exports.sendCertificateEmail = async (email, authorName, articleId, articleTitle, publicationLink, certificateUrl) => {
    try {
        const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/user/submissions`;

        const certSection = certificateUrl
            ? `<tr><td style="padding:0 40px 20px;text-align:center;">
                <a href="${certificateUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#d97706);color:#0f172a;font-weight:800;font-size:14px;padding:14px 32px;border-radius:10px;text-decoration:none;letter-spacing:0.5px;">
                  🏅 &nbsp;Download Your Certificate
                </a>
              </td></tr>`
            : '';

        const pubSection = publicationLink
            ? `<tr><td style="padding:0 40px 20px;text-align:center;">
                <a href="${publicationLink}" target="_blank" style="display:inline-block;background:#1e3a5f;color:#ffffff;font-weight:700;font-size:14px;padding:12px 28px;border-radius:10px;text-decoration:none;letter-spacing:0.5px;">
                  📖 &nbsp;View Published Paper
                </a>
              </td></tr>`
            : '';

        await transporter.sendMail({
            from: `"iCreate 2026 Conference" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `Your Certificate & Publication Details — ${articleId} | iCreate 2026`,
            html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.12);max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);padding:36px 40px;text-align:center;">
          <div style="display:inline-block;background:#f59e0b;border-radius:12px;padding:10px 24px;margin-bottom:12px;">
            <span style="color:#0f172a;font-size:22px;font-weight:900;letter-spacing:2px;font-family:Georgia,serif;">iCreate 2026</span>
          </div>
          <p style="margin:0;color:#94a3b8;font-size:11px;letter-spacing:2px;text-transform:uppercase;">International Conference on Research, Enhancement &amp; Advancements in Technology &amp; Engineering</p>
        </td></tr>

        <!-- Celebration badge -->
        <tr><td style="padding:32px 40px 16px;text-align:center;">
          <div style="font-size:48px;margin-bottom:8px;">🎓</div>
          <h2 style="margin:0;color:#1e293b;font-size:22px;font-family:Georgia,serif;">Congratulations, ${authorName}!</h2>
          <p style="margin:10px 0 0;color:#475569;font-size:14px;line-height:1.7;">Your certificate and publication details for paper <strong style="font-family:monospace;color:#1e293b;">${articleId}</strong> are now ready.</p>
        </td></tr>

        <!-- Paper details -->
        <tr><td style="padding:0 40px 24px;">
          <div style="background:#f8fafc;border-radius:10px;padding:16px 20px;border:1px solid #e2e8f0;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Paper Title</p>
            <p style="margin:0;color:#1e293b;font-size:14px;font-weight:600;line-height:1.5;">${articleTitle}</p>
          </div>
        </td></tr>

        <!-- Certificate button -->
        ${certSection}

        <!-- Publication link -->
        ${pubSection}

        <!-- Dashboard CTA -->
        <tr><td style="padding:0 40px 28px;text-align:center;">
          <p style="color:#64748b;font-size:13px;margin:0 0 12px;">You can also access these details anytime from your dashboard:</p>
          <a href="${dashboardUrl}" style="display:inline-block;background:#f1f5f9;color:#334155;font-weight:700;font-size:13px;padding:10px 24px;border-radius:8px;text-decoration:none;border:1px solid #e2e8f0;">
            View My Dashboard →
          </a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">© 2026 iCreate Conference &nbsp;|&nbsp; Vellore Institute of Technology</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
            `
        });
    } catch (error) {
        console.error('Failed to send certificate email:', error);
    }
};

