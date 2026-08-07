const multer = require("multer");

const AppError = require("../../shared/utils/AppError");

const allowedMimeTypes = new Set([
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
]);

const allowedExtensions = /\.(xls|xlsx)$/i;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const hasAllowedExtension = allowedExtensions.test(file.originalname);
    const hasAllowedMimeType = allowedMimeTypes.has(file.mimetype);

    if (!hasAllowedExtension || !hasAllowedMimeType) {
      return cb(new AppError("Only .xls and .xlsx files are allowed", 400));
    }

    cb(null, true);
  },
});

const uploadProductExcel = (req, res, next) => {
  upload.fields([
    { name: "excel", maxCount: 1 },
    { name: "file", maxCount: 1 },
  ])(req, res, (error) => {
    if (!error) {
      req.file = req.files?.excel?.[0] || req.files?.file?.[0];
      return next();
    }

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return next(new AppError("Product Excel must be 5MB or smaller", 400));
    }

    next(error);
  });
};

module.exports = uploadProductExcel;
