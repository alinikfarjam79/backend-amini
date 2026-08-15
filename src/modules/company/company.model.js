const mongoose = require("mongoose");

const companyFileSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "File title is required"],
      trim: true,
    },

    publishedAt: {
      type: String,
      required: [true, "Publish date is required"],
      trim: true,
    },

    filePath: {
      type: String,
      required: [true, "File path is required"],
    },

    fileUrl: {
      type: String,
      required: [true, "File URL is required"],
    },

    originalName: {
      type: String,
      required: [true, "Original file name is required"],
      trim: true,
    },

    mimeType: {
      type: String,
      default: null,
    },

    size: {
      type: Number,
      required: true,
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Company name is required"],
      trim: true,
    },

    code: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      default: undefined,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    files: {
      type: [companyFileSchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Company", companySchema);
