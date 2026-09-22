const XLSX = require("xlsx");
const mongoose = require("mongoose");

const productRepository = require("./product.repository");
const AppError = require("../../shared/utils/AppError");
const ROLES = require("../../shared/constants/roles");

const REQUIRED_COLUMNS = {
  productCode: "\u0643\u062f \u0643\u0627\u0644\u0627",
  title: "\u0639\u0646\u0648\u0627\u0646 \u0643\u0627\u0644\u0627",
  barcode: "\u0628\u0627\u0631\u06a9\u062f \u06a9\u0627\u0644\u0627",
  originalPrice: "\u0642\u06cc\u0645\u062a \u0627\u0635\u0644\u06cc",
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
    return {
      isValid: false,
      value: null,
      wasForcedToZero: false,
    };
  }

  const price = Number(normalized);

  if (!Number.isFinite(price)) {
    return {
      isValid: false,
      value: null,
      wasForcedToZero: false,
    };
  }

  if (price <= 0) {
    return {
      isValid: true,
      value: 0,
      wasForcedToZero: true,
    };
  }

  return {
    isValid: true,
    value: price,
    wasForcedToZero: false,
  };
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
  const zeroPriceProducts = [];
  const invalidPriceProductRows = [];
  const products = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const productCode = normalizeText(row[headerMap.productCode]);
    const title = normalizeText(row[headerMap.title]);
    const barcode = normalizeText(row[headerMap.barcode]) || undefined;
    const priceResult = parseOriginalPrice(row[headerMap.originalPrice]);
    const rowErrors = [];

    if (!productCode) {
      rowErrors.push(`${REQUIRED_COLUMNS.productCode} is required`);
    }

    if (!title) {
      rowErrors.push(`${REQUIRED_COLUMNS.title} is required`);
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

    if (!priceResult.isValid) {
      invalidPriceProductRows.push({
        row: rowNumber,
        productCode,
        title,
        barcode,
        originalPrice: 0,
        reason: `${REQUIRED_COLUMNS.originalPrice} must be a valid number`,
      });

      return;
    }

    if (priceResult.wasForcedToZero) {
      zeroPriceProducts.push({
        row: rowNumber,
        productCode,
        title,
        originalPrice: 0,
      });
    }

    if (productCode && title && priceResult.isValid) {
      products.push({
        row: rowNumber,
        productCode,
        title,
        barcode,
        originalPrice: priceResult.value,
      });
    }
  });

  return {
    products,
    errors,
    zeroPriceProducts,
    invalidPriceProductRows,
    totalRows: rows.length,
  };
};

const getThresholdExpressions = () => {
  const quantity = { $ifNull: ["$quantity", 0] };
  const criticalThreshold = { $ifNull: ["$criticalThreshold", 10] };
  const warningThreshold = { $ifNull: ["$warningThreshold", 15] };
  const thresholdEnabled = { $ifNull: ["$thresholdEnabled", true] };
  const enabled = { $eq: [thresholdEnabled, true] };

  return {
    thresholdEnabled,
    critical: {
      $and: [enabled, { $lte: [quantity, criticalThreshold] }],
    },
    warning: {
      $and: [
        enabled,
        { $gt: [quantity, criticalThreshold] },
        { $lt: [quantity, warningThreshold] },
      ],
    },
    normal: {
      $or: [
        { $eq: [thresholdEnabled, false] },
        {
          $and: [enabled, { $gte: [quantity, warningThreshold] }],
        },
      ],
    },
  };
};

const getProducts = async (query = {}, role) => {
  const enableQuery = normalizeText(query.enable).toLowerCase();

  if (enableQuery && !["true", "false"].includes(enableQuery)) {
    throw new AppError("enable must be true or false", 400);
  }

  if (enableQuery === "false" && role !== ROLES.ADMIN) {
    throw new AppError("Forbidden", 403);
  }

  const conditions = [
    { enable: enableQuery === "false" ? false : { $ne: false } },
  ];
  const search = normalizeText(query.search);

  if (search) {
    conditions.push({
      $or: [
        { productCode: { $regex: search, $options: "i" } },
        { title: { $regex: search, $options: "i" } },
        { alias: { $regex: search, $options: "i" } },
        { barcode: { $regex: search, $options: "i" } },
      ],
    });
  }

  const thresholdExpressions = getThresholdExpressions();
  const requestedStatuses = normalizeText(query.inventoryStatus)
    .toLowerCase()
    .split(",")
    .map((status) => status.trim())
    .filter(Boolean);
  const allowedStatuses = new Set(["critical", "warning", "normal"]);

  if (requestedStatuses.some((status) => !allowedStatuses.has(status))) {
    throw new AppError(
      "inventoryStatus must be critical, warning, normal, or a comma-separated combination",
      400
    );
  }

  if (requestedStatuses.length > 0) {
    conditions.push({ enable: { $ne: false } });
    const uniqueStatuses = [...new Set(requestedStatuses)];
    const statusExpressions = uniqueStatuses.map(
      (status) => thresholdExpressions[status]
    );

    conditions.push({
      $expr:
        statusExpressions.length === 1
          ? statusExpressions[0]
          : { $or: statusExpressions },
    });
  }

  const thresholdEnabledQuery = normalizeText(query.thresholdEnabled).toLowerCase();

  if (
    thresholdEnabledQuery &&
    !["true", "false"].includes(thresholdEnabledQuery)
  ) {
    throw new AppError("thresholdEnabled must be true or false", 400);
  }

  if (thresholdEnabledQuery) {
    conditions.push({
      $expr: {
        $eq: [
          thresholdExpressions.thresholdEnabled,
          thresholdEnabledQuery === "true",
        ],
      },
    });
  }

  const filter = conditions.length > 0 ? { $and: conditions } : {};

  const products = await productRepository.findAll(filter);

  return products.map(formatProduct);
};

const getInventoryStatus = (product) => {
  const quantity = Number.isFinite(product.quantity) ? product.quantity : 0;
  const criticalThreshold = Number.isFinite(product.criticalThreshold)
    ? product.criticalThreshold
    : 10;
  const warningThreshold = Number.isFinite(product.warningThreshold)
    ? product.warningThreshold
    : 15;
  const thresholdEnabled =
    typeof product.thresholdEnabled === "boolean"
      ? product.thresholdEnabled
      : product.warningThresholdEnabled !== false &&
        product.criticalThresholdEnabled !== false;

  if (!thresholdEnabled) {
    return "normal";
  }

  if (quantity <= criticalThreshold) {
    return "critical";
  }

  if (quantity < warningThreshold) {
    return "warning";
  }

  return "normal";
};

const formatProduct = (product) => {
  const productObject =
    typeof product.toObject === "function" ? product.toObject() : product;
  const {
    warningThresholdEnabled,
    criticalThresholdEnabled,
    ...cleanProduct
  } = productObject;
  const thresholdEnabled =
    typeof productObject.thresholdEnabled === "boolean"
      ? productObject.thresholdEnabled
      : warningThresholdEnabled !== false && criticalThresholdEnabled !== false;

  return {
    ...cleanProduct,
    alias: productObject.alias || productObject.title,
    quantity: Number.isFinite(productObject.quantity)
      ? productObject.quantity
      : 0,
    warningThreshold: productObject.warningThreshold ?? 15,
    criticalThreshold: productObject.criticalThreshold ?? 10,
    thresholdEnabled,
    enable: productObject.enable !== false,
    inventoryStatus: getInventoryStatus(productObject),
    warehouses: productObject.warehouses || [],
  };
};

const ensureProductAliases = async () => {
  return productRepository.ensureAliases();
};

const ensureProductThresholds = async () => {
  return productRepository.ensureThresholdDefaults();
};

const ensureProductEnableDefaults = async () => {
  return productRepository.ensureEnableDefaults();
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

  const {
    products,
    errors,
    zeroPriceProducts,
    invalidPriceProductRows,
    totalRows,
  } = parseProductRows(workbook.Sheets[firstSheetName]);
  const productCodes = [...new Set([
    ...products.map((product) => product.productCode),
    ...invalidPriceProductRows.map((product) => product.productCode),
  ])];
  const existingProducts = await productRepository.findByProductCodes(productCodes);
  const disabledCodes = new Set(
    existingProducts
      .filter((product) => product.enable === false)
      .map((product) => product.productCode)
  );
  const existingCodes = new Set(
    existingProducts.map((product) => product.productCode)
  );
  const skippedDisabledProducts = [...products, ...invalidPriceProductRows]
    .filter((product) => disabledCodes.has(product.productCode))
    .map((product) => ({
      row: product.row,
      productCode: product.productCode,
      title: product.title,
      reason: "Product is disabled",
    }))
    .sort((first, second) => first.row - second.row);
  const validProducts = products.filter(
    (product) => !disabledCodes.has(product.productCode)
  );
  const validInvalidPriceRows = invalidPriceProductRows.filter(
    (product) => !disabledCodes.has(product.productCode)
  );
  const result = await productRepository.bulkUpsert(
    validProducts.map(({ row, ...product }) => product),
    existingCodes
  );
  const invalidPriceProductCodes = validInvalidPriceRows.map(
    (product) => product.productCode
  );
  const existingInvalidPriceProducts =
    invalidPriceProductCodes.length > 0
      ? await productRepository.findByProductCodes(invalidPriceProductCodes)
      : [];
  const existingInvalidPriceProductCodes = new Set(
    existingInvalidPriceProducts.map((product) => product.productCode)
  );
  const zeroPriceProductRowsToCreate = Array.from(
    new Map(
      validInvalidPriceRows
        .filter(
          (product) => !existingInvalidPriceProductCodes.has(product.productCode)
        )
        .map((product) => [product.productCode, product])
    ).values()
  );

  await productRepository.bulkCreateMissingWithZeroPrice(
    zeroPriceProductRowsToCreate
  );
  const invalidPriceProducts = validInvalidPriceRows.map((product) => ({
    row: product.row,
    productCode: product.productCode,
    title: product.title,
    originalPrice: 0,
    reason: product.reason,
    action: existingInvalidPriceProductCodes.has(product.productCode)
      ? "skipped_existing_product"
      : "created_with_zero_price",
  }));
  const createdInvalidPriceProducts = invalidPriceProducts.filter(
    (product) => product.action === "created_with_zero_price"
  );
  const skippedInvalidPriceProducts = invalidPriceProducts.filter(
    (product) => product.action === "skipped_existing_product"
  );
  const createdInvalidPriceRows = createdInvalidPriceProducts.length;
  const skippedInvalidPriceRows = skippedInvalidPriceProducts.length;
  const invalidRows =
    invalidPriceProducts.length + errors.length + skippedDisabledProducts.length;
  const activeZeroPriceProducts = zeroPriceProducts.filter(
    (product) => !disabledCodes.has(product.productCode)
  );
  const zeroPriceRows = activeZeroPriceProducts.length;
  const inserted = result.upsertedCount || 0;
  const updated = result.modifiedCount || 0;

  return {
    totalRows,
    validRows: validProducts.length,
    invalidRows,
    zeroPriceRows,
    newProducts: inserted,
    updatedProducts: updated,
    createdInvalidPriceRows,
    skippedInvalidPriceRows,
    errorRows: errors.length,
    zeroPriceProducts: activeZeroPriceProducts,
    createdInvalidPriceProducts,
    skippedInvalidPriceProducts,
    skippedDisabledProducts,
    errors,
  };
};

const updateProductAlias = async (productId, payload) => {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new AppError("Invalid product id", 400);
  }

  const alias = normalizeText(payload.alias);

  if (!alias) {
    throw new AppError("Product alias is required", 400);
  }

  const existingProduct = await productRepository.findById(productId);

  if (!existingProduct) {
    throw new AppError("Product not found", 404);
  }

  if (existingProduct.enable === false) {
    throw new AppError("Product is disabled", 409);
  }

  const product = await productRepository.updateAliasById(productId, alias);

  if (!product) {
    throw new AppError("Product is disabled", 409);
  }

  return product;
};

const updateProductThresholds = async (productId, payload) => {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new AppError("Invalid product id", 400);
  }

  const existingProduct = await productRepository.findById(productId);

  if (!existingProduct) {
    throw new AppError("Product not found", 404);
  }

  if (existingProduct.enable === false) {
    throw new AppError("Product is disabled", 409);
  }

  const warningThreshold =
    payload.warningThreshold ?? existingProduct.warningThreshold ?? 15;
  const criticalThreshold =
    payload.criticalThreshold ?? existingProduct.criticalThreshold ?? 10;

  if (criticalThreshold > warningThreshold) {
    throw new AppError(
      "Critical threshold cannot be greater than warning threshold",
      400
    );
  }

  const product = await productRepository.updateThresholdsById(
    productId,
    payload
  );

  if (!product) {
    throw new AppError("Product is disabled", 409);
  }

  return formatProduct(product);
};

const updateProductEnable = async (productId, enable) => {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new AppError("Invalid product id", 400);
  }

  const existingProduct = await productRepository.findById(productId);

  if (!existingProduct) {
    throw new AppError("Product not found", 404);
  }

  if (existingProduct.enable === false && !enable) {
    throw new AppError("Product is already disabled", 409);
  }

  const product = await productRepository.updateEnableById(productId, enable);

  if (!product) {
    throw new AppError("Product is already disabled", 409);
  }

  return formatProduct(product);
};

module.exports = {
  ensureProductAliases,
  ensureProductThresholds,
  ensureProductEnableDefaults,
  getProducts,
  updateProductAlias,
  updateProductEnable,
  updateProductThresholds,
  uploadProductExcel,
};
