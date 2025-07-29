import { GoogleSignin } from "@react-native-google-signin/google-signin";
import auth from "@react-native-firebase/auth";
import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import apiService from "../services/api";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

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
      setLoading(true);
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
        Alert.alert("Error", "Failed to sign in via Google");
      }
    } finally {
      setLoading(false);
    }
  };

  const emailSignIn = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }

    try {
      setLoading(true);
      const userCredential = await auth().signInWithEmailAndPassword(
        email,
        password
      );
      console.log("User signed in with email:", userCredential.user.email);
    } catch (error) {
      console.log("Email sign-in error:", error);
      let errorMessage = "Failed to sign in";

      switch (error.code) {
        case "auth/user-not-found":
          errorMessage = "No user found with this email";
          break;
        case "auth/wrong-password":
          errorMessage = "Incorrect password";
          break;
        case "auth/invalid-email":
          errorMessage = "Invalid email format";
          break;
        case "auth/user-disabled":
          errorMessage = "Account has been disabled";
          break;
        case "auth/too-many-requests":
          errorMessage = "Too many attempts. Please try again later";
          break;
        default:
          errorMessage = error.message;
      }

      Alert.alert("Sign In Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const emailSignUp = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters long");
      return;
    }

    try {
      setLoading(true);
      const userCredential = await auth().createUserWithEmailAndPassword(
        email,
        password
      );
      console.log("User created with email:", userCredential.user.email);

      // Send email verification
      await userCredential.user.sendEmailVerification();
      Alert.alert(
        "Registration Successful!",
        "A verification email has been sent to your email address. Please check your inbox."
      );
    } catch (error) {
      console.log("Email sign-up error:", error);
      let errorMessage = "Failed to create account";

      switch (error.code) {
        case "auth/email-already-in-use":
          errorMessage = "This email is already in use";
          break;
        case "auth/invalid-email":
          errorMessage = "Invalid email format";
          break;
        case "auth/weak-password":
          errorMessage = "Password is too weak";
          break;
        case "auth/operation-not-allowed":
          errorMessage = "Email registration is disabled";
          break;
        default:
          errorMessage = error.message;
      }

      Alert.alert("Registration Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Welcome to Trolley</Text>
        <Text style={styles.subtitle}>Your personal shopping assistant</Text>

        {/* Email/Password Form */}
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>
            {isLogin ? "Sign In" : "Create Account"}
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={[styles.emailButton, loading && styles.disabledButton]}
            onPress={isLogin ? emailSignIn : emailSignUp}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.emailButtonText}>
              {loading ? "Please wait..." : isLogin ? "Sign In" : "Sign Up"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => setIsLogin(!isLogin)}
          >
            <Text style={styles.switchButtonText}>
              {isLogin
                ? "Don't have an account? Sign Up"
                : "Already have an account? Sign In"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Google Sign In */}
        <TouchableOpacity
          style={[styles.googleButton, loading && styles.disabledButton]}
          onPress={googleSignIn}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Image
            source={{
              uri: "https://developers.google.com/identity/images/g-logo.png",
            }}
            style={styles.googleIcon}
          />
          <Text style={styles.googleButtonText}>
            {loading ? "Please wait..." : "Sign in with Google"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
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
  formContainer: {
    width: "100%",
    maxWidth: 350,
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#2c3e50",
    textAlign: "center",
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "#dadce0",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: "#fff",
  },
  emailButton: {
    backgroundColor: "#3498db",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
  },
  emailButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  switchButton: {
    alignItems: "center",
  },
  switchButtonText: {
    color: "#3498db",
    fontSize: 14,
    textDecorationLine: "underline",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    maxWidth: 350,
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#dadce0",
  },
  dividerText: {
    marginHorizontal: 16,
    color: "#7f8c8d",
    fontSize: 14,
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
    width: "100%",
    maxWidth: 350,
    justifyContent: "center",
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
  disabledButton: {
    opacity: 0.6,
  },
});

export default LoginPage;
