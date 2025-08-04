const express = require("express");
const router = express.Router();
const { FirebaseService } = require("../services/firebase");
const { authenticateUser } = require("../middleware/auth");

router.get("/", authenticateUser, async (req, res) => {
  try {
    const { uid } = req.user;
    console.log("📦 Getting archived products for user:", uid);

    const archivedProducts = await FirebaseService.getUserArchivedProducts(uid);

    res.json({
      success: true,
      products: archivedProducts,
      count: archivedProducts.length,
    });
  } catch (error) {
    console.error("❌ Error getting archived products:", error);
    res.status(500).json({
      error: "Failed to get archived products",
      details: error.message,
    });
  }
});

router.post("/:id/restore", authenticateUser, async (req, res) => {
  try {
    const { uid } = req.user;
    const { id } = req.params;

    console.log("🔄 Restoring archived product:", id, "for user:", uid);

    await FirebaseService.restoreArchivedProduct(uid, id);

    res.json({
      success: true,
      message: "Product restored successfully",
      id,
    });
  } catch (error) {
    console.error("❌ Error restoring archived product:", error);
    res.status(500).json({
      error: "Failed to restore archived product",
      details: error.message,
    });
  }
});

router.delete("/:id", authenticateUser, async (req, res) => {
  try {
    const { uid } = req.user;
    const { id } = req.params;

    console.log(
      "🗑️ Deleting archived product permanently:",
      id,
      "for user:",
      uid
    );

    await FirebaseService.deleteArchivedProduct(uid, id);

    res.json({
      success: true,
      message: "Archived product deleted permanently",
      id,
    });
  } catch (error) {
    console.error("❌ Error deleting archived product:", error);
    res.status(500).json({
      error: "Failed to delete archived product",
      details: error.message,
    });
  }
});

module.exports = router;
