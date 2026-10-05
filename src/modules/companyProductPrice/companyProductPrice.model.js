const mongoose = require("mongoose");

const companyProductPriceSchema = new mongoose.Schema(
  {
    companyName: { type: String, required: true, trim: true },
    uploadDate: { type: String, required: true, trim: true },
    identityKey: { type: String, required: true },
    isCurrent: { type: Boolean, default: true, index: true },
    code: { type: String, required: true, trim: true },
    productCode: { type: String, trim: true, default: null },
    sourceTitle: { type: String, required: true, trim: true },
    size: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    factoryPrice: { type: Number, default: null, min: 0 },
    wholesalePrice: { type: Number, default: null, min: 0 },
    consumerPrice: { type: Number, default: null, min: 0 },
  },
  { timestamps: true }
);

companyProductPriceSchema.index(
  { identityKey: 1 },
  {
    unique: true,
    partialFilterExpression: { isCurrent: true },
  }
);
companyProductPriceSchema.index({ companyName: 1, uploadDate: 1 });
companyProductPriceSchema.index({ isCurrent: 1, companyName: 1 });

module.exports = mongoose.model(
  "CompanyProductPrice",
  companyProductPriceSchema
);
