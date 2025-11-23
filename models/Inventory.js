const { DataTypes } = require("sequelize");
const sequelize = require("../configs/db");

const Inventory = sequelize.define(
  "Inventory",
  {
    InventoryID: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    Barcode: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    Quantity: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  { timestamps: true }
);

module.exports = Inventory;
