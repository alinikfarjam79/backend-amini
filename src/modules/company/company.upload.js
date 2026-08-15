const multer = require("multer");

const AppError = require("../../shared/utils/AppError");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const uploadCompanyFile = (req, res, next) => {
  upload.any()(req, res, (error) => {
    if (!error) {
      req.filesList = req.files || [];

      if (req.filesList.length > 20) {
        return next(new AppError("You can upload up to 20 company files", 400));
      }

      return next();
    }

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return next(new AppError("Company file must be 10MB or smaller", 400));
    }

    next(error);
  });
};

module.exports = uploadCompanyFile;
