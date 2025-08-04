const BACKEND_URL = "http://localhost:3000";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyD8u8zHaq-v9yHMqWk24H1ft38Ej9oNmJo",
};

async function getFirebaseToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["firebase_id_token"], (result) => {
      resolve(result.firebase_id_token || null);
    });
  });
}

async function storeFirebaseToken(token, refreshToken = null) {
  return new Promise((resolve) => {
    const data = { firebase_id_token: token };
    if (refreshToken) {
      data.firebase_refresh_token = refreshToken;
    }
    chrome.storage.local.set(data, resolve);
  });
}

async function refreshFirebaseToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["firebase_refresh_token"], async (result) => {
      if (!result.firebase_refresh_token) {
        resolve(null);
        return;
      }

      try {
        console.log("🔄 Attempting to refresh Firebase token...");

        const response = await fetch(
          `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_CONFIG.apiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              grant_type: "refresh_token",
              refresh_token: result.firebase_refresh_token,
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          console.log("✅ Firebase token refreshed successfully");

          await storeFirebaseToken(data.id_token, data.refresh_token);
          resolve(data.id_token);
        } else {
          console.log("❌ Token refresh failed:", response.status);
          resolve(null);
        }
      } catch (error) {
        console.error("❌ Token refresh error:", error);
        resolve(null);
      }
    });
  });
}

async function performOAuthInBackground() {
  return new Promise((resolve, reject) => {
    console.log("🔐 Starting OAuth in background...");

    const clientId =
      "472976602572-0ir3i5jtc0itabq7upanaqd7rnr8ofv1.apps.googleusercontent.com";
    const redirectUri = chrome.identity.getRedirectURL();
    const scope = "openid email profile";

    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `access_type=offline&` +
      `prompt=consent`;

    console.log("🌐 Launching OAuth flow:", authUrl);

    chrome.identity.launchWebAuthFlow(
      {
        url: authUrl,
        interactive: true,
      },
      async (redirectUrl) => {
        if (chrome.runtime.lastError) {
          console.error(
            "❌ OAuth flow error:",
            chrome.runtime.lastError.message
          );
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!redirectUrl) {
          console.error("❌ No redirect URL received");
          reject(new Error("No redirect URL received"));
          return;
        }

        try {
          console.log("✅ OAuth redirect received:", redirectUrl);

          const url = new URL(redirectUrl);
          const code = url.searchParams.get("code");

          if (!code) {
            reject(new Error("No authorization code received"));
            return;
          }

          console.log(
            "🔑 Authorization code received, exchanging for tokens..."
          );

          const tokenResponse = await exchangeCodeForTokens(
            code,
            clientId,
            redirectUri
          );

          console.log("🎫 Tokens received, getting user info...");

          const userInfo = await getUserInfoFromGoogle(
            tokenResponse.access_token
          );

          console.log("👤 User info received:", userInfo.email);

          const firebaseResult = await createFirebaseUser(
            tokenResponse.id_token,
            userInfo
          );

          console.log("🔥 Firebase user created successfully");

          resolve({
            userInfo: userInfo,
            tokens: tokenResponse,
            firebaseToken: firebaseResult.idToken,
          });
        } catch (error) {
          console.error("❌ OAuth processing failed:", error);
          reject(error);
        }
      }
    );
  });
}

async function exchangeCodeForTokens(code, clientId, redirectUri) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code: code,
      client_id: clientId,
      client_secret: "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",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("❌ Token exchange failed:", response.status, errorText);
    throw new Error(`Token exchange failed: ${response.status}`);
  }

  const result = await response.json();
  console.log("✅ Token exchange successful");
  return result;
}

async function getUserInfoFromGoogle(accessToken) {
  const response = await fetch(
    `https://www.googleapis.com/oauth2/v1/userinfo?access_token=${accessToken}`
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("❌ Failed to get user info:", response.status, errorText);
    throw new Error(`Failed to get user info: ${response.status}`);
  }

  const result = await response.json();
  console.log("✅ User info retrieved successfully");
  return result;
}

async function createFirebaseUser(idToken, userInfo) {
  const firebaseConfig = {
    apiKey: "AIzaSyD8u8zHaq-v9yHMqWk24H1ft38Ej9oNmJo",
  };

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${firebaseConfig.apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requestUri: chrome.identity.getRedirectURL(),
        postBody: `id_token=${idToken}&providerId=google.com`,
        returnSecureToken: true,
        returnIdpCredential: true,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("❌ Firebase auth failed:", response.status, errorText);
    throw new Error(`Firebase auth failed: ${response.status}`);
  }

  const result = await response.json();
  console.log("✅ Firebase authentication successful");

  await storeFirebaseToken(result.idToken, result.refreshToken);

  try {
    await createUserProfileInBackend(userInfo, result.idToken);
  } catch (error) {
    console.warn("⚠️ Backend profile creation failed (continuing):", error);
  }

  return result;
}

async function createUserProfileInBackend(userInfo, firebaseToken) {
  try {
    const response = await fetch(
      `${BACKEND_URL}/api/products/auth/google-token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${firebaseToken}`,
        },
        body: JSON.stringify({
          googleAccessToken: "background-auth",
          userInfo: {
            id: userInfo.id,
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture,
            verified_email: userInfo.verified_email,
          },
        }),
      }
    );

    if (response.ok) {
      console.log("✅ Backend user profile created/updated");
    } else {
      console.warn("⚠️ Backend profile creation failed:", response.status);
    }
  } catch (error) {
    console.warn("⚠️ Backend profile creation error:", error);
  }
}

async function makeAuthenticatedRequest(url, options = {}) {
  let token = await getFirebaseToken();

  if (!token) {
    throw new Error("User not authenticated. Please sign in first.");
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...options.headers,
  };

  let response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    console.log("🔄 401 error, attempting token refresh...");
    const newToken = await refreshFirebaseToken();

    if (newToken) {
      console.log("✅ Token refreshed, retrying request...");

      const newHeaders = {
        ...headers,
        Authorization: `Bearer ${newToken}`,
      };

      response = await fetch(url, {
        ...options,
        headers: newHeaders,
      });

      if (response.status === 401) {
        console.log(
          "🚨 401 error persists after token refresh, clearing tokens..."
        );
        chrome.storage.local.remove([
          "firebase_id_token",
          "firebase_user_info",
          "firebase_refresh_token",
        ]);
        throw new Error("Authentication expired. Please sign in again.");
      }
    } else {
      console.log("🚨 Token refresh failed, clearing tokens...");
      chrome.storage.local.remove([
        "firebase_id_token",
        "firebase_user_info",
        "firebase_refresh_token",
      ]);
      throw new Error("Authentication expired. Please sign in again.");
    }
  }

  return response;
}

async function getAllProducts() {
  try {
    console.log("📥 Getting all products from server...");

    const response = await makeAuthenticatedRequest(
      `${BACKEND_URL}/api/products`
    );

    if (!response.ok) {
      throw new Error(`Failed to get products: ${response.status}`);
    }

    const products = await response.json();
    console.log("📥 Received", products.length, "products from server");

    return products;
  } catch (error) {
    console.error("❌ Failed to get products:", error);
    throw error;
  }
}

async function addProduct(product) {
  try {
    console.log("➕ Adding product to server:", product.title);

    const response = await makeAuthenticatedRequest(
      `${BACKEND_URL}/api/products`,
      {
        method: "POST",
        body: JSON.stringify({
          url: product.url,
          title: product.title,
          price: product.price,
          originalPrice: product.originalPrice,
          image: product.image,
          site: product.site,
          displaySite: product.displaySite,
          category: product.category || "general",
          variants: product.variants || {},
          dateAdded: product.dateAdded || new Date().toISOString(),
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to add product: ${response.status} - ${errorText}`
      );
    }

    const result = await response.json();
    console.log("✅ Product added to server successfully");

    return result;
  } catch (error) {
    console.error("❌ Failed to add product to server:", error);
    throw error;
  }
}

async function deleteProduct(productId) {
  try {
    console.log("📦 Archiving product from server:", productId);

    const response = await makeAuthenticatedRequest(
      `${BACKEND_URL}/api/products/${productId}/archive`,
      {
        method: "POST",
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to archive product: ${response.status} - ${errorText}`
      );
    }

    const result = await response.json();
    console.log("✅ Product archived from server successfully");

    return result;
  } catch (error) {
    console.error("❌ Failed to archive product from server:", error);
    throw error;
  }
}

async function extractProductInfo(url) {
  try {
    console.log("🔍 Extracting product info from:", url);

    const response = await fetch(`${BACKEND_URL}/extract-product`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      throw new Error(`Failed to extract product: ${response.status}`);
    }

    const result = await response.json();
    console.log("✅ Product info extracted successfully");

    return result;
  } catch (error) {
    console.error("❌ Failed to extract product info:", error);
    throw error;
  }
}

function serverToChrome(products) {
  const chromeData = {};

  chromeData["All Items"] = [];

  products.forEach((product) => {
    const category = product.category || "general";

    chromeData["All Items"].push({
      id: product.id,
      url: product.url,
      title: product.title,
      price: product.price,
      originalPrice: product.originalPrice,
      image: product.image,
      site: product.site,
      displaySite: product.displaySite,
      variants: product.variants || {},
      dateAdded: product.dateAdded,
    });

    if (category !== "general") {
      if (!chromeData[category]) {
        chromeData[category] = [];
      }

      chromeData[category].push({
        id: product.id,
        url: product.url,
        title: product.title,
        price: product.price,
        originalPrice: product.originalPrice,
        image: product.image,
        site: product.site,
        displaySite: product.displaySite,
        variants: product.variants || {},
        dateAdded: product.dateAdded,
      });
    }
  });

  return chromeData;
}

function updateBadge() {
  chrome.storage.local.get({ cart: {} }, (result) => {
    let count = 0;
    Object.values(result.cart).forEach((category) => {
      Object.values(category).forEach((siteProducts) => {
        count += siteProducts.length;
      });
    });

    chrome.action.setBadgeText({
      text: count > 0 ? count.toString() : "",
    });
    chrome.action.setBadgeBackgroundColor({ color: "#4CAF50" });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("🚀 Trolley Extension installed");
  updateBadge();
});

async function emailSignInInBackground(email, password) {
  console.log("🔐 Starting email sign in process...");

  try {
    const signInResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_CONFIG.apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          password: password,
          returnSecureToken: true,
        }),
      }
    );

    const signInData = await signInResponse.json();

    if (!signInResponse.ok) {
      throw new Error(signInData.error?.message || "Sign in failed");
    }

    console.log("✅ Firebase email sign in successful");

    const userInfo = {
      uid: signInData.localId,
      email: signInData.email,
      displayName: signInData.displayName || email.split("@")[0],
      emailVerified: signInData.emailVerified || false,
      photoURL: null,
    };

    await storeFirebaseToken(signInData.idToken, signInData.refreshToken);

    await createUserProfileInBackend(userInfo, signInData.idToken);

    return {
      userInfo: userInfo,
      firebaseToken: signInData.idToken,
    };
  } catch (error) {
    console.error("❌ Email sign in error:", error);
    throw error;
  }
}

async function emailSignUpInBackground(email, password) {
  console.log("📝 Starting email sign up process...");

  try {
    const signUpResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_CONFIG.apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          password: password,
          returnSecureToken: true,
        }),
      }
    );

    const signUpData = await signUpResponse.json();

    if (!signUpResponse.ok) {
      throw new Error(signUpData.error?.message || "Sign up failed");
    }

    console.log("✅ Firebase email sign up successful");

    try {
      await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_CONFIG.apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requestType: "VERIFY_EMAIL",
            idToken: signUpData.idToken,
          }),
        }
      );
      console.log("📧 Verification email sent");
    } catch (emailError) {
      console.warn("⚠️ Failed to send verification email:", emailError);
    }

    const userInfo = {
      uid: signUpData.localId,
      email: signUpData.email,
      displayName: email.split("@")[0],
      emailVerified: false,
      photoURL: null,
    };

    await storeFirebaseToken(signUpData.idToken, signUpData.refreshToken);

    await createUserProfileInBackend(userInfo, signUpData.idToken);

    return {
      userInfo: userInfo,
      firebaseToken: signUpData.idToken,
    };
  } catch (error) {
    console.error("❌ Email sign up error:", error);
    throw error;
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("📨 Received message:", request);

  if (request.action === "performOAuth") {
    console.log("🔐 OAuth requested from popup");

    performOAuthInBackground()
      .then((result) => {
        console.log("✅ Background OAuth completed successfully");
        sendResponse({
          success: true,
          userInfo: result.userInfo,
          firebaseToken: result.firebaseToken,
        });
      })
      .catch((error) => {
        console.error("❌ Background OAuth failed:", error);
        sendResponse({
          success: false,
          error: error.message,
        });
      });

    return true;
  }

  if (request.action === "emailSignIn") {
    console.log("📧 Email sign in requested:", request.email);

    emailSignInInBackground(request.email, request.password)
      .then((result) => {
        console.log("✅ Email sign in completed successfully");
        sendResponse({
          success: true,
          userInfo: result.userInfo,
          firebaseToken: result.firebaseToken,
        });
      })
      .catch((error) => {
        console.error("❌ Email sign in failed:", error);
        sendResponse({
          success: false,
          error: error.code || error.message,
        });
      });

    return true;
  }

  if (request.action === "emailSignUp") {
    console.log("📝 Email sign up requested:", request.email);

    emailSignUpInBackground(request.email, request.password)
      .then((result) => {
        console.log("✅ Email sign up completed successfully");
        sendResponse({
          success: true,
          userInfo: result.userInfo,
          firebaseToken: result.firebaseToken,
        });
      })
      .catch((error) => {
        console.error("❌ Email sign up failed:", error);
        sendResponse({
          success: false,
          error: error.code || error.message,
        });
      });

    return true;
  }

  if (request.action === "getAllProducts") {
    console.log("📥 Get all products requested");

    getAllProducts()
      .then((products) => {
        const chromeData = serverToChrome(products);
        console.log("💾 Saving to Chrome storage:", chromeData);
        chrome.storage.local.set({ cart: chromeData }, () => {
          console.log(
            "✅ Chrome storage updated with",
            Object.keys(chromeData).length,
            "folders"
          );
          updateBadge();
          sendResponse({
            success: true,
            message: `Loaded ${products.length} products`,
            productCount: products.length,
          });
        });
      })
      .catch((error) => {
        console.error("❌ Error getting products:", error);
        sendResponse({
          success: false,
          error: error.message,
          needsAuth:
            error.message.includes("not authenticated") ||
            error.message.includes("Authentication expired"),
        });
      });

    return true;
  }

  if (request.action === "addProduct") {
    console.log("➕ Add product requested:", request.product);

    addProduct(request.product)
      .then((result) => {
        console.log("✅ Product added to server, result:", result);
        return getAllProducts();
      })
      .then((products) => {
        console.log("📥 Retrieved products after adding:", products.length);
        const chromeData = serverToChrome(products);
        chrome.storage.local.set({ cart: chromeData }, () => {
          updateBadge();
          sendResponse({
            success: true,
            message: `Product added successfully`,
            productCount: products.length,
          });
        });
      })
      .catch((error) => {
        console.error("❌ Error in addProduct flow:", error);
        sendResponse({
          success: false,
          error: error.message,
          needsAuth:
            error.message.includes("not authenticated") ||
            error.message.includes("Authentication expired"),
        });
      });

    return true;
  }

  if (request.action === "deleteProduct") {
    console.log("📦 Archive product requested:", request.productId);

    deleteProduct(request.productId)
      .then((result) => {
        return getAllProducts();
      })
      .then((products) => {
        const chromeData = serverToChrome(products);
        chrome.storage.local.set({ cart: chromeData }, () => {
          updateBadge();
          sendResponse({
            success: true,
            message: `Product archived successfully`,
            productCount: products.length,
          });
        });
      })
      .catch((error) => {
        console.error("❌ Error in archive product flow:", error);
        sendResponse({
          success: false,
          error: error.message,
          needsAuth:
            error.message.includes("not authenticated") ||
            error.message.includes("Authentication expired"),
        });
      });

    return true;
  }

  if (request.action === "extractProduct") {
    console.log("🔍 Extract product requested:", request.url);

    extractProductInfo(request.url)
      .then((result) => {
        sendResponse({
          success: true,
          productInfo: result,
        });
      })
      .catch((error) => {
        console.error("❌ Error extracting product:", error);
        sendResponse({
          success: false,
          error: error.message,
        });
      });

    return true;
  }

  if (request.action === "storeFirebaseToken") {
    console.log("🔐 Storing Firebase token");
    storeFirebaseToken(request.token)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });

    return true;
  }

  if (request.action === "getAuthStatus") {
    getFirebaseToken()
      .then((token) => {
        sendResponse({
          isAuthenticated: !!token,
          hasToken: !!token,
        });
      })
      .catch(() => {
        sendResponse({
          isAuthenticated: false,
          hasToken: false,
        });
      });

    return true;
  }

  if (request.action === "clearAuth") {
    chrome.storage.local.remove(
      ["firebase_id_token", "firebase_user_info", "firebase_refresh_token"],
      () => {
        sendResponse({ success: true });
      }
    );

    return true;
  }
});

updateBadge();
