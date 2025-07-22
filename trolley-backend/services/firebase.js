const admin = require("firebase-admin");
const path = require("path");

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    // Try to use service account JSON file first
    const serviceAccountPath = path.join(
      __dirname,
      "../firebase-service-account.json"
    );

    try {
      console.log("🔥 Trying to initialize Firebase Admin with JSON file...");
      const serviceAccount = require(serviceAccountPath);

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: "trolley-app-4885d",
      });
      console.log("✅ Firebase Admin initialized with JSON file");
    } catch (jsonError) {
      console.log("⚠️ JSON file not found, trying environment variables...");

      // Fallback to environment variables
      if (
        process.env.FIREBASE_PRIVATE_KEY &&
        process.env.FIREBASE_CLIENT_EMAIL
      ) {
        console.log(
          "🔥 Initializing Firebase Admin with environment variables"
        );

        const serviceAccount = {
          type: "service_account",
          project_id: "trolley-app-4885d",
          private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
          private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
          client_email: process.env.FIREBASE_CLIENT_EMAIL,
          client_id: process.env.FIREBASE_CLIENT_ID,
          auth_uri: "https://accounts.google.com/o/oauth2/auth",
          token_uri: "https://oauth2.googleapis.com/token",
          auth_provider_x509_cert_url:
            "https://www.googleapis.com/oauth2/v1/certs",
          client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`,
          universe_domain: "googleapis.com",
        };

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: "trolley-app-4885d",
        });
        console.log("✅ Firebase Admin initialized with environment variables");
      } else {
        // Final fallback: use default credentials (for Google Cloud environments)
        console.log("🔥 Initializing Firebase Admin with default credentials");
        admin.initializeApp({
          projectId: "trolley-app-4885d",
        });
        console.log("✅ Firebase Admin initialized with default credentials");
      }
    }
  } catch (error) {
    console.error("❌ Firebase Admin initialization failed:", error.message);
    console.log("⚠️ Continuing without Firebase Admin (development mode)");
    console.log("💡 To fix this:");
    console.log("   1. Download service account JSON from Firebase Console");
    console.log(
      "   2. Save it as firebase-service-account.json in the project root"
    );
    console.log("   3. Or set up environment variables in .env file");
  }
}

// Get Firestore instance
const db = admin.apps.length > 0 ? admin.firestore() : null;

// Firebase service functions
const FirebaseService = {
  // Verify Firebase ID token
  verifyIdToken: async (idToken) => {
    try {
      if (!admin.apps.length) {
        throw new Error("Firebase Admin not initialized");
      }
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      return decodedToken;
    } catch (error) {
      console.error("❌ Token verification failed:", error.message);
      throw new Error("Invalid or expired token");
    }
  },

  // User profile management
  async getUserProfile(userId) {
    if (!db) throw new Error("Firebase not initialized");

    try {
      const userDoc = await db.collection("users").doc(userId).get();

      if (!userDoc.exists) {
        return null;
      }

      return { id: userDoc.id, ...userDoc.data() };
    } catch (error) {
      console.error("Error getting user profile:", error);
      throw error;
    }
  },

  async updateUserProfile(userId, profileData) {
    if (!db) throw new Error("Firebase not initialized");

    try {
      console.log("📝 Updating user profile for:", userId);

      // Use set with merge: true to create document if it doesn't exist
      await db
        .collection("users")
        .doc(userId)
        .set(profileData, { merge: true });
      console.log("✅ User profile updated:", userId);

      // Initialize user's products subcollection with a dummy document
      await this.initializeUserCollections(userId);

      return true;
    } catch (error) {
      console.error("Error updating user profile:", error);

      // If it's a NOT_FOUND error, try to create the document
      if (error.code === 5 || error.message.includes("NOT_FOUND")) {
        try {
          console.log("🔄 Trying to create user profile document...");
          await db.collection("users").doc(userId).set(profileData);
          console.log("✅ User profile created:", userId);

          // Initialize user's products subcollection
          await this.initializeUserCollections(userId);

          return true;
        } catch (createError) {
          console.error("Error creating user profile:", createError);
          throw createError;
        }
      }

      throw error;
    }
  },

  async initializeUserCollections(userId) {
    try {
      console.log("🔄 Initializing collections for user:", userId);

      // Create a temporary document in products subcollection to initialize it
      const tempDocRef = db
        .collection("users")
        .doc(userId)
        .collection("products")
        .doc("_init");

      await tempDocRef.set({
        _temp: true,
        createdAt: new Date().toISOString(),
        message: "Temporary document to initialize collection",
      });

      console.log("✅ Collections initialized for user:", userId);

      // Immediately delete the temporary document
      await tempDocRef.delete();
      console.log("🗑️ Temporary document removed");
    } catch (error) {
      console.warn(
        "⚠️ Could not initialize collections (this is usually fine):",
        error.message
      );
    }
  },

  async deleteUserProfile(userId) {
    if (!db) throw new Error("Firebase not initialized");

    try {
      await db.collection("users").doc(userId).delete();
      console.log("✅ User profile deleted:", userId);
      return true;
    } catch (error) {
      console.error("Error deleting user profile:", error);
      throw error;
    }
  },

  // Product management for users
  async getUserProducts(userId) {
    if (!db) throw new Error("Firebase not initialized");

    try {
      console.log(`📦 Getting products for user: ${userId}`);

      const snapshot = await db
        .collection("users")
        .doc(userId)
        .collection("products")
        .orderBy("dateAdded", "desc")
        .get();

      if (snapshot.empty) {
        console.log(
          `📦 No products found for user ${userId}, returning empty array`
        );
        return [];
      }

      const products = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        products.push({
          id: doc.id,
          ...data,
          // Parse variants if they're stored as strings
          variants:
            typeof data.variants === "string"
              ? JSON.parse(data.variants || "{}")
              : data.variants || {},
        });
      });

      console.log(
        `📦 Retrieved ${products.length} products for user ${userId}`
      );
      return products;
    } catch (error) {
      console.error("Error getting user products:", error);

      // If the error is NOT_FOUND (collection doesn't exist), return empty array
      if (error.code === 5 || error.message.includes("NOT_FOUND")) {
        console.log(
          `📦 Collection doesn't exist for user ${userId}, returning empty array`
        );
        return [];
      }

      throw error;
    }
  },

  async addUserProduct(userId, productData) {
    if (!db) throw new Error("Firebase not initialized");

    try {
      console.log(`➕ Adding product for user ${userId}:`, productData.title);

      // Validate required fields
      if (!productData.url || !productData.title) {
        throw new Error("URL and title are required");
      }

      // Check if product already exists for this user
      const existingProducts = await this.getUserProducts(userId);
      const existing = existingProducts.find((p) => p.url === productData.url);

      if (existing) {
        throw new Error("Product already exists in trolley");
      }

      // Prepare product data
      const finalProductData = {
        ...productData,
        url: productData.url.trim(),
        title: productData.title.trim(),
        price: productData.price || "N/A",
        originalPrice: productData.originalPrice || null,
        image: productData.image || null,
        site: productData.site || new URL(productData.url).hostname,
        displaySite:
          productData.displaySite ||
          productData.site ||
          new URL(productData.url).hostname,
        category: productData.category || "general",
        variants: productData.variants || {},
        dateAdded: productData.dateAdded || new Date().toISOString(),
        userId: userId,
      };

      const docRef = await db
        .collection("users")
        .doc(userId)
        .collection("products")
        .add(finalProductData);

      console.log(`✅ Product added for user ${userId} with ID: ${docRef.id}`);
      return docRef.id;
    } catch (error) {
      console.error("Error adding user product:", error);

      // If it's a NOT_FOUND error, try to initialize collections first
      if (error.code === 5 || error.message.includes("NOT_FOUND")) {
        try {
          console.log("🔄 Collection not found, initializing...");

          // Initialize user profile if it doesn't exist
          await this.updateUserProfile(userId, {
            userId: userId,
            createdAt: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
          });

          // Try adding the product again
          const finalProductData = {
            ...productData,
            url: productData.url.trim(),
            title: productData.title.trim(),
            price: productData.price || "N/A",
            originalPrice: productData.originalPrice || null,
            image: productData.image || null,
            site: productData.site || new URL(productData.url).hostname,
            displaySite:
              productData.displaySite ||
              productData.site ||
              new URL(productData.url).hostname,
            category: productData.category || "general",
            variants: productData.variants || {},
            dateAdded: productData.dateAdded || new Date().toISOString(),
            userId: userId,
          };

          const docRef = await db
            .collection("users")
            .doc(userId)
            .collection("products")
            .add(finalProductData);

          console.log(
            `✅ Product added after initialization for user ${userId} with ID: ${docRef.id}`
          );
          return docRef.id;
        } catch (retryError) {
          console.error(
            "Error adding product after initialization:",
            retryError
          );
          throw retryError;
        }
      }

      throw error;
    }
  },

  async updateUserProduct(userId, productId, updates) {
    if (!db) throw new Error("Firebase not initialized");

    try {
      const updateData = {
        ...updates,
        lastModified: new Date().toISOString(),
      };

      await db
        .collection("users")
        .doc(userId)
        .collection("products")
        .doc(productId)
        .update(updateData);

      console.log(`✅ Product updated for user ${userId}: ${productId}`);
      return true;
    } catch (error) {
      console.error("Error updating user product:", error);
      throw error;
    }
  },

  async deleteUserProduct(userId, productId) {
    if (!db) throw new Error("Firebase not initialized");

    try {
      await db
        .collection("users")
        .doc(userId)
        .collection("products")
        .doc(productId)
        .delete();

      console.log(`✅ Product deleted for user ${userId}: ${productId}`);
      return true;
    } catch (error) {
      console.error("Error deleting user product:", error);
      throw error;
    }
  },

  async clearUserProducts(userId) {
    if (!db) throw new Error("Firebase not initialized");

    try {
      const snapshot = await db
        .collection("users")
        .doc(userId)
        .collection("products")
        .get();

      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`✅ All products cleared for user ${userId}`);
      return true;
    } catch (error) {
      console.error("Error clearing user products:", error);
      throw error;
    }
  },

  // Sync operations
  async getUserSyncData(userId) {
    if (!db) throw new Error("Firebase not initialized");

    try {
      const products = await this.getUserProducts(userId);

      return {
        products,
        lastSync: new Date().toISOString(),
        totalProducts: products.length,
      };
    } catch (error) {
      console.error("Error getting sync data:", error);
      throw error;
    }
  },

  async syncUserProducts(userId, productsData) {
    if (!db) throw new Error("Firebase not initialized");

    try {
      console.log(
        `🔄 Syncing ${productsData.length} products for user ${userId}`
      );

      // Clear existing products
      await this.clearUserProducts(userId);

      // Add new products
      const batch = db.batch();

      productsData.forEach((product) => {
        const docRef = db
          .collection("users")
          .doc(userId)
          .collection("products")
          .doc();

        batch.set(docRef, {
          ...product,
          userId: userId,
          dateAdded: product.dateAdded || new Date().toISOString(),
        });
      });

      await batch.commit();

      console.log(
        `✅ Synced ${productsData.length} products for user ${userId}`
      );
      return true;
    } catch (error) {
      console.error("Error syncing user products:", error);
      throw error;
    }
  },

  async mergeUserProducts(userId, productsData) {
    if (!db) throw new Error("Firebase not initialized");

    try {
      console.log(
        `🔄 Merging ${productsData.length} products for user ${userId}`
      );

      const existingProducts = await this.getUserProducts(userId);
      const existingUrls = new Set(existingProducts.map((p) => p.url));

      // Only add products that don't already exist
      const newProducts = productsData.filter(
        (product) => !existingUrls.has(product.url)
      );

      if (newProducts.length === 0) {
        console.log("⚠️ No new products to merge");
        return { added: 0, skipped: productsData.length };
      }

      const batch = db.batch();

      newProducts.forEach((product) => {
        const docRef = db
          .collection("users")
          .doc(userId)
          .collection("products")
          .doc();

        batch.set(docRef, {
          ...product,
          userId: userId,
          dateAdded: product.dateAdded || new Date().toISOString(),
        });
      });

      await batch.commit();

      console.log(
        `✅ Merged ${newProducts.length} new products for user ${userId}`
      );
      return {
        added: newProducts.length,
        skipped: productsData.length - newProducts.length,
      };
    } catch (error) {
      console.error("Error merging user products:", error);
      throw error;
    }
  },
};

module.exports = {
  admin,
  db,
  FirebaseService,
};
