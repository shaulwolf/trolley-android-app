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
    // Initialize OAuth2 with Google configuration
    this.oauth2 = new OAuth2("google", {
      client_id:
        "472976602572-758e48ae800229fecf1969.apps.googleusercontent.com",
      client_secret: "", // Chrome extension doesn't need client_secret for OAuth2 flow
      api_scope: "openid email profile",
    });

    // Try to load existing tokens
    this.oauth2.loadStoredTokens((auth, error) => {
      if (auth) {
        console.log("Existing tokens loaded successfully");
        this.isAuthenticated = true;
        this.getUserInfo((userInfo) => {
          this.userInfo = userInfo;
          this.onAuthStateChanged(true, userInfo);
        });
      } else {
        console.log("No existing tokens:", error);
        this.isAuthenticated = false;
        this.onAuthStateChanged(false, null);
      }
    });
  }

  signIn(callback) {
    if (!this.oauth2) {
      console.error("OAuth2 not initialized");
      callback(null, "OAuth2 not initialized");
      return;
    }

    this.oauth2.authorize((auth, error) => {
      if (auth) {
        console.log("OAuth2 authorization successful");
        this.isAuthenticated = true;

        // Get user info
        this.getUserInfo((userInfo) => {
          this.userInfo = userInfo;
          this.onAuthStateChanged(true, userInfo);
          callback(userInfo);
        });
      } else {
        console.error("OAuth2 authorization failed:", error);
        this.isAuthenticated = false;
        this.onAuthStateChanged(false, null);
        callback(null, error);
      }
    });
  }

  signOut(callback) {
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
    if (!this.oauth2 || !this.oauth2.accessToken) {
      callback(null, "No access token available");
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open("GET", "https://www.googleapis.com/oauth2/v2/userinfo", true);
    xhr.setRequestHeader("Authorization", "Bearer " + this.oauth2.accessToken);

    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          try {
            const userInfo = JSON.parse(xhr.responseText);
            callback(userInfo);
          } catch (error) {
            console.error("Error parsing user info:", error);
            callback(null, "Error parsing user info");
          }
        } else {
          console.error(
            "Failed to get user info:",
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
    console.log("Auth state changed:", isSignedIn, userInfo);
  }

  // Set auth state change callback
  setAuthStateChangeCallback(callback) {
    this.onAuthStateChanged = callback;
  }
}

// Make GoogleAuth available globally
window.GoogleAuth = GoogleAuth;
