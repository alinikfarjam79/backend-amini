const warehouseConfig = {
  defaultWarehouses: [
    "\u067e\u0644\u0627\u0633\u062a\u06cc\u06a9",
    "\u0631\u0648\u063a\u0646\u06cc",
    "\u0627\u0646\u0628\u0627\u0631 \u0641\u0631\u0648\u0634\u06af\u0627\u0647",
  ],

  productExcelColumns: {
    productCode: [
      "\u06a9\u062f",
      "\u06a9\u062f\u06a9\u0627\u0644\u0627",
      "\u06a9\u062f \u06a9\u0627\u0644\u0627",
      "\u0643\u062f \u0643\u0627\u0644\u0627",
    ],
    title: ["\u0639\u0646\u0648\u0627\u0646"],
    quantity: [
      "\u0645\u0648\u062c\u0648\u062f\u06cc",
      "\u0645\u0648\u062c\u0648\u062f\u064a",
    ],
  },
};

module.exports = Object.freeze(warehouseConfig);
