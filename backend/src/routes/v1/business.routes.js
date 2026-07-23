const express = require('express');
const businessController = require('../../controllers/business.controller');
const { upload, handleUploadError } = require('../../middleware/upload');

const router = express.Router();

router.get('/header', businessController.getHeaderConfig);
router.get('/search', businessController.searchBusinesses);
router.post('/predict-suppliers', businessController.predictSuppliers);
router.post('/search-by-image', upload.single('image'), handleUploadError, businessController.searchByImage);
router.get('/', businessController.getBusinesses);

module.exports = router;
