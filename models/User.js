const { DataTypes } = require("sequelize");
const sequelize = require("../configs/db");

const User = sequelize.define(
  "User",
  {
    UserID: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    Username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    Password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    Role: {
      type: DataTypes.ENUM("admin", "staff"),
      defaultValue: "staff",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = User;
