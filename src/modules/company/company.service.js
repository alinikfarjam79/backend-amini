const crypto = require("crypto");
const { execFile } = require("child_process");
const fs = require("fs/promises");
const mongoose = require("mongoose");
const path = require("path");
const sharp = require("sharp");
const { promisify } = require("util");

const companyRepository = require("./company.repository");
const env = require("../../config/env");
const AppError = require("../../shared/utils/AppError");

const uploadDirectory = path.join(__dirname, "..", "..", "..", "uploads", "company-files");
const publicUploadPath = "/uploads/company-files";
const execFileAsync = promisify(execFile);
const combinedImageGap = 24;
const maxCombinedImagePixels = 50_000_000;

const normalizeSearch = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

const getFileDownloadUrl = (fileUrl, baseUrl) => {
  if (!fileUrl || !baseUrl) {
    return fileUrl;
  }

  return `${baseUrl}${fileUrl}`;
};

const addDownloadUrls = (company, baseUrl) => {
  const companyObject =
    typeof company.toObject === "function" ? company.toObject() : company;

  return {
    ...companyObject,
    files: (companyObject.files || []).map((file) => ({
      ...file,
      downloadUrl: getFileDownloadUrl(file.fileUrl, baseUrl),
    })),
  };
};

const getCompanies = async (query = {}, baseUrl = "") => {
  const filter = {};
  const search = normalizeSearch(query.search);

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { code: { $regex: search, $options: "i" } },
    ];
  }

  const companies = await companyRepository.findAll(filter);

  return companies.map((company) => addDownloadUrls(company, baseUrl));
};

const normalizeCode = (value) => {
  const code = normalizeSearch(value);

  return code || undefined;
};

const createCompany = async (payload) => {
  const name = normalizeSearch(payload.name);
  const code = normalizeCode(payload.code);

  if (!name) {
    throw new AppError("Company name is required", 400);
  }

  if (code) {
    const existingCompany = await companyRepository.findByCode(code);

    if (existingCompany) {
      throw new AppError("Company code already exists", 409);
    }
  }

  return companyRepository.create({
    name,
    code,
    isActive: payload.isActive,
  });
};

const getOrCreateCompanyForUpload = async ({ companyId, companyName, companyCode }) => {
  const name = normalizeSearch(companyName);
  const code = normalizeCode(companyCode);

  if (companyId) {
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      throw new AppError("Invalid company id", 400);
    }

    const existingCompany = await companyRepository.findById(companyId);

    if (existingCompany) {
      return existingCompany;
    }
  }

  if (code) {
    const existingCompany = await companyRepository.findByCode(code);

    if (existingCompany) {
      return existingCompany;
    }
  }

  if (name) {
    const existingCompany = await companyRepository.findByName(name);

    if (existingCompany) {
      return existingCompany;
    }
  }

  if (!name) {
    throw new AppError("Company name is required when company does not exist", 400);
  }

  return companyRepository.create({
    name,
    code,
    isActive: true,
  });
};

const normalizePublishDate = (value) => {
  return normalizeSearch(value);
};

const getStoredFileName = (originalName) => {
  const extension = path.extname(originalName || "");

  return `${crypto.randomUUID()}${extension}`;
};

const saveCompanyFile = async (file) => {
  await fs.mkdir(uploadDirectory, { recursive: true });

  const storedFileName = getStoredFileName(file.originalname);
  const absolutePath = path.join(uploadDirectory, storedFileName);

  await fs.writeFile(absolutePath, file.buffer);

  return {
    filePath: absolutePath,
    fileUrl: `${publicUploadPath}/${storedFileName}`,
  };
};

const isPdfFile = (file) => {
  const extension = path.extname(file.originalname || "").toLowerCase();

  return file.mimetype === "application/pdf" || extension === ".pdf";
};

const getPdfPageNumber = (fileName, outputBaseName) => {
  const match = fileName.match(
    new RegExp(`^${outputBaseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d+)\\.png$`)
  );

  return match ? Number(match[1]) : 0;
};

const createCombinedPdfImage = async ({
  pageFileNames,
  originalName,
  outputBaseName,
}) => {
  const pagePaths = pageFileNames.map((fileName) =>
    path.join(uploadDirectory, fileName)
  );
  const metadata = await Promise.all(
    pagePaths.map((pagePath) => sharp(pagePath).metadata())
  );
  const pageDimensions = metadata.map(({ width, height }) => ({
    width: width || 1,
    height: height || 1,
  }));
  const columns = Math.ceil(Math.sqrt(pagePaths.length));
  const rows = Math.ceil(pagePaths.length / columns);
  const maxPageWidth = Math.max(...pageDimensions.map((page) => page.width));
  const maxPageHeight = Math.max(...pageDimensions.map((page) => page.height));
  const unscaledWidth =
    columns * maxPageWidth + (columns + 1) * combinedImageGap;
  const unscaledHeight =
    rows * maxPageHeight + (rows + 1) * combinedImageGap;
  const scale = Math.min(
    1,
    Math.sqrt(
      maxCombinedImagePixels / (unscaledWidth * unscaledHeight)
    )
  );
  const cellWidth = Math.max(1, Math.round(maxPageWidth * scale));
  const cellHeight = Math.max(1, Math.round(maxPageHeight * scale));
  const canvasWidth =
    columns * cellWidth + (columns + 1) * combinedImageGap;
  const canvasHeight = rows * cellHeight + (rows + 1) * combinedImageGap;
  const combinedFileName = `${outputBaseName}-combined.png`;
  const combinedPath = path.join(uploadDirectory, combinedFileName);

  try {
    const composites = await Promise.all(
      pagePaths.map(async (pagePath, index) => {
        const source =
          scale < 1
            ? await sharp(pagePath)
                .resize({
                  width: Math.max(
                    1,
                    Math.round(pageDimensions[index].width * scale)
                  ),
                  height: Math.max(
                    1,
                    Math.round(pageDimensions[index].height * scale)
                  ),
                  fit: "fill",
                })
                .png()
                .toBuffer()
            : pagePath;
        const column = index % columns;
        const row = Math.floor(index / columns);

        return {
          input: source,
          left: combinedImageGap + column * (cellWidth + combinedImageGap),
          top: combinedImageGap + row * (cellHeight + combinedImageGap),
        };
      })
    );

    await sharp({
      create: {
        width: canvasWidth,
        height: canvasHeight,
        channels: 3,
        background: "white",
      },
    })
      .composite(composites)
      .png({ compressionLevel: 8, adaptiveFiltering: true })
      .toFile(combinedPath);

    const combinedStats = await fs.stat(combinedPath);
    const originalBaseName = path.basename(
      originalName || "company-file.pdf",
      path.extname(originalName || "")
    );

    return {
      filePath: combinedPath,
      fileUrl: `${publicUploadPath}/${combinedFileName}`,
      originalName: `${originalBaseName}-all-pages.png`,
      mimeType: "image/png",
      size: combinedStats.size,
      sourceType: "pdf-combined",
      sourceOriginalName: originalName,
    };
  } catch (error) {
    await fs.rm(combinedPath, { force: true });
    throw error;
  }
};

const convertPdfToImages = async (file) => {
  await fs.mkdir(uploadDirectory, { recursive: true });

  const pdfFileName = `${crypto.randomUUID()}.pdf`;
  const outputBaseName = `${crypto.randomUUID()}-page`;
  const pdfPath = path.join(uploadDirectory, pdfFileName);
  const outputPrefix = path.join(uploadDirectory, outputBaseName);
  const generatedFiles = [];

  try {
    await fs.writeFile(pdfPath, file.buffer);

    await execFileAsync(
      env.pdfRendererPath,
      ["-png", "-r", "150", pdfPath, outputPrefix],
      {
        timeout: 120000,
      }
    );

    const uploadedFiles = await fs.readdir(uploadDirectory);
    const pageFileNames = uploadedFiles
      .filter((fileName) => fileName.startsWith(`${outputBaseName}-`))
      .filter((fileName) => fileName.toLowerCase().endsWith(".png"))
      .sort(
        (first, second) =>
          getPdfPageNumber(first, outputBaseName) -
          getPdfPageNumber(second, outputBaseName)
      );

    if (pageFileNames.length === 0) {
      throw new AppError("PDF does not contain renderable pages", 400);
    }

    for (const pageFileName of pageFileNames) {
      const pageNumber = getPdfPageNumber(pageFileName, outputBaseName);
      const pagePath = path.join(uploadDirectory, pageFileName);
      const pageStats = await fs.stat(pagePath);
      const originalBaseName = path.basename(
        file.originalname || "company-file.pdf",
        path.extname(file.originalname || "")
      );

      generatedFiles.push({
        filePath: pagePath,
        fileUrl: `${publicUploadPath}/${pageFileName}`,
        originalName: `${originalBaseName}-page-${pageNumber}.png`,
        mimeType: "image/png",
        size: pageStats.size,
        sourceType: "pdf-page",
        pageNumber,
        sourceOriginalName: file.originalname,
      });
    }

    const combinedImage = await createCombinedPdfImage({
      pageFileNames,
      originalName: file.originalname,
      outputBaseName,
    });
    generatedFiles.push(combinedImage);

    return generatedFiles;
  } catch (error) {
    await Promise.all(
      generatedFiles.map((generatedFile) =>
        fs.rm(generatedFile.filePath, { force: true })
      )
    );

    if (error.code === "ENOENT") {
      throw new AppError(
        "امکان تبدیل PDF به عکس روی سرور فعال نیست. لطفا ابزار Poppler را روی سرور نصب کنید.",
        503
      );
    }

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError("Could not convert PDF pages to images", 400);
  } finally {
    await fs.rm(pdfPath, { force: true });
  }
};

const saveCompanyUpload = async (file) => {
  if (isPdfFile(file)) {
    return convertPdfToImages(file);
  }

  const savedFile = await saveCompanyFile(file);

  return [
    {
      ...savedFile,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      sourceType: "file",
    },
  ];
};

const removeFileFromDisk = async (filePath) => {
  if (!filePath) {
    return;
  }

  const resolvedUploadDirectory = path.resolve(uploadDirectory);
  const resolvedFilePath = path.resolve(filePath);
  const relativePath = path.relative(resolvedUploadDirectory, resolvedFilePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return;
  }

  await fs.rm(resolvedFilePath, { force: true });
};

const deleteCompanyFile = async ({ companyId, fileId }) => {
  if (!mongoose.Types.ObjectId.isValid(companyId)) {
    throw new AppError("Invalid company id", 400);
  }

  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    throw new AppError("Invalid file id", 400);
  }

  const company = await companyRepository.findById(companyId);

  if (!company) {
    throw new AppError("Company not found", 404);
  }

  const file = company.files.id(fileId);

  if (!file) {
    throw new AppError("Company file not found", 404);
  }

  await companyRepository.removeFileById(companyId, fileId);
  await removeFileFromDisk(file.filePath);

  return true;
};

const uploadCompanyFiles = async ({
  companyId,
  companyName,
  companyCode,
  title,
  publishDate,
  files,
  userId,
}) => {
  const normalizedTitle = normalizeSearch(title);
  const publishedAt = normalizePublishDate(publishDate);

  if (!normalizedTitle) {
    throw new AppError("File title is required", 400);
  }

  if (!publishedAt) {
    throw new AppError("Publish date is required", 400);
  }

  if (!Array.isArray(files) || files.length === 0) {
    throw new AppError("At least one company file is required", 400);
  }

  const savedFiles = [];

  try {
    const targetCompany = await getOrCreateCompanyForUpload({
      companyId,
      companyName,
      companyCode,
    });

    for (const file of files) {
      const savedUploadFiles = await saveCompanyUpload(file);
      savedFiles.push(...savedUploadFiles);
    }

    const fileDocuments = savedFiles.map((savedFile) => ({
      title: normalizedTitle,
      publishedAt,
      filePath: savedFile.filePath,
      fileUrl: savedFile.fileUrl,
      originalName: savedFile.originalName,
      mimeType: savedFile.mimeType,
      sourceType: savedFile.sourceType,
      pageNumber: savedFile.pageNumber,
      sourceOriginalName: savedFile.sourceOriginalName,
      size: savedFile.size,
      uploadedBy: userId,
    }));

    const company = await companyRepository.addFilesById(targetCompany._id, fileDocuments);

    if (!company) {
      throw new AppError("Company not found", 404);
    }

    return {
      company: {
        id: company._id,
        name: company.name,
        code: company.code,
      },
      files: company.files.slice(-fileDocuments.length),
    };
  } catch (error) {
    await Promise.all(
      savedFiles.map((savedFile) => fs.rm(savedFile.filePath, { force: true }))
    );
    throw error;
  }
};

module.exports = {
  createCompany,
  deleteCompanyFile,
  getCompanies,
  uploadCompanyFiles,
};
