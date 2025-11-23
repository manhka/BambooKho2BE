const { DataTypes } = require("sequelize");
const sequelize = require("../configs/db");

const Location = sequelize.define(
  "Locations",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    Code: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    Name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    Description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    Status: {
      type: DataTypes.ENUM("active", "archive"),
      allowNull: false,
      defaultValue: "active",
    },
  },
  {
    timestamps: true,
    tableName: "Locations",
  }
);

module.exports = Location;
