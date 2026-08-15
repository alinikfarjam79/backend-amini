const crypto = require("crypto");
const fs = require("fs/promises");
const mongoose = require("mongoose");
const path = require("path");

const companyRepository = require("./company.repository");
const AppError = require("../../shared/utils/AppError");

const uploadDirectory = path.join(__dirname, "..", "..", "..", "uploads", "company-files");
const publicUploadPath = "/uploads/company-files";

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
      const savedFile = await saveCompanyFile(file);

      savedFiles.push({
        ...savedFile,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      });
    }

    const fileDocuments = savedFiles.map((savedFile) => ({
      title: normalizedTitle,
      publishedAt,
      filePath: savedFile.filePath,
      fileUrl: savedFile.fileUrl,
      originalName: savedFile.originalName,
      mimeType: savedFile.mimeType,
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
  getCompanies,
  uploadCompanyFiles,
};
