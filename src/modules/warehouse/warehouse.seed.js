const warehouseConfig = require("../../config/warehouse");
const warehouseRepository = require("./warehouse.repository");

const ensureDefaultWarehouses = async () => {
  await warehouseRepository.bulkCreateDefaults(warehouseConfig.defaultWarehouses);
};

module.exports = {
  ensureDefaultWarehouses,
};
