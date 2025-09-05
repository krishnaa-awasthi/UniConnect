// config/api.ts
import Constants from "expo-constants";

export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ||     
  Constants.expoConfig?.extra?.API_BASE ||
  "http://localhost:3000";              