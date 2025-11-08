const express = require('express');
const router = express.Router();
const apiClient = require('../utils/api');
const { requireAuth } = require('../middleware/auth');

const DEFAULT_FORM = {
  meal_type: 'lunch',
  image_base64: '',
};

const renderPage = (res, payload = {}) => {
  res.render('intelligent-flow', {
    title: 'Intelligent Flow',
    form: payload.form || DEFAULT_FORM,
    result: payload.result || null,
    job: payload.job || null,
    jobStatus: payload.jobStatus || null,
    errorMessage: payload.errorMessage || null,
  });
};

router.get('/', requireAuth, (req, res) => {
  renderPage(res);
});

router.post('/run', requireAuth, async (req, res) => {
  const { meal_type, image_base64, mode } = req.body;
  const form = {
    meal_type: meal_type || 'lunch',
    image_base64: image_base64 || '',
  };

  if (!form.image_base64) {
    return renderPage(res, {
      form,
      errorMessage: 'Please provide an image in Base64 format.',
    });
  }

  try {
    const asyncMode = mode === 'async';
    const data = await apiClient.runIntelligentFlow(
      {
        image_base64: form.image_base64.trim(),
        meal_type: form.meal_type || 'lunch',
      },
      req.cookies.access_token,
      { asyncMode }
    );

    if (asyncMode) {
      renderPage(res, { form, job: data });
    } else {
      renderPage(res, { form, result: data });
    }
  } catch (error) {
    renderPage(res, {
      form,
      errorMessage: error.message || 'Failed to execute intelligent flow.',
    });
  }
});

router.post('/job', requireAuth, async (req, res) => {
  const { job_id } = req.body;
  const form = {
    meal_type: req.body.meal_type || DEFAULT_FORM.meal_type,
    image_base64: req.body.image_base64 || DEFAULT_FORM.image_base64,
  };

  if (!job_id) {
    return renderPage(res, {
      form,
      errorMessage: 'Please provide a job ID to fetch status.',
    });
  }

  try {
    const jobStatus = await apiClient.getIntelligentFlowJob(job_id.trim(), req.cookies.access_token);
    renderPage(res, { form, jobStatus });
  } catch (error) {
    renderPage(res, {
      form,
      errorMessage: error.message || 'Failed to fetch job status.',
    });
  }
});

module.exports = router;
