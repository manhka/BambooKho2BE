const { Op } = require("sequelize");
const { Location } = require("../models");
const controller = require("../controllers/locationController");

jest.mock("../models");

beforeAll(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

const mockReq = (data = {}) => ({
  body: data.body || {},
  params: data.params || {},
  query: data.query || {},
});

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("Location Controller", () => {

  // ======================================================
  // GET ALL
  // ======================================================
  describe("getAll()", () => {
    test("success (search + filter + pagination)", async () => {
      const req = mockReq({
        query: { page: 2, limit: 5, search: "Kho", status: "active" }
      });
      const res = mockRes();

      Location.findAndCountAll.mockResolvedValue({
        rows: [{ Id: 1 }],
        count: 10
      });

      await controller.getAll(req, res);

      expect(Location.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          Status: "active",
          [Op.or]: [
            { Code: { [Op.like]: "%Kho%" } },
            { Name: { [Op.like]: "%Kho%" } }
          ]
        }),
        offset: 5,
        limit: 5,
        order: [["Code", "ASC"]]
      }));

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        items: [{ Id: 1 }],
        totalItems: 10,
        totalPages: 2,
        currentPage: 2
      }));
    });

    test("DB error", async () => {
      const req = mockReq();
      const res = mockRes();

      Location.findAndCountAll.mockRejectedValue(new Error("DB error"));

      await controller.getAll(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ======================================================
  // CREATE
  // ======================================================
  describe("create()", () => {
    test("success", async () => {
      const req = mockReq({
        body: { Code: "L01", Name: "Kho Chính", Description: "Test" }
      });
      const res = mockRes();

      Location.findOne.mockResolvedValueOnce(null); // Code
      Location.findOne.mockResolvedValueOnce(null); // Name

      Location.create.mockResolvedValue({ Id: 1 });

      await controller.create(req, res);

      expect(Location.create).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });

    test("missing Code", async () => {
      const req = mockReq({ body: { Name: "Kho" } });
      const res = mockRes();

      await controller.create(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test("missing Name", async () => {
      const req = mockReq({ body: { Code: "L01" } });
      const res = mockRes();

      await controller.create(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test("duplicate Code", async () => {
      const req = mockReq({ body: { Code: "L01", Name: "Kho Mới" } });
      const res = mockRes();

      Location.findOne.mockResolvedValueOnce({ Id: 1 });

      await controller.create(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test("duplicate Name", async () => {
      const req = mockReq({ body: { Code: "L02", Name: "Kho Chính" } });
      const res = mockRes();

      Location.findOne.mockResolvedValueOnce(null);
      Location.findOne.mockResolvedValueOnce({ Id: 2 });

      await controller.create(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test("DB error", async () => {
      const req = mockReq({ body: { Code: "L01", Name: "Kho" } });
      const res = mockRes();

      Location.findOne.mockRejectedValue(new Error("DB error"));

      await controller.create(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ======================================================
  // UPDATE
  // ======================================================
  describe("update()", () => {
    test("success", async () => {
      const req = mockReq({
        params: { id: 1 },
        body: { Code: "L02", Name: "Kho Mới", Description: "", IsActive: false }
      });
      const res = mockRes();

      const mockLoc = { Id: 1, update: jest.fn() };

      Location.findByPk.mockResolvedValue(mockLoc);
      Location.findOne.mockResolvedValueOnce(null); // Code ok
      Location.findOne.mockResolvedValueOnce(null); // Name ok

      await controller.update(req, res);

      expect(mockLoc.update).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("missing Code", async () => {
      const req = mockReq({ params: { id: 1 }, body: { Name: "Kho" } });
      const res = mockRes();

      await controller.update(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test("missing Name", async () => {
      const req = mockReq({ params: { id: 1 }, body: { Code: "L01" } });
      const res = mockRes();

      await controller.update(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test("not found", async () => {
      const req = mockReq({ params: { id: 1 }, body: { Code: "L01", Name: "Kho" } });
      const res = mockRes();

      Location.findByPk.mockResolvedValue(null);

      await controller.update(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test("duplicate Code", async () => {
      const req = mockReq({
        params: { id: 1 },
        body: { Code: "L01", Name: "Kho" }
      });
      const res = mockRes();

      Location.findByPk.mockResolvedValue({});
      Location.findOne.mockResolvedValueOnce({ Id: 2 });

      await controller.update(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test("duplicate Name", async () => {
      const req = mockReq({
        params: { id: 1 },
        body: { Code: "L02", Name: "Kho 1" }
      });
      const res = mockRes();

      Location.findByPk.mockResolvedValue({});
      Location.findOne.mockResolvedValueOnce(null);
      Location.findOne.mockResolvedValueOnce({ Id: 2 });

      await controller.update(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test("DB error", async () => {
      const req = mockReq({ params: { id: 1 }, body: { Code: "A", Name: "B" } });
      const res = mockRes();

      Location.findByPk.mockRejectedValue(new Error("DB error"));

      await controller.update(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ======================================================
  // REMOVE
  // ======================================================
  describe("remove()", () => {
    test("success", async () => {
      const req = mockReq({ params: { id: 1 } });
      const res = mockRes();

      const mockLoc = { Status: "active", update: jest.fn() };
      Location.findByPk.mockResolvedValue(mockLoc);

      await controller.remove(req, res);

      expect(mockLoc.update).toHaveBeenCalledWith({ Status: "archive" });
      expect(res.json).toHaveBeenCalled();
    });

    test("not found", async () => {
      const req = mockReq({ params: { id: 10 } });
      const res = mockRes();

      Location.findByPk.mockResolvedValue(null);

      await controller.remove(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test("already archived", async () => {
      const req = mockReq({ params: { id: 1 } });
      const res = mockRes();

      Location.findByPk.mockResolvedValue({ Status: "archive" });

      await controller.remove(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test("DB error", async () => {
      const req = mockReq({ params: { id: 1 } });
      const res = mockRes();

      Location.findByPk.mockRejectedValue(new Error("DB error"));

      await controller.remove(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ======================================================
  // RESTORE
  // ======================================================
  describe("restore()", () => {
    test("success", async () => {
      const req = mockReq({ params: { id: 1 } });
      const res = mockRes();

      const mockLoc = { Status: "archive", update: jest.fn() };
      Location.findByPk.mockResolvedValue(mockLoc);

      await controller.restore(req, res);

      expect(mockLoc.update).toHaveBeenCalledWith({ Status: "active" });
      expect(res.json).toHaveBeenCalled();
    });

    test("not found", async () => {
      const req = mockReq({ params: { id: 5 } });
      const res = mockRes();

      Location.findByPk.mockResolvedValue(null);

      await controller.restore(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test("already active", async () => {
      const req = mockReq({ params: { id: 1 } });
      const res = mockRes();

      Location.findByPk.mockResolvedValue({ Status: "active" });

      await controller.restore(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test("DB error", async () => {
      const req = mockReq({ params: { id: 1 } });
      const res = mockRes();

      Location.findByPk.mockRejectedValue(new Error("DB error"));

      await controller.restore(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

});
