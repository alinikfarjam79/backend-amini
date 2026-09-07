const XLSX = require("xlsx");
const mongoose = require("mongoose");

const warehouseConfig = require("../../config/warehouse");
const warehouseRepository = require("./warehouse.repository");
const productRepository = require("../product/product.repository");
const AppError = require("../../shared/utils/AppError");

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

const normalizeHeader = (value) => {
  return normalizeText(value).replace(/\s+/g, "").toLowerCase();
};

const normalizeNumberText = (value) => {
  return normalizeText(value)
    .replace(/[\u06f0-\u06f9\u0660-\u0669]/g, (digit) => persianDigitMap[digit])
    .replace(/[,\u060c\s]/g, "");
};

const parseQuantity = (value) => {
  const normalized = normalizeNumberText(value);

  if (!normalized) {
    return {
      isValid: false,
      value: null,
      isZeroOrNegative: false,
    };
  }

  const quantity = Number(normalized);

  if (!Number.isInteger(quantity)) {
    return {
      isValid: false,
      value: null,
      isZeroOrNegative: false,
    };
  }

  return {
    isValid: true,
    value: quantity,
    isZeroOrNegative: quantity <= 0,
  };
};

const getHeaderMap = (headers, columnsConfig) => {
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));

  return Object.entries(columnsConfig).reduce((map, [field, aliases]) => {
    const normalizedAliases = aliases.map((alias) => normalizeHeader(alias));
    const index = normalizedHeaders.findIndex((header) =>
      normalizedAliases.includes(header)
    );

    if (index !== -1) {
      map[field] = headers[index];
    }

    return map;
  }, {});
};

const getMissingColumns = (headerMap, columnsConfig) => {
  return Object.entries(columnsConfig)
    .filter(([field]) => !headerMap[field])
    .map(([, aliases]) => aliases[0]);
};

const parseWarehouseProductRows = (worksheet) => {
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    defval: "",
    raw: false,
  });

  if (rows.length === 0) {
    throw new AppError("Warehouse product Excel is empty", 400);
  }

  const headerMap = getHeaderMap(
    Object.keys(rows[0]),
    warehouseConfig.productExcelColumns
  );
  const missingColumns = getMissingColumns(
    headerMap,
    warehouseConfig.productExcelColumns
  );

  if (missingColumns.length > 0) {
    throw new AppError(
      `Warehouse product Excel is missing required columns: ${missingColumns.join(", ")}`,
      400
    );
  }

  const errors = [];
  const zeroOrNegativeQuantityProducts = [];
  const productRowsByCode = new Map();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const productCode = normalizeText(row[headerMap.productCode]);
    const title = normalizeText(row[headerMap.title]);
    const quantityResult = parseQuantity(row[headerMap.quantity]);
    const rowErrors = [];

    if (!productCode) {
      rowErrors.push("product code is required");
    }

    if (!title) {
      rowErrors.push("title is required");
    }

    if (!quantityResult.isValid) {
      rowErrors.push("quantity must be a valid whole number");
    }

    if (rowErrors.length > 0) {
      errors.push({
        row: rowNumber,
        productCode: productCode || null,
        title: title || null,
        message: rowErrors.join("; "),
      });

      return;
    }

    if (quantityResult.isZeroOrNegative) {
      zeroOrNegativeQuantityProducts.push({
        row: rowNumber,
        productCode,
        title,
        quantity: quantityResult.value,
      });
    }

    if (productCode && title && quantityResult.isValid) {
      productRowsByCode.set(productCode, {
        productCode,
        title,
        quantity: quantityResult.value,
      });
    }
  });

  if (productRowsByCode.size === 0) {
    const error = new AppError(
      "Warehouse product Excel does not contain valid rows",
      400
    );
    error.errors = errors;
    error.zeroOrNegativeQuantityProducts = zeroOrNegativeQuantityProducts;
    throw error;
  }

  return {
    rows: Array.from(productRowsByCode.values()),
    errors,
    zeroOrNegativeQuantityProducts,
    totalRows: rows.length,
  };
};

const createWarehouse = async (payload) => {
  const name = normalizeText(payload.name);

  if (!name) {
    throw new AppError("Warehouse name is required", 400);
  }

  const existingWarehouse = await warehouseRepository.findByName(name);

  if (existingWarehouse) {
    throw new AppError("Warehouse name already exists", 409);
  }

  return warehouseRepository.create({
    name,
    isActive: payload.isActive,
  });
};

const getWarehouses = async () => {
  return warehouseRepository.findAll();
};

const getWarehouseItems = async (warehouseId) => {
  if (!mongoose.Types.ObjectId.isValid(warehouseId)) {
    throw new AppError("Invalid warehouse id", 400);
  }

  const warehouse = await warehouseRepository.findById(warehouseId);

  if (!warehouse) {
    throw new AppError("Warehouse not found", 404);
  }

  return warehouse.items;
};

const uploadWarehouseProductsExcel = async ({ warehouseId, file }) => {
  if (!mongoose.Types.ObjectId.isValid(warehouseId)) {
    throw new AppError("Invalid warehouse id", 400);
  }

  if (!file) {
    throw new AppError("Warehouse product Excel is required", 400);
  }

  const workbook = XLSX.read(file.buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new AppError("Warehouse product Excel does not contain any sheets", 400);
  }

  const {
    rows: parsedRows,
    errors,
    zeroOrNegativeQuantityProducts,
    totalRows,
  } = parseWarehouseProductRows(workbook.Sheets[firstSheetName]);
  const productCodes = parsedRows.map((row) => row.productCode);
  const products = await productRepository.findByProductCodes(productCodes);
  const productByCode = new Map(
    products.map((product) => [product.productCode, product])
  );
  const unmatchedCodes = productCodes.filter((code) => !productByCode.has(code));
  const items = parsedRows
    .filter((row) => productByCode.has(row.productCode))
    .map((row) => {
      const product = productByCode.get(row.productCode);

      return {
        product: product._id,
        productCode: product.productCode,
        title: product.title || row.title,
        quantity: row.quantity,
      };
    });

  const warehouse = await warehouseRepository.replaceItemsByProductCodes(
    warehouseId,
    items
  );

  if (!warehouse) {
    throw new AppError("Warehouse not found", 404);
  }

  const inventorySummaries = await warehouseRepository.getInventorySummariesByProductCodes(
    items.map((item) => item.productCode)
  );

  const productUpdateResult = await productRepository.bulkUpdateWarehouseInventory({
    inventorySummaries,
  });

  return {
    totalRows,
    validRows: parsedRows.length,
    invalidRows: errors.length,
    matched: items.length,
    unmatched: unmatchedCodes.length,
    unmatchedCodes,
    zeroOrNegativeQuantityProducts,
    errors,
    productsUpdated: productUpdateResult.modifiedCount || 0,
    warehouse,
  };
};

module.exports = {
  createWarehouse,
  getWarehouseItems,
  getWarehouses,
  uploadWarehouseProductsExcel,
};
