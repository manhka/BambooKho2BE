// test/product.test.js

// ─────────── MOCKS ───────────

// Mock fs/promises trước khi import controller
jest.mock("fs/promises", () => ({
  unlink: jest.fn().mockResolvedValue(),
}));

// Mock XLSX
jest.mock("xlsx", () => ({
  readFile: jest.fn(),
  utils: { sheet_to_json: jest.fn() },
}));

// Mock các model
jest.mock("../models", () => ({
  Product: {
    findOne: jest.fn(),
    create: jest.fn(),
    findAndCountAll: jest.fn(),
    findByPk: jest.fn(),
    update: jest.fn(),
    bulkCreate: jest.fn(),
    findAll: jest.fn(),
  },
  Category: { findOne: jest.fn() },
  Brand: { findOne: jest.fn() },
  Location: { findOne: jest.fn() },
  Inventory: { create: jest.fn(), update: jest.fn(), bulkCreate: jest.fn() },
  ProductBatch: { findOne: jest.fn(), findByPk: jest.fn(), findAll: jest.fn(), create: jest.fn() },
  ProductSerial: { findAll: jest.fn(), findOne: jest.fn(), create: jest.fn() },
  InventoryVoucher: { create: jest.fn(), findByPk: jest.fn(), findAndCountAll: jest.fn() },
  VoucherDetail: { bulkCreate: jest.fn() },
  User: { findAndCountAll: jest.fn() },
  Customer: {},
  Supplier: {},
}));

// Mock sequelize transaction
jest.mock("../configs/db", () => ({
  transaction: jest.fn(() =>
    Promise.resolve({
      commit: jest.fn(),
      rollback: jest.fn(),
    })
  ),
}));

const controller = require("../controllers/productController");
const { Product, Category, Brand, Location, Inventory, ProductBatch, ProductSerial } = require("../models");
const XLSX = require("xlsx");
const fs = require("fs/promises");

// ─────────── HELPERS ───────────
const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ─────────── TEST create() ───────────
describe("ProductController.create()", () => {
  const req = {
    body: {
      Barcode: "ABC123",
      Name: "iPhone",
      CategoryID: 1,
      BrandID: 1,
      LocationID: 2,
      CostPrice: 1000,
      SalePrice: 1500,
      StockQuantity: 10,
    },
  };

  test("Tạo sản phẩm thành công", async () => {
    const res = mockRes();
    Product.findOne.mockResolvedValue(null);
    Product.create.mockResolvedValue({ Barcode: "ABC123" });
    Inventory.create.mockResolvedValue({});
    await controller.create(req, res);
    expect(Product.create).toHaveBeenCalled();
    expect(Inventory.create).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("Lỗi: Barcode bị trùng", async () => {
    const res = mockRes();
    Product.findOne.mockResolvedValue({ Barcode: "ABC123" });
    await controller.create(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Mã sản phẩm đã tồn tại. Vui lòng chọn mã khác.",
    });
  });

  test("Lỗi: Giá bán < Giá nhập", async () => {
    const res = mockRes();
    const badReq = {
      body: { Barcode: "A1", Name: "X", CategoryID: 1, BrandID: 1, LocationID: 1, CostPrice: 100, SalePrice: 10 },
    };
    await controller.create(badReq, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Giá bán phải lớn hơn hoặc bằng Giá nhập." });
  });
});

// ─────────── TEST getAll() ───────────
describe("ProductController.getAll()", () => {
  test("Trả danh sách sản phẩm", async () => {
    const req = { query: { page: 1, limit: 10, search: "ip" } };
    const res = mockRes();
    Product.findAndCountAll.mockResolvedValue({ rows: [{ Name: "iPhone" }], count: 1 });
    await controller.getAll(req, res);
    expect(Product.findAndCountAll).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      items: [{ Name: "iPhone" }],
      totalItems: 1,
      totalPages: 1,
      currentPage: 1,
    });
  });
});

// ─────────── TEST viewDetail() ───────────
describe("ProductController.viewDetail()", () => {
  test("Trả về chi tiết sản phẩm", async () => {
    const req = { params: { id: 3 } };
    const res = mockRes();
    Product.findByPk.mockResolvedValue({ id: 3 });
    await controller.viewDetail(req, res);
    expect(res.json).toHaveBeenCalledWith({ message: "Thông tin sản phẩm", product: { id: 3 } });
  });

  test("Không tìm thấy sản phẩm", async () => {
    const req = { params: { id: 9 } };
    const res = mockRes();
    Product.findByPk.mockResolvedValue(null);
    await controller.viewDetail(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ─────────── TEST update() ───────────
describe("ProductController.update()", () => {
  test("Cập nhật thành công", async () => {
    const req = { params: { id: 1 }, body: { Barcode: "NEW", Name: "New Name", CategoryID: 1, BrandID: 1, LocationID: 2, CostPrice: 100, SalePrice: 200 } };
    const res = mockRes();
    const mockProduct = { Barcode: "OLD", Name: "Old Name", StockQuantity: 5, save: jest.fn() };
    Product.findByPk.mockResolvedValue(mockProduct);
    Product.findOne.mockResolvedValue(null);
    Inventory.update.mockResolvedValue({});
    await controller.update(req, res);
    expect(mockProduct.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();
  });
});

// ─────────── TEST archive() ───────────
describe("ProductController.archive()", () => {
  test("Lưu trữ thành công", async () => {
    const req = { params: { id: 1 } };
    const res = mockRes();
    Product.findByPk.mockResolvedValue({ save: jest.fn() });
    await controller.archive(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Đã lưu trữ sản phẩm" }));
  });
});

// ─────────── TEST restore() ───────────
describe("ProductController.restore()", () => {
  test("Khôi phục thành công", async () => {
    const req = { params: { id: 1 } };
    const res = mockRes();
    Product.findByPk.mockResolvedValue({ save: jest.fn() });
    await controller.restore(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Đã khôi phục sản phẩm" }));
  });
});

// ─────────── TEST importExcel() ───────────
describe("ProductController.importExcel()", () => {
  test("Thiếu file", async () => {
    const req = { file: null };
    const res = mockRes();
    await controller.importExcel(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Chưa có file Excel." });
  });

  test("Đọc file Excel thành công", async () => {
    const req = { file: { path: "/tmp/test.xlsx" } };
    const res = mockRes();

    XLSX.readFile.mockReturnValue({ SheetNames: ["Sheet1"], Sheets: { Sheet1: {} } });
    XLSX.utils.sheet_to_json.mockReturnValue([
      {
        Barcode: "A1",
        Name: "Test",
        CategoryName: "Cat",
        BrandName: "Br",
        LocationName: "Loc",
        StockQuantity: 5,
        CostPrice: 10,
        SalePrice: 20,
      },
    ]);

    Product.findByPk.mockResolvedValue(null);
    Category.findOne.mockResolvedValue({ id: 1, Name: "Cat" });
    Brand.findOne.mockResolvedValue({ id: 1 });
    Location.findOne.mockResolvedValue({ id: 1 });

    await controller.importExcel(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: "Đã đọc và xác thực file Excel",
      results: expect.objectContaining({
        success: 1,
        failed: 0,
        items: expect.any(Array),
      }),
    }));

    expect(fs.unlink).toHaveBeenCalledWith("/tmp/test.xlsx");
  });
});

// ─────────── TEST confirmImport() ───────────
describe("ProductController.confirmImport()", () => {
  test("Không có sản phẩm", async () => {
    const req = { body: { productsToSave: [] } };
    const res = mockRes();
    await controller.confirmImport(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("Lưu thành công", async () => {
    const req = { body: { productsToSave: [{ Barcode: "A1", StockQuantity: 10, CategoryID: 1, BrandID: 1, LocationID: 1 }] } };
    const res = mockRes();
    Product.bulkCreate.mockResolvedValue([{ Barcode: "A1", StockQuantity: 10 }]);
    Inventory.bulkCreate.mockResolvedValue(true);
    await controller.confirmImport(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ count: 1 }));
  });
});

// ─────────── TEST searchProducts() ───────────
describe("ProductController.searchProducts()", () => {
  test("Tìm kiếm thành công", async () => {
    const req = { query: { search: "ip" } };
    const res = mockRes();
    Product.findAll.mockResolvedValue([{ Barcode: "A1" }]);
    await controller.searchProducts(req, res);
    expect(res.json).toHaveBeenCalled();
  });
});

// ─────────── TEST getBatches() ───────────
describe("ProductController.getBatches()", () => {
  test("Thiếu barcode", async () => {
    const req = { params: { barcode: "" } };
    const res = mockRes();
    await controller.getBatches(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("Lấy batches thành công", async () => {
    const req = { params: { barcode: "A1" } };
    const res = mockRes();
    ProductBatch.findAll.mockResolvedValue([{ id: 1 }]);
    await controller.getBatches(req, res);
    expect(res.json).toHaveBeenCalled();
  });
});

// ─────────── TEST getSerials() ───────────
describe("ProductController.getSerials()", () => {
  test("Thiếu barcode", async () => {
    const req = { params: { barcode: "" } };
    const res = mockRes();
    await controller.getSerials(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("Lấy serial thành công", async () => {
    const req = { params: { barcode: "A1" } };
    const res = mockRes();
    ProductSerial.findAll.mockResolvedValue([{ Serial: "X1" }]);
    await controller.getSerials(req, res);
    expect(res.json).toHaveBeenCalled();
  });
});
