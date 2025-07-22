import { GoogleSignin } from "@react-native-google-signin/google-signin";
import auth from "@react-native-firebase/auth";
import { useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";

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
    const unsubscribe = auth().onAuthStateChanged((user) => {
      console.log("Auth state changed:", user ? user.email : "No user");
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
        // await sendTokenToBackend(firebaseIdToken);
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
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#212529",
    marginBottom: 8,
    textAlign: "center",
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dee2e6",
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  googleIcon: {
    width: 24,
    height: 24,
    marginRight: 12,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#212529",
  },
});

export default LoginPage;
