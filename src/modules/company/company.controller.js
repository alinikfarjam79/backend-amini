const companyService = require("./company.service");
const asyncHandler = require("../../shared/utils/asyncHandler");

const getBodyValue = (body, aliases) => {
  for (const alias of aliases) {
    if (body[alias] !== undefined) {
      return body[alias];
    }
  }

  const normalizedBodyKeys = Object.keys(body).reduce((map, key) => {
    map[key.trim().toLowerCase()] = body[key];
    return map;
  }, {});

  for (const alias of aliases) {
    const value = normalizedBodyKeys[alias.trim().toLowerCase()];

    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
};

const createCompany = asyncHandler(async (req, res) => {
  const company = await companyService.createCompany(req.body);

  res.status(201).json({
    success: true,
    data: company,
  });
});

const getCompanies = asyncHandler(async (req, res) => {
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const companies = await companyService.getCompanies(req.query, baseUrl);

  res.status(200).json({
    success: true,
    data: companies,
  });
});

const uploadCompanyFile = asyncHandler(async (req, res) => {
  const result = await companyService.uploadCompanyFiles({
    companyId: req.params.companyId,
    companyName: getBodyValue(req.body, ["companyName", "company", "name"]),
    companyCode: getBodyValue(req.body, ["companyCode", "code"]),
    title: getBodyValue(req.body, [
      "title",
      "fileTitle",
      "documentTitle",
      "file_title",
      "\u0639\u0646\u0648\u0627\u0646",
    ]),
    publishDate: getBodyValue(req.body, [
      "publishDate",
      "publishedAt",
      "dateOfPublish",
      "publish_date",
      "\u062a\u0627\u0631\u06cc\u062e",
    ]),
    files: req.filesList,
    userId: req.user._id,
  });

  res.status(201).json({
    success: true,
    message: "Company files uploaded successfully",
    data: result,
  });
});

module.exports = {
  createCompany,
  getCompanies,
  uploadCompanyFile,
};
