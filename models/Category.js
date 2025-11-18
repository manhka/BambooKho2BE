const { DataTypes } = require("sequelize");
const sequelize = require("../configs/db");

const Category = sequelize.define(
  "Category",
  {
    CategoryID: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    Name: { type: DataTypes.STRING, allowNull: false, unique: true },
    Description: { type: DataTypes.TEXT, allowNull: true },
    Status: {
      type: DataTypes.ENUM("active", "archived"),
      defaultValue: "active",
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

module.exports = Category;
