const multer = require("multer");

const AppError = require("../../shared/utils/AppError");

const allowedMimeTypes = new Set([
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const validExtension = /\.(xls|xlsx)$/i.test(file.originalname);

    if (!validExtension || !allowedMimeTypes.has(file.mimetype)) {
      return callback(new AppError("Only .xls and .xlsx files are allowed", 400));
    }

    callback(null, true);
  },
});

module.exports = (req, res, next) => {
  upload.fields([
    { name: "excel", maxCount: 1 },
    { name: "file", maxCount: 1 },
  ])(req, res, (error) => {
    if (!error) {
      req.file = req.files?.excel?.[0] || req.files?.file?.[0];
      return next();
    }

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return next(new AppError("Company product price Excel must be 10MB or smaller", 400));
    }

    next(error);
  });
};
