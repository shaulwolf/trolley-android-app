// Load environment variables first
require("dotenv").config();

// Set timezone to UTC to avoid Firebase token issues
process.env.TZ = "UTC";

// Log current time for debugging
console.log("🕐 Server time:", new Date().toISOString());
console.log("🌍 Timezone:", process.env.TZ || "system default");

// server.js - Clean Universal Pure Scraper Backend with Firebase
const express = require("express");
const cors = require("cors");

// Initialize Firebase service (this will set up Firebase Admin)
require("./services/firebase");

// Import route modules
const productsRouter = require("./routes/products");
const syncRouter = require("./routes/sync");
const scraperRouter = require("./routes/scraper");
const archiveRouter = require("./routes/archive");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    scraper: "universal-pure-scraper",
    version: "3.0",
    database: "Firebase Firestore",
    authentication: "Firebase Auth",
  });
});

// Mount route modules
app.use("/api", productsRouter); // This includes auth and user profile routes
app.use("/api/sync", syncRouter);
app.use("/api/archive", archiveRouter); // For archive routes
app.use("/", scraperRouter); // For /extract-product endpoint

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Trolley Backend with Firebase running on port ${PORT}`);
  console.log(`🔥 Using Firebase Firestore database`);
  console.log(`🔐 Using Firebase Authentication`);
  console.log(`🌐 Server accessible at:`);
  console.log(`   - http://localhost:${PORT}`);
  console.log(`   - http://0.0.0.0:${PORT} (all interfaces)`);
  console.log(`📊 Available endpoints:`);
  console.log(`   GET  /health - Health check`);
  console.log(`   🌐 PUBLIC ENDPOINTS:`);
  console.log(
    `   POST /api/auth/google-token - Exchange Google token for Firebase token`
  );
  console.log(
    `   POST /extract-product - Scrape product info (no auth required)`
  );
  console.log(`   🔐 AUTHENTICATED ENDPOINTS (require Bearer token):`);
  console.log(`   POST /api/users/profile - Create/update user profile`);
  console.log(`   GET  /api/users/profile - Get user profile`);
  console.log(`   GET  /api/products - Get user's products`);
  console.log(`   POST /api/products - Add product to user's trolley`);
  console.log(`   PUT  /api/products/:id - Update user's product`);
  console.log(`   POST /api/products/:id/archive - Archive user's product`);
  console.log(`   DELETE /api/products/:id - Delete user's product`);
  console.log(`   GET  /api/archive - Get user's archived products`);
  console.log(`   POST /api/archive/:id/restore - Restore archived product`);
  console.log(
    `   DELETE /api/archive/:id - Delete archived product permanently`
  );
  console.log(`   GET  /api/sync - Get user's products for sync`);
  console.log(`   POST /api/sync - Upload user's products for sync`);
  console.log(`   POST /api/sync/merge - Merge products into user's trolley`);
  console.log(`   GET  /api/sync/status - Get user's sync status`);
  console.log(`   `);
  console.log(`💡 To use authenticated endpoints, include header:`);
  console.log(`   Authorization: Bearer <firebase-id-token>`);
});
