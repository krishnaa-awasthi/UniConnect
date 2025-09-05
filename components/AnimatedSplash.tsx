import { useRouter } from "expo-router";
import * as ExpoSplash from "expo-splash-screen";
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
    Easing,
    useAnimatedProps,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import Svg, { Text as SvgText, TSpan } from "react-native-svg";

const AnimatedText = Animated.createAnimatedComponent(SvgText);

export default function AnimatedSplash() {
  const router = useRouter();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(30);

  const animatedProps = useAnimatedProps(() => ({
    opacity: opacity.value,
    translateY: translateY.value,
  }));

  useEffect(() => {
    opacity.value = withTiming(1, {
      duration: 1500,
      easing: Easing.out(Easing.cubic),
    });
    translateY.value = withTiming(0, {
      duration: 1500,
      easing: Easing.out(Easing.cubic),
    });

    const timeout = setTimeout(async () => {
      await ExpoSplash.hideAsync();
      router.replace("/tabs/home"); // go to your main tab
    }, 2200);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <View style={styles.container}>
      <Svg height="100" width="300">
        <AnimatedText
          animatedProps={animatedProps}
          x="0"
          y="70"
          fontSize="48"
          fontWeight="bold"
          fontFamily="sans-serif"
        >
          <TSpan fill="red">Uni</TSpan>
          <TSpan fill="white">Connect</TSpan>
        </AnimatedText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
    justifyContent: "center",
    alignItems: "center",
  },
});
