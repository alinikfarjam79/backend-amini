const assert = require("node:assert/strict");
const test = require("node:test");
const XLSX = require("xlsx");

const repository = require("../src/modules/companyProductPrice/companyProductPrice.repository");
const service = require("../src/modules/companyProductPrice/companyProductPrice.service");

const originals = { ...repository };

test.after(() => {
  Object.assign(repository, originals);
});

const excelFile = (rows) => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(rows),
    "Sheet1"
  );

  return {
    buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }),
  };
};

test("normalizes configured company product terms", () => {
  const cases = [
    ["\u06a9\u0648\u0627\u0631\u062a", "\u06a9\u06cc\u0644\u0648"],
    ["\u0646\u06cc\u0645 \u06a9\u0648\u0627\u0631\u062a", "\u0646\u06cc\u0645\u06cc"],
    ["\u06cc\u06a9 \u0686\u0647\u0627\u0631\u0645 \u06a9\u0648\u0627\u0631\u062a", "\u0631\u0628\u0639\u06cc"],
    ["\u0627\u0632 \u06f3.\u06f5 \u06a9\u06cc\u0644\u0648 \u062a\u0627 \u06f5.\u06f5 \u06a9\u06cc\u0644\u0648", "\u06af\u0627\u0644\u0646"],
    ["\u0622\u06a9\u0631\u0648\u0644\u06cc\u06a9 \u06a9\u06cc\u0644\u0648\u06cc\u06cc", "\u0627\u06a9\u0631\u06cc\u0644\u06cc\u06a9 \u06a9\u06cc\u0644\u0648"],
    ["\u0622\u0644\u06a9\u06cc\u062f\u06cc \u06af\u0644 \u0645\u0627\u0634", "\u0631\u0648\u063a\u0646\u06cc \u06af\u0644\u0645\u0627\u0634"],
    ["\u067e\u0644\u06cc \u0627\u0648\u0631\u062a\u0627\u0646 \u0644\u06cc\u062a\u0631\u06cc", "\u067e\u0644\u06cc \u06cc\u0648\u0631\u062a\u0627\u0646 \u0644\u06cc\u062a\u0631"],
  ];

  for (const [input, expected] of cases) {
    assert.equal(service.normalizeProductText(input), expected);
  }
});

test("removes dollar signs from product codes", () => {
  assert.equal(service.normalizeCode("$711"), "711");
  assert.equal(service.normalizeCode("$A$-10"), "A-10");
});

test("uses companyName, code, and size as product identity", () => {
  const first = service.createIdentityKey({
    companyName: "Factory",
    productCode: "P-1",
    code: "100",
    size: "Small",
  });
  const second = service.createIdentityKey({
    companyName: "Factory",
    productCode: "P-2",
    code: "100",
    size: "Small",
  });
  const differentCode = service.createIdentityKey({
    companyName: "Factory",
    productCode: "P-1",
    code: "200",
    size: "Small",
  });

  assert.equal(first, second);
  assert.notEqual(first, differentCode);
});

test("uploads valid rows, keeps empty prices null, and ignores extra columns", async () => {
  let savedProducts;
  repository.createVersions = async (products) => {
    savedProducts = products;
    return { insertedCount: 1, replacedCurrentCount: 0 };
  };

  const result = await service.uploadExcel({
    companyName: "\u0634\u0631\u06a9\u062a \u0646\u0645\u0648\u0646\u0647",
    uploadDate: "1405/07/13",
    file: excelFile([
      {
        "\u0639\u0646\u0648\u0627\u0646": "\u0631\u0646\u06af \u0622\u06a9\u0631\u0648\u0644\u06cc\u06a9",
        "\u06a9\u062f": "$A-10",
        "\u06a9\u062f \u06a9\u0627\u0644\u0627": "",
        "\u0627\u0646\u062f\u0627\u0632\u0647": "\u06f5 \u06af\u0627\u0644\u0646",
        "\u0642\u06cc\u0645\u062a \u062f\u0631\u0628 \u06a9\u0627\u0631\u062e\u0627\u0646\u0647": "",
        "\u0642\u06cc\u0645\u062a \u0639\u0645\u062f\u0647": "\u06f1,\u06f2\u06f0\u06f0",
        "\u0642\u06cc\u0645\u062a \u0645\u0635\u0631\u0641 \u06a9\u0646\u0646\u062f\u0647": "2500",
        "\u0633\u062a\u0648\u0646 \u0627\u0636\u0627\u0641\u06cc": "ignored",
      },
    ]),
  });

  assert.equal(result.totalRows, 1);
  assert.equal(result.uploadDate, "1405/07/13");
  assert.equal(result.validRows, 1);
  assert.equal(result.invalidRows, 0);
  assert.equal(result.savedProducts, 1);
  assert.equal(result.newProducts, 1);
  assert.equal(result.updatedProducts, 0);
  assert.equal(result.createdVersions, 1);
  assert.equal(savedProducts[0].isCurrent, true);
  assert.equal(savedProducts[0].sourceTitle, "\u0631\u0646\u06af \u0627\u06a9\u0631\u06cc\u0644\u06cc\u06a9");
  assert.equal(savedProducts[0].uploadDate, "1405/07/13");
  assert.equal(savedProducts[0].productCode, null);
  assert.equal(savedProducts[0].size, "\u062d\u0644\u0628");
  assert.equal(savedProducts[0].factoryPrice, null);
  assert.equal(savedProducts[0].wholesalePrice, 1200);
  assert.equal(savedProducts[0].consumerPrice, 2500);
  assert.equal(
    savedProducts[0].title,
    "\u0631\u0646\u06af \u0627\u06a9\u0631\u06cc\u0644\u06cc\u06a9 A-10 \u062d\u0644\u0628 \u0634\u0631\u06a9\u062a \u0646\u0645\u0648\u0646\u0647"
  );
});

test("skips invalid rows while saving healthy rows", async () => {
  let savedProducts;
  repository.createVersions = async (products) => {
    savedProducts = products;
    return { insertedCount: products.length, replacedCurrentCount: 1 };
  };

  const base = {
    "\u06a9\u062f \u06a9\u0627\u0644\u0627": "$P-20",
    "\u0627\u0646\u062f\u0627\u0632\u0647": "\u06a9\u0648\u0627\u0631\u062a",
    "\u0642\u06cc\u0645\u062a \u062f\u0631\u0628 \u06a9\u0627\u0631\u062e\u0648\u0646\u0647": "100",
    "\u0642\u06cc\u0645\u062a \u0639\u0645\u062f\u0647": "200",
    "\u0642\u06cc\u0645\u062a \u0645\u0635\u0631\u0641 \u06a9\u0646\u0646\u062f\u0647": "300",
  };
  const result = await service.uploadExcel({
    companyName: "Factory",
    uploadDate: "2026-10-05",
    file: excelFile([
      { ...base, "\u0639\u0646\u0648\u0627\u0646": "Good", "\u06a9\u062f": "1" },
      { ...base, "\u0639\u0646\u0648\u0627\u0646": "Bad", "\u06a9\u062f": "2", "\u0642\u06cc\u0645\u062a \u0639\u0645\u062f\u0647": "wrong" },
    ]),
  });

  assert.equal(savedProducts.length, 1);
  assert.equal(savedProducts[0].productCode, "P-20");
  assert.equal(result.validRows, 1);
  assert.equal(result.invalidRows, 1);
  assert.equal(result.updatedProducts, 1);
  assert.equal(result.newProducts, 0);
  assert.equal(result.errors[0].row, 3);
});

test("main list only returns current versions and history accepts company and date", async () => {
  let currentFilter;
  let historyFilter;
  repository.findAll = async (filter) => {
    currentFilter = filter;
    return [];
  };
  repository.findHistory = async (filter) => {
    historyFilter = filter;
    return [];
  };

  await service.getProducts({ companyName: "Factory", search: "white P-1" });
  await service.getHistory({ companyName: "Factory", uploadDate: "1405/07/13" });

  assert.equal(currentFilter.isCurrent, true);
  assert.equal(currentFilter.companyName, "Factory");
  assert.equal(currentFilter.$and.length, 2);
  assert.ok(currentFilter.$and[1].$or.some((condition) => condition.productCode));
  assert.deepEqual(historyFilter, {
    companyName: "Factory",
    uploadDate: "1405/07/13",
  });
});

test("search token order does not change its conditions", () => {
  const first = service.getSearchConditions("\u0622\u06a9\u0631\u0644\u06cc\u06a9 \u0633\u0641\u06cc\u062f");
  const reversed = service.getSearchConditions("\u0633\u0641\u06cc\u062f \u0627\u06a9\u0631\u06cc\u0644\u06cc\u06a9");
  const getTokens = (conditions) => conditions
    .map((condition) => condition.$or[0].title.$regex)
    .sort();

  assert.deepEqual(getTokens(first), getTokens(reversed));
  assert.deepEqual(getTokens(first), ["\u0627\u06a9\u0631\u06cc\u0644\u06cc\u06a9", "\u0633\u0641\u06cc\u062f"].sort());
});

test("requires a user-provided upload date", async () => {
  await assert.rejects(
    service.uploadExcel({ companyName: "Factory", file: { buffer: Buffer.alloc(0) } }),
    { statusCode: 400, message: "Upload date is required" }
  );
});
