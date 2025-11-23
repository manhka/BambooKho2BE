const { Sequelize } = require("sequelize");

// Kết nối Sequelize
const sequelize = new Sequelize("warehouse_db", "root", "123456", {
  host: "localhost",
  dialect: "mysql",
  logging: false,
});

// Import models
const Product = require("./Product");
const ProductBatch = require("./ProductBatch");
const ProductSerial = require("./ProductSerial");
const Inventory = require("./Inventory");
const Category = require("./Category"); // Cần import Category & Brand (nếu chúng cũng dùng cấu trúc này)
const Brand = require("./Brand"); // Cần import Category & Brand
const Location = require("./Location");
/* ============================================================
  ASSOCIATIONS
  ============================================================ */
// Các quan hệ cần được thiết lập sau khi TẤT CẢ các Model đã được định nghĩa.
// Vì các Model của bạn đã được định nghĩa bên trong các file riêng, bạn có thể thiết lập quan hệ tại đây.

Product.hasMany(ProductBatch, { foreignKey: "Barcode", sourceKey: "Barcode" });
ProductBatch.belongsTo(Product, {
  foreignKey: "Barcode",
  targetKey: "Barcode",
});

Product.hasMany(ProductSerial, { foreignKey: "Barcode", sourceKey: "Barcode" });
ProductSerial.belongsTo(Product, {
  foreignKey: "Barcode",
  targetKey: "Barcode",
});

ProductBatch.hasMany(ProductSerial, { foreignKey: "BatchId" });
ProductSerial.belongsTo(ProductBatch, { foreignKey: "BatchId" });

Product.hasOne(Inventory, { foreignKey: "Barcode", sourceKey: "Barcode" });
Inventory.belongsTo(Product, { foreignKey: "Barcode", targetKey: "Barcode" });
// ⭐ PRODUCT ↔ LOCATION (1 Product có vị trí lưu trữ mặc định)
Product.belongsTo(Location, {
  foreignKey: "LocationID",
  targetKey: "id",
  as: "Location",
});
Location.hasMany(Product, { foreignKey: "LocationID", sourceKey: "id" });
// Quan hệ cho Category và Brand để Controller thực hiện JOIN được
Product.belongsTo(Category, {
  foreignKey: "CategoryID",
  targetKey: "CategoryID",
  as: "Category",
});
Category.hasMany(Product, {
  foreignKey: "CategoryID",
  sourceKey: "CategoryID",
});

Product.belongsTo(Brand, {
  foreignKey: "BrandID",
  targetKey: "BrandID",
  as: "Brand",
});
Brand.hasMany(Product, { foreignKey: "BrandID", sourceKey: "BrandID" });

/* ============================================================
  EXPORT
  ============================================================ */

module.exports = {
  sequelize,
  Product,
  ProductBatch,
  ProductSerial,
  Inventory,
  Category,
  Brand,
  Location,
};
