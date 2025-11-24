const express = require("express");
const router = express.Router();
const supplierController = require("../controllers/suppliersController");
const auth = require("../middlewares/authMiddleware");

router.post("/", auth(), supplierController.create);
router.put("/:id", auth(), supplierController.update);
router.get("/", auth(), supplierController.list);
router.get("/:id", auth(), supplierController.get);

module.exports = router;
