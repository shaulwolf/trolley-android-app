const { FirebaseService } = require("../services/firebase");

const authenticateUser = async (req, res, next) => {
  try {
    console.log("🔐 Authentication middleware called");
    console.log("🕐 Current server time:", new Date().toISOString());
    console.log("🔐 Headers:", JSON.stringify(req.headers, null, 2));

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      console.log("❌ No authorization header found");
      return res.status(401).json({
        error: "Unauthorized",
        message: "No valid authorization token provided",
      });
    }

    if (!authHeader.startsWith("Bearer ")) {
      console.log("❌ Invalid authorization header format:", authHeader);
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid authorization header format",
      });
    }

    const token = authHeader.substring(7);
    console.log("🔐 Extracted token length:", token.length);
    console.log("🔐 Token preview:", token.substring(0, 50) + "...");

    // Decode token to check expiration
    const decoded = JSON.parse(
      Buffer.from(token.split(".")[1], "base64").toString()
    );
    console.log(
      "🕐 Token issued at:",
      new Date(decoded.iat * 1000).toISOString()
    );
    console.log(
      "🕐 Token expires at:",
      new Date(decoded.exp * 1000).toISOString()
    );
    console.log(
      "🕐 Time until expiry:",
      Math.floor((decoded.exp * 1000 - Date.now()) / 1000),
      "seconds"
    );

    console.log("🔐 Verifying Firebase ID token...");
    const decodedToken = await FirebaseService.verifyIdToken(token);

    console.log(
      "✅ User authenticated:",
      decodedToken.email,
      `(${decodedToken.uid})`
    );

    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("❌ Authentication failed:", error.message);
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid or expired token: " + error.message,
    });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("🔓 No auth header, proceeding without user");
      req.user = null;
      return next();
    }

    const token = authHeader.substring(7);
    console.log("🔐 Optional auth - verifying token...");

    const decodedToken = await FirebaseService.verifyIdToken(token);
    console.log("✅ Optional auth - User:", decodedToken.email);

    req.user = decodedToken;
    next();
  } catch (error) {
    console.log(
      "⚠️ Optional auth failed, proceeding without user:",
      error.message
    );
    req.user = null;
    next();
  }
};

module.exports = { authenticateUser, optionalAuth };
