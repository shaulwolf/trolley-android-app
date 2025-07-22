/**
 * Google Auth for Chrome Extension using OAuth2
 */

class GoogleAuth {
  constructor() {
    this.oauth2 = null;
    this.userInfo = null;
    this.isAuthenticated = false;
  }

  initialize() {
    console.log("[GoogleAuth] initialize()");

    // Get OAuth credentials from environment variables
    const clientId = window.env && window.env.GOOGLE_CLIENT_ID;
    const clientSecret = window.env && window.env.GOOGLE_CLIENT_SECRET;
    const apiScope = window.env && window.env.GOOGLE_API_SCOPE;

    // Initialize OAuth2 with Google configuration
    this.oauth2 = new OAuth2("google", {
      client_id: clientId,
      client_secret: clientSecret,
      api_scope: apiScope,
    });

    // Try to load existing tokens
    this.oauth2.loadStoredTokens((auth, error) => {
      if (auth) {
        console.log("[GoogleAuth] Existing tokens loaded successfully");
        this.isAuthenticated = true;
        this.getUserInfo((userInfo) => {
          this.userInfo = userInfo;
          this.onAuthStateChanged(true, userInfo);
        });
      } else {
        console.log("[GoogleAuth] No existing tokens:", error);
        this.isAuthenticated = false;
        this.onAuthStateChanged(false, null);
      }
    });
  }

  signIn(callback) {
    if (!this.oauth2) {
      console.error("[GoogleAuth] OAuth2 not initialized");
      callback(null, "OAuth2 not initialized");
      return;
    }
    console.log("[GoogleAuth] signIn() - calling authorize...");
    this.oauth2.authorize((auth, error) => {
      if (auth) {
        console.log("[GoogleAuth] OAuth2 authorization successful");
        this.isAuthenticated = true;

        // Get user info
        this.getUserInfo((userInfo) => {
          this.userInfo = userInfo;
          this.onAuthStateChanged(true, userInfo);
          callback(userInfo);
        });
      } else {
        console.error("[GoogleAuth] OAuth2 authorization failed:", error);
        this.isAuthenticated = false;
        this.onAuthStateChanged(false, null);
        callback(null, error);
      }
    });
  }

  signOut(callback) {
    console.log("[GoogleAuth] signOut()");
    if (this.oauth2) {
      this.oauth2.clearTokens();
    }

    this.isAuthenticated = false;
    this.userInfo = null;
    this.onAuthStateChanged(false, null);

    if (callback) {
      callback();
    }
  }

  getUserInfo(callback) {
    console.log("[GoogleAuth] getUserInfo()");
    if (!this.oauth2 || !this.oauth2.accessToken) {
      console.warn("[GoogleAuth] No access token available");
      callback(null, "No access token available");
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open("GET", "https://www.googleapis.com/oauth2/v2/userinfo", true);
    xhr.setRequestHeader("Authorization", "Bearer " + this.oauth2.accessToken);

    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        console.log("[OAuth2] Token exchange status:", xhr.status);
        console.log("[OAuth2] Token exchange responseText:", xhr.responseText);
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText);
            console.log("[OAuth2] Token response:", response);
            // Якщо у відповіді є id_token, логінити у Firebase
            if (response.id_token) {
              signInWithFirebaseIdToken(response.id_token);
            }
            callback(response);
          } catch (error) {
            console.error("[GoogleAuth] Error parsing user info:", error);
            callback(null, "Error parsing user info");
          }
        } else {
          console.error(
            "[GoogleAuth] Failed to get user info:",
            xhr.status,
            xhr.responseText
          );
          callback(null, "Failed to get user info: " + xhr.status);
        }
      }
    };

    xhr.send();
  }

  getCurrentUser() {
    return this.userInfo;
  }

  isSignedIn() {
    return this.isAuthenticated && this.userInfo !== null;
  }

  getAccessToken() {
    return this.oauth2 ? this.oauth2.accessToken : null;
  }

  // Callback for auth state changes
  onAuthStateChanged(isSignedIn, userInfo) {
    // This will be overridden by the popup
    console.log("[GoogleAuth] Auth state changed:", isSignedIn, userInfo);
  }

  // Set auth state change callback
  setAuthStateChangeCallback(callback) {
    this.onAuthStateChanged = callback;
  }
}

// Make GoogleAuth available globally
window.GoogleAuth = GoogleAuth;
