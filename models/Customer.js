const { DataTypes } = require("sequelize");
const sequelize = require("../configs/db");

const Customer = sequelize.define(
  "Customers",
  {
    CustomerID: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    FullName: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    Phone: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
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

module.exports = Customer;
