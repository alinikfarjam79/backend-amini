const assert = require("node:assert/strict");
const test = require("node:test");
const XLSX = require("xlsx");

const productRepository = require("../src/modules/product/product.repository");
const Product = require("../src/modules/product/product.model");
const warehouseRepository = require("../src/modules/warehouse/warehouse.repository");
const productService = require("../src/modules/product/product.service");
const warehouseService = require("../src/modules/warehouse/warehouse.service");

const productId = "6aa9984ce808df2141cfe755";
const warehouseId = "6a98686c00fcbafbbcd4a27f";
const originals = {
  product: { ...productRepository },
  warehouse: { ...warehouseRepository },
};

test.after(() => {
  Object.assign(productRepository, originals.product);
  Object.assign(warehouseRepository, originals.warehouse);
});

test("new products default to enable=true", () => {
  const product = new Product({
    productCode: "NEW",
    title: "New",
    originalPrice: 0,
  });
  assert.equal(product.enable, true);
});

test("repository bulk updates guard existing disabled products", async () => {
  const originalBulkWrite = Product.bulkWrite;
  let operations;
  Product.bulkWrite = async (items) => {
    operations = items;
    return { modifiedCount: items.length, upsertedCount: 0 };
  };

  try {
    await productRepository.bulkUpsert(
      [{ productCode: "ACTIVE", title: "Active", originalPrice: 1 }],
      new Set(["ACTIVE"])
    );
    assert.deepEqual(operations[0].updateOne.filter, {
      productCode: "ACTIVE",
      enable: { $ne: false },
    });
    assert.equal(operations[0].updateOne.upsert, false);

    await productRepository.bulkUpdateWarehouseInventory({
      inventorySummaries: [
        { productCode: "ACTIVE", quantity: 5, warehouses: [] },
      ],
    });
    assert.deepEqual(operations[0].updateOne.filter, {
      productCode: "ACTIVE",
      enable: { $ne: false },
    });
  } finally {
    Product.bulkWrite = originalBulkWrite;
  }
});

const excelFile = (rows) => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(rows),
    "Sheet1"
  );
  return { buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) };
};

test("main and monitoring lists exclude disabled products", async () => {
  const filters = [];
  productRepository.findAll = async (filter) => {
    filters.push(filter);
    return [];
  };

  await productService.getProducts();
  await productService.getProducts({ inventoryStatus: "warning" });
  await productService.getProducts({ enable: "false" }, "admin");

  assert.deepEqual(filters[0].$and[0], { enable: { $ne: false } });
  assert.ok(
    filters[1].$and.some(
      (condition) => JSON.stringify(condition) === JSON.stringify({ enable: { $ne: false } })
    )
  );
  assert.deepEqual(filters[2].$and[0], { enable: false });
  await assert.rejects(
    productService.getProducts({ enable: "false" }, "user"),
    { statusCode: 403 }
  );
});

test("disabled product can only be re-enabled", async () => {
  productRepository.findById = async () => ({ _id: productId, enable: false });
  warehouseRepository.getProductWarehouseQuantities = async () => [];
  productRepository.updateAliasById = async () => {
    throw new Error("alias update must not run");
  };
  productRepository.updateThresholdsById = async () => {
    throw new Error("threshold update must not run");
  };
  productRepository.updateEnableById = async (_id, enable) => ({
    _id: productId,
    title: "Existing",
    enable,
  });

  await assert.rejects(
    productService.updateProductAlias(productId, { alias: "New" }),
    { statusCode: 409 }
  );
  await assert.rejects(
    productService.updateProductThresholds(productId, { warningThreshold: 20 }),
    { statusCode: 409 }
  );
  await assert.rejects(productService.updateProductEnable(productId, false), {
    statusCode: 409,
  });
  assert.equal((await productService.updateProductEnable(productId, true)).enable, true);
});

test("price upload skips disabled products and updates active rows", async () => {
  let upsertedProducts;
  productRepository.findByProductCodes = async () => [
    { productCode: "DISABLED", title: "Disabled", enable: false },
    { productCode: "ACTIVE", title: "Active", enable: true },
  ];
  productRepository.bulkUpsert = async (products) => {
    upsertedProducts = products;
    return { modifiedCount: products.length, upsertedCount: 0 };
  };
  productRepository.bulkCreateMissingWithZeroPrice = async () => ({});

  const result = await productService.uploadProductExcel(
    excelFile([
      { "كد كالا": "DISABLED", "عنوان كالا": "Disabled", "بارکد کالا": "D", "قیمت اصلی": 100 },
      { "كد كالا": "ACTIVE", "عنوان كالا": "Active", "بارکد کالا": "A", "قیمت اصلی": 200 },
      { "كد كالا": "DISABLED", "عنوان كالا": "Disabled", "بارکد کالا": "D", "قیمت اصلی": "bad" },
    ])
  );

  assert.deepEqual(upsertedProducts.map((product) => product.productCode), ["ACTIVE"]);
  assert.equal(result.skippedDisabledProducts.length, 2);
  assert.equal(result.skippedDisabledProducts[0].row, 2);
  assert.equal(result.skippedDisabledProducts[1].row, 4);
  assert.equal(result.updatedProducts, 1);
});

test("warehouse upload leaves disabled inventory untouched", async () => {
  let updatedItems;
  let updatedInventory;
  warehouseRepository.findSummaryById = async () => ({ _id: warehouseId });
  warehouseRepository.replaceItemsByProductCodes = async (_id, items) => {
    updatedItems = items;
    return { warehouse: { _id: warehouseId } };
  };
  warehouseRepository.getInventorySummariesForProductUpdate = async (codes) =>
    codes.map((productCode) => ({ productCode, quantity: 5, warehouses: [warehouseId] }));
  productRepository.findByProductCodes = async () => [
    { _id: productId, productCode: "DISABLED", title: "Disabled", enable: false },
    { _id: productId, productCode: "ACTIVE", title: "Active", enable: true },
  ];
  productRepository.bulkCreateMissingWithZeroPrice = async () => ({});
  productRepository.bulkUpdateWarehouseInventory = async ({ inventorySummaries }) => {
    updatedInventory = inventorySummaries;
    return { modifiedCount: inventorySummaries.length };
  };

  const result = await warehouseService.uploadWarehouseProductsExcel({
    warehouseId,
    file: excelFile([
      { "کد": "DISABLED", "عنوان": "Disabled", "موجودی": 9 },
      { "کد": "ACTIVE", "عنوان": "Active", "موجودی": 5 },
      { "کد": "DISABLED", "عنوان": "Disabled", "موجودی": "bad" },
    ]),
  });

  assert.deepEqual(updatedItems.map((item) => item.productCode), ["ACTIVE"]);
  assert.deepEqual(updatedInventory.map((item) => item.productCode), ["ACTIVE"]);
  assert.equal(result.skippedDisabledProducts.length, 2);
  assert.equal(result.skippedDisabledProducts[0].row, 2);
  assert.equal(result.skippedDisabledProducts[1].row, 4);
});
