import { v2 as cloudinary } from 'cloudinary';
import { env } from './env.js';

// Configure Cloudinary
cloudinary.config({
  cloud_name: env.cloudinaryCloudName,
  api_key: env.cloudinaryApiKey,
  api_secret: env.cloudinaryApiSecret,
  secure: true,
});

export default cloudinary;
