const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Resolve uploads directory and ensure it exists
const uploadDir = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Allowed MIME types and extensions for complaint evidence
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

// Storage Engine
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate secure collision-resistant filename: complaint-<timestamp>-<hash><ext>
    const ext = path.extname(file.originalname).toLowerCase();
    const randomHex = crypto.randomBytes(6).toString('hex');
    const safeFilename = `complaint-${Date.now()}-${randomHex}${ext}`;
    cb(null, safeFilename);
  }
});

// File Filter for format validation
const fileFilter = function (req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  const isMimeValid = ALLOWED_MIME_TYPES.includes(file.mimetype);
  const isExtValid = ALLOWED_EXTENSIONS.includes(ext);

  if (isMimeValid && isExtValid) {
    cb(null, true);
  } else {
    const error = new Error('Invalid file format. Only JPEG, PNG, and WEBP images are allowed.');
    error.code = 'INVALID_FILE_TYPE';
    cb(error, false);
  }
};

// Multer Instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB max file size
  }
});

/**
 * Express middleware wrapper for single photo upload ('photo' field)
 * Catches Multer errors and returns user-friendly JSON responses.
 */
function handlePhotoUpload(req, res, next) {
  const singleUpload = upload.single('photo');

  singleUpload(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'File too large. Image size must not exceed 5MB.'
        });
      }
      return res.status(400).json({
        success: false,
        error: `File upload error: ${err.message}`
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }

    // Attach relative URL path for easy database saving and client consumption
    if (req.file) {
      req.file.relativeUrl = `/uploads/${req.file.filename}`;
    }

    next();
  });
}

module.exports = {
  handlePhotoUpload,
  uploadDir
};

