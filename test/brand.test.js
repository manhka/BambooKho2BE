const controller = require("../controllers/brandController");
const Brand = require("../models/Brand");
const { Op } = require("sequelize");

jest.mock("../models/Brand", () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  findAndCountAll: jest.fn(),
  findByPk: jest.fn(),
}));

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("BrandController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===================== CREATE =====================
  describe("create()", () => {
    test("400 nếu Name rỗng", async () => {
      const req = { body: { Name: "  " } };
      const res = mockRes();

      await controller.create(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Tên thương hiệu không được để trống.",
      });
    });

    test("400 nếu tên đã tồn tại", async () => {
      Brand.findOne.mockResolvedValue({ BrandID: 1 });

      const req = { body: { Name: "Nike" } };
      const res = mockRes();

      await controller.create(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Tên thương hiệu đã tồn tại. Vui lòng chọn tên khác.",
      });
    });

    test("Tạo brand thành công", async () => {
      Brand.findOne.mockResolvedValue(null);
      Brand.create.mockResolvedValue({
        BrandID: 5,
        Name: "Adidas",
        Status: "active",
      });

      const req = { body: { Name: "Adidas", Description: "Desc" } };
      const res = mockRes();

      await controller.create(req, res);

      expect(Brand.create).toHaveBeenCalledWith({
        Name: "Adidas",
        Description: "Desc",
        Status: "active",
      });

      expect(res.json).toHaveBeenCalledWith({
        message: "Created",
        brand: {
          BrandID: 5,
          Name: "Adidas",
          Status: "active",
        },
      });
    });
  });

  // ===================== LIST =====================
  describe("list()", () => {
    test("Trả danh sách brand + paginate + search", async () => {
      Brand.findAndCountAll.mockResolvedValue({
        rows: [{ BrandID: 1, Name: "Nike" }],
        count: 1,
      });

      const req = {
        query: { page: 1, limit: 10, search: "Ni", status: "active" },
      };
      const res = mockRes();

      await controller.list(req, res);

      expect(Brand.findAndCountAll).toHaveBeenCalledWith({
        where: {
          Name: { [Op.like]: "%Ni%" },
          Status: "active",
        },
        offset: 0,
        limit: 10,
        order: [["BrandID", "DESC"]],
      });

      expect(res.json).toHaveBeenCalledWith({
        items: [{ BrandID: 1, Name: "Nike" }],
        totalItems: 1,
        totalPages: 1,
        currentPage: 1,
      });
    });
  });

  // ===================== GET =====================
  describe("get()", () => {
    test("404 nếu không tìm thấy", async () => {
      Brand.findByPk.mockResolvedValue(null);

      const req = { params: { id: 99 } };
      const res = mockRes();

      await controller.get(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test("Trả về brand", async () => {
      Brand.findByPk.mockResolvedValue({ BrandID: 1, Name: "Nike" });

      const req = { params: { id: 1 } };
      const res = mockRes();

      await controller.get(req, res);

      expect(res.json).toHaveBeenCalledWith({ BrandID: 1, Name: "Nike" });
    });
  });

  // ===================== UPDATE =====================
  describe("update()", () => {
    test("400 nếu Name rỗng", async () => {
      const req = { params: { id: 1 }, body: { Name: " " } };
      const res = mockRes();

      await controller.update(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test("404 nếu không tìm thấy brand", async () => {
      Brand.findByPk.mockResolvedValue(null);

      const req = { params: { id: 1 }, body: { Name: "New" } };
      const res = mockRes();

      await controller.update(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test("400 nếu tên mới đã tồn tại", async () => {
      Brand.findByPk.mockResolvedValue({
        BrandID: 1,
        Name: "Nike",
        save: jest.fn(),
      });

      Brand.findOne.mockResolvedValue({ BrandID: 2 });

      const req = { params: { id: 1 }, body: { Name: "Adidas" } };
      const res = mockRes();

      await controller.update(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test("Update thành công", async () => {
      const mockSave = jest.fn();

      Brand.findByPk.mockResolvedValue({
        BrandID: 1,
        Name: "Nike",
        Description: "Old",
        save: mockSave,
      });

      Brand.findOne.mockResolvedValue(null);

      const req = {
        params: { id: 1 },
        body: { Name: "Adidas", Description: "New" },
      };
      const res = mockRes();

      await controller.update(req, res);

      expect(mockSave).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        message: "Updated",
        brand: expect.any(Object),
      });
    });
  });

  // ===================== ARCHIVE =====================
  describe("archive()", () => {
    test("404 nếu không tìm thấy", async () => {
      Brand.findByPk.mockResolvedValue(null);

      const req = { params: { id: 1 } };
      const res = mockRes();

      await controller.archive(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test("Archive thành công", async () => {
      const mockSave = jest.fn();

      Brand.findByPk.mockResolvedValue({
        BrandID: 1,
        Name: "Nike",
        Status: "active",
        save: mockSave,
      });

      const req = { params: { id: 1 } };
      const res = mockRes();

      await controller.archive(req, res);

      expect(mockSave).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        message: "Archived",
        brand: expect.any(Object),
      });
    });
  });

  // ===================== RESTORE =====================
  describe("restore()", () => {
    test("404 nếu không tìm thấy", async () => {
      Brand.findByPk.mockResolvedValue(null);

      const req = { params: { id: 1 } };
      const res = mockRes();

      await controller.restore(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test("Restore thành công", async () => {
      const mockSave = jest.fn();

      Brand.findByPk.mockResolvedValue({
        BrandID: 1,
        Name: "Nike",
        Status: "archived",
        save: mockSave,
      });

      const req = { params: { id: 1 } };
      const res = mockRes();

      await controller.restore(req, res);

      expect(mockSave).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        message: "Restored",
        brand: expect.any(Object),
      });
    });
  });
});
