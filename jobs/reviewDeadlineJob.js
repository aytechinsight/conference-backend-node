/**
 * reviewDeadlineJob.js
 *
 * Background job that finds papers still in "Under Review" where:
 *   - A review deadline was set (reviewDeadline field)
 *   - The deadline has now passed
 *   - At least one reviewer has submitted their review
 *   - The other reviewer has NOT submitted
 *
 * In that case, we finalize the outcome using only the review(s) received,
 * applying the same 6-case combination logic used during live submission.
 */

const Article = require('../models/Article');
const emailUtils = require('../utils/emailUtils');
const notifUtils = require('../utils/notificationUtils');

// ── Duplicate of the classify + computeCombinedOutcome helpers (kept in sync with reviewerController) ──
function classify(decision) {
    if (!decision) return null;
    if (decision === 'Accepted') return 'accept';
    if (decision === 'Accept with Minor Revision') return 'minor';
    if (decision === 'Accept with Major Revision') return 'major';
    if (decision === 'Reject') return 'reject';
    return null;
}

function computeCombinedOutcome(d1, d2, r1Report, r2Report) {
    const c1 = classify(d1);
    const c2 = d2 ? classify(d2) : null;

    if (c1 === 'reject') {
        return { status: 'Reviewer Rejected', rejectionStage: 'Reviewer 1', rejectionRemark: r1Report?.remark };
    }
    if (c2 === 'reject') {
        return { status: 'Reviewer Rejected', rejectionStage: 'Reviewer 2', rejectionRemark: r2Report?.remark };
    }
    if (c1 === 'accept' && (c2 === null || c2 === 'accept')) {
        return { status: 'Accepted' };
    }
    if (c1 === 'minor' && c2 === 'minor') {
        return {
            status: 'Review Revision',
            revisionDecision: 'Accept with Minor Revision',
            revisionRemark: [r1Report?.remark, r2Report?.remark].filter(Boolean).join(' | '),
            revisionStage: 'Both',
        };
    }
    if ((c1 === 'minor' && c2 === 'major') || (c1 === 'major' && c2 === 'minor')) {
        return {
            status: 'Review Revision',
            revisionDecision: 'Accept with Major Revision',
            revisionRemark: [r1Report?.remark, r2Report?.remark].filter(Boolean).join(' | '),
            revisionStage: c1 === 'major' ? 'Reviewer 1' : 'Reviewer 2',
        };
    }
    if (c1 === 'accept' && c2 === 'minor') {
        return { status: 'Review Revision', revisionDecision: 'Accept with Minor Revision', revisionRemark: r2Report?.remark, revisionStage: 'Reviewer 2' };
    }
    if (c1 === 'minor' && c2 === null) {
        return { status: 'Review Revision', revisionDecision: 'Accept with Minor Revision', revisionRemark: r1Report?.remark, revisionStage: 'Reviewer 1' };
    }
    if (c1 === 'accept' && c2 === 'major') {
        return { status: 'Review Revision', revisionDecision: 'Accept with Major Revision', revisionRemark: r2Report?.remark, revisionStage: 'Reviewer 2' };
    }
    if (c1 === 'major' && c2 === null) {
        return { status: 'Review Revision', revisionDecision: 'Accept with Major Revision', revisionRemark: r1Report?.remark, revisionStage: 'Reviewer 1' };
    }
    // Fallback — still waiting (should not reach here when called by deadline job)
    return { status: 'Under Review' };
}

/**
 * Main job: find and process expired deadlines.
 */
exports.processExpiredReviewDeadlines = async () => {
    const now = new Date();

    // Find all Under Review papers whose deadline has passed and haven't been triggered yet
    const articles = await Article.find({
        status: 'Under Review',
        reviewDeadline: { $lte: now },
        reviewDeadlineTriggered: { $ne: true },
    }).populate('submittedBy', 'email fullName name');

    if (articles.length === 0) return;

    console.log(`[Review Deadline Job] Processing ${articles.length} article(s) with expired deadlines.`);

    for (const article of articles) {
        try {
            const r1Done = !!article.reviewer1Report?.decision;
            const r2Done = !!article.reviewer2Report?.decision;

            // Skip if somehow both have reviewed (shouldn't happen but be safe)
            if (r1Done && r2Done) {
                article.reviewDeadlineTriggered = true;
                await article.save();
                continue;
            }

            // Skip if neither has reviewed — unexpected, but protect against infinite loops
            if (!r1Done && !r2Done) {
                console.warn(`[Review Deadline Job] Article ${article.articleId}: deadline passed but NO reviews submitted. Skipping.`);
                article.reviewDeadlineTriggered = true;
                await article.save();
                continue;
            }

            // Determine which review we have — normalize so d1 is always the present decision.
            // CRITICAL: if only R2 reviewed (d1 is null), computeCombinedOutcome would fall
            // through to 'Under Review' because all cases start with a c1 check.
            // Swap so the available review is always in the d1 position.
            let d1, d2, r1Rep, r2Rep;
            if (r1Done && !r2Done) {
                d1 = article.reviewer1Report.decision;
                d2 = null;
                r1Rep = article.reviewer1Report;
                r2Rep = null;
            } else {
                // r2Done && !r1Done
                d1 = article.reviewer2Report.decision;
                d2 = null;
                r1Rep = article.reviewer2Report;
                r2Rep = null;
            }

            const absentReviewer = !r1Done ? 'Reviewer 1' : 'Reviewer 2';
            console.log(`[Review Deadline Job] Article ${article.articleId}: deadline passed, ${absentReviewer} did not review. Finalizing with available review (decision: ${d1}).`);

            const outcome = computeCombinedOutcome(d1, d2, r1Rep, r2Rep);

            // Safety guard: if somehow still Under Review, don't lock it — let the job retry
            if (outcome.status === 'Under Review') {
                console.warn(`[Review Deadline Job] Article ${article.articleId}: outcome resolved to Under Review unexpectedly. Will retry next cycle.`);
                continue;
            }

            article.status = outcome.status;
            article.reviewDeadlineTriggered = true;

            if (outcome.status === 'Reviewer Rejected') {
                article.reviewRejectionStage = outcome.rejectionStage;
                article.reviewRejectionRemark = outcome.rejectionRemark;
                article.reviewRevisionStage = undefined;
                article.reviewRevisionRemark = undefined;
                article.reviewRevisionDecision = undefined;

                if (article.submittedBy?.email) {
                    try {
                        emailUtils.sendReviewRejectionEmail(article.submittedBy.email, article.articleId, article.title, outcome.rejectionRemark);
                        notifUtils.notifyReviewRejection(article.submittedBy.email, article.articleId, article.title, outcome.rejectionRemark);
                    } catch (e) { console.error('Email error:', e); }
                }
            } else if (outcome.status === 'Review Revision') {
                article.reviewRevisionStage = outcome.revisionStage;
                article.reviewRevisionRemark = outcome.revisionRemark;
                article.reviewRevisionDecision = outcome.revisionDecision;

                if (article.submittedBy?.email) {
                    try {
                        emailUtils.sendReviewRevisionEmail(article.submittedBy.email, article.articleId, article.title, outcome.revisionDecision, outcome.revisionRemark);
                        notifUtils.notifyReviewRevision(article.submittedBy.email, article.articleId, article.title, outcome.revisionDecision, outcome.revisionRemark);
                    } catch (e) { console.error('Email error:', e); }
                }
            } else if (outcome.status === 'Accepted') {
                if (article.submittedBy?.email) {
                    try {
                        emailUtils.sendFinalAcceptanceEmail(article.submittedBy.email, article.articleId, article.title);
                        notifUtils.notifyFinalAcceptance(article.submittedBy.email, article.articleId, article.title);
                    } catch (e) { console.error('Email error:', e); }
                }
                try {
                    notifUtils.notifySuperadminPaperAccepted(article.articleId, article.title);
                } catch (e) { console.error('Notif error:', e); }
            }

            await article.save();
            console.log(`[Review Deadline Job] Article ${article.articleId}: finalized with status "${article.status}".`);
        } catch (err) {
            console.error(`[Review Deadline Job] Error processing ${article.articleId}:`, err);
        }
    }
};
