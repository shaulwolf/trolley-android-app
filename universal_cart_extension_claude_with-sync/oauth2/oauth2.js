/**
 * OAuth2 library for Chrome Extensions
 * Using chrome.identity.launchWebAuthFlow for proper OAuth2 flow
 *
 * FIXED:
 * - Resolved duplicate function name 'getAccessToken'. The simple getter was renamed to 'retrieveAccessToken'.
 * - Modernized token exchange requests from XMLHttpRequest to the 'fetch' API for consistency and readability.
 * - Improved error handling within fetch calls.
 */

// Firebase config for the extension
const firebaseConfig = {
  apiKey: "AIzaSyD8u8zHaq-v9yHMqWk24H1ft38Ej9oNmJo",
  authDomain: "trolley-app-4885d.firebaseapp.com",
  projectId: "trolley-app-4885d",
  storageBucket: "trolley-app-4885d.firebasestorage.app",
  messagingSenderId: "472976602572",
  appId: "1:472976602572:android:866b0c16330c5c62cf1969",
};

function signInWithFirebaseIdToken(idToken) {
  console.log("[OAuth2] Calling Firebase signInWithIdp with idToken:", idToken);
  fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${firebaseConfig.apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        postBody: `id_token=${idToken}&providerId=google.com`,
        requestUri: "http://localhost",
        returnIdpCredential: true,
        returnSecureToken: true,
      }),
    }
  )
    .then((res) => {
      console.log("[OAuth2] Firebase signInWithIdp status:", res.status);
      if (!res.ok) {
        // If the response is not ok, read the body as text to see the error
        return res.text().then((text) => {
          throw new Error(text);
        });
      }
      return res.json();
    })
    .then((data) => {
      console.log("[OAuth2] Firebase signInWithIdp response:", data);
      if (data && data.idToken) {
        console.log("[OAuth2] Firebase user signed in or created:", data);
      } else {
        // This block might not be necessary if the !res.ok check above catches all errors
        console.error("[OAuth2] Firebase signInWithIdp error:", data);
      }
    })
    .catch((err) => {
      console.error("[OAuth2] Firebase signInWithIdp fetch error:", err);
    });
}

class OAuth2 {
  constructor(provider, config) {
    this.provider = provider;
    this.clientId = config.client_id;
    this.clientSecret = config.client_secret;
    this.apiScope = config.api_scope;
    this.redirectUri = chrome.identity.getRedirectURL();

    // Initialize properties
    this.accessToken = null;
    this.refreshToken = null;
    this.expiresIn = null;
    this.tokenType = null;
    this.expiresAt = null;
  }

  authorize(callback) {
    console.log("[OAuth2] authorize() called");
    if (
      typeof chrome === "undefined" ||
      !chrome.identity ||
      !chrome.identity.launchWebAuthFlow
    ) {
      console.error("[OAuth2] Chrome Identity API is not available.");
      callback(null, "Chrome Identity API is not available.");
      return;
    }

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.append("client_id", this.clientId);
    authUrl.searchParams.append("response_type", "code");
    authUrl.searchParams.append("redirect_uri", this.redirectUri);
    authUrl.searchParams.append("scope", this.apiScope);
    authUrl.searchParams.append("access_type", "offline");
    authUrl.searchParams.append("prompt", "consent"); // Use 'consent' to ensure a refresh token is issued

    console.log("[OAuth2] Launching WebAuthFlow with URL:", authUrl.href);

    chrome.identity.launchWebAuthFlow(
      {
        url: authUrl.href,
        interactive: true,
      },
      (redirectUrl) => {
        if (chrome.runtime.lastError) {
          console.error(
            "[OAuth2] OAuth error:",
            chrome.runtime.lastError.message
          );
          callback(null, "OAuth error: " + chrome.runtime.lastError.message);
          return;
        }

        if (!redirectUrl) {
          console.error(
            "[OAuth2] Authorization cancelled or failed: No redirect URL received."
          );
          callback(null, "Authorization cancelled or failed.");
          return;
        }

        console.log("[OAuth2] Got redirectUrl:", redirectUrl);
        const url = new URL(redirectUrl);
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");

        if (error) {
          console.error("[OAuth2] OAuth error from provider:", error);
          callback(null, "OAuth error: " + error);
          return;
        }

        if (!code) {
          console.error(
            "[OAuth2] No authorization code found in redirect URL."
          );
          callback(null, "No authorization code found.");
          return;
        }

        console.log("[OAuth2] Got authorization code:", code);
        // Exchange the code for an access token
        this.getAccessToken(code, callback);
      }
    );
  }

  // This function performs the token exchange
  getAccessToken(code, callback) {
    console.log("[OAuth2] getAccessToken() called with code:", code);
    const tokenUrl = "https://oauth2.googleapis.com/token";
    const body = new URLSearchParams();
    body.append("code", code);
    body.append("client_id", this.clientId);
    body.append("redirect_uri", this.redirectUri);
    body.append("grant_type", "authorization_code");
    if (this.clientSecret) {
      body.append("client_secret", this.clientSecret);
    }

    console.log("[OAuth2] Sending token exchange request...");

    fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body,
    })
      .then((response) => {
        if (!response.ok) {
          return response.json().then((err) => {
            throw new Error(JSON.stringify(err));
          });
        }
        return response.json();
      })
      .then((response) => {
        console.log("[OAuth2] Token response:", response);
        this.accessToken = response.access_token;
        this.refreshToken = response.refresh_token; // May be undefined on subsequent authorizations
        this.expiresIn = response.expires_in;
        this.tokenType = response.token_type;
        this.expiresAt = Date.now() + this.expiresIn * 1000;

        // Store ID token if available
        if (response.id_token) {
          this.idToken = response.id_token;
          signInWithFirebaseIdToken(response.id_token);
        } else {
          console.warn("[OAuth2] No id_token in Google OAuth response.");
        }

        const tokensToStore = {
          oauth_access_token: this.accessToken,
          oauth_expires_in: this.expiresIn,
          oauth_token_type: this.tokenType,
          oauth_expires_at: this.expiresAt,
        };

        // Store the refresh token if we receive a new one
        if (this.refreshToken) {
          tokensToStore.oauth_refresh_token = this.refreshToken;
        }

        // Store the ID token if we receive one
        if (response.id_token) {
          tokensToStore.oauth_id_token = response.id_token;
        }

        chrome.storage.local.set(tokensToStore, () => {
          console.log("[OAuth2] OAuth tokens stored successfully.");
          callback(this);
        });
      })
      .catch((error) => {
        console.error("[OAuth2] Token request failed:", error.message);
        callback(null, "Token request failed: " + error.message);
      });
  }

  // **FIXED**: Renamed this function to avoid conflict. This is a simple getter.
  retrieveStoredAccessToken() {
    return this.accessToken;
  }

  refreshAccessToken(callback) {
    if (!this.refreshToken) {
      console.warn("[OAuth2] No refresh token available to refresh.");
      callback(null, "No refresh token available.");
      return;
    }

    console.log("[OAuth2] refreshAccessToken() called");
    const tokenUrl = "https://oauth2.googleapis.com/token";
    const body = new URLSearchParams();
    body.append("refresh_token", this.refreshToken);
    body.append("client_id", this.clientId);
    body.append("client_secret", this.clientSecret);
    body.append("grant_type", "refresh_token");

    fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body,
    })
      .then((response) => {
        if (!response.ok) {
          return response.json().then((err) => {
            throw new Error(JSON.stringify(err));
          });
        }
        return response.json();
      })
      .then((response) => {
        console.log("[OAuth2] Refresh token response:", response);
        this.accessToken = response.access_token;
        this.expiresIn = response.expires_in;
        this.expiresAt = Date.now() + this.expiresIn * 1000;

        chrome.storage.local.set(
          {
            oauth_access_token: this.accessToken,
            oauth_expires_in: this.expiresIn,
            oauth_expires_at: this.expiresAt,
          },
          () => {
            console.log(
              "[OAuth2] Access token refreshed and stored successfully."
            );
            callback(this);
          }
        );
      })
      .catch((error) => {
        console.error("[OAuth2] Token refresh failed:", error.message);
        // If refresh fails (e.g., token revoked), clear all tokens to force re-auth
        this.clearTokens();
        callback(null, "Token refresh failed: " + error.message);
      });
  }

  isTokenExpired() {
    return Date.now() >= (this.expiresAt || 0);
  }

  loadStoredTokens(callback) {
    if (
      typeof chrome === "undefined" ||
      !chrome.storage ||
      !chrome.storage.local
    ) {
      console.warn("[OAuth2] Chrome storage APIs not available.");
      callback(null, "Chrome storage APIs not available.");
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
        if (chrome.runtime.lastError) {
          callback(null, "Error loading tokens from storage.");
          return;
        }

        if (result.oauth_access_token) {
          this.accessToken = result.oauth_access_token;
          this.refreshToken = result.oauth_refresh_token;
          this.expiresIn = result.oauth_expires_in;
          this.tokenType = result.oauth_token_type;
          this.expiresAt = result.oauth_expires_at;

          if (this.isTokenExpired()) {
            console.log("[OAuth2] Stored token has expired, refreshing...");
            this.refreshAccessToken(callback);
          } else {
            console.log("[OAuth2] Valid token loaded from storage.");
            callback(this);
          }
        } else {
          console.log("[OAuth2] No stored tokens found.");
          callback(null, "No stored tokens.");
        }
      }
    );
  }

  clearTokens(callback) {
    if (
      typeof chrome === "undefined" ||
      !chrome.storage ||
      !chrome.storage.local
    ) {
      if (callback) callback();
      return;
    }

    this.accessToken = null;
    this.refreshToken = null;
    this.expiresIn = null;
    this.tokenType = null;
    this.expiresAt = null;

    chrome.storage.local.remove(
      [
        "oauth_access_token",
        "oauth_refresh_token",
        "oauth_expires_in",
        "oauth_token_type",
        "oauth_expires_at",
      ],
      () => {
        console.log("[OAuth2] OAuth tokens cleared from instance and storage.");
        if (callback) callback();
      }
    );
  }
}

// Make OAuth2 available on the window object for easy access from other scripts
window.OAuth2 = OAuth2;
