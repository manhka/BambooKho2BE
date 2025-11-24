const Customer = require("../models/Customer");
const { Op } = require("sequelize");
const controller = require("../controllers/customersController");

jest.mock("../models/Customer");

beforeAll(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "log").mockImplementation(() => {});
});

const mockReq = (data = {}) => ({
  body: data.body || {},
  params: data.params || {},
  query: data.query || {}
});

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("Customer Controller", () => {

  // -------------------- CREATE --------------------
  describe("create()", () => {
    test("success", async () => {
      const req = mockReq({ body: { FullName: "Nguyen Van A", Phone: "0123456789", Email: "a@mail.com", Address: "HN" } });
      const res = mockRes();

      Customer.findOne.mockResolvedValue(null);
      Customer.create.mockResolvedValue({ CustomerID: 1, FullName: "Nguyen Van A" });

      await controller.create(req, res);

      expect(Customer.findOne).toHaveBeenCalledWith({ where: { Phone: "0123456789" } });
      expect(Customer.create).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Created" }));
    });

    test("missing name", async () => {
      const req = mockReq({ body: { Phone: "0123456789" } });
      const res = mockRes();

      await controller.create(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Tên khách hàng không được để trống." });
    });

    test("missing phone", async () => {
      const req = mockReq({ body: { FullName: "Nguyen Van A" } });
      const res = mockRes();

      await controller.create(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Số điện thoại không được để trống." });
    });

    test("phone exists", async () => {
      const req = mockReq({ body: { FullName: "Nguyen Van A", Phone: "0123456789" } });
      const res = mockRes();

      Customer.findOne.mockResolvedValue({ CustomerID: 1 });

      await controller.create(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Số điện thoại đã tồn tại." });
    });

    test("DB error", async () => {
      const req = mockReq({ body: { FullName: "Nguyen Van A", Phone: "0123456789" } });
      const res = mockRes();

      Customer.findOne.mockRejectedValue(new Error("DB error"));

      await controller.create(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: "Server error" });
    });
  });

  // -------------------- LIST --------------------
  describe("list()", () => {
    test("success with pagination and search", async () => {
      const req = mockReq({ query: { page: 2, limit: 5, search: "Nguyen" } });
      const res = mockRes();

      Customer.findAndCountAll.mockResolvedValue({ rows: [{ CustomerID: 1 }], count: 1 });

      await controller.list(req, res);

      expect(Customer.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
        where: { [Op.or]: [{ FullName: { [Op.like]: "%Nguyen%" } }, { Phone: { [Op.like]: "%Nguyen%" } }] },
        offset: 5,
        limit: 5,
        order: [["CustomerID", "DESC"]]
      }));
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        items: [{ CustomerID: 1 }],
        totalItems: 1,
        totalPages: 1,
        currentPage: 2
      }));
    });

    test("DB error", async () => {
      const req = mockReq();
      const res = mockRes();

      Customer.findAndCountAll.mockRejectedValue(new Error("DB error"));

      await controller.list(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // -------------------- GET --------------------
  describe("get()", () => {
    test("success", async () => {
      const req = mockReq({ params: { id: 1 } });
      const res = mockRes();

      Customer.findByPk.mockResolvedValue({ CustomerID: 1, FullName: "Nguyen Van A" });

      await controller.get(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ CustomerID: 1 }));
    });

    test("not found", async () => {
      const req = mockReq({ params: { id: 1 } });
      const res = mockRes();

      Customer.findByPk.mockResolvedValue(null);

      await controller.get(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test("DB error", async () => {
      const req = mockReq({ params: { id: 1 } });
      const res = mockRes();

      Customer.findByPk.mockRejectedValue(new Error("DB error"));

      await controller.get(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // -------------------- UPDATE --------------------
  describe("update()", () => {
    test("success", async () => {
      const req = mockReq({ params: { id: 1 }, body: { FullName: "Updated", Phone: "0123456789" } });
      const res = mockRes();

      const mockCustomer = { CustomerID: 1, Phone: "0987654321", save: jest.fn() };
      Customer.findByPk.mockResolvedValue(mockCustomer);
      Customer.findOne.mockResolvedValue(null);

      await controller.update(req, res);

      expect(mockCustomer.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Updated" }));
    });

    test("missing name", async () => {
      const req = mockReq({ params: { id: 1 }, body: { Phone: "0123456789" } });
      const res = mockRes();

      await controller.update(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test("missing phone", async () => {
      const req = mockReq({ params: { id: 1 }, body: { FullName: "Name" } });
      const res = mockRes();

      await controller.update(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test("phone exists", async () => {
      const req = mockReq({ params: { id: 1 }, body: { FullName: "Name", Phone: "0123456789" } });
      const res = mockRes();

      const mockCustomer = { CustomerID: 1, Phone: "0987654321", save: jest.fn() };
      Customer.findByPk.mockResolvedValue(mockCustomer);
      Customer.findOne.mockResolvedValue({ CustomerID: 2 });

      await controller.update(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Số điện thoại đã tồn tại." });
    });

    test("not found", async () => {
      const req = mockReq({ params: { id: 1 }, body: { FullName: "Name", Phone: "0123456789" } });
      const res = mockRes();

      Customer.findByPk.mockResolvedValue(null);

      await controller.update(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test("DB error", async () => {
      const req = mockReq({ params: { id: 1 }, body: { FullName: "Name", Phone: "0123456789" } });
      const res = mockRes();

      Customer.findByPk.mockRejectedValue(new Error("DB error"));

      await controller.update(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

});
