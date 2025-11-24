const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const auth = require("../middlewares/authMiddleware");
const upload = require("../middlewares/upload");

// Admin only
router.post("/", auth(["admin"]), productController.create);
router.put("/:id", auth(["admin"]), productController.update);
router.delete("/:id", auth(["admin"]), productController.archive);
router.post("/:id/restore", auth(["admin"]), productController.restore);

// All logged in users
router.get("/", auth(), productController.getAll);
router.get("/view-detail/:id", auth(), productController.viewDetail);
router.post(
  "/import",
  auth(["admin"]),
  upload.single("file"), // Sử dụng middleware upload.single để xử lý file
  productController.importExcel
);

// 2. Giai đoạn 2: Xác nhận và Lưu trữ dữ liệu đã xác thực
// Dữ liệu sản phẩm (productsToSave) được gửi qua body (JSON)
router.post(
  "/confirm-import",
  auth(["admin"]),
  productController.confirmImport
);

// 1. GET /api/products/search
// Tìm kiếm sản phẩm theo tên, Barcode hoặc Serial. Trả về danh sách gợi ý cho FE.
router.get(
  "/search",
  auth(), // Bảo vệ route
  productController.searchProducts
);

// 2. GET /api/products/:barcode/batches
// Lấy danh sách các Lô (Batch) còn tồn của một sản phẩm cụ thể.
router.get("/:barcode/batches", auth(), productController.getBatches);

// 3. GET /api/products/:barcode/serials
// Lấy danh sách các Serial còn tồn (status='in_stock') của một sản phẩm cụ thể.
router.get("/:barcode/serials", auth(), productController.getSerials);

module.exports = router;
