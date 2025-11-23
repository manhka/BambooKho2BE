// ProductController.js

// 1. IMPORT CÁC MODULE VÀ MODEL CẦN THIẾT (LUÔN ĐẶT Ở ĐẦU)
const { Op } = require("sequelize");
const { Product, Category, Brand, Location } = require("../models"); // Import models từ index.js
const XLSX = require("xlsx");
const { unlink } = require("fs/promises"); // Import để xóa file tạm sau khi import (nên có)

exports.create = async (req, res) => {
  try {
    const {
      Barcode,
      Name,
      CategoryID,
      BrandID,
      LocationID, // ⭐️ Bắt buộc phải có
      IsSerial,
      Description,
      Attributes,
      CostPrice,
      SalePrice,
      AverageCost,
      ImageUrl,
      Status,
    } = req.body;

    // Trim các string
    const trimmedBarcode = Barcode ? String(Barcode).trim() : "";
    const trimmedName = Name ? String(Name).trim() : "";

    // 1. Kiểm tra bắt buộc
    if (
      !trimmedBarcode ||
      !trimmedName ||
      !CategoryID ||
      !BrandID ||
      !LocationID
    ) {
      return res.status(400).json({
        // ⭐️ Cập nhật thông báo lỗi
        message:
          "Mã sản phẩm, Tên, Danh mục, Thương hiệu và Vị trí lưu trữ là bắt buộc.",
      });
    }

    // ⭐️ Kiểm tra LocationID phải là số nguyên hợp lệ (do nó là bắt buộc)
    const parsedLocationID = parseInt(LocationID);
    if (isNaN(parsedLocationID)) {
      return res.status(400).json({
        message: "LocationID phải là một số nguyên hợp lệ.",
      });
    }

    // Kiểm tra bắt buộc giá nhập/bán và parse giá trị
    const parsedCostPrice = parseFloat(CostPrice);
    const parsedSalePrice = parseFloat(SalePrice);

    if (
      CostPrice === undefined ||
      SalePrice === undefined ||
      isNaN(parsedCostPrice) ||
      isNaN(parsedSalePrice)
    ) {
      return res.status(400).json({
        message: "Giá nhập và Giá bán phải là số và không được để trống.",
      });
    }

    // Bổ sung Validation: Giá phải lớn hơn 0
    if (parsedCostPrice <= 0 || parsedSalePrice <= 0) {
      return res.status(400).json({
        message: "Giá nhập và Giá bán phải lớn hơn 0.",
      });
    }

    // Bổ sung Validation: Giá bán phải lớn hơn hoặc bằng Giá nhập
    if (parsedSalePrice < parsedCostPrice) {
      return res.status(400).json({
        message:
          "Giá bán phải lớn hơn hoặc bằng Giá nhập để đảm bảo lợi nhuận (tối thiểu 0%).",
      });
    }

    // 2. Kiểm tra Barcode đã tồn tại chưa
    const exist = await Product.findOne({ where: { Barcode: trimmedBarcode } });
    if (exist) {
      return res.status(400).json({
        message: "Mã sản phẩm đã tồn tại. Vui lòng chọn mã khác.",
      });
    }

    // Chuẩn bị dữ liệu
    const calculatedAverageCost =
      AverageCost !== undefined ? parseFloat(AverageCost) : parsedCostPrice;

    // 3. Tạo product
    const product = await Product.create({
      Barcode: trimmedBarcode,
      Name: trimmedName,
      CategoryID,
      BrandID,
      LocationID: parsedLocationID, // Sử dụng giá trị đã parse
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
    });

    res.status(201).json({ message: "Tạo sản phẩm thành công", product });
  } catch (err) {
    console.error("LỖI [ProductController:create]:", err);

    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({
        message: "Mã sản phẩm đã tồn tại. Vui lòng chọn mã khác.",
      });
    }

    if (err.name === "SequelizeValidationError") {
      return res.status(400).json({
        message: err.errors[0].message || "Dữ liệu không hợp lệ.",
      });
    }

    res.status(500).json({ message: "Lỗi máy chủ." });
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
    } = req.body;

    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm." });
    }

    // Trim các string
    const trimmedBarcode = Barcode ? String(Barcode).trim() : product.Barcode;
    const trimmedName = Name ? String(Name).trim() : "";

    if (!trimmedName || !CategoryID || !BrandID || !LocationID) {
      return res.status(400).json({
        message: "Tên, Danh mục, Thương hiệu và Vị trí lưu trữ là bắt buộc.",
      });
    }

    const parsedLocationID = parseInt(LocationID);
    if (isNaN(parsedLocationID)) {
      return res.status(400).json({
        message: "LocationID phải là một số nguyên hợp lệ.",
      });
    }

    const parsedCostPrice = parseFloat(CostPrice);
    const parsedSalePrice = parseFloat(SalePrice);

    if (
      CostPrice === undefined ||
      SalePrice === undefined ||
      isNaN(parsedCostPrice) ||
      isNaN(parsedSalePrice)
    ) {
      return res.status(400).json({
        message: "Giá nhập và Giá bán phải là số và không được để trống.",
      });
    }

    if (parsedCostPrice <= 0 || parsedSalePrice <= 0) {
      return res.status(400).json({
        message: "Giá nhập và Giá bán phải lớn hơn 0.",
      });
    }

    if (parsedSalePrice < parsedCostPrice) {
      return res.status(400).json({
        message:
          "Giá bán phải lớn hơn hoặc bằng Giá nhập để đảm bảo lợi nhuận (tối thiểu 0%).",
      });
    }

    if (trimmedBarcode !== product.Barcode) {
      const exist = await Product.findOne({
        where: { Barcode: trimmedBarcode },
      });
      if (exist) {
        return res.status(400).json({
          message: "Mã sản phẩm đã tồn tại. Vui lòng chọn mã khác.",
        });
      }
    }

    // Validate tồn kho tối đa >= tồn kho tối thiểu
    const minStock = MinStockLevel !== undefined ? parseInt(MinStockLevel) : 0;
    const maxStock = MaxStockLevel !== undefined ? parseInt(MaxStockLevel) : 0;
    if (maxStock < minStock) {
      return res.status(400).json({
        message:
          "Định mức tồn kho tối đa phải lớn hơn hoặc bằng tồn kho tối thiểu.",
      });
    }

    const calculatedAverageCost =
      AverageCost !== undefined ? parseFloat(AverageCost) : parsedCostPrice;

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
    product.CostPrice = parsedCostPrice;
    product.AverageCost = calculatedAverageCost;
    product.SalePrice = parsedSalePrice;
    product.ImageUrl = ImageUrl !== undefined ? ImageUrl : product.ImageUrl;
    product.Status = Status || product.Status;
    product.MinStockLevel = minStock;
    product.MaxStockLevel = maxStock;

    await product.save();

    res.json({ message: "Cập nhật sản phẩm thành công", product });
  } catch (err) {
    console.error("LỖI [ProductController:update]:", err);

    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({
        message: "Mã sản phẩm đã tồn tại. Vui lòng chọn mã khác.",
      });
    }

    if (err.name === "SequelizeValidationError") {
      return res.status(400).json({
        message: err.errors[0].message || "Dữ liệu không hợp lệ.",
      });
    }

    res.status(500).json({ message: "Lỗi máy chủ." });
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

  try {
    // Lọc bỏ các trường Category, Brand, Location (object) không cần thiết khi lưu vào DB
    const finalProducts = productsToSave.map((p) => {
      console.log("product:", p);
      const { Category, Brand, Location, ...rest } = p;
      return rest;
    });

    const savedProducts = await Product.bulkCreate(finalProducts, {
      validate: true,
      ignoreDuplicates: false, // Thường là false để nếu có lỗi sẽ báo ngay
    });

    res.json({
      message: `Đã lưu thành công ${savedProducts.length} sản phẩm.`,
      count: savedProducts.length,
    });
  } catch (err) {
    console.error("LỖI LƯU SẢN PHẨM IMPORT:", err);
    let errorMessage = "Lỗi khi lưu sản phẩm vào cơ sở dữ liệu.";
    if (err.errors && err.errors.length > 0) {
      errorMessage = `Lỗi Validation: ${err.errors[0].message}`;
    }
    res.status(500).json({ message: errorMessage });
  }
};
