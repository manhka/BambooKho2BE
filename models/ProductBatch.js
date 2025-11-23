const { DataTypes } = require("sequelize");
const sequelize = require("../configs/db");

const ProductBatch = sequelize.define(
  "ProductBatch",
  {
    BatchID: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    Barcode: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    Quantity: { type: DataTypes.INTEGER, defaultValue: 0 },

    WarrantyMonths: { type: DataTypes.INTEGER },
    WarrantyEnd: { type: DataTypes.DATE },
  },
  { timestamps: true }
);

module.exports = ProductBatch;
