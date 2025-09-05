// app/splash.tsx
import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

export default function SplashScreen() {
  const router = useRouter();

  const uniOpacity = useRef(new Animated.Value(0)).current;
  const connectOpacity = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Run animation sequence
    Animated.sequence([
      Animated.timing(uniOpacity, {
        toValue: 1,
        duration: 800,
        easing: Easing.ease,
        useNativeDriver: true,
      }),
      Animated.timing(connectOpacity, {
        toValue: 1,
        duration: 800,
        easing: Easing.ease,
        useNativeDriver: true,
      }),
    ]).start();

    // Scale bounce animation
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 1600,
      easing: Easing.bezier(0.68, -0.55, 0.27, 1.55),
      useNativeDriver: true,
    }).start();

    // Navigate after ~4 seconds
    const timer = setTimeout(() => {
      router.replace("/");
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={{ flexDirection: "row", transform: [{ scale: scaleAnim }] }}>
        <Animated.Text style={[styles.text, styles.red, { opacity: uniOpacity }]}>
          Uni
        </Animated.Text>
        <Animated.Text style={[styles.text, styles.white, { opacity: connectOpacity }]}>
          Connect
        </Animated.Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontSize: 42,
    fontWeight: "bold",
    letterSpacing: 2,
  },
  red: { color: "red" },
  white: { color: "black" },
});
