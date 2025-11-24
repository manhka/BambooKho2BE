// routes/inventoryRoutes.js

const express = require("express");
const router = express.Router();
const inventoryController = require("../controllers/inventoryController");
// Import middleware xác thực (Auth)
const auth = require("../middlewares/authMiddleware");

/**
 * 📦 Các tuyến đường cho nghiệp vụ Nhập/Xuất/Trả hàng
 * Quyền truy cập: Chỉ dành cho Admin và Staff (hoặc vai trò được phép)
 */

// POST /api/inventory/import
// Xử lý Nhập Kho (Goods Receipt) - Tăng tồn kho
router.post(
  "/import",
  auth(["admin", "staff"]),
  inventoryController.importGoods
);

// POST /api/inventory/export
// Xử lý Xuất Kho (Goods Issue) - Giảm tồn kho (Đã viết controller)
router.post(
  "/export",
  auth(["admin", "staff"]),
  inventoryController.exportGoods
);

// POST /api/inventory/return
// Xử lý Trả Hàng (Sale Return) - Tăng tồn kho do khách trả lại
// router.post(
//   "/return",
//   auth(["admin", "staff"]),
//   inventoryController.returnGoods
// );

// --- TÙY CHỌN: Các route xem chứng từ ---

/**
 * @route GET /api/inventory/vouchers
 * @desc Lấy danh sách tất cả các chứng từ (Nhập/Xuất/Trả hàng)
 */
// router.get(
//   "/vouchers",
//   auth(["admin", "staff"]),
//   inventoryController.listVouchers
// );

/**
 * @route GET /api/inventory/vouchers/:id
 * @desc Lấy chi tiết một chứng từ cụ thể
 */

router.get(
  "/vouchers/:voucherId", // <-- Chấp nhận ID số nguyên
  auth(["admin", "staff"]),
  inventoryController.getVoucherDetails // <-- Gọi hàm này
);
router.get(
  "/vouchers",
  auth(["admin", "staff"]),
  inventoryController.listVouchers
);
module.exports = router;
