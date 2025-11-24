// controllers/inventoryController.js

const { Op } = require("sequelize");
const sequelize = require("../configs/db");
const {
  Product,
  ProductBatch,
  ProductSerial,
  InventoryVoucher,
  VoucherDetail,
  Inventory,
  User,
  Customer,
  Supplier,
} = require("../models");
// xuất kho
exports.exportGoods = async (req, res) => {
  const { customerId, details, description } = req.body;

  // 1. LẤY USERID TỪ TOKEN VÀ XÁC THỰC
  const userId = req.user?.id;

  if (!userId) {
    // Trả về 401 nếu middleware không cung cấp ID người dùng
    return res
      .status(401)
      .json({ message: "Lỗi xác thực: Không tìm thấy User ID trong token." });
  }

  if (!customerId || !details || details.length === 0) {
    return res
      .status(400)
      .json({ message: "Thiếu thông tin Khách hàng hoặc chi tiết sản phẩm." });
  }

  const t = await sequelize.transaction();

  try {
    let totalQuantity = 0;
    let totalAmount = 0;
    const detailRecords = [];
    const saleDate = new Date();

    // TẠO MÃ CHỨNG TỪ TỰ SINH (Đồng bộ)
    const typePrefix = "PXK";
    const timestamp = Date.now();
    const voucherCode = `${typePrefix}${timestamp}`;

    // 2. Tạo bản ghi Tiêu đề Chứng từ (Voucher)
    const voucher = await InventoryVoucher.create(
      {
        VoucherCode: voucherCode,
        VoucherType: "OUT",
        VoucherDate: saleDate,
        PartnerID: customerId,
        UserID: userId,
        Status: "COMPLETED",
        Description: description,
      },
      { transaction: t }
    );

    // 3. Xử lý Chi tiết Từng mặt hàng (GIẢM TỒN KHO)
    for (const item of details) {
      // LƯU Ý: Frontend gửi serialIdentifiers (mảng chuỗi SerialNumber/ID)
      const {
        barcode,
        quantity,
        unitPrice,
        batchId,
        serialIdentifiers, // Sử dụng serialIdentifiers (chuỗi)
        warrantyMonths,
      } = item;

      if (!barcode || !quantity || quantity <= 0 || !unitPrice) {
        throw new Error(
          "Chi tiết sản phẩm không hợp lệ: thiếu Barcode, Số lượng, hoặc Đơn giá."
        );
      }

      totalQuantity += quantity;
      totalAmount += quantity * unitPrice;

      const isSerial = !!serialIdentifiers && serialIdentifiers.length > 0;

      if (isSerial) {
        // --- A. Xử lý Sản phẩm theo Serial: Cập nhật Status và Bảo hành ---

        if (quantity !== serialIdentifiers.length) {
          throw new Error(
            `[${barcode}] Số lượng yêu cầu (${quantity}) không khớp với số Serial cung cấp (${serialIdentifiers.length}).`
          );
        }

        // Tính toán ngày bảo hành
        const months = warrantyMonths || 0;
        const warrantyEnd = new Date(saleDate);
        warrantyEnd.setMonth(saleDate.getMonth() + months);

        // Lấy các bản ghi Serial đang in_stock (Dùng SerialNumber/ID để tìm)
        const serialsToUpdate = await ProductSerial.findAll({
          where: {
            SerialNumber: serialIdentifiers,
            Barcode: barcode,
            Status: "in_stock",
          },
          transaction: t,
        });

        if (serialsToUpdate.length !== quantity) {
          throw new Error(
            `[${barcode}] Không tìm thấy đủ Serial đang 'in_stock' (${serialsToUpdate.length}/${quantity}).`
          );
        }

        // Cập nhật trạng thái và thông tin bảo hành
        for (const serial of serialsToUpdate) {
          await serial.update(
            {
              Status: "sold",
              WarrantyStart: saleDate,
              WarrantyEnd: warrantyEnd,
              WarrantyMonths: months,
            },
            { transaction: t }
          );

          // Tạo Chi tiết Chứng từ liên kết Serial
          detailRecords.push({
            VoucherID: voucher.VoucherID,
            Barcode: barcode,
            Quantity: 1,
            UnitPrice: unitPrice,
            SerialID: serial.SerialID, // Lưu ID số nguyên
            TotalLineAmount: unitPrice,
            WarrantyMonthsApplied: months,
          });
        }
      } else if (batchId) {
        // --- B. Xử lý Sản phẩm theo Lô: Giảm Quantity ---

        const currentBatch = await ProductBatch.findOne({
          where: { BatchID: batchId, Barcode: barcode },
          transaction: t,
        });

        if (!currentBatch || currentBatch.Quantity < quantity) {
          throw new Error(`[${barcode}] Lô ${batchId} không đủ tồn kho.`);
        }

        await currentBatch.decrement("Quantity", {
          by: quantity,
          transaction: t,
        });

        // Tạo Chi tiết Chứng từ liên kết Lô
        detailRecords.push({
          VoucherID: voucher.VoucherID,
          Barcode: barcode,
          Quantity: quantity,
          UnitPrice: unitPrice,
          BatchID: batchId,
          TotalLineAmount: quantity * unitPrice,
          WarrantyMonthsApplied: warrantyMonths || null,
        });
      } else {
        throw new Error(
          `[${barcode}] Sản phẩm cần chỉ định BatchID hoặc SerialID để xuất kho.`
        );
      }

      // --- C. Cập nhật Tồn kho Tổng hợp (Inventory & Product) ---
      await Inventory.increment("Quantity", {
        by: -quantity, // GIẢM
        where: { Barcode: barcode },
        transaction: t,
      });

      await Product.increment("StockQuantity", {
        by: -quantity, // GIẢM
        where: { Barcode: barcode },
        transaction: t,
      });
    }

    // 4. Tạo các bản ghi Chi tiết Chứng từ
    await VoucherDetail.bulkCreate(detailRecords, { transaction: t });

    // 5. Cập nhật Tổng tiền và Tổng số lượng cho Chứng từ
    await voucher.update(
      { TotalQuantity: totalQuantity, TotalAmount: totalAmount },
      { transaction: t }
    );

    // 6. Hoàn tất Transaction
    await t.commit();

    return res.status(201).json({
      message: "Xuất kho thành công. Chứng từ đã được tạo.",
      voucherId: voucher.VoucherID, // Trả về ID số nguyên
      voucherCode: voucher.VoucherCode, // Trả về Mã chuỗi
    });
  } catch (err) {
    // 7. Xử lý lỗi và Rollback Transaction
    await t.rollback();
    console.error("Lỗi xuất kho:", err);

    const errorMessage =
      err.message || "Lỗi máy chủ nội bộ khi xử lý xuất kho.";

    return res.status(500).json({
      message: errorMessage,
      error: err.message,
    });
  }
};
// nhập kho
// Đảm bảo Product có các trường StockQuantity và AverageCost

exports.importGoods = async (req, res) => {
  const { supplierId, details, description } = req.body;

  // 1. LẤY USERID TỪ TOKEN (req.user.id)
  // Giả định middleware đã gán token payload vào req.user.
  // Dùng req.user?.id để an toàn, nếu không có token thì trả về lỗi 401 hoặc 500
  const userId = req.user?.id;

  // Thêm kiểm tra xác thực người dùng
  if (!userId) {
    // Nếu token hợp lệ nhưng không có ID, hoặc middleware không chạy
    return res
      .status(401)
      .json({ message: "Lỗi xác thực: Không tìm thấy User ID trong token." });
  }

  if (!supplierId || !details || details.length === 0) {
    return res.status(400).json({
      message: "Thiếu thông tin Nhà cung cấp hoặc chi tiết sản phẩm.",
    });
  }

  const t = await sequelize.transaction();

  try {
    let totalQuantity = 0;
    let totalAmount = 0;
    const detailRecords = [];

    // TẠO MÃ CHỨNG TỪ TỰ SINH (Khắc phục lỗi notNull VoucherCode)
    const typePrefix = "PNK";
    const timestamp = Date.now();
    const voucherCode = `${typePrefix}${timestamp}`;

    // 2. Tạo bản ghi Tiêu đề Chứng từ (Voucher)
    const voucher = await InventoryVoucher.create(
      {
        VoucherCode: voucherCode, // <-- TRƯỜNG NÀY ĐÃ ĐƯỢC THÊM
        VoucherType: "IN",
        VoucherDate: new Date(),
        PartnerID: supplierId,
        UserID: userId, // <-- SỬ DỤNG USERID TỪ TOKEN
        Status: "COMPLETED",
        Description: description,
      },
      { transaction: t }
    );

    // ... (Vòng lặp xử lý chi tiết sản phẩm, WAC, và cập nhật tồn kho)

    // (Đoạn này giữ nguyên logic phức tạp đã viết trước đó)
    for (const item of details) {
      const {
        barcode,
        quantity,
        unitPrice,
        serialNumbers,
        batchDetails,
        newSalePrice,
      } = item;

      if (!barcode || !quantity || quantity <= 0 || !unitPrice) {
        throw new Error("Chi tiết sản phẩm không hợp lệ.");
      }

      totalQuantity += quantity;
      totalAmount += quantity * unitPrice;

      const isSerial = !!serialNumbers && serialNumbers.length > 0;

      // Xử lý Serial & Lô (Logic đã viết...)

      if (isSerial) {
        if (quantity !== serialNumbers.length) {
          throw new Error(
            `[${barcode}] Số lượng yêu cầu (${quantity}) không khớp với số Serial cung cấp.`
          );
        }
        for (const sn of serialNumbers) {
          const existingSerial = await ProductSerial.findOne({
            where: { SerialNumber: sn },
          });
          if (existingSerial) {
            throw new Error(`Serial Number '${sn}' đã tồn tại trong hệ thống.`);
          }
          const serial = await ProductSerial.create(
            {
              Barcode: barcode,
              SerialNumber: sn,
              Status: "in_stock",
              WarrantyMonths:
                batchDetails?.warrantyMonths || item.warrantyMonths || 0,
            },
            { transaction: t }
          );
          detailRecords.push({
            VoucherID: voucher.VoucherID,
            Barcode: barcode,
            Quantity: 1,
            UnitPrice: unitPrice,
            SerialID: serial.SerialID,
            TotalLineAmount: unitPrice,
          });
        }
      } else {
        let batchIdToUse = batchDetails?.batchId;
        let currentBatch;
        if (batchIdToUse) {
          currentBatch = await ProductBatch.findByPk(batchIdToUse, {
            transaction: t,
          });
          if (!currentBatch) {
            throw new Error(`Lô ID ${batchIdToUse} không tồn tại.`);
          }
          await currentBatch.increment("Quantity", {
            by: quantity,
            transaction: t,
          });
        } else {
          currentBatch = await ProductBatch.create(
            {
              Barcode: barcode,
              Quantity: quantity,
              CostPrice: unitPrice,
              WarrantyMonths: batchDetails?.warrantyMonths || 0,
            },
            { transaction: t }
          );
          batchIdToUse = currentBatch.BatchID;
        }
        detailRecords.push({
          VoucherID: voucher.VoucherID,
          Barcode: barcode,
          Quantity: quantity,
          UnitPrice: unitPrice,
          BatchID: batchIdToUse,
          TotalLineAmount: quantity * unitPrice,
        });
      }

      // Cập nhật Tồn kho và Giá (WAC & SalePrice)
      const productBeforeUpdate = await Product.findByPk(barcode, {
        attributes: ["StockQuantity", "AverageCost", "SalePrice"],
        transaction: t,
      });
      const oldStock = parseInt(productBeforeUpdate.StockQuantity || 0);
      const oldAverageCost = parseFloat(productBeforeUpdate.AverageCost || 0);
      const newCost = parseFloat(unitPrice);
      let newAverageCost = oldAverageCost;
      let productUpdateFields = {};

      if (oldStock > 0) {
        const totalValueOld = oldStock * oldAverageCost;
        const totalValueNew = quantity * newCost;
        newAverageCost =
          (totalValueOld + totalValueNew) / (oldStock + quantity);
      } else if (quantity > 0) {
        newAverageCost = newCost;
      }

      if (newAverageCost !== oldAverageCost) {
        productUpdateFields.AverageCost = newAverageCost;
      }
      const parsedNewSalePrice = parseFloat(newSalePrice);
      if (
        !isNaN(parsedNewSalePrice) &&
        parsedNewSalePrice >= 0 &&
        parseFloat(productBeforeUpdate.SalePrice) !== parsedNewSalePrice
      ) {
        productUpdateFields.SalePrice = parsedNewSalePrice;
      }

      await Product.increment("StockQuantity", {
        by: quantity,
        where: { Barcode: barcode },
        transaction: t,
      });
      await Inventory.increment("Quantity", {
        by: quantity,
        where: { Barcode: barcode },
        transaction: t,
      });
      if (Object.keys(productUpdateFields).length > 0) {
        await Product.update(productUpdateFields, {
          where: { Barcode: barcode },
          transaction: t,
        });
      }
    }

    // 3. Tạo các bản ghi Chi tiết Chứng từ
    await VoucherDetail.bulkCreate(detailRecords, { transaction: t });

    // 4. Cập nhật Tổng tiền và Tổng số lượng cho Chứng từ
    await voucher.update(
      { TotalQuantity: totalQuantity, TotalAmount: totalAmount },
      { transaction: t }
    );

    // 5. Commit Transaction
    await t.commit();

    return res.status(201).json({
      message: "Nhập kho thành công. Chứng từ đã được tạo.",
      voucherId: voucher.VoucherID,
      voucherCode: voucher.VoucherCode,
    });
  } catch (err) {
    // 6. Rollback nếu có lỗi
    await t.rollback();
    console.error("Lỗi nhập kho:", err);

    return res.status(500).json({
      message: err.message || "Lỗi máy chủ nội bộ khi xử lý nhập kho.",
      error: err.message,
    });
  }
};

exports.getVoucherDetails = async (req, res) => {
  try {
    // Lấy voucherId từ URL params (ví dụ: /vouchers/123)
    const { voucherId } = req.params;

    if (!voucherId) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu ID chứng từ." });
    }

    // --- Truy vấn Chứng từ DÙNG ID (findByPk) ---
    // findByPk là phương pháp tối ưu nhất khi tìm kiếm bằng khóa chính (ID)
    const voucher = await InventoryVoucher.findByPk(voucherId, {
      include: [
        // 1. Thông tin người dùng tạo/phê duyệt
        { model: User, attributes: ["UserID", "Username"], as: "Creator" },

        // 2. Thông tin đối tác (Supplier HOẶC Customer)
        {
          model: Customer,
          attributes: ["CustomerID", "FullName", "Phone"],
          as: "CustomerPartner",
        },
        {
          model: Supplier,
          attributes: ["SupplierID", "Name", "Phone"],
          as: "SupplierPartner",
        },

        // 3. Chi tiết từng dòng sản phẩm
        {
          model: VoucherDetail,
          as: "VoucherDetail",
          include: [
            // 3.1. Thông tin Sản phẩm
            {
              model: Product,
              attributes: [
                "Barcode",
                "Name",
                "SalePrice",
                "CostPrice",
                "IsSerial",
              ],
            },
            // 3.2. Thông tin Lô (nếu có)
            {
              model: ProductBatch,
              attributes: ["BatchID", "Quantity"],
              required: false,
            },
            // 3.3. Thông tin Serial (nếu có)
            {
              model: ProductSerial,
              attributes: ["SerialID", "SerialNumber"],
              required: false,
            },
          ],
        },
      ],
      // Sắp xếp chi tiết theo ID để đảm bảo thứ tự
      order: [["VoucherDetail", "VoucherDetailID", "ASC"]],
    });

    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy chứng từ nhập/xuất kho.",
      });
    }

    // --- 4. Chuẩn hóa Dữ liệu Trả về ---
    const voucherData = voucher.toJSON();

    // Xác định đối tác chính xác
    const partner =
      voucherData.VoucherType === "IN"
        ? voucherData.SupplierPartner
        : voucherData.CustomerPartner;

    // Ánh xạ lại cấu trúc để FE dễ dùng
    const finalData = {
      ...voucherData,
      User: voucherData.Creator,
      Partner: partner,

      // Xóa các trường lồng ghép không cần thiết
      CustomerPartner: undefined,
      SupplierPartner: undefined,
      Creator: undefined,
    };

    return res.status(200).json({ success: true, data: finalData });
  } catch (error) {
    console.error("Lỗi khi xem chi tiết chứng từ:", error);
    return res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ khi truy vấn chứng từ." });
  }
};

exports.listVouchers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "", type = "" } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitInt = parseInt(limit);

    let whereCondition = {};

    // 1. Lọc theo Loại Chứng từ (IN, OUT, RETURN)
    if (type) {
      whereCondition.VoucherType = type;
    }

    // 2. Tìm kiếm theo Mã Chứng từ (VoucherCode)
    if (search) {
      whereCondition.VoucherCode = { [Op.like]: `%${search}%` };
    }

    // 3. Thực hiện truy vấn (kèm theo tổng số bản ghi)
    const { count, rows } = await InventoryVoucher.findAndCountAll({
      where: whereCondition,
      order: [
        ["VoucherDate", "DESC"],
        ["VoucherID", "DESC"],
      ], // Sắp xếp mới nhất lên đầu
      limit: limitInt,
      offset: offset,
      // Include các đối tượng cần thiết cho báo cáo
      include: [
        { model: User, attributes: ["Username"], as: "Creator" },
        { model: Customer, attributes: ["FullName"], as: "CustomerPartner" },
        { model: Supplier, attributes: ["Name"], as: "SupplierPartner" },
      ],
    });

    // 4. Chuẩn hóa dữ liệu trả về
    const vouchers = rows.map((voucher) => {
      const data = voucher.toJSON();
      const partner =
        data.VoucherType === "IN" ? data.SupplierPartner : data.CustomerPartner;

      return {
        VoucherID: data.VoucherID,
        VoucherCode: data.VoucherCode,
        VoucherType: data.VoucherType,
        VoucherDate: data.VoucherDate,
        TotalQuantity: data.TotalQuantity,
        TotalAmount: data.TotalAmount,
        Status: data.Status,
        Creator: data.Creator?.Username || "N/A",
        PartnerName: partner?.Name || partner?.FullName || "Khách/NCC",
      };
    });

    return res.status(200).json({
      success: true,
      data: vouchers,
      total: count,
      page: parseInt(page),
      limit: limitInt,
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách chứng từ:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi lấy lịch sử giao dịch.",
    });
  }
};
