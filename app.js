const express = require("express");
const cors = require("cors");
const sequelize = require("./configs/db");
require("dotenv").config();

// Routes
const authRoutes = require("./routes/authRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const brandRoutes = require("./routes/brandRoutes");
const productRoutes = require("./routes/productRoutes");
const locationRoutes = require("./routes/locationRoutes");
const customerRoutes = require("./routes/customerRoutes");
const supplierRoutes = require("./routes/supplierRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const dashboardRouter = require("./routes/dashboardRouter");
const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/brands", brandRoutes);
app.use("/api/products", productRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/dashboard", dashboardRouter);
// Test database connection
sequelize
  .authenticate()
  .then(() => console.log("Connected to MySQL"))
  .catch((err) => console.error("DB connection error:", err));

// Sync models (optionally { force: true } để tạo lại bảng)
sequelize.sync();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
