import { v2 as cloudinary } from 'cloudinary';
import { env } from './env.js';

// Configure Cloudinary
cloudinary.config({
  cloud_name: env.cloudinaryCloudName,
  api_key: env.cloudinaryApiKey,
  api_secret: env.cloudinaryApiSecret,
  secure: true,
});

// Validate configuration
if (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) {
  console.error('❌ Cloudinary configuration incomplete. Please check your .env file.');
  console.error('Missing:', {
    cloud_name: !env.cloudinaryCloudName ? 'CLOUDINARY_CLOUD_NAME' : undefined,
    api_key: !env.cloudinaryApiKey ? 'CLOUDINARY_API_KEY' : undefined,
    api_secret: !env.cloudinaryApiSecret ? 'CLOUDINARY_API_SECRET' : undefined,
  });
} else {
  console.log('✅ Cloudinary configured successfully');
}

export default cloudinary;
