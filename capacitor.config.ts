import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kord.gg',
  appName: 'Kord',
  webDir: 'public',
  server: {
    androidScheme: 'https',
    url: 'https://kord.gg'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#0f172a",
      showSpinner: false
    }
  }
};

export default config;