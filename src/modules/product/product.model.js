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

    alias: {
      type: String,
      trim: true,
      default: function () {
        return this.title;
      },
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

    warehouses: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Warehouse",
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

productSchema.pre("save", function (next) {
  if (!this.alias) {
    this.alias = this.title;
  }

  next();
});

module.exports = mongoose.model("Product", productSchema);
