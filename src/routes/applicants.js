const express = require('express');
const { requireAuth } = require('../middleware/requireAuth');

/**
 * HTTP layer only: translates requests and responses. Rules live in the service.
 * The contract has already validated the request structure (RNF-12).
 */
function createApplicantsRouter({ applicantService }) {
  const router = express.Router();
  const idOf = (req) => Number(req.params.id);

  // RF-01: public registration.
  router.post('/', async (req, res) => {
    const cvFile = (req.files || []).find((file) => file.fieldname === 'cv');
    const receipt = await applicantService.register(req.body, cvFile);
    res.status(201).json(receipt);
  });

  // Analyst panel: every route below requires a session (RNF-02).

  // RF-06, RF-11
  router.get('/', requireAuth, (req, res) => {
    res.json(applicantService.list({ status: req.query.status }));
  });

  // RF-07
  router.get('/:id', requireAuth, (req, res) => {
    res.json(applicantService.getById(idOf(req)));
  });

  // RF-08, RF-10
  router.put('/:id/status', requireAuth, (req, res) => {
    res.json(applicantService.changeStatus(idOf(req), req.body.status, req.session.analyst));
  });

  // RF-10
  router.get('/:id/status-history', requireAuth, (req, res) => {
    res.json(applicantService.getStatusHistory(idOf(req)));
  });

  // RF-09: the only way to reach a stored CV (RNF-03).
  router.get('/:id/cv', requireAuth, async (req, res, next) => {
    const { filePath, downloadName } = await applicantService.getCv(idOf(req));
    res.download(
      filePath,
      downloadName,
      // The browser must treat it as a PDF download, never sniff it as something else.
      { headers: { 'X-Content-Type-Options': 'nosniff' } },
      (err) => {
        if (err && !res.headersSent) next(err);
      },
    );
  });

  return router;
}

module.exports = { createApplicantsRouter };
