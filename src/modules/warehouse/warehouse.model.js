const mongoose = require("mongoose");

const warehouseItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    productCode: {
      type: String,
      required: true,
      trim: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    quantity: {
      type: Number,
      required: true,
    },
  },
  { _id: false, timestamps: true }
);

const warehouseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Warehouse name is required"],
      unique: true,
      trim: true,
    },

    isDefault: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    items: {
      type: [warehouseItemSchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Warehouse", warehouseSchema);
