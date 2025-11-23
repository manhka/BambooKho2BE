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
router.get("/:id", auth(), productController.viewDetail);
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

module.exports = router;
