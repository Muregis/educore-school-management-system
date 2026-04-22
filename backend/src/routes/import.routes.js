import { Router } from "express";
import multer from "multer";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";
import { ImportService } from "../services/import.service.js";
import { importRateLimit } from "../middleware/rateLimit.js";

const router = Router();
router.use(authRequired);

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  }
});

// ─── GET /api/import/template ────────────────────────────────────────────────
router.get("/template", requireRoles("admin", "teacher", "director", "superadmin"), (req, res) => {
  try {
    const csvTemplate = ImportService.generateCSVTemplate();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=student_import_template.csv');
    res.send(csvTemplate);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── POST /api/import/students ───────────────────────────────────────────────
router.post("/students", 
  requireRoles("admin", "teacher", "director", "superadmin"), 
  importRateLimit,
  upload.single('csvFile'), 
  async (req, res, next) => {
    try {
      const { schoolId } = req.user;

      if (!req.file) {
        return res.status(400).json({ message: "CSV file is required" });
      }

      // Validate file
      ImportService.validateCSVFile(req.file);

      // Parse CSV
      const { students, errors: parseErrors } = ImportService.parseCSV(req.file.buffer);

      if (parseErrors.length > 0) {
        return res.status(400).json({ 
          message: "CSV parsing errors", 
          errors: parseErrors 
        });
      }

      if (students.length === 0) {
        return res.status(400).json({ message: "No valid students found in CSV" });
      }

      // Import students
      const results = await ImportService.importStudents(schoolId, students, req);

      res.json({
        message: "Import completed",
        summary: {
          total: students.length,
          imported: results.imported.length,
          duplicates: results.duplicates.length,
          errors: results.errors.length
        },
        details: results
      });

    } catch (error) {
      next(error);
    }
  }
);

// ─── GET /api/import/export/students ───────────────────────────────────────────
router.get("/export/students", 
  requireRoles("admin", "teacher", "director", "superadmin"), 
  async (req, res, next) => {
    try {
      const { schoolId } = req.user;
      const { classId, status, format = 'csv' } = req.query;

      const filters = {};
      if (classId) filters.classId = classId;
      if (status) filters.status = status;

      const csvData = await ImportService.exportStudentsToCSV(schoolId, filters);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=students_export.csv');
      res.send(csvData);

    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /api/import/validate ───────────────────────────────────────────────
router.post("/validate", 
  requireRoles("admin", "teacher", "director", "superadmin"), 
  upload.single('csvFile'), 
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "CSV file is required" });
      }

      // Validate file
      ImportService.validateCSVFile(req.file);

      // Parse CSV (without importing)
      const { students, errors } = ImportService.parseCSV(req.file.buffer);

      res.json({
        valid: errors.length === 0,
        summary: {
          totalRows: students.length + errors.length,
          validStudents: students.length,
          errors: errors.length
        },
        errors: errors.slice(0, 10), // Show first 10 errors
        sampleData: students.slice(0, 5) // Show first 5 valid rows
      });

    } catch (error) {
      next(error);
    }
  }
);

export default router;
