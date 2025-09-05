// app/index.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { API_BASE } from "./config/api"; // ✅ centralized

export default function LoginScreen() {
  const router = useRouter();
  const [collegeId, setCollegeId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  /* -------------------- Login Handler -------------------- */
  const handleLogin = async () => {
    if (!collegeId || !password) {
      Alert.alert("Error", "Please enter both College ID and Password");
      return;
    }

    setLoading(true);
    try {
      console.log("Attempting login for:", collegeId);

      const res = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: collegeId, password }),
      });

      const data = await res.json();
      console.log("Backend response:", data);

      if (!res.ok) {
        throw new Error(data.message || `Server error: ${res.status}`);
      }

      if (data.success && data.token) {
        // ✅ Save both token & username
        await AsyncStorage.setItem("token", data.token);
        await AsyncStorage.setItem("loggedInUser", collegeId);

        Alert.alert("Success", "You are logged in");
        router.replace("/(tabs)/home");
      } else {
        Alert.alert("Login Failed", data.message || "Invalid College ID or Password");
      }
    } catch (error: any) {
      console.error("Login error:", error);
      if (error.message.includes("Network request failed")) {
        Alert.alert(
          "Network Error",
          "Could not reach the server. Please check your internet connection and ensure the server is running."
        );
      } else {
        Alert.alert("Error", error.message || "An error occurred during login.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.logo}>
            <Text style={styles.red}>Uni</Text>
            <Text style={styles.black}>Connect</Text>
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Enter ID / University Roll No."
            placeholderTextColor="#555"
            value={collegeId}
            onChangeText={setCollegeId}
            keyboardType="numeric"
          />

          {/* Password field with eye icon */}
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              placeholderTextColor="#555"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons
                name={showPassword ? "eye-off" : "eye"}
                size={22}
                color="#555"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.loginText}>Log in</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() =>
              Linking.openURL("https://erp.psit.ac.in/Erp/ForgetPassword")
            }
          >
            <Text style={styles.forgotPassword}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.verified}>Only verified students and faculty can join</Text>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* -------------------- Styles -------------------- */
const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    backgroundColor: "white",
  },
  header: { marginBottom: 40 },
  logo: { fontSize: 36, fontWeight: "bold" },
  red: { color: "#C62828" },
  black: { color: "black" },
  form: { width: "100%", alignItems: "center" },
  input: {
    backgroundColor: "#D9D9D9",
    width: "100%",
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 10,
    fontSize: 16,
    marginBottom: 15,
    color: "black",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#D9D9D9",
    width: "100%",
    borderRadius: 10,
    marginBottom: 15,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 15,
    fontSize: 16,
    color: "black",
  },
  eyeIcon: { paddingHorizontal: 12 },
  loginButton: {
    backgroundColor: "#C62828",
    width: "100%",
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: "center",
    marginBottom: 10,
  },
  loginText: { color: "white", fontSize: 16, fontWeight: "500" },
  forgotPassword: { color: "black", fontSize: 14, marginTop: 5 },
  verified:{color: "gray", fontSize: 10, marginTop: 20, textAlign: "center"},
});
