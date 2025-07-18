/**
 * OAuth2 library for Chrome Extensions
 * Using chrome.identity.launchWebAuthFlow for proper OAuth2 flow
 */

class OAuth2 {
  constructor(provider, config) {
    this.provider = provider;
    this.clientId = config.client_id;
    this.clientSecret = config.client_secret;
    this.apiScope = config.api_scope;
    this.redirectUri = chrome.identity.getRedirectURL();
  }

  authorize(callback) {
    // Check if we're in a Chrome extension context
    if (
      typeof chrome === "undefined" ||
      !chrome.runtime ||
      !chrome.runtime.getManifest
    ) {
      callback(null, "Chrome extension APIs not available");
      return;
    }

    // Check if chrome.identity is available
    if (!chrome.identity || !chrome.identity.launchWebAuthFlow) {
      callback(null, "Chrome identity API not available");
      return;
    }

    const clientId = encodeURIComponent(this.clientId);
    const scopes = encodeURIComponent(this.apiScope);
    const redirectUri = encodeURIComponent(this.redirectUri);

    const authUrl =
      "https://accounts.google.com/o/oauth2/v2/auth" +
      "?client_id=" +
      clientId +
      "&response_type=code" +
      "&redirect_uri=" +
      redirectUri +
      "&scope=" +
      scopes +
      "&access_type=offline" +
      "&prompt=consent";

    chrome.identity.launchWebAuthFlow(
      {
        url: authUrl,
        interactive: true,
      },
      (redirectUrl) => {
        if (chrome.runtime.lastError) {
          console.error("OAuth error:", chrome.runtime.lastError);
          callback(null, "OAuth error: " + chrome.runtime.lastError.message);
          return;
        }

        if (!redirectUrl) {
          callback(null, "No redirect URL received");
          return;
        }

        // Extract authorization code from redirect URL
        const url = new URL(redirectUrl);
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");

        if (error) {
          console.error("OAuth error:", error);
          callback(null, "OAuth error: " + error);
          return;
        }

        if (!code) {
          console.error("No authorization code found in redirect URL");
          callback(null, "No authorization code found");
          return;
        }

        // Exchange code for access token
        this.getAccessToken(code, callback);
      }
    );
  }

  getAccessToken(code, callback) {
    const tokenUrl = "https://oauth2.googleapis.com/token";
    const data = {
      code: code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
      grant_type: "authorization_code",
    };

    const xhr = new XMLHttpRequest();
    xhr.open("POST", tokenUrl, true);
    xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");

    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText);
            this.accessToken = response.access_token;
            this.refreshToken = response.refresh_token;
            this.expiresIn = response.expires_in;
            this.tokenType = response.token_type;

            // Store tokens in chrome.storage
            chrome.storage.local.set(
              {
                oauth_access_token: this.accessToken,
                oauth_refresh_token: this.refreshToken,
                oauth_expires_in: this.expiresIn,
                oauth_token_type: this.tokenType,
                oauth_expires_at: Date.now() + this.expiresIn * 1000,
              },
              () => {
                console.log("OAuth tokens stored successfully");
                callback(this);
              }
            );
          } catch (error) {
            console.error("Error parsing token response:", error);
            callback(null, "Error parsing token response");
          }
        } else {
          console.error("Token request failed:", xhr.status, xhr.responseText);
          callback(null, "Token request failed: " + xhr.status);
        }
      }
    };

    // Convert data object to URL-encoded string
    const formData = Object.keys(data)
      .map(
        (key) => encodeURIComponent(key) + "=" + encodeURIComponent(data[key])
      )
      .join("&");

    xhr.send(formData);
  }

  getAccessToken() {
    return this.accessToken;
  }

  refreshAccessToken(callback) {
    if (!this.refreshToken) {
      callback(null, "No refresh token available");
      return;
    }

    const tokenUrl = "https://oauth2.googleapis.com/token";
    const data = {
      refresh_token: this.refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: "refresh_token",
    };

    const xhr = new XMLHttpRequest();
    xhr.open("POST", tokenUrl, true);
    xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");

    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText);
            this.accessToken = response.access_token;
            this.expiresIn = response.expires_in;

            // Update stored tokens
            chrome.storage.local.set(
              {
                oauth_access_token: this.accessToken,
                oauth_expires_in: this.expiresIn,
                oauth_expires_at: Date.now() + this.expiresIn * 1000,
              },
              () => {
                console.log("Access token refreshed successfully");
                callback(this);
              }
            );
          } catch (error) {
            console.error("Error parsing refresh response:", error);
            callback(null, "Error parsing refresh response");
          }
        } else {
          console.error("Token refresh failed:", xhr.status, xhr.responseText);
          callback(null, "Token refresh failed: " + xhr.status);
        }
      }
    };

    const formData = Object.keys(data)
      .map(
        (key) => encodeURIComponent(key) + "=" + encodeURIComponent(data[key])
      )
      .join("&");

    xhr.send(formData);
  }

  isTokenExpired() {
    return Date.now() >= (this.expiresAt || 0);
  }

  loadStoredTokens(callback) {
    // Check if we're in a Chrome extension context
    if (
      typeof chrome === "undefined" ||
      !chrome.storage ||
      !chrome.storage.local
    ) {
      callback(null, "Chrome storage APIs not available");
      return;
    }

    chrome.storage.local.get(
      [
        "oauth_access_token",
        "oauth_refresh_token",
        "oauth_expires_in",
        "oauth_token_type",
        "oauth_expires_at",
      ],
      (result) => {
        if (result.oauth_access_token) {
          this.accessToken = result.oauth_access_token;
          this.refreshToken = result.oauth_refresh_token;
          this.expiresIn = result.oauth_expires_in;
          this.tokenType = result.oauth_token_type;
          this.expiresAt = result.oauth_expires_at;

          if (this.isTokenExpired()) {
            console.log("Token expired, refreshing...");
            this.refreshAccessToken(callback);
          } else {
            console.log("Valid token loaded from storage");
            callback(this);
          }
        } else {
          console.log("No stored tokens found");
          callback(null, "No stored tokens");
        }
      }
    );
  }

  clearTokens() {
    // Check if we're in a Chrome extension context
    if (
      typeof chrome === "undefined" ||
      !chrome.storage ||
      !chrome.storage.local
    ) {
      return;
    }

    chrome.storage.local.remove(
      [
        "oauth_access_token",
        "oauth_refresh_token",
        "oauth_expires_in",
        "oauth_token_type",
        "oauth_expires_at",
      ],
      () => {
        console.log("OAuth tokens cleared from storage");
        this.accessToken = null;
        this.refreshToken = null;
        this.expiresIn = null;
        this.tokenType = null;
        this.expiresAt = null;
      }
    );
  }
}

// Make OAuth2 available globally
window.OAuth2 = OAuth2;
