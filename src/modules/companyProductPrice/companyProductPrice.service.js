const XLSX = require("xlsx");

const config = require("../../config/companyProductPrice");
const AppError = require("../../shared/utils/AppError");
const repository = require("./companyProductPrice.repository");

const digitMap = {
  "\u06f0": "0", "\u06f1": "1", "\u06f2": "2", "\u06f3": "3", "\u06f4": "4",
  "\u06f5": "5", "\u06f6": "6", "\u06f7": "7", "\u06f8": "8", "\u06f9": "9",
  "\u0660": "0", "\u0661": "1", "\u0662": "2", "\u0663": "3", "\u0664": "4",
  "\u0665": "5", "\u0666": "6", "\u0667": "7", "\u0668": "8", "\u0669": "9",
};

const normalizeText = (value) => String(value ?? "")
  .trim()
  .replace(/\u064a/g, "\u06cc")
  .replace(/\u0643/g, "\u06a9")
  .replace(/[\u06f0-\u06f9\u0660-\u0669]/g, (digit) => digitMap[digit])
  .replace(/\s+/g, " ");

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeProductText = (value) => {
  let normalized = normalizeText(value);

  for (const [source, target] of config.textReplacements) {
    const normalizedSource = normalizeText(source);
    normalized = normalized.replace(
      new RegExp(escapeRegExp(normalizedSource), "gi"),
      normalizeText(target)
    );
  }

  return normalized.replace(/\s+/g, " ").trim();
};

const normalizeHeader = (value) => normalizeText(value).replace(/\s+/g, "");
const normalizeCode = (value) => normalizeText(value).replace(/\$/g, "").trim();
const searchableFields = [
  "title",
  "sourceTitle",
  "code",
  "productCode",
  "size",
  "companyName",
];

const getSearchConditions = (value) => {
  const tokens = normalizeProductText(value)
    .replace(/\$/g, "")
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);

  return tokens.map((token) => ({
    $or: searchableFields.map((field) => ({
      [field]: { $regex: escapeRegExp(token), $options: "i" },
    })),
  }));
};

const createIdentityKey = ({ companyName, code, size }) => {
  const normalizedCompanyName = normalizeText(companyName).toLowerCase();

  return JSON.stringify([
    normalizedCompanyName,
    normalizeCode(code).toLowerCase(),
    normalizeProductText(size).toLowerCase(),
  ]);
};

const getHeaderMap = (headers) => Object.entries(config.excelColumns).reduce(
  (result, [field, aliases]) => {
    const header = headers.find((item) =>
      aliases.some((alias) => normalizeHeader(item) === normalizeHeader(alias))
    );

    if (header !== undefined) {
      result[field] = header;
    }

    return result;
  },
  {}
);

const parsePrice = (value) => {
  const normalized = normalizeText(value).replace(/[\s,\u060c]/g, "");

  if (!normalized) {
    return { valid: true, value: null };
  }

  const price = Number(normalized);
  return Number.isFinite(price) && price >= 0
    ? { valid: true, value: price }
    : { valid: false, value: null };
};

const parseWorksheet = (worksheet, companyName, uploadDate) => {
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false });

  if (!rows.length) {
    throw new AppError("Company product price Excel is empty", 400);
  }

  const headerMap = getHeaderMap(Object.keys(rows[0]));
  const missingColumns = Object.keys(config.excelColumns)
    .filter((field) => !headerMap[field])
    .map((field) => config.excelColumns[field][0]);

  if (missingColumns.length) {
    throw new AppError(
      `Company product price Excel is missing required columns: ${missingColumns.join(", ")}`,
      400
    );
  }

  const productsByKey = new Map();
  const errors = [];
  let validRows = 0;

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const sourceTitle = normalizeProductText(row[headerMap.title]);
    const code = normalizeCode(row[headerMap.code]);
    const productCode = normalizeCode(row[headerMap.productCode]) || null;
    const size = normalizeProductText(row[headerMap.size]);
    const prices = {
      factoryPrice: parsePrice(row[headerMap.factoryPrice]),
      wholesalePrice: parsePrice(row[headerMap.wholesalePrice]),
      consumerPrice: parsePrice(row[headerMap.consumerPrice]),
    };
    const rowErrors = [];

    if (!sourceTitle) rowErrors.push("title is required");
    if (!code) rowErrors.push("code is required");
    if (!size) rowErrors.push("size is required");

    for (const [field, price] of Object.entries(prices)) {
      if (!price.valid) rowErrors.push(`${field} must be a valid non-negative number or empty`);
    }

    if (rowErrors.length) {
      errors.push({ row: rowNumber, code: code || null, title: sourceTitle || null, message: rowErrors.join("; ") });
      return;
    }

    const product = {
      companyName,
      uploadDate,
      identityKey: createIdentityKey({ companyName, code, size }),
      isCurrent: true,
      code,
      productCode,
      sourceTitle,
      size,
      title: [sourceTitle, code, size, companyName].join(" "),
      factoryPrice: prices.factoryPrice.value,
      wholesalePrice: prices.wholesalePrice.value,
      consumerPrice: prices.consumerPrice.value,
    };

    validRows += 1;
    productsByKey.set(product.identityKey, product);
  });

  return {
    products: [...productsByKey.values()],
    errors,
    totalRows: rows.length,
    validRows,
  };
};

const uploadExcel = async ({ file, companyName, uploadDate }) => {
  const normalizedCompanyName = normalizeText(companyName);
  const normalizedUploadDate = normalizeText(uploadDate);

  if (!normalizedCompanyName) throw new AppError("Company name is required", 400);
  if (!normalizedUploadDate) throw new AppError("Upload date is required", 400);
  if (!file) throw new AppError("Company product price Excel is required", 400);

  const workbook = XLSX.read(file.buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new AppError("Excel does not contain any sheets", 400);

  const parsed = parseWorksheet(
    workbook.Sheets[sheetName],
    normalizedCompanyName,
    normalizedUploadDate
  );
  const result = await repository.createVersions(parsed.products);
  const replacedCurrentProducts = result.replacedCurrentCount || 0;
  const insertedProducts = result.insertedCount || 0;

  return {
    companyName: normalizedCompanyName,
    uploadDate: normalizedUploadDate,
    totalRows: parsed.totalRows,
    validRows: parsed.validRows,
    invalidRows: parsed.errors.length,
    savedProducts: parsed.products.length,
    duplicateRows: parsed.validRows - parsed.products.length,
    newProducts: Math.max(0, insertedProducts - replacedCurrentProducts),
    updatedProducts: replacedCurrentProducts,
    replacedCurrentProducts,
    createdVersions: insertedProducts,
    errors: parsed.errors,
  };
};

const getProducts = async (query = {}) => {
  const filter = { isCurrent: true };
  const companyName = normalizeText(query.companyName);
  const searchConditions = getSearchConditions(query.search);

  if (companyName) filter.companyName = companyName;
  if (searchConditions.length) filter.$and = searchConditions;

  return repository.findAll(filter);
};

const getHistory = async (query = {}) => {
  const filter = {};
  const companyName = normalizeText(query.companyName);
  const uploadDate = normalizeText(query.uploadDate || query.date);
  const searchConditions = getSearchConditions(query.search);

  if (companyName) filter.companyName = companyName;
  if (uploadDate) filter.uploadDate = uploadDate;
  if (searchConditions.length) filter.$and = searchConditions;

  return repository.findHistory(filter);
};

const ensureCompanyProductPriceIndexes = () => repository.syncIndexes();

module.exports = {
  createIdentityKey,
  ensureCompanyProductPriceIndexes,
  getHistory,
  getProducts,
  getSearchConditions,
  normalizeCode,
  normalizeProductText,
  parseWorksheet,
  uploadExcel,
};
