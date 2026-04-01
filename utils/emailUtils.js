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

// ── NEW: Payment Confirmation Email ──
exports.sendPaymentConfirmationEmail = async (email, articleId, articleTitle, amount) => {
    try {
        await transporter.sendMail({
            from: `"iCreate 2026" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `Payment Confirmed — ${articleId}`,
            html: getHtmlTemplate(
                'Payment Successful',
                `Your payment of <strong>${amount}</strong> for the paper titled <strong>"${articleTitle}"</strong> (${articleId}) has been <strong>successfully confirmed</strong>.
                 <br/><br/>Your registration is now complete. Thank you for participating in iCreate 2026!
                 <br/><br/>You will receive further details about the conference schedule and proceedings soon.`
            )
        });
    } catch (error) {
        console.error('Failed to send payment confirmation email:', error);
    }
};
