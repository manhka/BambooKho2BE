const express = require("express");
const router = express.Router();
const brandController = require("../controllers/brandController");
const auth = require("../middlewares/authMiddleware");

// Admin only
router.post("/", auth(), brandController.create);
router.put("/:id", auth(), brandController.update);
router.delete("/:id", auth(), brandController.archive);
router.post("/:id/restore", auth(), brandController.restore);

// All logged in users
router.get("/", auth(), brandController.list);
router.get("/:id", auth(), brandController.get);

module.exports = router;
