import { GoogleSignin } from "@react-native-google-signin/google-signin";
import auth from "@react-native-firebase/auth";
import { useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import apiService from "../services/api";

const LoginPage = () => {
  useEffect(() => {
    GoogleSignin.configure({
      webClientId:
        "472976602572-g3ujtnkpkdu9ctml7uo3tgiarsplifqr.apps.googleusercontent.com",
      iosClientId:
        "472976602572-iuh3f73itbcg66dulftv7778k39dvi4l.apps.googleusercontent.com",
      scopes: [
        "email",
        "openid",
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/userinfo.email",
      ],
    });
  }, []);

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async (user) => {
      if (user) {
        console.log("Auth state changed - User logged in:", user.email);

        // Create user profile in backend after successful login
        try {
          console.log("🔄 Creating/updating user profile in backend...");

          // Wait a moment for the token to be ready
          await new Promise((resolve) => setTimeout(resolve, 1000));

          const profileData = {
            email: user.email,
            displayName: user.displayName || user.email.split("@")[0],
            photoURL: user.photoURL,
            emailVerified: user.emailVerified,
            createdAt: new Date().toISOString(),
          };

          // Create user profile in backend using API service
          const response = await fetch(
            "http://localhost:3000/api/users/profile",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${await user.getIdToken()}`,
              },
              body: JSON.stringify(profileData),
            }
          );

          if (response.ok) {
            console.log("✅ User profile created/updated in backend");
          } else {
            console.log("⚠️ Failed to create user profile, but continuing...");
          }
        } catch (error) {
          console.log("⚠️ Error creating user profile:", error.message);
          // Continue anyway - user can still use the app
        }
      } else {
        console.log("Auth state changed - User logged out");
      }
    });
    return unsubscribe;
  }, []);

  const googleSignIn = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const user = await GoogleSignin.signIn();
      const idToken = user.data?.idToken;
      console.log("Google ID Token:", idToken);

      if (idToken) {
        const googleCredential = auth.GoogleAuthProvider.credential(idToken);
        const firebaseUser = await auth().signInWithCredential(
          googleCredential
        );
        console.log("Firebase user created:", firebaseUser.user.uid);
        console.log("User email:", firebaseUser.user.email);
        console.log("User display name:", firebaseUser.user.displayName);

        const firebaseIdToken = await firebaseUser.user.getIdToken();
        console.log("Firebase ID Token for backend:", firebaseIdToken);

        // User profile creation will be handled by auth state change listener
      } else {
        console.log("No ID token received from Google");
      }
    } catch (error) {
      console.log("Google Sign-In error:", error);
      if (error.code === "SIGN_IN_CANCELLED") {
        console.log("User cancelled the sign-in flow");
      } else if (error.code === "PLAY_SERVICES_NOT_AVAILABLE") {
        console.log("Play services not available");
      } else if (error.code === "SIGN_IN_REQUIRED") {
        console.log("Sign-in required");
      } else {
        console.log("Other error:", error.message);
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Trolley</Text>
      <Text style={styles.subtitle}>Your personal shopping assistant</Text>
      <TouchableOpacity
        style={styles.googleButton}
        onPress={googleSignIn}
        activeOpacity={0.85}
      >
        <Image
          source={{
            uri: "https://developers.google.com/identity/images/g-logo.png",
          }}
          style={styles.googleIcon}
        />
        <Text style={styles.googleButtonText}>Sign in with Google</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#2c3e50",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#7f8c8d",
    marginBottom: 40,
    textAlign: "center",
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#dadce0",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#3c4043",
  },
});

export default LoginPage;
