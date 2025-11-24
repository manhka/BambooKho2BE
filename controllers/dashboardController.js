// controllers/dashboardController.js

const { Op, Sequelize } = require("sequelize");
const {
  InventoryVoucher,
  VoucherDetail,
  Product,
  Inventory,
} = require("../models");

exports.getInventorySummary = async (req, res) => {
  const { startDate, endDate, dataType = "value" } = req.query;

  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate
    ? new Date(startDate)
    : new Date(end.getFullYear(), end.getMonth() - 5, 1);

  try {
    // --- 1. KPI: Tổng tồn kho ---
    const totalStock = await Inventory.sum("Quantity");

    const totalStockValueResult = await Product.findAll({
      attributes: [
        [
          Sequelize.fn("SUM", Sequelize.literal("StockQuantity * AverageCost")),
          "totalValue",
        ],
      ],
      raw: true,
    });
    const totalStockValue = parseFloat(
      totalStockValueResult[0]?.totalValue || 0
    );

    // --- 2. Monthly Trend ---
    // Chọn cột SUM theo dataType
    const sumField =
      dataType === "value"
        ? Sequelize.col("TotalAmount")
        : Sequelize.col("TotalQuantity");

    const monthlyData = await InventoryVoucher.findAll({
      attributes: [
        [
          Sequelize.fn("DATE_FORMAT", Sequelize.col("VoucherDate"), "%Y-%m"),
          "month",
        ],
        "VoucherType",
        [Sequelize.fn("SUM", sumField), "totalValue"],
      ],
      where: {
        VoucherType: { [Op.in]: ["IN", "OUT"] },
        VoucherDate: { [Op.between]: [start, end] },
        Status: "COMPLETED",
      },
      group: ["month", "VoucherType"],
      order: [[Sequelize.literal("month"), "ASC"]],
      raw: true,
    });

    // Pivot IN/OUT
    const trendData = {};
    monthlyData.forEach((item) => {
      const key = item.month;
      if (!trendData[key])
        trendData[key] = { month: key, inValue: 0, outValue: 0 };
      if (item.VoucherType === "IN")
        trendData[key].inValue = parseFloat(item.totalValue);
      if (item.VoucherType === "OUT")
        trendData[key].outValue = parseFloat(item.totalValue);
    });

    // --- 3. Top 5 sản phẩm xuất nhiều nhất ---
    const topExportData = await VoucherDetail.findAll({
      attributes: [
        "Barcode",
        [Sequelize.fn("SUM", Sequelize.col("Quantity")), "totalQuantity"],
      ],
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
      order: [[Sequelize.literal("totalQuantity"), "DESC"]],
      limit: 5,
      raw: true,
    });

    const topExport = topExportData.map((item) => ({
      name: item["Product.Name"],
      quantity: parseInt(item.totalQuantity),
      salePrice: item["Product.SalePrice"],
    }));

    // --- 4. Kết quả trả về ---
    return res.json({
      kpi: {
        totalStock: totalStock || 0,
        totalStockValue: totalStockValue || 0,
      },
      monthlyTrend: Object.values(trendData),
      topExport,
      dataType,
    });
  } catch (error) {
    console.error("Lỗi lấy dữ liệu Dashboard:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi lấy dữ liệu Dashboard.",
    });
  }
};
