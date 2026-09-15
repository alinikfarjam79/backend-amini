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
      isZero: false,
      isNegative: false,
    };
  }

  const quantity = Number(normalized);

  if (!Number.isInteger(quantity)) {
    return {
      isValid: false,
      value: null,
      isZero: false,
      isNegative: false,
    };
  }

  return {
    isValid: true,
    value: quantity,
    isZero: quantity === 0,
    isNegative: quantity < 0,
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
  const zeroQuantityProducts = [];
  const invalidQuantityProductRows = [];
  const productRowsByCode = new Map();
  let validRowsCount = 0;

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

    if (rowErrors.length > 0) {
      errors.push({
        row: rowNumber,
        productCode: productCode || null,
        title: title || null,
        message: rowErrors.join("; "),
      });

      return;
    }

    if (!quantityResult.isValid) {
      invalidQuantityProductRows.push({
        row: rowNumber,
        productCode,
        title,
        quantity: 0,
        originalQuantity: normalizeText(row[headerMap.quantity]) || null,
        reason: "quantity must be a valid whole number",
      });

      return;
    }

    if (quantityResult.isNegative) {
      invalidQuantityProductRows.push({
        row: rowNumber,
        productCode,
        title,
        quantity: 0,
        originalQuantity: quantityResult.value,
        reason: "quantity must be zero or greater",
      });

      return;
    }

    if (quantityResult.isZero) {
      zeroQuantityProducts.push({
        row: rowNumber,
        productCode,
        title,
        quantity: quantityResult.value,
      });
    }

    if (productCode && title && quantityResult.isValid) {
      validRowsCount += 1;
      productRowsByCode.set(productCode, {
        productCode,
        title,
        quantity: quantityResult.value,
      });
    }
  });

  return {
    rows: Array.from(productRowsByCode.values()),
    errors,
    zeroQuantityProducts,
    invalidQuantityProductRows,
    validRowsCount,
    totalRows: rows.length,
  };
};

const uniqueRowsByProductCode = (rows) => {
  return Array.from(
    new Map(rows.map((row) => [row.productCode, row])).values()
  );
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
    zeroQuantityProducts,
    invalidQuantityProductRows,
    validRowsCount,
    totalRows,
  } = parseWarehouseProductRows(workbook.Sheets[firstSheetName]);
  const existingWarehouse = await warehouseRepository.findSummaryById(warehouseId);

  if (!existingWarehouse) {
    throw new AppError("Warehouse not found", 404);
  }

  const productCodes = [
    ...new Set([
      ...parsedRows.map((row) => row.productCode),
      ...invalidQuantityProductRows.map((row) => row.productCode),
    ]),
  ];
  const products = await productRepository.findByProductCodes(productCodes);
  const productByCode = new Map(
    products.map((product) => [product.productCode, product])
  );
  const existingProductCodes = new Set(productByCode.keys());
  const validRowsToCreate = uniqueRowsByProductCode(
    parsedRows.filter((row) => !existingProductCodes.has(row.productCode))
  );
  const invalidQuantityRowsToCreate = Array.from(
    new Map(
      invalidQuantityProductRows
        .filter((row) => !existingProductCodes.has(row.productCode))
        .map((row) => [row.productCode, row])
    ).values()
  );
  const rowsToCreate = uniqueRowsByProductCode([
    ...validRowsToCreate,
    ...invalidQuantityRowsToCreate,
  ]);

  await productRepository.bulkCreateMissingWithZeroPrice(rowsToCreate);

  const createdProducts =
    rowsToCreate.length > 0
      ? await productRepository.findByProductCodes(
          rowsToCreate.map((row) => row.productCode)
        )
      : [];

  createdProducts.forEach((product) => {
    productByCode.set(product.productCode, product);
  });

  const parsedProductCodes = new Set(parsedRows.map((row) => row.productCode));
  const invalidQuantityItems = invalidQuantityRowsToCreate
    .filter(
      (row) =>
        productByCode.has(row.productCode) && !parsedProductCodes.has(row.productCode)
    )
    .map((row) => {
      const product = productByCode.get(row.productCode);

      return {
        product: product._id,
        productCode: product.productCode,
        title: product.title || row.title,
        quantity: 0,
      };
    });
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
    })
    .concat(invalidQuantityItems);
  const updatedProducts = items.filter((item) =>
    existingProductCodes.has(item.productCode)
  ).length;

  const warehouseUpdateResult = await warehouseRepository.replaceItemsByProductCodes(
    warehouseId,
    items
  );

  if (!warehouseUpdateResult) {
    throw new AppError("Warehouse not found", 404);
  }

  const inventorySummaries =
    items.length > 0
      ? await warehouseRepository.getInventorySummariesForProductUpdate(
          items.map((item) => item.productCode)
        )
      : [];

  const productUpdateResult =
    inventorySummaries.length > 0
      ? await productRepository.bulkUpdateWarehouseInventory({
          inventorySummaries,
        })
      : { modifiedCount: 0 };
  const invalidQuantityProducts = invalidQuantityProductRows.map((row) => ({
    row: row.row,
    productCode: row.productCode,
    title: row.title,
    quantity: 0,
    originalQuantity: row.originalQuantity,
    reason: row.reason,
    action: existingProductCodes.has(row.productCode)
      ? "skipped_existing_product"
      : "created_with_zero_quantity",
  }));
  const createdInvalidQuantityProducts = invalidQuantityProducts.filter(
    (product) => product.action === "created_with_zero_quantity"
  );
  const skippedInvalidQuantityProducts = invalidQuantityProducts.filter(
    (product) => product.action === "skipped_existing_product"
  );
  const invalidRows = invalidQuantityProducts.length + errors.length;

  return {
    totalRows,
    validRows: validRowsCount,
    invalidRows,
    zeroQuantityRows: zeroQuantityProducts.length,
    newProducts: rowsToCreate.length,
    updatedProducts,
    createdInvalidQuantityRows: createdInvalidQuantityProducts.length,
    skippedInvalidQuantityRows: skippedInvalidQuantityProducts.length,
    errorRows: errors.length,
    zeroQuantityProducts,
    createdInvalidQuantityProducts,
    skippedInvalidQuantityProducts,
    errors,
    productsUpdated: productUpdateResult.modifiedCount || 0,
    warehouse: warehouseUpdateResult.warehouse,
  };
};

module.exports = {
  createWarehouse,
  getWarehouseItems,
  getWarehouses,
  uploadWarehouseProductsExcel,
};
