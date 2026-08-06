const express = require('express');
const marketingController = require('../../controllers/marketing.controller');

const router = express.Router();

router.get('/homepage-ads', marketingController.getPublicHomepageAds);

module.exports = router;
