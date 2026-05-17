// T-05: Standalone /api/assignments router — provides the accept / return
// endpoints exactly at the path shape required by the PRD:
//
//   POST /api/assignments/:id/reports/:reportId/accept
//   POST /api/assignments/:id/reports/:reportId/return  (body.comment ≥ 10 chars)
//
// These are functional aliases of the existing nested endpoints at
//   /api/clients/:cid/assignments/:aid/reports/:rid/(accept|return)
// We derive the client_id internally from the assignment row so the URL
// shape matches the spec, but still go through the same consent gate as
// every other client-data route.
//
// All logic lives in services/assignmentReports.js — this file is just an
// auth + ownership shim that hangs off the standalone router.

const express = require('express');
const { logger } = require('../utils/logger');
const { authenticate, requireRole } = require('../middleware/auth');
const { verifyClientConsent } = require('../utils/consentCheck');
const assignmentsService = require('../services/assignments');
const assignmentReports = require('../services/assignmentReports');

const router = express.Router();

// Every endpoint requires a logged-in therapist (or superadmin).
router.use(authenticate);
router.use(requireRole('therapist', 'superadmin'));

/**
 * Lookup helper: given an assignment id, return { therapist_id, client_id }
 * when the assignment belongs to req.user (the therapist) and exists, or
 * an error object otherwise.
 */
function resolveAssignmentOwnership(req, assignmentId) {
  const therapistId = req.user.id;
  // assignmentReports.findAssignmentBase pulls the same triple we need:
  // (id, therapist_id, client_id, status). We trust it because it bypasses
  // the heavier listAssignments path.
  const base = assignmentReports.findAssignmentBase(assignmentId);
  if (!base) return { error: 'Assignment not found', status: 404 };
  if (Number(base.therapist_id) !== Number(therapistId)) {
    return { error: 'Forbidden', status: 403 };
  }
  return { therapistId, clientId: Number(base.client_id), assignment: base };
}

// POST /api/assignments/:id/reports/:reportId/accept
router.post('/:id/reports/:reportId/accept', (req, res) => {
  try {
    const assignmentId = parseInt(req.params.id, 10);
    const reportId = parseInt(req.params.reportId, 10);
    if (!Number.isFinite(assignmentId) || assignmentId <= 0) {
      return res.status(400).json({ error: 'Invalid assignment id' });
    }
    if (!Number.isFinite(reportId) || reportId <= 0) {
      return res.status(400).json({ error: 'Invalid report id' });
    }
    const own = resolveAssignmentOwnership(req, assignmentId);
    if (own.error) return res.status(own.status).json({ error: own.error });

    const consentCheck = verifyClientConsent(own.therapistId, own.clientId, 'accept_assignment_report');
    if (!consentCheck.allowed) {
      return res.status(consentCheck.status).json({ error: consentCheck.error });
    }

    const result = assignmentReports.acceptReport(own.therapistId, reportId);
    if (result.notFound) return res.status(404).json({ error: 'Report not found' });
    if (result.forbidden) return res.status(403).json({ error: 'Forbidden' });
    if (result.invalid_input) return res.status(400).json({ error: result.invalid_input });
    if (result.report && Number(result.report.assignment_id) !== assignmentId) {
      return res.status(404).json({ error: 'Report not found in this assignment' });
    }
    res.json(result.report);
  } catch (error) {
    logger.error('Accept report alias error: ' + error.message);
    res.status(500).json({ error: 'Failed to accept report' });
  }
});

// POST /api/assignments/:id/reports/:reportId/return
router.post('/:id/reports/:reportId/return', (req, res) => {
  try {
    const assignmentId = parseInt(req.params.id, 10);
    const reportId = parseInt(req.params.reportId, 10);
    if (!Number.isFinite(assignmentId) || assignmentId <= 0) {
      return res.status(400).json({ error: 'Invalid assignment id' });
    }
    if (!Number.isFinite(reportId) || reportId <= 0) {
      return res.status(400).json({ error: 'Invalid report id' });
    }
    const own = resolveAssignmentOwnership(req, assignmentId);
    if (own.error) return res.status(own.status).json({ error: own.error });

    const consentCheck = verifyClientConsent(own.therapistId, own.clientId, 'return_assignment_report');
    if (!consentCheck.allowed) {
      return res.status(consentCheck.status).json({ error: consentCheck.error });
    }

    const comment = (req.body || {}).comment;
    const result = assignmentReports.returnReport(own.therapistId, reportId, comment);
    if (result.notFound) return res.status(404).json({ error: 'Report not found' });
    if (result.forbidden) return res.status(403).json({ error: 'Forbidden' });
    if (result.conflict) return res.status(409).json({ error: result.conflict });
    if (result.invalid_input) return res.status(400).json({ error: result.invalid_input });
    if (result.report && Number(result.report.assignment_id) !== assignmentId) {
      return res.status(404).json({ error: 'Report not found in this assignment' });
    }
    res.json(result.report);
  } catch (error) {
    if (error.code === 'invalid_input') {
      return res.status(400).json({ error: error.message });
    }
    logger.error('Return report alias error: ' + error.message);
    res.status(500).json({ error: 'Failed to return report' });
  }
});

module.exports = router;
