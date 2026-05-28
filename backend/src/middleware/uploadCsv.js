import multer from 'multer';

export const uploadCsv = multer({
  storage: multer.memoryStorage(),

  fileFilter: (req, file, cb) => {
    if (!file.originalname.match(/\.csv$/i)) {
      return cb(new Error('Only CSV files allowed'));
    }

    cb(null, true);
  },

  limits: {
    fileSize: 5 * 1024 * 1024
  }
});