const { DataTypes } = require("sequelize");
const sequelize = require("../configs/db");

const Product = sequelize.define(
  "Product",
  {
    Barcode: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    Name: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    CategoryID: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    BrandID: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    LocationID: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    IsSerial: { type: DataTypes.BOOLEAN, defaultValue: true },

    Description: { type: DataTypes.TEXT },

    Attributes: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
    },

    CostPrice: { type: DataTypes.DECIMAL(20, 2), defaultValue: 0 },
    AverageCost: { type: DataTypes.DECIMAL(20, 2), defaultValue: 0 },
    SalePrice: { type: DataTypes.DECIMAL(20, 2), defaultValue: 0 },

    ImageUrl: { type: DataTypes.STRING },
    StockQuantity: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    MinStockLevel: { type: DataTypes.INTEGER, defaultValue: 0 },
    MaxStockLevel: { type: DataTypes.INTEGER, defaultValue: 0 },

    Status: {
      type: DataTypes.ENUM("active", "archived"),
      defaultValue: "active",
    },
  },
  { timestamps: true }
);

module.exports = Product;
