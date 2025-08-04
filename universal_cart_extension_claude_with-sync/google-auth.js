/**
 * Google Auth for Chrome Extension using OAuth2 with Firebase Integration
 */

class GoogleAuth {
  constructor() {
    this.oauth2 = null;
    this.userInfo = null;
    this.isAuthenticated = false;
    this.firebaseIdToken = null;
    this.authStateChangeCallback = null;
  }

  initialize() {
    console.log("[GoogleAuth] initialize()");

    const clientId = window.env && window.env.GOOGLE_CLIENT_ID;
    const clientSecret = window.env && window.env.GOOGLE_CLIENT_SECRET;
    const apiScope = window.env && window.env.GOOGLE_API_SCOPE;

    if (!clientId) {
      console.error("[GoogleAuth] No Google Client ID found in env");
      return;
    }

    this.oauth2 = new OAuth2("google", {
      client_id: clientId,
      client_secret: clientSecret,
      api_scope: apiScope || "openid email profile",
    });

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
    this.oauth2.authorize(async (auth, error) => {
      if (auth) {
        console.log("[GoogleAuth] OAuth2 authorization successful");
        this.isAuthenticated = true;

        this.getUserInfo(async (userInfo, userError) => {
          if (userInfo) {
            this.userInfo = userInfo;

            try {
              await this.createFirebaseUser(userInfo);
              await this.createUserProfileInBackend(userInfo);

              this.onAuthStateChanged(true, userInfo);
              callback(userInfo);
            } catch (firebaseError) {
              console.warn(
                "[GoogleAuth] Firebase setup failed, but continuing:",
                firebaseError
              );

              this.onAuthStateChanged(true, userInfo);
              callback(userInfo);
            }
          } else {
            console.error("[GoogleAuth] Failed to get user info:", userError);
            callback(null, userError || "Failed to get user info");
          }
        });
      } else {
        console.error("[GoogleAuth] OAuth2 authorization failed:", error);
        this.isAuthenticated = false;
        this.onAuthStateChanged(false, null);
        callback(null, error);
      }
    });
  }

  async createFirebaseUser(userInfo) {
    console.log("[GoogleAuth] Creating Firebase user...");

    if (!this.oauth2.accessToken) {
      throw new Error("No access token available");
    }

    try {
      const storedTokens = await new Promise((resolve) => {
        chrome.storage.local.get(["oauth_id_token"], resolve);
      });

      let idToken = storedTokens.oauth_id_token;

      if (idToken) {
        console.log("[GoogleAuth] Using stored ID token from OAuth2 flow");
        await this.signInWithFirebaseIdToken(idToken);
      } else {
        console.log("[GoogleAuth] No stored ID token, trying to get fresh one");

        await this.getGoogleIdToken();
      }
    } catch (error) {
      console.error("[GoogleAuth] Firebase user creation failed:", error);
      throw error;
    }
  }

  async getGoogleIdToken() {
    console.log("[GoogleAuth] Getting fresh Google ID token...");

    try {
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          access_token: this.oauth2.accessToken,
          grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
          requested_token_type: "urn:ietf:params:oauth:token-type:id_token",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.id_token) {
          await this.signInWithFirebaseIdToken(data.id_token);
          return;
        }
      }

      console.log("[GoogleAuth] Falling back to access token approach");
      await this.createCustomFirebaseToken(userInfo);
    } catch (error) {
      console.error("[GoogleAuth] Error getting ID token:", error);

      await this.createCustomFirebaseToken(userInfo);
    }
  }

  async signInWithFirebaseIdToken(idToken) {
    console.log("[GoogleAuth] Signing in with Firebase ID token");

    const firebaseConfig = {
      apiKey: "AIzaSyD8u8zHaq-v9yHMqWk24H1ft38Ej9oNmJo",
      authDomain: "trolley-app-4885d.firebaseapp.com",
      projectId: "trolley-app-4885d",
    };

    try {
      const response = await fetch(
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
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Firebase signIn failed: ${errorText}`);
      }

      const data = await response.json();
      console.log("[GoogleAuth] Firebase signIn successful:", data);

      if (data.idToken) {
        this.firebaseIdToken = data.idToken;

        chrome.runtime.sendMessage({
          action: "storeFirebaseToken",
          token: data.idToken,
        });

        console.log("[GoogleAuth] Firebase ID token stored successfully");
      } else {
        throw new Error("No Firebase ID token in response");
      }

      return data;
    } catch (error) {
      console.error("[GoogleAuth] Firebase signIn error:", error);
      throw error;
    }
  }

  async createCustomFirebaseToken(userInfo) {
    console.log(
      "[GoogleAuth] Creating custom Firebase token for user:",
      userInfo.email
    );

    try {
      const response = await fetch(
        "http://localhost:3000/api/auth/google-token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            googleAccessToken: this.oauth2.accessToken,
            userInfo: userInfo,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.firebaseToken) {
          this.firebaseIdToken = data.firebaseToken;

          chrome.runtime.sendMessage({
            action: "storeFirebaseToken",
            token: data.firebaseToken,
          });

          console.log("[GoogleAuth] Custom Firebase token created via backend");
          return;
        }
      }
    } catch (error) {
      console.log("[GoogleAuth] Backend token exchange failed:", error.message);
    }

    console.log("[GoogleAuth] Using Google access token as fallback");
    this.firebaseIdToken = this.oauth2.accessToken;

    chrome.runtime.sendMessage({
      action: "storeFirebaseToken",
      token: this.oauth2.accessToken,
    });
  }

  async createUserProfileInBackend(userInfo) {
    console.log("[GoogleAuth] Creating user profile in backend...");

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const profileData = {
        email: userInfo.email,
        displayName: userInfo.name || userInfo.email.split("@")[0],
        photoURL: userInfo.picture,
        emailVerified: userInfo.verified_email,
        createdAt: new Date().toISOString(),
      };

      const response = await fetch("http://localhost:3000/api/users/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.firebaseIdToken}`,
        },
        body: JSON.stringify(profileData),
      });

      if (response.ok) {
        console.log("[GoogleAuth] User profile created/updated in backend");
      } else {
        const errorText = await response.text();
        console.warn(
          "[GoogleAuth] Failed to create user profile:",
          response.status,
          errorText
        );
      }
    } catch (error) {
      console.warn("[GoogleAuth] Error creating user profile:", error.message);
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
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText);
            console.log("[GoogleAuth] User info retrieved:", response);
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

  signOut(callback) {
    console.log("[GoogleAuth] signOut()");

    if (this.oauth2) {
      this.oauth2.clearTokens();
    }

    chrome.runtime.sendMessage({
      action: "clearAuth",
    });

    this.isAuthenticated = false;
    this.userInfo = null;
    this.firebaseIdToken = null;

    this.onAuthStateChanged(false, null);

    if (callback) {
      callback();
    }
  }

  setAuthStateChangeCallback(callback) {
    this.authStateChangeCallback = callback;
  }

  onAuthStateChanged(isSignedIn, userInfo) {
    console.log(
      "[GoogleAuth] Auth state changed:",
      isSignedIn ? "signed in" : "signed out"
    );
    if (this.authStateChangeCallback) {
      this.authStateChangeCallback(isSignedIn, userInfo);
    }
  }

  isSignedIn() {
    return this.isAuthenticated && this.userInfo !== null;
  }

  getCurrentUser() {
    return this.userInfo;
  }
}
