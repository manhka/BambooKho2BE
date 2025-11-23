const express = require("express");
const router = express.Router();
const customerController = require("../controllers/customerController");
const auth = require("../middlewares/authMiddleware");

router.post("/", auth(["admin"]), customerController.create);
router.put("/:id", auth(["admin"]), customerController.update);

router.get("/", auth(), customerController.list);
router.get("/:id", auth(), customerController.get);

module.exports = router;
