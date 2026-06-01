import cloudinary from '../config/cloudinary.js';

/**
 * Upload a file to Cloudinary
 * @param {string} filePath - Path to the file to upload
 * @param {object} options - Cloudinary upload options
 * @returns {Promise<object>} - Upload result
 */
export const uploadToCloudinary = async (filePath, options = {}) => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: 'educore',
      resource_type: 'auto',
      ...options,
    });
    return result;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error('Failed to upload file to Cloudinary');
  }
};

/**
 * Upload a buffer to Cloudinary
 * @param {Buffer} buffer - File buffer
 * @param {string} fileName - Name of the file
 * @param {object} options - Cloudinary upload options
 * @returns {Promise<object>} - Upload result
 */
export const uploadBufferToCloudinary = async (buffer, fileName, options = {}) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder: 'educore',
        resource_type: 'auto',
        public_id: fileName,
        ...options,
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary buffer upload error:', error);
          reject(new Error('Failed to upload buffer to Cloudinary'));
        } else {
          resolve(result);
        }
      }
    ).end(buffer);
  });
};

/**
 * Delete a file from Cloudinary
 * @param {string} publicId - Public ID of the file to delete
 * @returns {Promise<object>} - Delete result
 */
export const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw new Error('Failed to delete file from Cloudinary');
  }
};

/**
 * Get file URL from Cloudinary
 * @param {string} publicId - Public ID of the file
 * @param {object} transformations - Image transformations
 * @returns {string} - File URL
 */
export const getCloudinaryUrl = (publicId, transformations = {}) => {
  return cloudinary.url(publicId, transformations);
};
