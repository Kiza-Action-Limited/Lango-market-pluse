// config/cloudinary.config.js
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload file buffer to Cloudinary (without streamifier)
const uploadToCloudinary = (buffer, folder = 'products', mimeType = 'image/jpeg') => {
  return new Promise((resolve, reject) => {
    const sanitizedMimeType = mimeType || 'image/jpeg';
    const base64String = buffer.toString('base64');
    const dataURI = `data:${sanitizedMimeType};base64,${base64String}`;

    cloudinary.uploader.upload(dataURI, {
      folder: folder,
      resource_type: 'image',
      allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'gif'],
      transformation: [
        { width: 800, height: 800, crop: 'limit', quality: 'auto' }
      ],
    }, (error, result) => {
      if (error) {
        console.error('Cloudinary upload error:', error);
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
};

// Alternative using upload_stream (requires streamifier)
const uploadToCloudinaryWithStream = (buffer, folder = 'products') => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'gif'],
        transformation: [
          { width: 800, height: 800, crop: 'limit', quality: 'auto' }
        ],
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
    
    // Create readable stream from buffer
    const { Readable } = require('stream');
    const readableStream = new Readable();
    readableStream.push(buffer);
    readableStream.push(null);
    readableStream.pipe(uploadStream);
  });
};

// Delete image from Cloudinary
const deleteFromCloudinary = async (publicId) => {
  try {
    if (!publicId) return null;
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw error;
  }
};

// Extract public ID from Cloudinary URL
const getPublicIdFromUrl = (url) => {
  try {
    if (!url) return null;
    const parts = url.split('/');
    const filename = parts.pop();
    const folderIndex = parts.findIndex(part => part === 'products');
    if (folderIndex === -1) return null;
    const publicId = `${parts.slice(folderIndex).join('/')}/${filename.split('.')[0]}`;
    return publicId;
  } catch (error) {
    console.error('Error extracting public ID:', error);
    return null;
  }
};

module.exports = {
  cloudinary,
  uploadToCloudinary, // Use this version (doesn't require streamifier)
  uploadToCloudinaryWithStream, // Alternative version
  deleteFromCloudinary,
  getPublicIdFromUrl,
};