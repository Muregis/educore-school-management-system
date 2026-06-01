import { Router } from "express";
import multer from "multer";
import { uploadBufferToCloudinary, deleteFromCloudinary } from "../services/cloudinary.service.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed.'), false);
    }
  }
});

/**
 * Upload an image to Cloudinary
 * POST /api/upload/image
 */
router.post("/image", authRequired, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const result = await uploadBufferToCloudinary(
      req.file.buffer,
      req.file.originalname,
      {
        folder: 'educore',
        transformation: [
          { quality: 'auto', fetch_format: 'auto' }
        ]
      }
    );

    res.json({
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Failed to upload image" });
  }
});

/**
 * Delete an image from Cloudinary
 * DELETE /api/upload/image/:publicId
 */
router.delete("/image/:publicId", authRequired, async (req, res) => {
  try {
    const { publicId } = req.params;
    
    if (!publicId) {
      return res.status(400).json({ error: "Public ID is required" });
    }

    const result = await deleteFromCloudinary(publicId);

    if (result.result === 'ok') {
      res.json({ success: true, message: "Image deleted successfully" });
    } else {
      res.status(404).json({ error: "Image not found or already deleted" });
    }
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ error: "Failed to delete image" });
  }
});

export default router;
