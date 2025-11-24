// ProductController.js

// 1. IMPORT CÁC MODULE VÀ MODEL CẦN THIẾT (LUÔN ĐẶT Ở ĐẦU)
const { Op } = require("sequelize");
const {
  Product,
  Category,
  Brand,
  Location,
  ProductBatch,
  ProductSerial,
  Inventory,
} = require("../models"); // Import models từ index.js
const XLSX = require("xlsx");
const { unlink } = require("fs/promises"); // Import để xóa file tạm sau khi import (nên có)
const sequelize = require("../configs/db");
exports.create = async (req, res) => {
  // Lấy LocationID và StockQuantity (Số lượng ban đầu) làm bắt buộc
  const {
    Barcode,
    Name,
    CategoryID,
    BrandID,
    LocationID,
    IsSerial,
    Description,
    Attributes,
    CostPrice,
    SalePrice,
    AverageCost,
    ImageUrl,
    Status,
    StockQuantity, // ⭐️ INPUT TỒN KHO BAN ĐẦU TỪ FE
  } = req.body;

  // Bắt đầu Transaction để đảm bảo tính nguyên tử (atomic) của Product và Inventory
  const t = await sequelize.transaction();

  try {
    // --- 1. Xác thực và Chuẩn hóa Dữ liệu ---
    const trimmedBarcode = Barcode ? String(Barcode).trim() : "";
    const trimmedName = Name ? String(Name).trim() : "";

    // Kiểm tra bắt buộc: Mã, Tên, Danh mục, Thương hiệu và Vị trí
    if (
      !trimmedBarcode ||
      !trimmedName ||
      !CategoryID ||
      !BrandID ||
      !LocationID
    ) {
      throw new Error(
        "Mã sản phẩm, Tên, Danh mục, Thương hiệu và Vị trí lưu trữ là bắt buộc."
      );
    }

    // Kiểm tra và Parse LocationID
    const parsedLocationID = parseInt(LocationID);
    if (isNaN(parsedLocationID)) {
      throw new Error("LocationID phải là một số nguyên hợp lệ.");
    }

    // Kiểm tra và Parse Giá (CostPrice & SalePrice)
    const parsedCostPrice = parseFloat(CostPrice);
    const parsedSalePrice = parseFloat(SalePrice);

    if (
      CostPrice === undefined ||
      SalePrice === undefined ||
      isNaN(parsedCostPrice) ||
      isNaN(parsedSalePrice)
    ) {
      throw new Error("Giá nhập và Giá bán phải là số và không được để trống.");
    }
    if (parsedCostPrice <= 0 || parsedSalePrice <= 0) {
      throw new Error("Giá nhập và Giá bán phải lớn hơn 0.");
    }
    if (parsedSalePrice < parsedCostPrice) {
      throw new Error("Giá bán phải lớn hơn hoặc bằng Giá nhập.");
    }

    // ⭐️ Kiểm tra và Parse StockQuantity
    const rawStockQuantity = StockQuantity;
    // Mặc định tồn kho ban đầu là 0 nếu không được cung cấp hoặc không hợp lệ
    const parsedStockQuantity = parseInt(rawStockQuantity) || 0;

    if (
      rawStockQuantity !== undefined &&
      (isNaN(parsedStockQuantity) || parsedStockQuantity < 0)
    ) {
      throw new Error("Số lượng tồn kho ban đầu phải là số nguyên không âm.");
    }

    // 2. Kiểm tra Barcode đã tồn tại chưa
    const exist = await Product.findOne({ where: { Barcode: trimmedBarcode } });
    if (exist) {
      throw new Error("Mã sản phẩm đã tồn tại. Vui lòng chọn mã khác.");
    }

    const calculatedAverageCost =
      AverageCost !== undefined ? parseFloat(AverageCost) : parsedCostPrice;

    // --- 3. Tạo Product (Cập nhật StockQuantity) ---
    const product = await Product.create(
      {
        Barcode: trimmedBarcode,
        Name: trimmedName,
        CategoryID,
        BrandID,
        LocationID: parsedLocationID,
        IsSerial: IsSerial !== undefined ? IsSerial : true,
        Description: Description || null,
        Attributes:
          Attributes &&
          (typeof Attributes === "object" && !Array.isArray(Attributes)
            ? Attributes
            : null),
        CostPrice: parsedCostPrice,
        AverageCost: calculatedAverageCost,
        SalePrice: parsedSalePrice,
        ImageUrl: ImageUrl || null,
        Status: Status || "active",
        // ⭐️ CẬP NHẬT TỒN KHO TRONG PRODUCT
        StockQuantity: parsedStockQuantity,
      },
      { transaction: t }
    );

    // --- 4. KHỞI TẠO BẢN GHI TRONG INVENTORY ---
    // Phản ánh số lượng tồn kho ban đầu trong bảng Inventory
    await Inventory.create(
      {
        Barcode: product.Barcode,
        // ⭐️ CẬP NHẬT TỒN KHO TRONG INVENTORY
        Quantity: parsedStockQuantity,
      },
      { transaction: t }
    );

    // 5. Commit Transaction
    await t.commit();

    res.status(201).json({
      message: "Tạo sản phẩm thành công và khởi tạo tồn kho.",
      product,
    });
  } catch (err) {
    // 6. Rollback Transaction nếu có bất kỳ lỗi nào
    await t.rollback();

    console.error("LỖI [ProductController:create]:", err);

    // Xử lý lỗi cụ thể
    const errorMessage =
      err.message ||
      (err.name === "SequelizeUniqueConstraintError"
        ? "Mã sản phẩm đã tồn tại. Vui lòng chọn mã khác."
        : "Dữ liệu không hợp lệ.");

    res.status(400).json({ message: errorMessage });
  }
};
exports.getAll = async (req, res) => {
  try {
    let { page = 1, limit = 8, search = "", status, locationId } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 8;

    const whereCondition = {};

    // Lọc theo tên hoặc barcode sản phẩm
    if (search) {
      whereCondition[Op.or] = [
        { Name: { [Op.like]: `%${search}%` } },
        { Barcode: { [Op.like]: `%${search}%` } },
      ];
    }

    // Lọc theo trạng thái
    if (status) {
      whereCondition.Status = status;
    }

    // Lọc theo LocationID
    if (locationId) {
      whereCondition.LocationID = locationId;
    }

    const offset = (pageNum - 1) * limitNum;

    const { rows, count } = await Product.findAndCountAll({
      where: whereCondition,
      offset,
      limit: limitNum,
      include: [
        {
          model: Category,
          attributes: ["Name"],
          as: "Category",
          required: false,
        },
        { model: Brand, attributes: ["Name"], as: "Brand", required: false },
        {
          model: Location,
          attributes: ["Name"],
          as: "Location",
          required: false,
        },
      ],
      attributes: { exclude: ["SKU"] },
      order: [["updatedAt", "DESC"]],
    });

    res.json({
      items: rows,
      totalItems: count,
      totalPages: Math.ceil(count / limitNum),
      currentPage: pageNum,
    });
  } catch (err) {
    console.error("LỖI [ProductController:getAll]:", err.message);
    res.status(500).json({
      message: "Lỗi máy chủ khi lấy danh sách sản phẩm.",
      error: err.message,
    });
  }
};
exports.viewDetail = async (req, res) => {
  try {
    const { id } = req.params;
    console.log("iddiidid:", id);
    // Thêm include để trả về chi tiết Category và Brand khi xem chi tiết
    const product = await Product.findByPk(id, {
      include: [
        { model: Category, as: "Category", attributes: ["Name"] },
        { model: Brand, as: "Brand", attributes: ["Name"] },
        { model: Location, as: "Location", attributes: ["Name"] },
      ],
    });

    if (!product) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm." });
    }

    res.json({ message: "Thông tin sản phẩm", product });
  } catch (err) {
    console.error("LỖI [ProductController:viewDetail]:", err);
    res.status(500).json({ message: "Lỗi máy chủ" });
  }
};

exports.update = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { id } = req.params;
    const {
      Barcode,
      Name,
      CategoryID,
      BrandID,
      LocationID,
      IsSerial,
      Description,
      Attributes,
      CostPrice,
      SalePrice,
      AverageCost,
      ImageUrl,
      Status,
      MinStockLevel,
      MaxStockLevel,
      StockQuantity,
    } = req.body;
    const parsedLocationID = parseInt(LocationID);
    if (isNaN(parsedLocationID)) {
      throw new Error("LocationID phải là một số nguyên hợp lệ.");
    }
    const product = await Product.findByPk(id, { transaction: t });
    if (!product) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm." });
    }

    // --- 1. Xác thực Dữ liệu và Giá ---
    const trimmedBarcode = Barcode ? String(Barcode).trim() : product.Barcode;
    const trimmedName = Name ? String(Name).trim() : product.Name; // Sử dụng product.Name làm fallback

    // (Giữ nguyên các validation khác: Tên, Danh mục, Vị trí, Giá nhập/bán, Min/Max Stock)

    // ... (Logic kiểm tra bắt buộc và parse LocationID) ...

    const parsedCostPrice = parseFloat(CostPrice);
    const parsedSalePrice = parseFloat(SalePrice);

    // ... (Logic kiểm tra giá > 0 và Giá bán >= Giá nhập) ...

    // --- 2. Xử lý Barcode (Nếu thay đổi) ---
    if (trimmedBarcode !== product.Barcode) {
      const exist = await Product.findOne({
        where: { Barcode: trimmedBarcode },
      });
      if (exist) {
        return res
          .status(400)
          .json({ message: "Mã sản phẩm đã tồn tại. Vui lòng chọn mã khác." });
      }
      // LƯU Ý: Nếu Barcode thay đổi, bạn cần cập nhật Barcode trong các bảng liên quan (Inventory, ProductBatch, ProductSerial, VoucherDetail).
      // Đây là một nghiệp vụ phức tạp, cần thực hiện thủ công hoặc dùng cascade update nếu cấu hình DB cho phép.
      // Trong trường hợp này, ta giả định Barcode là khóa chính/duy nhất và ít thay đổi.
    }

    // --- 3. Xử lý Tồn kho Vật lý (StockQuantity) ---
    let updatedStockQuantity = product.StockQuantity; // Giữ giá trị cũ
    const parsedStockQuantity = parseInt(StockQuantity);

    if (
      !isNaN(parsedStockQuantity) &&
      parsedStockQuantity >= 0 &&
      parsedStockQuantity !== product.StockQuantity
    ) {
      // CẢNH BÁO: Đây là điểm bỏ qua Audit Trail. Chỉ cho phép nếu Admin thực sự muốn sửa số lượng.

      // Cập nhật số lượng mới
      updatedStockQuantity = parsedStockQuantity;

      // Cập nhật bảng Inventory tương ứng
      await Inventory.update(
        {
          Quantity: parsedStockQuantity,
        },
        {
          where: { Barcode: trimmedBarcode },
          transaction: t,
        }
      );

      // LƯU Ý: Không được cập nhật AverageCost ở đây.
    }

    // Validate tồn kho tối đa >= tồn kho tối thiểu
    const minStock =
      MinStockLevel !== undefined
        ? parseInt(MinStockLevel)
        : product.MinStockLevel;
    const maxStock =
      MaxStockLevel !== undefined
        ? parseInt(MaxStockLevel)
        : product.MaxStockLevel;
    if (maxStock < minStock) {
      throw new Error(
        "Định mức tồn kho tối đa phải lớn hơn hoặc bằng tồn kho tối thiểu."
      );
    }

    const calculatedAverageCost =
      AverageCost !== undefined ? parseFloat(AverageCost) : product.AverageCost;

    // --- 4. Cập nhật Model Product ---
    product.Barcode = trimmedBarcode;
    product.Name = trimmedName;
    product.CategoryID = CategoryID;
    product.BrandID = BrandID;
    product.LocationID = parsedLocationID;
    product.IsSerial = IsSerial !== undefined ? IsSerial : product.IsSerial;
    product.Description =
      Description !== undefined ? Description : product.Description;
    product.Attributes =
      Attributes && typeof Attributes === "object" && !Array.isArray(Attributes)
        ? Attributes
        : product.Attributes;

    // Cập nhật giá
    product.CostPrice = parsedCostPrice;
    product.AverageCost = calculatedAverageCost;
    product.SalePrice = parsedSalePrice;

    product.ImageUrl = ImageUrl !== undefined ? ImageUrl : product.ImageUrl;
    product.Status = Status || product.Status;

    // Cập nhật tồn kho vật lý và định mức
    product.StockQuantity = updatedStockQuantity; // Cập nhật số lượng vật lý
    product.MinStockLevel = minStock;
    product.MaxStockLevel = maxStock;

    await product.save({ transaction: t });

    await t.commit();
    res.json({ message: "Cập nhật sản phẩm thành công", product });
  } catch (err) {
    await t.rollback();
    console.error("LỖI [ProductController:update]:", err);

    // Xử lý lỗi cụ thể
    const errorMessage =
      err.message ||
      (err.name === "SequelizeUniqueConstraintError"
        ? "Mã sản phẩm đã tồn tại."
        : "Lỗi dữ liệu không hợp lệ.");
    res.status(400).json({ message: errorMessage });
  }
};

exports.archive = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm." });
    }

    product.Status = "archived";
    await product.save();

    res.json({ message: "Đã lưu trữ sản phẩm", product });
  } catch (err) {
    console.error("LỖI [ProductController:archive]:", err);
    res.status(500).json({ message: "Lỗi máy chủ" });
  }
};

exports.restore = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm." });
    }

    product.Status = "active";
    await product.save();

    res.json({ message: "Đã khôi phục sản phẩm", product });
  } catch (err) {
    console.error("LỖI [ProductController:restore]:", err);
    res.status(500).json({ message: "Lỗi máy chủ" });
  }
};

// exports.importExcel - CONTROLLER GIAI ĐOẠN 1
exports.importExcel = async (req, res) => {
  let filePath = null;
  try {
    if (!req.file)
      return res.status(400).json({ message: "Chưa có file Excel." });

    filePath = req.file.path;
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet);

    const results = { success: 0, failed: 0, errors: [], items: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const {
          Barcode,
          Name,
          CategoryName,
          BrandName,
          LocationName,
          StockQuantity,
          IsSerial,
          Description,
          Attributes,
          CostPrice,
          SalePrice,
          MinStockLevel,
          MaxStockLevel,
          ImageUrl,
          Status,
        } = row;

        if (
          !Barcode ||
          !Name ||
          !CategoryName ||
          !BrandName ||
          !LocationName ||
          StockQuantity === undefined ||
          CostPrice === undefined ||
          SalePrice === undefined
        ) {
          results.failed++;
          results.errors.push({ row: i + 2, message: "Thiếu trường bắt buộc" });
          continue;
        }

        const trimmedBarcode = String(Barcode).trim();
        if (!trimmedBarcode) {
          results.failed++;
          results.errors.push({ row: i + 2, message: "Barcode không hợp lệ" });
          continue;
        }

        const exist = await Product.findByPk(trimmedBarcode);
        if (exist) {
          results.failed++;
          results.errors.push({ row: i + 2, message: "Barcode đã tồn tại" });
          continue;
        }

        const category = await Category.findOne({
          where: { Name: CategoryName },
        });
        const brand = await Brand.findOne({ where: { Name: BrandName } });
        const location = await Location.findOne({
          where: { Name: LocationName },
        });

        if (!category) {
          results.failed++;
          results.errors.push({
            row: i + 2,
            message: `Danh mục "${CategoryName}" không tồn tại`,
          });
          continue;
        }
        if (!brand) {
          results.failed++;
          results.errors.push({
            row: i + 2,
            message: `Thương hiệu "${BrandName}" không tồn tại`,
          });
          continue;
        }
        if (!location) {
          results.failed++;
          results.errors.push({
            row: i + 2,
            message: `Vị trí "${LocationName}" không tồn tại`,
          });
          continue;
        }

        const parsedCostPrice = parseFloat(CostPrice);
        const parsedSalePrice = parseFloat(SalePrice);
        const parsedStock = parseInt(StockQuantity);
        const parsedMinStock = parseInt(MinStockLevel || 0);
        const parsedMaxStock = parseInt(MaxStockLevel || 0);

        if (
          parsedCostPrice <= 0 ||
          parsedSalePrice <= 0 ||
          parsedSalePrice < parsedCostPrice ||
          parsedMaxStock < parsedMinStock ||
          parsedStock < 0
        ) {
          results.failed++;
          let msg = "";
          if (parsedCostPrice <= 0 || parsedSalePrice <= 0)
            msg = "Giá nhập/bán phải > 0";
          else if (parsedSalePrice < parsedCostPrice)
            msg = "Giá bán phải >= Giá nhập";
          else if (parsedMaxStock < parsedMinStock)
            msg = "Tồn kho tối đa phải >= tối thiểu";
          else if (parsedStock < 0) msg = "StockQuantity phải >= 0";
          results.errors.push({ row: i + 2, message: msg });
          continue;
        }

        let attr = null;
        if (Attributes) {
          try {
            attr =
              typeof Attributes === "string"
                ? JSON.parse(Attributes)
                : Attributes;
          } catch (e) {
            results.failed++;
            results.errors.push({
              row: i + 2,
              message: "Thuộc tính Attributes không hợp lệ (JSON)",
            });
            continue;
          }
        }

        // Lưu dữ liệu hợp lệ (có Category, Brand, Location reference cho Frontend)
        results.items.push({
          Barcode: trimmedBarcode,
          Name: String(Name).trim(),
          CategoryID: category.id,
          BrandID: brand.id,
          LocationID: location.id,
          Category: { CategoryID: category.CategoryID, Name: CategoryName },
          Brand: { BrandID: brand.BrandID, Name: BrandName },
          Location: { LocationID: location.id, Name: LocationName },
          StockQuantity: parsedStock,
          IsSerial: IsSerial !== undefined ? IsSerial : true,
          Description: Description || null,
          Attributes: attr,
          CostPrice: parsedCostPrice,
          AverageCost: parsedCostPrice,
          SalePrice: parsedSalePrice,
          MinStockLevel: parsedMinStock,
          MaxStockLevel: parsedMaxStock,
          ImageUrl: ImageUrl || null,
          Status: Status || "active",
        });

        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push({ row: i + 2, message: err.message });
      }
    }

    res.json({ message: "Đã đọc và xác thực file Excel", results });
  } catch (err) {
    console.error("LỖI [ProductController]:", err);
    res.status(500).json({ message: "Lỗi máy chủ" });
  } finally {
    if (filePath)
      await fs
        .unlink(filePath)
        .catch((err) => console.error("Lỗi xóa file tạm:", err));
  }
};
// exports.confirmImport - CONTROLLER GIAI ĐOẠN 2
exports.confirmImport = async (req, res) => {
  const { productsToSave } = req.body;

  if (!productsToSave || productsToSave.length === 0) {
    return res.status(400).json({ message: "Không có sản phẩm nào để lưu." });
  }

  const t = await sequelize.transaction(); // ⭐️ Bắt đầu Transaction

  try {
    // 1. Lọc bỏ các trường Category, Brand, Location (object) không cần thiết khi lưu vào DB
    const finalProducts = productsToSave.map((p) => {
      const { Category, Brand, Location, ...rest } = p;
      return rest;
    });

    // 2. Tạo Sản phẩm hàng loạt (Product.bulkCreate)
    // Lưu ý: Hàm này chỉ dành cho việc tạo sản phẩm MỚI, không xử lý cập nhật.
    const savedProducts = await Product.bulkCreate(finalProducts, {
      validate: true,
      ignoreDuplicates: false,
      transaction: t, // ⭐️ Áp dụng Transaction
    });

    // --- 3. Khởi tạo tồn kho cho các sản phẩm đã được lưu (BẮT BUỘC) ---

    const inventoryRecords = savedProducts.map((product) => ({
      Barcode: product.Barcode,
      // Lấy StockQuantity đã được lưu trong Product từ file Excel
      Quantity: product.StockQuantity,
    }));

    // 4. Thực hiện BulkCreate cho Inventory
    await Inventory.bulkCreate(inventoryRecords, {
      validate: true,
      transaction: t, // ⭐️ Áp dụng Transaction
      // Dùng ignoreDuplicates=true để tránh lỗi nếu Product đã tồn tại Inventory record (mặc dù không nên xảy ra ở đây)
      ignoreDuplicates: true,
    });

    // 5. Commit Transaction
    await t.commit();

    res.json({
      message: `Đã lưu thành công ${savedProducts.length} sản phẩm và khởi tạo tồn kho.`,
      count: savedProducts.length,
    });
  } catch (err) {
    // 6. Rollback nếu có lỗi
    if (t) await t.rollback();

    console.error("LỖI LƯU SẢN PHẨM IMPORT:", err);

    let errorMessage = "Lỗi khi lưu sản phẩm vào cơ sở dữ liệu.";

    if (err.errors && err.errors.length > 0) {
      errorMessage = `Lỗi Validation: ${err.errors[0].message}`;
    } else if (err.original && err.original.code === "ER_DUP_ENTRY") {
      errorMessage = "Lỗi: Mã sản phẩm đã tồn tại trong database.";
    } else if (err.message) {
      errorMessage = err.message; // Báo cáo lỗi từ throw new Error()
    }

    res.status(500).json({ message: errorMessage });
  }
};

// 1. Controller cho tìm kiếm chung sản phẩm theo Barcode, Tên, hoặc Serial
// controllers/productController.js

exports.searchProducts = async (req, res) => {
  try {
    const { search } = req.query;

    console.log("Tìm kiếm Barcode/Tên sản phẩm với từ khóa:", search);

    let whereCondition = {};
    let limitValue = 10; // Giới hạn kết quả mặc định

    // 1. Định nghĩa điều kiện WHERE
    if (search && search.trim().length > 0) {
      // Nếu có từ khóa tìm kiếm, áp dụng điều kiện LIKE
      const trimmedSearch = search.trim();
      whereCondition = {
        [Op.or]: [
          // Tìm kiếm theo Tên (chứa từ khóa)
          { Name: { [Op.like]: `%${trimmedSearch}%` } },
          // Tìm kiếm theo Barcode (chứa từ khóa)
          { Barcode: { [Op.like]: `%${trimmedSearch}%` } },
        ],
      };
    } else {
      limitValue = 50;
    }

    // 2. Thực hiện truy vấn Product
    const productList = await Product.findAll({
      where: whereCondition,
      attributes: [
        "Barcode",
        "Name",
        "IsSerial",
        "SalePrice",
        "StockQuantity",
        "CostPrice",
        "AverageCost",
      ],
      limit: limitValue,
      order: [["Name", "ASC"]], // Sắp xếp theo tên cho dễ nhìn
    });

    // 3. Trả về kết quả
    // Lưu ý: Nếu whereCondition là {}, nó sẽ trả về productList (theo limit)
    return res.status(200).json({
      success: true,
      data: productList,
    });
  } catch (error) {
    console.error("Lỗi tìm kiếm sản phẩm:", error);
    return res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ khi tìm kiếm sản phẩm." });
  }
};

// 2. Controller lấy tồn kho Lô
exports.getBatches = async (req, res) => {
  try {
    const { barcode } = req.params;

    if (!barcode) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu Barcode." });
    }

    const batches = await ProductBatch.findAll({
      where: {
        Barcode: barcode,
        Quantity: { [Op.gt]: 0 }, // Chỉ lấy lô có số lượng > 0
      },
      // Order theo ngày hết hạn hoặc ngày nhập (ví dụ: FEFO)
      order: [["createdAt", "ASC"]],
    });

    return res.status(200).json({
      success: true,
      data: batches,
    });
  } catch (error) {
    console.error(`Lỗi lấy lô cho ${req.params.barcode}:`, error);
    return res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ khi lấy tồn kho lô." });
  }
};

// 3. Controller lấy tồn kho Serial
exports.getSerials = async (req, res) => {
  try {
    const { barcode } = req.params;

    if (!barcode) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu Barcode." });
    }

    const serials = await ProductSerial.findAll({
      where: {
        Barcode: barcode,
        Status: "in_stock", // Chỉ lấy các serial còn trong kho
      },
      order: [["WarrantyEnd", "ASC"]], // Ví dụ: ưu tiên xuất Serial có hạn bảo hành gần hết
    });

    return res.status(200).json({
      success: true,
      data: serials,
    });
  } catch (error) {
    console.error(`Lỗi lấy serial cho ${req.params.barcode}:`, error);
    return res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ khi lấy tồn kho serial." });
  }
};
