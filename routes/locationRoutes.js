const express = require("express");
const router = express.Router();

const locationController = require("../controllers/locationController");
const auth = require("../middlewares/authMiddleware");

// ==========================================================
// 1. ROUTES DÀNH CHO READ (GET)
// ==========================================================

// GET /api/locations: Lấy danh sách tất cả vị trí (chỉ active)
router.get("/", auth(), locationController.getAll);

// ==========================================================
// 2. ROUTES DÀNH CHO CREATE/UPDATE/DELETE (POST/PUT/DELETE)
// ==========================================================

router.post("/", auth(), locationController.create);

router.put("/:id", auth(), locationController.update);

router.delete("/:id", auth(), locationController.remove);
router.post("/restore/:id", locationController.restore);
module.exports = router;
