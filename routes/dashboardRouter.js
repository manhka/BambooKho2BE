// routes/dashboardRouter.js (Ví dụ)

const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");
const auth = require("../middlewares/authMiddleware");

router.get(
  "/summary", // Ví dụ: /api/dashboard/summary
  auth(["admin"]), // Chỉ admin mới xem được dashboard
  dashboardController.getInventorySummary
);

module.exports = router;
