const { DataTypes } = require("sequelize");
const sequelize = require("../configs/db");

const Supplier = sequelize.define(
  "Suppliers",
  {
    SupplierID: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    Name: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    Phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },

    Email: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: { isEmail: true },
    },

    Address: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

module.exports = Supplier;
