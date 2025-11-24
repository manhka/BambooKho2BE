const SupplierController = require("../controllers/SuppliersController");
const Supplier = require("../models/Supplier");
const { Op } = require("sequelize");

jest.mock("../models/Supplier");

const mockReq = (data) => ({ body: data.body || {}, params: data.params || {}, query: data.query || {} });
const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

describe("SupplierController", () => {
    beforeEach(() => jest.clearAllMocks());

    // ============================================
    // =============== CREATE ======================
    // ============================================
    describe("create()", () => {
        test("should return 400 if Name is empty", async () => {
            const req = mockReq({ body: { Name: "", Phone: "0123456789" } });
            const res = mockRes();

            await SupplierController.create(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: "Tên nhà cung cấp không được để trống.",
            });
        });

        test("should return 400 if Phone invalid", async () => {
            const req = mockReq({ body: { Name: "ABC", Phone: "123" } });
            const res = mockRes();

            await SupplierController.create(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        test("should return 400 if Phone already exists", async () => {
            Supplier.findOne.mockResolvedValue({ SupplierID: 1 });

            const req = mockReq({
                body: { Name: "ABC", Phone: "0123456789" },
            });
            const res = mockRes();

            await SupplierController.create(req, res);

            expect(Supplier.findOne).toHaveBeenCalledWith({
                where: { Phone: "0123456789" },
            });

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: "Số điện thoại đã tồn tại.",
            });
        });

        test("should create supplier successfully", async () => {
            Supplier.findOne.mockResolvedValue(null);
            Supplier.create.mockResolvedValue({ SupplierID: 1, Name: "ABC" });

            const req = mockReq({
                body: {
                    Name: "ABC",
                    Phone: "0123456789",
                    Email: "",
                },
            });
            const res = mockRes();

            await SupplierController.create(req, res);

            expect(Supplier.create).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith({
                message: "Created",
                supplier: { SupplierID: 1, Name: "ABC" },
            });
        });
    });

    // ============================================
    // =============== LIST ========================
    // ============================================
    describe("list()", () => {
        test("should return list of suppliers", async () => {
            Supplier.findAndCountAll.mockResolvedValue({
                rows: [{ SupplierID: 1, Name: "Test" }],
                count: 1,
            });

            const req = mockReq({
                query: { page: 1, limit: 10, search: "" },
            });
            const res = mockRes();

            await SupplierController.list(req, res);

            expect(Supplier.findAndCountAll).toHaveBeenCalledWith({
                where: {},
                offset: 0,
                limit: 10,
                order: [["SupplierID", "DESC"]],
            });

            expect(res.json).toHaveBeenCalledWith({
                items: [{ SupplierID: 1, Name: "Test" }],
                totalItems: 1,
                totalPages: 0.1 * 10, // = 1
                currentPage: 1,
            });
        });
    });

    // ============================================
    // =============== GET BY ID ===================
    // ============================================
    describe("get()", () => {
        test("should return supplier by ID", async () => {
            Supplier.findByPk.mockResolvedValue({
                SupplierID: 1,
                Name: "ABC",
            });

            const req = mockReq({ params: { id: 1 } });
            const res = mockRes();

            await SupplierController.get(req, res);

            expect(res.json).toHaveBeenCalledWith({
                SupplierID: 1,
                Name: "ABC",
            });
        });

        test("should return 404 if not found", async () => {
            Supplier.findByPk.mockResolvedValue(null);

            const req = mockReq({ params: { id: 99 } });
            const res = mockRes();

            await SupplierController.get(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ message: "Not found" });
        });
    });

    // ============================================
    // =============== UPDATE ======================
    // ============================================
    describe("update()", () => {
        test("should return 400 if Name empty", async () => {
            const req = mockReq({
                params: { id: 1 },
                body: { Name: "", Phone: "0123456789" },
            });
            const res = mockRes();

            await SupplierController.update(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        test("should return 404 if supplier not found", async () => {
            Supplier.findByPk.mockResolvedValue(null);

            const req = mockReq({
                params: { id: 99 },
                body: { Name: "ABC", Phone: "0123456789" },
            });
            const res = mockRes();

            await SupplierController.update(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });

        test("should return 400 if phone duplicated", async () => {
            Supplier.findByPk.mockResolvedValue({ SupplierID: 1 });

            Supplier.findOne.mockResolvedValue({ SupplierID: 2 });

            const req = mockReq({
                params: { id: 1 },
                body: { Name: "ABC", Phone: "0123456789" },
            });
            const res = mockRes();

            await SupplierController.update(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: "Số điện thoại đã tồn tại.",
            });
        });

        test("should update supplier successfully", async () => {
            const save = jest.fn();

            Supplier.findByPk.mockResolvedValue({
                SupplierID: 1,
                save,
            });

            Supplier.findOne.mockResolvedValue(null);

            const req = mockReq({
                params: { id: 1 },
                body: { Name: "ABC", Phone: "0123456789", Email: "" },
            });
            const res = mockRes();

            await SupplierController.update(req, res);

            expect(save).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith({
                message: "Updated",
                supplier: expect.any(Object),
            });
        });
    });
});
