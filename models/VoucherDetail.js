// models/VoucherDetail.js

const { DataTypes } = require("sequelize");
const sequelize = require("../configs/db");

const VoucherDetail = sequelize.define(
  "VoucherDetail",
  {
    VoucherDetailID: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    VoucherID: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    Barcode: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    Quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    UnitPrice: {
      // Giá bán/giá nhập tại thời điểm giao dịch
      type: DataTypes.DECIMAL(20, 2),
      allowNull: true,
    },
    TotalLineAmount: {
      type: DataTypes.DECIMAL(20, 2),
      allowNull: true,
    },

    // **LIÊN KẾT TỒN KHO**
    BatchID: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    SerialID: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    // **THÔNG TIN ĐỔI TRẢ/BẢO HÀNH**
    WarrantyMonthsApplied: {
      // Số tháng bảo hành áp dụng cho giao dịch này
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    timestamps: false,
  }
);

module.exports = VoucherDetail;
