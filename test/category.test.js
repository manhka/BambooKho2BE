const controller = require("../controllers/categoryController");
const Category = require("../models/Category");
const { Op } = require("sequelize");

jest.mock("../models/Category", () => ({
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

describe("CategoryController", () => {
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
        message: "Tên danh mục không được để trống.",
      });
    });

    test("400 nếu tên đã tồn tại", async () => {
      Category.findOne.mockResolvedValue({ CategoryID: 1 });

      const req = { body: { Name: "Laptop" } };
      const res = mockRes();

      await controller.create(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Tên danh mục đã tồn tại. Vui lòng chọn tên khác.",
      });
    });

    test("Tạo category thành công", async () => {
      Category.findOne.mockResolvedValue(null);
      Category.create.mockResolvedValue({
        CategoryID: 10,
        Name: "Phone",
        Status: "active",
      });

      const req = { body: { Name: "Phone", Description: "desc" } };
      const res = mockRes();

      await controller.create(req, res);

      expect(Category.create).toHaveBeenCalledWith({
        Name: "Phone",
        Description: "desc",
        Status: "active",
      });

      expect(res.json).toHaveBeenCalledWith({
        message: "Created",
        category: {
          CategoryID: 10,
          Name: "Phone",
          Status: "active",
        },
      });
    });
  });

  // ===================== LIST =====================
  describe("list()", () => {
    test("Trả danh sách categories + paginate + search", async () => {
      Category.findAndCountAll.mockResolvedValue({
        rows: [{ CategoryID: 1, Name: "Laptop" }],
        count: 1,
      });

      const req = {
        query: { page: 1, limit: 10, search: "Lap", status: "active" },
      };
      const res = mockRes();

      await controller.list(req, res);

      expect(Category.findAndCountAll).toHaveBeenCalledWith({
        where: {
          Name: { [Op.like]: "%Lap%" },
          Status: "active",
        },
        offset: 0,
        limit: 10,
        order: [["CategoryID", "DESC"]],
      });

      expect(res.json).toHaveBeenCalledWith({
        items: [{ CategoryID: 1, Name: "Laptop" }],
        totalItems: 1,
        totalPages: 1,
        currentPage: 1,
      });
    });
  });

  // ===================== GET =====================
  describe("get()", () => {
    test("404 nếu không tìm thấy", async () => {
      Category.findByPk.mockResolvedValue(null);

      const req = { params: { id: 99 } };
      const res = mockRes();

      await controller.get(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test("Trả về category", async () => {
      Category.findByPk.mockResolvedValue({ CategoryID: 1, Name: "Laptop" });

      const req = { params: { id: 1 } };
      const res = mockRes();

      await controller.get(req, res);

      expect(res.json).toHaveBeenCalledWith({ CategoryID: 1, Name: "Laptop" });
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

    test("404 nếu không tìm thấy category", async () => {
      Category.findByPk.mockResolvedValue(null);

      const req = { params: { id: 1 }, body: { Name: "New" } };
      const res = mockRes();

      await controller.update(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test("400 nếu tên mới đã tồn tại", async () => {
      Category.findByPk.mockResolvedValue({
        CategoryID: 1,
        Name: "Laptop",
        save: jest.fn(),
      });

      Category.findOne.mockResolvedValue({ CategoryID: 2 });

      const req = { params: { id: 1 }, body: { Name: "Phone" } };
      const res = mockRes();

      await controller.update(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test("Update thành công", async () => {
      const mockSave = jest.fn();

      Category.findByPk.mockResolvedValue({
        CategoryID: 1,
        Name: "Laptop",
        Description: "Old",
        save: mockSave,
      });

      Category.findOne.mockResolvedValue(null);

      const req = {
        params: { id: 1 },
        body: { Name: "Tablet", Description: "New" },
      };
      const res = mockRes();

      await controller.update(req, res);

      expect(mockSave).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        message: "Updated",
        category: expect.any(Object),
      });
    });
  });

  // ===================== ARCHIVE =====================
  describe("archive()", () => {
    test("404 nếu không tìm thấy", async () => {
      Category.findByPk.mockResolvedValue(null);

      const req = { params: { id: 1 } };
      const res = mockRes();

      await controller.archive(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test("Archive thành công", async () => {
      const mockSave = jest.fn();

      Category.findByPk.mockResolvedValue({
        CategoryID: 1,
        Name: "Laptop",
        Status: "active",
        save: mockSave,
      });

      const req = { params: { id: 1 } };
      const res = mockRes();

      await controller.archive(req, res);

      expect(mockSave).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        message: "Archived",
        category: expect.any(Object),
      });
    });
  });

  // ===================== RESTORE =====================
  describe("restore()", () => {
    test("404 nếu không tìm thấy", async () => {
      Category.findByPk.mockResolvedValue(null);

      const req = { params: { id: 1 } };
      const res = mockRes();

      await controller.restore(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test("Restore thành công", async () => {
      const mockSave = jest.fn();

      Category.findByPk.mockResolvedValue({
        CategoryID: 1,
        Name: "Laptop",
        Status: "archived",
        save: mockSave,
      });

      const req = { params: { id: 1 } };
      const res = mockRes();

      await controller.restore(req, res);

      expect(mockSave).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        message: "Restored",
        category: expect.any(Object),
      });
    });
  });
});
