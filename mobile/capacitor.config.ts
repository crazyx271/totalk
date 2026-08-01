import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.totalk.mobile",
  appName: "ToTalk",
  webDir: "www",
  server: {
    url: process.env.TOTALK_MOBILE_URL ?? "https://totalker.ru",
    cleartext: false,
    allowNavigation: ["totalker.ru", "*.totalker.ru"],
  },
  backgroundColor: "#0b0d12",
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#0b0d12",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0b0d12",
      overlaysWebView: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
