const assert = require("node:assert/strict");
const test = require("node:test");

const productRepository = require("../src/modules/product/product.repository");
const productService = require("../src/modules/product/product.service");
const warehouseRepository = require("../src/modules/warehouse/warehouse.repository");
const Warehouse = require("../src/modules/warehouse/warehouse.model");

test("product list includes per-warehouse quantities in one batch", async () => {
  const originalFindAll = productRepository.findAll;
  const originalGetQuantities = warehouseRepository.getProductWarehouseQuantities;
  let requestedCodes;

  productRepository.findAll = async () => [
    { productCode: "P1", title: "First", quantity: 4, warehouses: [] },
    { productCode: "P2", title: "Second", quantity: 0, warehouses: [] },
  ];
  warehouseRepository.getProductWarehouseQuantities = async (codes) => {
    requestedCodes = codes;
    return [
      {
        productCode: "P1",
        quantity: 6,
        warehouse: { _id: "W1", name: "Store", isActive: true },
      },
      {
        productCode: "P1",
        quantity: -2,
        warehouse: { _id: "W2", name: "Reserve", isActive: true },
      },
      {
        productCode: "P2",
        quantity: 0,
        warehouse: { _id: "W1", name: "Store", isActive: true },
      },
    ];
  };

  try {
    const products = await productService.getProducts();
    assert.deepEqual(requestedCodes, ["P1", "P2"]);
    assert.deepEqual(
      products[0].warehouses.map(({ name, quantity }) => ({ name, quantity })),
      [
        { name: "Store", quantity: 6 },
        { name: "Reserve", quantity: -2 },
      ]
    );
    assert.deepEqual(products[1].warehouses, [
      { _id: "W1", name: "Store", isActive: true, quantity: 0 },
    ]);
    assert.equal(products[0].quantity, 4);
    assert.ok(products.every((product) =>
      product.warehouses.every((warehouse) => !("items" in warehouse))
    ));
  } finally {
    productRepository.findAll = originalFindAll;
    warehouseRepository.getProductWarehouseQuantities = originalGetQuantities;
  }
});

test("warehouse aggregation selects only requested product codes", () => {
  const originalAggregate = Warehouse.aggregate;
  let pipeline;
  Warehouse.aggregate = (stages) => {
    pipeline = stages;
    return { allowDiskUse: () => [] };
  };

  try {
    warehouseRepository.getProductWarehouseQuantities(["P1", "P2"]);
    assert.deepEqual(pipeline[0].$match["items.productCode"].$in, ["P1", "P2"]);
    assert.deepEqual(pipeline[2], pipeline[0]);
    assert.deepEqual(pipeline[3].$group.quantity, {
      $sum: "$items.quantity",
    });
  } finally {
    Warehouse.aggregate = originalAggregate;
  }
});
