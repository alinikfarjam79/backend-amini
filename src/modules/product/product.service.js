const XLSX = require("xlsx");

const productRepository = require("./product.repository");
const AppError = require("../../shared/utils/AppError");

const REQUIRED_COLUMNS = {
  productCode: "\u0643\u062f \u0643\u0627\u0644\u0627",
  title: "\u0639\u0646\u0648\u0627\u0646 \u0643\u0627\u0644\u0627",
  barcode: "\u0628\u0627\u0631\u06a9\u062f \u06a9\u0627\u0644\u0627",
  originalPrice: "\u0642\u06cc\u0645\u062a \u0627\u0635\u0644\u06cc",
};

const QUANTITY_COLUMNS = {
  productCode: "\u06a9\u062f",
  quantity: "\u0645\u0648\u062c\u0648\u062f\u06cc",
};

const persianDigitMap = {
  "\u06f0": "0",
  "\u06f1": "1",
  "\u06f2": "2",
  "\u06f3": "3",
  "\u06f4": "4",
  "\u06f5": "5",
  "\u06f6": "6",
  "\u06f7": "7",
  "\u06f8": "8",
  "\u06f9": "9",
  "\u0660": "0",
  "\u0661": "1",
  "\u0662": "2",
  "\u0663": "3",
  "\u0664": "4",
  "\u0665": "5",
  "\u0666": "6",
  "\u0667": "7",
  "\u0668": "8",
  "\u0669": "9",
};

const normalizeText = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .trim()
    .replace(/[\u064a]/g, "\u06cc")
    .replace(/[\u0643]/g, "\u06a9")
    .replace(/\s+/g, " ");
};

const normalizeNumberText = (value) => {
  return normalizeText(value)
    .replace(/[\u06f0-\u06f9\u0660-\u0669]/g, (digit) => persianDigitMap[digit])
    .replace(/[,\u060c\s]/g, "");
};

const getHeaderMap = (headers) => {
  const normalizedHeaders = headers.map((header) => normalizeText(header));

  return Object.entries(REQUIRED_COLUMNS).reduce((map, [field, column]) => {
    const index = normalizedHeaders.indexOf(normalizeText(column));

    if (index !== -1) {
      map[field] = headers[index];
    }

    return map;
  }, {});
};

const getMissingColumns = (headerMap) => {
  return Object.entries(REQUIRED_COLUMNS)
    .filter(([field]) => !headerMap[field])
    .map(([, column]) => column);
};

const parseOriginalPrice = (value) => {
  const normalized = normalizeNumberText(value);

  if (!normalized) {
    return null;
  }

  const price = Number(normalized);

  if (!Number.isFinite(price) || price < 0) {
    return null;
  }

  return price;
};

const parseQuantity = (value) => {
  const normalized = normalizeNumberText(value);

  if (!normalized) {
    return null;
  }

  const quantity = Number(normalized);

  if (!Number.isInteger(quantity) || quantity < 0) {
    return null;
  }

  return quantity;
};

const getRows = (worksheet, fileLabel) => {
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    defval: "",
    raw: false,
  });

  if (rows.length === 0) {
    throw new AppError(`${fileLabel} is empty`, 400);
  }

  return rows;
};

const parseProductRows = (worksheet) => {
  const rows = getRows(worksheet, "Product Excel");
  const headerMap = getHeaderMap(Object.keys(rows[0]));
  const missingColumns = getMissingColumns(headerMap);

  if (missingColumns.length > 0) {
    throw new AppError(
      `Product Excel is missing required columns: ${missingColumns.join(", ")}`,
      400
    );
  }

  const errors = [];
  const products = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const productCode = normalizeText(row[headerMap.productCode]);
    const title = normalizeText(row[headerMap.title]);
    const barcode = normalizeText(row[headerMap.barcode]) || undefined;
    const originalPrice = parseOriginalPrice(row[headerMap.originalPrice]);

    if (!productCode) {
      errors.push(`Row ${rowNumber}: ${REQUIRED_COLUMNS.productCode} is required`);
    }

    if (!title) {
      errors.push(`Row ${rowNumber}: ${REQUIRED_COLUMNS.title} is required`);
    }

    if (originalPrice === null) {
      errors.push(
        `Row ${rowNumber}: ${REQUIRED_COLUMNS.originalPrice} must be a valid number`
      );
    }

    if (productCode && title && originalPrice !== null) {
      products.push({
        productCode,
        title,
        barcode,
        originalPrice,
      });
    }
  });

  if (errors.length > 0) {
    throw new AppError(errors.join("; "), 400);
  }

  if (products.length === 0) {
    throw new AppError("Product Excel does not contain valid products", 400);
  }

  return products;
};

const getQuantityHeaderMap = (headers) => {
  const normalizedHeaders = headers.map((header) => normalizeText(header));

  return Object.entries(QUANTITY_COLUMNS).reduce((map, [field, column]) => {
    const index = normalizedHeaders.indexOf(normalizeText(column));

    if (index !== -1) {
      map[field] = headers[index];
    }

    return map;
  }, {});
};

const getMissingQuantityColumns = (headerMap) => {
  return Object.entries(QUANTITY_COLUMNS)
    .filter(([field]) => !headerMap[field])
    .map(([, column]) => column);
};

const parseQuantityRows = (worksheet) => {
  const rows = getRows(worksheet, "Product Quantity Excel");
  const headerMap = getQuantityHeaderMap(Object.keys(rows[0]));
  const missingColumns = getMissingQuantityColumns(headerMap);

  if (missingColumns.length > 0) {
    throw new AppError(
      `Product Quantity Excel is missing required columns: ${missingColumns.join(", ")}`,
      400
    );
  }

  const errors = [];
  const quantityByProductCode = new Map();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const productCode = normalizeText(row[headerMap.productCode]);
    const quantity = parseQuantity(row[headerMap.quantity]);

    if (!productCode) {
      errors.push(`Row ${rowNumber}: ${QUANTITY_COLUMNS.productCode} is required`);
    }

    if (quantity === null) {
      errors.push(
        `Row ${rowNumber}: ${QUANTITY_COLUMNS.quantity} must be a valid whole number`
      );
    }

    if (productCode && quantity !== null) {
      quantityByProductCode.set(productCode, quantity);
    }
  });

  if (errors.length > 0) {
    throw new AppError(errors.join("; "), 400);
  }

  if (quantityByProductCode.size === 0) {
    throw new AppError("Product Quantity Excel does not contain valid rows", 400);
  }

  return quantityByProductCode;
};

const getProducts = async (query = {}) => {
  const filter = {};
  const search = normalizeText(query.search);

  if (search) {
    filter.$or = [
      { productCode: { $regex: search, $options: "i" } },
      { title: { $regex: search, $options: "i" } },
      { barcode: { $regex: search, $options: "i" } },
    ];
  }

  return productRepository.findAll(filter);
};

const uploadProductExcel = async (file) => {
  if (!file) {
    throw new AppError("Product Excel is required", 400);
  }

  const workbook = XLSX.read(file.buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new AppError("Product Excel does not contain any sheets", 400);
  }

  const products = parseProductRows(workbook.Sheets[firstSheetName]);
  const result = await productRepository.bulkUpsert(products);

  return {
    totalRows: products.length,
    inserted: result.upsertedCount || 0,
    updated: result.modifiedCount || 0,
    matched: result.matchedCount || 0,
  };
};

const uploadProductQuantityExcel = async (file) => {
  if (!file) {
    throw new AppError("Product Quantity Excel is required", 400);
  }

  const workbook = XLSX.read(file.buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new AppError("Product Quantity Excel does not contain any sheets", 400);
  }

  const quantityByProductCode = parseQuantityRows(workbook.Sheets[firstSheetName]);
  const uploadedCodes = Array.from(quantityByProductCode.keys());
  const matchedProducts = await productRepository.findByProductCodes(uploadedCodes);
  const matchedCodes = new Set(
    matchedProducts.map((product) => product.productCode)
  );
  const unmatchedCodes = uploadedCodes.filter((code) => !matchedCodes.has(code));
  const matchedQuantityByProductCode = new Map(
    uploadedCodes
      .filter((code) => matchedCodes.has(code))
      .map((code) => [code, quantityByProductCode.get(code)])
  );

  const result = await productRepository.bulkUpdateQuantities({
    quantityByProductCode: matchedQuantityByProductCode,
    missingQuantity: 0,
  });

  return {
    totalRows: uploadedCodes.length,
    matched: matchedQuantityByProductCode.size,
    unmatched: unmatchedCodes.length,
    unmatchedCodes,
    modified: result.modifiedCount || 0,
  };
};

module.exports = {
  getProducts,
  uploadProductExcel,
  uploadProductQuantityExcel,
};
