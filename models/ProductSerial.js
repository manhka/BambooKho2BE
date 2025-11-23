const { DataTypes } = require("sequelize");
const sequelize = require("../configs/db");

const ProductSerial = sequelize.define(
  "ProductSerial",
  {
    SerialID: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    Barcode: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    SerialNumber: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    WarrantyMonths: { type: DataTypes.INTEGER, allowNull: false },
    WarrantyStart: { type: DataTypes.DATE },
    WarrantyEnd: { type: DataTypes.DATE },

    Status: {
      type: DataTypes.ENUM("in_stock", "sold", "warranty", "return"),
      defaultValue: "in_stock",
    },
  },
  { timestamps: true }
);

module.exports = ProductSerial;
