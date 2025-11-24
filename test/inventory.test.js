const controller = require("../controllers/inventoryController");
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

// ===================== MOCK DATABASE MODELS =====================
jest.mock("../models", () => ({
  Product: {
    increment: jest.fn(),
    findByPk: jest.fn(),
    update: jest.fn(),
  },

  ProductBatch: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
  },

  ProductSerial: {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  },

  InventoryVoucher: {
    create: jest.fn(),
    findByPk: jest.fn(),
    findAndCountAll: jest.fn(),
    update: jest.fn(),
  },

  VoucherDetail: {
    bulkCreate: jest.fn(),
  },

  Inventory: {
    increment: jest.fn(),
  },

  User: { findByPk: jest.fn() },
  Customer: { findByPk: jest.fn() },
  Supplier: { findByPk: jest.fn() },
}));


// ===================== MOCK TRANSACTION =====================
const commit = jest.fn();
const rollback = jest.fn();

sequelize.transaction = jest.fn().mockResolvedValue({
  commit,
  rollback,
});

// ===================== MOCK REQ RES =====================
const mockReq = (data) => ({
  body: data.body || {},
  params: data.params || {},
  query: data.query || {},
  user: data.user || null,
});

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("InventoryController", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================
  // ======================== EXPORT GOODS ======================
  // ===========================================================

  describe("exportGoods()", () => {
    test("401 nếu thiếu userId trong token", async () => {
      const req = mockReq({ body: {} });
      const res = mockRes();

      await controller.exportGoods(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Không tìm thấy User ID"),
        })
      );
    });

    test("400 thiếu customerId hoặc details", async () => {
      const req = mockReq({
        user: { id: 1 },
        body: { customerId: null, details: [] },
      });
      const res = mockRes();

      await controller.exportGoods(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Thiếu thông tin"),
        })
      );
    });

    test("xuất kho batch thành công", async () => {
      const req = mockReq({
        user: { id: 99 },
        body: {
          customerId: 10,
          description: "ghi chú",
          details: [
            {
              barcode: "SP01",
              quantity: 5,
              unitPrice: 100,
              batchId: 999,
            },
          ],
        },
      });

      const res = mockRes();

      InventoryVoucher.create.mockResolvedValue({
        VoucherID: 500,
        VoucherCode: "PXK123456789",
        update: jest.fn(),
      });

      ProductBatch.findOne.mockResolvedValue({
        Quantity: 10,
        decrement: jest.fn(),
      });

      Product.increment.mockResolvedValue(true);
      Inventory.increment.mockResolvedValue(true);
      VoucherDetail.bulkCreate.mockResolvedValue(true);

      await controller.exportGoods(req, res);

      expect(commit).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.any(String),
          voucherId: 500,
          voucherCode: expect.any(String),
        })
      );
    });

    test("xuất kho serial: lỗi thiếu serial in_stock", async () => {
      const req = mockReq({
        user: { id: 1 },
        body: {
          customerId: 100,
          details: [
            {
              barcode: "SP02",
              quantity: 1,
              unitPrice: 200,
              serialIdentifiers: ["S123"],
            },
          ],
        },
      });

      const res = mockRes();

      InventoryVoucher.create.mockResolvedValue({
        VoucherID: 501,
        VoucherCode: "PXK001",
      });

      ProductSerial.findAll.mockResolvedValue([]); // không tìm thấy serial

      await controller.exportGoods(req, res);

      expect(rollback).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Không tìm thấy đủ Serial"),
        })
      );
    });
  });

  // ===========================================================
  // ======================== IMPORT GOODS ======================
  // ===========================================================

  describe("importGoods()", () => {
    test("401 nếu thiếu user", async () => {
      const res = mockRes();
      await controller.importGoods(
        mockReq({ body: { supplierId: 1 } }),
        res
      );
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test("400 thiếu supplierId hoặc details", async () => {
      const req = mockReq({
        user: { id: 5 },
        body: { supplierId: null, details: [] },
      });
      const res = mockRes();

      await controller.importGoods(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test("nhập kho serial thành công", async () => {
      const req = mockReq({
        user: { id: 5 },
        body: {
          supplierId: 7,
          details: [
            {
              barcode: "SP01",
              quantity: 1,
              unitPrice: 150,
              serialNumbers: ["SN001"],
            },
          ],
        },
      });
      const res = mockRes();

      InventoryVoucher.create.mockResolvedValue({
        VoucherID: 100,
        VoucherCode: "PNK001",
        update: jest.fn(),
      });

      ProductSerial.findOne.mockResolvedValue(null); // serial chưa tồn tại

      ProductSerial.create.mockResolvedValue({
        SerialID: 900,
      });

      Product.findByPk.mockResolvedValue({
        StockQuantity: 0,
        AverageCost: 0,
        SalePrice: 0,
      });

      await controller.importGoods(req, res);

      expect(commit).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });

    test("serial đã tồn tại → báo lỗi", async () => {
      ProductSerial.findOne.mockResolvedValue({ SerialID: 123 });

      const req = mockReq({
        user: { id: 5 },
        body: {
          supplierId: 1,
          details: [
            {
              barcode: "SP01",
              quantity: 1,
              unitPrice: 100,
              serialNumbers: ["DUP123"],
            },
          ],
        },
      });
      const res = mockRes();

      await controller.importGoods(req, res);

      expect(rollback).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("đã tồn tại"),
        })
      );
    });
  });

  // ===========================================================
  // ====================== GET VOUCHER DETAILS =================
  // ===========================================================

  describe("getVoucherDetails()", () => {
    test("400 thiếu voucherId", async () => {
      const req = mockReq({ params: {} });
      const res = mockRes();

      await controller.getVoucherDetails(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test("404 nếu không tìm thấy", async () => {
      InventoryVoucher.findByPk.mockResolvedValue(null);

      const req = mockReq({ params: { voucherId: 999 } });
      const res = mockRes();

      await controller.getVoucherDetails(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test("trả về chi tiết chứng từ", async () => {
      InventoryVoucher.findByPk.mockResolvedValue({
        toJSON: () => ({
          VoucherType: "OUT",
          Creator: { Username: "admin" },
          CustomerPartner: { FullName: "KH1" },
          VoucherDetail: [],
        }),
      });

      const req = mockReq({ params: { voucherId: 1 } });
      const res = mockRes();

      await controller.getVoucherDetails(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ===========================================================
  // ======================== LIST VOUCHERS =====================
  // ===========================================================

  describe("listVouchers()", () => {
    test("trả danh sách vouchers", async () => {
      InventoryVoucher.findAndCountAll.mockResolvedValue({
        count: 1,
        rows: [
          {
            toJSON: () => ({
              VoucherID: 1,
              VoucherType: "IN",
              SupplierPartner: { Name: "NCC1" },
              Creator: { Username: "admin" },
            }),
          },
        ],
      });

      const req = mockReq({
        query: { page: 1, limit: 10, search: "", type: "" },
      });
      const res = mockRes();

      await controller.listVouchers(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.any(Array),
          total: 1,
        })
      );
    });
  });
});
