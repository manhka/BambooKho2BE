const { DataTypes } = require("sequelize");
const sequelize = require("../configs/db");

const InventoryVoucher = sequelize.define(
  "InventoryVoucher",
  {
    VoucherID: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    // 1. Thông tin Chứng từ
    VoucherCode: {
      // Mã chứng từ (Ví dụ: PNK20250001, PXK20250002)
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    VoucherType: {
      type: DataTypes.ENUM("IN", "OUT", "RETURN"), // Nhập, Xuất, Trả hàng
      allowNull: false,
    },
    VoucherDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },

    // 2. Thông tin Đối tác và Kho
    // Giữ lại để linh hoạt, đặt mặc định 1 cho Kho duy nhất
    WarehouseID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },

    // ID đối tác (Customer cho OUT/RETURN, Supplier cho IN)
    PartnerID: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    // 3. Thông tin Tham chiếu và Người dùng
    ReferenceID: {
      type: DataTypes.STRING, // ID Hóa đơn gốc (quan trọng cho RETURN)
      allowNull: true,
    },

    // Người dùng tạo/phê duyệt chứng từ
    UserID: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // 4. Tổng hợp
    TotalQuantity: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    TotalAmount: {
      type: DataTypes.DECIMAL(20, 2),
      defaultValue: 0,
    },

    // 5. Trạng thái
    Status: {
      type: DataTypes.ENUM("DRAFT", "COMPLETED", "CANCELLED"),
      defaultValue: "DRAFT",
    },

    Description: { type: DataTypes.TEXT },
  },
  {
    timestamps: true, // createdAt (Ngày tạo chứng từ), updatedAt
  }
);

module.exports = InventoryVoucher;
