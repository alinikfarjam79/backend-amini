const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const childProcess = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");
const sharp = require("sharp");

const generatedPaths = [];
childProcess.execFile = (_command, args, _options, callback) => {
  const outputPrefix = args[4];

  Promise.all(
    [1, 2].map(async (page) => {
      const pagePath = `${outputPrefix}-${page}.png`;
      generatedPaths.push(pagePath);
      await sharp({
        create: {
          width: 100,
          height: 150,
          channels: 3,
          background: page === 1 ? "white" : "red",
        },
      })
        .png()
        .toFile(pagePath);
    })
  ).then(() => callback(null, "", ""), callback);
};

const repository = require("../src/modules/company/company.repository");
const service = require("../src/modules/company/company.service");
childProcess.execFile = execFile;

const companyId = "6a8009da4989d2a41252e712";
repository.findById = async () => ({ _id: companyId, name: "Example" });
repository.addFilesById = async (_id, files) => ({
  _id: companyId,
  name: "Example",
  files,
});

test.after(async () => {
  await Promise.all(
    generatedPaths.map((filePath) => fs.rm(filePath, { force: true }))
  );
});

for (const [setting, expectedCount] of [
  [true, 3],
  [false, 1],
  ["true", 3],
  ["false", 1],
  [undefined, 3],
]) {
  test(`PDF upload includePdfPages=${setting}`, async () => {
    const result = await service.uploadCompanyFiles({
      companyId,
      title: "Price list",
      publishDate: "1405/06/30",
      includePdfPages: setting,
      files: [
        {
          originalname: "price-list.pdf",
          mimetype: "application/pdf",
          buffer: Buffer.from("%PDF-test"),
        },
      ],
      userId: companyId,
    });

    assert.equal(result.files.length, expectedCount);
    assert.equal(
      result.files.filter((file) => file.sourceType === "pdf-combined").length,
      1
    );
    assert.equal(
      result.files.filter((file) => file.sourceType === "pdf-page").length,
      expectedCount - 1
    );

    for (const file of result.files) {
      generatedPaths.push(file.filePath);
      await fs.access(file.filePath);
    }

    if (setting === false || setting === "false") {
      const combinedPath = result.files[0].filePath;
      const prefix = path.basename(combinedPath, "-combined.png");
      const directoryFiles = await fs.readdir(path.dirname(combinedPath));
      assert.deepEqual(
        directoryFiles.filter((fileName) => fileName.startsWith(prefix)),
        [path.basename(combinedPath)]
      );
    }
  });
}

test("invalid includePdfPages is rejected", async () => {
  await assert.rejects(
    service.uploadCompanyFiles({ includePdfPages: "maybe" }),
    { statusCode: 400, message: "includePdfPages must be true or false" }
  );
});
