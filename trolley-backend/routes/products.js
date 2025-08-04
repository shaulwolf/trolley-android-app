const express = require("express");
const router = express.Router();
const { FirebaseService } = require("../services/firebase");
const { authenticateUser, optionalAuth } = require("../middleware/auth");

// Google token exchange endpoint (no auth required)
router.post("/auth/google-token", async (req, res) => {
  try {
    const { googleAccessToken, userInfo } = req.body;

    if (!googleAccessToken || !userInfo) {
      return res.status(400).json({
        error: "Missing required fields",
        details: "googleAccessToken and userInfo are required",
      });
    }

    console.log(
      "🔄 Creating custom Firebase token for Chrome extension user:",
      userInfo.email
    );

    // Verify the Google access token first
    const googleResponse = await fetch(
      `https://www.googleapis.com/oauth2/v1/userinfo?access_token=${googleAccessToken}`
    );

    if (!googleResponse.ok) {
      return res.status(401).json({
        error: "Invalid Google access token",
      });
    }

    const googleUserInfo = await googleResponse.json();

    if (googleUserInfo.email !== userInfo.email) {
      return res.status(401).json({
        error: "Token email mismatch",
      });
    }

    // Create a custom Firebase token
    const admin = require("firebase-admin");
    const customToken = await admin
      .auth()
      .createCustomToken(googleUserInfo.id, {
        email: googleUserInfo.email,
        name: googleUserInfo.name,
        picture: googleUserInfo.picture,
        email_verified: googleUserInfo.verified_email,
        provider: "google.com",
      });

    // Create/update user profile
    await FirebaseService.updateUserProfile(googleUserInfo.id, {
      email: googleUserInfo.email,
      displayName: googleUserInfo.name || googleUserInfo.email.split("@")[0],
      photoURL: googleUserInfo.picture,
      emailVerified: googleUserInfo.verified_email,
      provider: "google.com",
      lastLogin: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      firebaseToken: customToken,
      userId: googleUserInfo.id,
    });
  } catch (error) {
    console.error("❌ Error creating custom Firebase token:", error);
    res.status(500).json({
      error: "Failed to create Firebase token",
      details: error.message,
    });
  }
});

// User profile endpoints (authenticated)
router.post("/users/profile", authenticateUser, async (req, res) => {
  try {
    const { uid } = req.user;
    const profileData = req.body;

    console.log("📝 Creating/updating user profile for:", uid);

    // Create or update user profile
    await FirebaseService.updateUserProfile(uid, {
      ...profileData,
      lastLogin: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: "User profile created/updated successfully",
      userId: uid,
    });
  } catch (error) {
    console.error("❌ Error creating/updating user profile:", error);
    res.status(500).json({
      error: "Failed to create/update user profile",
      details: error.message,
    });
  }
});

router.get("/users/profile", authenticateUser, async (req, res) => {
  try {
    const { uid } = req.user;

    console.log("📋 Getting user profile for:", uid);

    const profile = await FirebaseService.getUserProfile(uid);

    if (!profile) {
      return res.status(404).json({
        error: "User profile not found",
      });
    }

    res.json(profile);
  } catch (error) {
    console.error("❌ Error getting user profile:", error);
    res.status(500).json({
      error: "Failed to get user profile",
      details: error.message,
    });
  }
});

// Product CRUD endpoints (authenticated)
router.get("/products", authenticateUser, async (req, res) => {
  try {
    const { uid } = req.user;
    console.log("📦 Getting products for user:", uid);

    const products = await FirebaseService.getUserProducts(uid);

    res.json(products);
  } catch (error) {
    console.error("❌ Error getting products:", error);
    res.status(500).json({
      error: "Failed to get products",
      details: error.message,
    });
  }
});

router.post("/products", authenticateUser, async (req, res) => {
  try {
    const { uid } = req.user;
    const productData = req.body;

    console.log("➕ Adding product for user:", uid);

    const productId = await FirebaseService.addUserProduct(uid, productData);

    // Return the created product with its ID
    const createdProduct = {
      id: productId,
      ...productData,
      userId: uid,
      dateAdded: new Date().toISOString(),
    };

    res.status(201).json(createdProduct);
  } catch (error) {
    console.error("❌ Error adding product:", error);
    res.status(500).json({
      error: "Failed to add product",
      details: error.message,
    });
  }
});

router.put("/products/:id", authenticateUser, async (req, res) => {
  try {
    const { uid } = req.user;
    const { id } = req.params;
    const updates = req.body;

    console.log("🔄 Updating product:", id, "for user:", uid);

    await FirebaseService.updateUserProduct(uid, id, updates);

    res.json({
      success: true,
      message: "Product updated successfully",
      id,
      updates,
    });
  } catch (error) {
    console.error("❌ Error updating product:", error);
    res.status(500).json({
      error: "Failed to update product",
      details: error.message,
    });
  }
});

// Archive product endpoint (must come before DELETE to avoid route conflict)
router.post("/products/:id/archive", authenticateUser, async (req, res) => {
  try {
    const { uid } = req.user;
    const { id } = req.params;

    console.log("📦 Archiving product:", id, "for user:", uid);

    await FirebaseService.archiveUserProduct(uid, id);

    res.json({
      success: true,
      message: "Product archived successfully",
      id,
    });
  } catch (error) {
    console.error("❌ Error archiving product:", error);
    console.error("❌ Error details:", {
      userId: req.user?.uid,
      productId: req.params?.id,
      errorMessage: error.message,
      errorStack: error.stack,
    });
    res.status(500).json({
      error: "Failed to archive product",
      details: error.message,
    });
  }
});

router.delete("/products/:id", authenticateUser, async (req, res) => {
  try {
    const { uid } = req.user;
    const { id } = req.params;

    console.log("🗑️ Deleting product:", id, "for user:", uid);

    await FirebaseService.deleteUserProduct(uid, id);

    res.json({
      success: true,
      message: "Product deleted successfully",
      id,
    });
  } catch (error) {
    console.error("❌ Error deleting product:", error);
    res.status(500).json({
      error: "Failed to delete product",
      details: error.message,
    });
  }
});

module.exports = router;
