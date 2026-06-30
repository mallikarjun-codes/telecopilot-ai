const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const uploadDirectory = path.resolve(__dirname, '../../../uploads');

fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination(req, file, callback) {
    callback(null, uploadDirectory);
  },
  filename(req, file, callback) {
    callback(null, `${crypto.randomUUID()}.pdf`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter(req, file, callback) {
    if (file.mimetype !== 'application/pdf') {
      const error = new Error('Only PDF files are allowed.');
      error.statusCode = 400;
      return callback(error);
    }

    return callback(null, true);
  },
});

function uploadPdf(req, res, next) {
  upload.single('file')(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      error.message = 'PDF file must not exceed 20MB.';
      error.statusCode = 413;
    } else if (error instanceof multer.MulterError) {
      error.statusCode = 400;
    }

    return next(error);
  });
}

module.exports = uploadPdf;
