const { Op } = require("sequelize");
const {
  Product,
  Category,
  Brand,
  Location,
  ProductBatch,
  ProductSerial,
  Inventory,
} = require("../models"); 
const XLSX = require("xlsx");
const { unlink } = require("fs/promises"); 
const sequelize = require("../configs/db");
const fs = require("fs/promises");
exports.create = async (req, res) => {
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
    StockQuantity,
  } = req.body;
  const t = await sequelize.transaction();

  try {
    const trimmedBarcode = Barcode ? String(Barcode).trim() : "";
    const trimmedName = Name ? String(Name).trim() : "";
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
    const parsedLocationID = parseInt(LocationID);
    if (isNaN(parsedLocationID)) {
      throw new Error("LocationID phải là một số nguyên hợp lệ.");
    }
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
    const rawStockQuantity = StockQuantity;
    const parsedStockQuantity = parseInt(rawStockQuantity) || 0;

    if (
      rawStockQuantity !== undefined &&
      (isNaN(parsedStockQuantity) || parsedStockQuantity < 0)
    ) {
      throw new Error("Số lượng tồn kho ban đầu phải là số nguyên không âm.");
    }
    const exist = await Product.findOne({ where: { Barcode: trimmedBarcode } });
    if (exist) {
      throw new Error("Mã sản phẩm đã tồn tại. Vui lòng chọn mã khác.");
    }

    const calculatedAverageCost =
      AverageCost !== undefined ? parseFloat(AverageCost) : parsedCostPrice;
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
        StockQuantity: parsedStockQuantity,
      },
      { transaction: t }
    );
    await Inventory.create(
      {
        Barcode: product.Barcode,
        Quantity: parsedStockQuantity,
      },
      { transaction: t }
    );
    await t.commit();

    res.status(201).json({
      message: "Tạo sản phẩm thành công và khởi tạo tồn kho.",
      product,
    });
  } catch (err) {
    await t.rollback();
    console.error("LỖI [ProductController:create]:", err);
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
    if (search) {
      whereCondition[Op.or] = [
        { Name: { [Op.like]: `%${search}%` } },
        { Barcode: { [Op.like]: `%${search}%` } },
      ];
    }
    if (status) {
      whereCondition.Status = status;
    }
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
    const trimmedBarcode = Barcode ? String(Barcode).trim() : product.Barcode;
    const trimmedName = Name ? String(Name).trim() : product.Name; 
    const parsedCostPrice = parseFloat(CostPrice);
    const parsedSalePrice = parseFloat(SalePrice);
    if (trimmedBarcode !== product.Barcode) {
      const exist = await Product.findOne({
        where: { Barcode: trimmedBarcode },
      });
      if (exist) {
        return res
          .status(400)
          .json({ message: "Mã sản phẩm đã tồn tại. Vui lòng chọn mã khác." });
      }
    }
    let updatedStockQuantity = product.StockQuantity;
    const parsedStockQuantity = parseInt(StockQuantity);

    if (
      !isNaN(parsedStockQuantity) &&
      parsedStockQuantity >= 0 &&
      parsedStockQuantity !== product.StockQuantity
    ) {
      updatedStockQuantity = parsedStockQuantity;

      await Inventory.update(
        {
          Quantity: parsedStockQuantity,
        },
        {
          where: { Barcode: trimmedBarcode },
          transaction: t,
        }
      );
    }
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
    product.StockQuantity = updatedStockQuantity; 
    product.MinStockLevel = minStock;
    product.MaxStockLevel = maxStock;

    await product.save({ transaction: t });

    await t.commit();
    res.json({ message: "Cập nhật sản phẩm thành công", product });
  } catch (err) {
    await t.rollback();
    console.error("LỖI [ProductController:update]:", err);
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
exports.confirmImport = async (req, res) => {
  const { productsToSave } = req.body;

  if (!productsToSave || productsToSave.length === 0) {
    return res.status(400).json({ message: "Không có sản phẩm nào để lưu." });
  }
  const t = await sequelize.transaction();
  try {
    const finalProducts = productsToSave.map((p) => {
      const { Category, Brand, Location, ...rest } = p;
      return rest;
    });
    const savedProducts = await Product.bulkCreate(finalProducts, {
      validate: true,
      ignoreDuplicates: false,
      transaction: t, 
    });
    const inventoryRecords = savedProducts.map((product) => ({
      Barcode: product.Barcode,
      Quantity: product.StockQuantity,
    }));
    await Inventory.bulkCreate(inventoryRecords, {
      validate: true,
      transaction: t,
      ignoreDuplicates: true,
    });
    await t.commit();

    res.json({
      message: `Đã lưu thành công ${savedProducts.length} sản phẩm và khởi tạo tồn kho.`,
      count: savedProducts.length,
    });
  } catch (err) {
    if (t) await t.rollback();

    console.error("LỖI LƯU SẢN PHẨM IMPORT:", err);

    let errorMessage = "Lỗi khi lưu sản phẩm vào cơ sở dữ liệu.";

    if (err.errors && err.errors.length > 0) {
      errorMessage = `Lỗi Validation: ${err.errors[0].message}`;
    } else if (err.original && err.original.code === "ER_DUP_ENTRY") {
      errorMessage = "Lỗi: Mã sản phẩm đã tồn tại trong database.";
    } else if (err.message) {
      errorMessage = err.message; 
    }

    res.status(500).json({ message: errorMessage });
  }
};
exports.searchProducts = async (req, res) => {
  try {
    const { search } = req.query;

    console.log("Tìm kiếm Barcode/Tên sản phẩm với từ khóa:", search);

    let whereCondition = {};
    let limitValue = 10; 
    if (search && search.trim().length > 0) {
      const trimmedSearch = search.trim();
      whereCondition = {
        [Op.or]: [
          { Name: { [Op.like]: `%${trimmedSearch}%` } },
          { Barcode: { [Op.like]: `%${trimmedSearch}%` } },
        ],
      };
    } else {
      limitValue = 50;
    }
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
      order: [["Name", "ASC"]], 
    });
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
        Quantity: { [Op.gt]: 0 },
      },
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
        Status: "in_stock",
      },
      order: [["WarrantyEnd", "ASC"]], 
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
