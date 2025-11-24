// controllers/dashboardController.js

const { Op, Sequelize } = require("sequelize");
const sequelize = require("../configs/db");
// Đảm bảo các models đã được import từ file models/index.js
const {
  InventoryVoucher,
  VoucherDetail,
  Product,
  Inventory,
} = require("../models");

exports.getInventorySummary = async (req, res) => {
  // Lấy tham số lọc từ Frontend
  // dataType: 'value' (Giá trị VND) hoặc 'quantity' (Số lượng)
  const { startDate, endDate, dataType = "value" } = req.query;

  // Thiết lập phạm vi ngày mặc định là 6 tháng gần nhất
  const end = endDate ? new Date(endDate) : new Date();
  // Bắt đầu từ ngày 1 của 6 tháng trước
  const start = startDate
    ? new Date(startDate)
    : new Date(end.getFullYear(), end.getMonth() - 5, 1);

  try {
    // --- 1. Tính Tồn kho Tổng thể (KPIs) ---

    // 1.1 Tổng Số lượng Tồn kho vật lý (Từ bảng Inventory)
    const totalStock = await Inventory.sum("Quantity");

    // 1.2 Tổng Giá trị Tồn kho (Sử dụng AverageCost * StockQuantity)
    const totalStockValueResult = await Product.findAll({
      attributes: [
        [
          Sequelize.fn(
            "SUM",
            Sequelize.literal("Product.StockQuantity * Product.AverageCost")
          ),
          "totalValue",
        ],
      ],
      raw: true,
    });
    const currentTotalStockValue = parseFloat(
      totalStockValueResult[0]?.totalValue || 0
    );

    // --- 2. Phân tích Xu hướng Nhập/Xuất theo tháng (Monthly Trend) ---

    // Chọn trường SUM dựa trên tham số dataType từ Frontend
    const sumField =
      dataType === "value"
        ? Sequelize.col("TotalAmount")
        : Sequelize.col("TotalQuantity");

    const monthlyData = await InventoryVoucher.findAll({
      attributes: [
        // Nhóm theo Năm-Tháng
        [
          Sequelize.fn("DATE_FORMAT", Sequelize.col("VoucherDate"), "%Y-%m"),
          "monthYear",
        ],
        [Sequelize.col("VoucherType"), "type"],
        [Sequelize.fn("SUM", sumField), "totalValue"],
      ],
      where: {
        VoucherType: { [Op.in]: ["IN", "OUT"] }, // Chỉ lấy Nhập và Xuất
        VoucherDate: { [Op.between]: [start, end] },
        Status: "COMPLETED",
      },
      group: ["monthYear", "type"],
      order: [[Sequelize.literal("monthYear"), "ASC"]],
      raw: true,
    });

    // Chuyển đổi mảng kết quả thành cấu trúc pivot (IN vs OUT)
    const trendData = monthlyData.reduce((acc, item) => {
      const key = item.monthYear;
      if (!acc[key]) {
        acc[key] = { month: key, inValue: 0, outValue: 0 };
      }
      if (item.type === "IN") {
        acc[key].inValue = parseFloat(item.totalValue);
      }
      if (item.type === "OUT") {
        acc[key].outValue = parseFloat(item.totalValue);
      }
      return acc;
    }, {});

    // --- 3. Top 5 Sản phẩm Xuất nhiều nhất (theo số lượng) ---
    const topExport = await VoucherDetail.findAll({
      attributes: [
        "Barcode",
        // Tổng số lượng xuất
        [Sequelize.fn("SUM", Sequelize.col("Quantity")), "totalExportQuantity"],
      ],
      // JOIN với InventoryVoucher (để lọc theo loại/ngày) và Product (để lấy tên/giá bán)
      include: [
        {
          model: InventoryVoucher,
          as: "InventoryVoucher",
          attributes: [],
          where: {
            VoucherType: "OUT",
            VoucherDate: { [Op.between]: [start, end] },
            Status: "COMPLETED",
          },
        },
        {
          model: Product,
          as: "Product",
          attributes: ["Name", "SalePrice"],
        },
      ],
      group: ["Barcode", "Product.Name", "Product.SalePrice"],
      order: [[Sequelize.literal("totalExportQuantity"), "DESC"]],
      limit: 5,
      raw: true,
    });

    // --- 4. Trả về Kết quả Tổng hợp ---
    return res.json({
      kpi: {
        totalStock: totalStock || 0,
        totalStockValue: currentTotalStockValue,
      },
      monthlyTrend: Object.values(trendData),
      topExport: topExport.map((item) => ({
        name: item["Product.Name"],
        quantity: parseInt(item.totalExportQuantity),
        // Sử dụng SalePrice của Product tại thời điểm hiện tại (cần join thêm Product)
        salePrice: item["Product.SalePrice"],
      })),
      dataType: dataType,
    });
  } catch (error) {
    console.error("Lỗi lấy dữ liệu Dashboard:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ nội bộ khi lấy dữ liệu Dashboard.",
    });
  }
};
