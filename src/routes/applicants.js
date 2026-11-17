const express = require('express');

/**
 * HTTP layer only: translates requests and responses. Rules live in the service.
 * The contract has already validated the request structure (RNF-12).
 */
function createApplicantsRouter({ applicantService }) {
  const router = express.Router();

  // RF-01: public registration.
  router.post('/', async (req, res) => {
    const cvFile = (req.files || []).find((file) => file.fieldname === 'cv');
    const receipt = await applicantService.register(req.body, cvFile);
    res.status(201).json(receipt);
  });

  return router;
}

module.exports = { createApplicantsRouter };
