const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    productCode: {
      type: String,
      required: [true, "Product code is required"],
      unique: true,
      trim: true,
    },

    title: {
      type: String,
      required: [true, "Product title is required"],
      trim: true,
    },

    barcode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      default: undefined,
    },

    originalPrice: {
      type: Number,
      required: [true, "Original price is required"],
      min: [0, "Original price must be greater than or equal to 0"],
    },

    quantity: {
      type: Number,
      default: 0,
      min: [0, "Quantity must be greater than or equal to 0"],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
