// Config for @capacitor/assets — run: npx capacitor-assets generate
// Reads icon-foreground.png / icon-background.png / splash.png from ./assets/
// and outputs to ios/ and android/ directories.
// See: https://github.com/ionic-team/capacitor-assets

const config = {
  assetPath: "./assets",
  templateParameters: {},
  ios: {
    // Foreground icon (1024×1024 PNG, lime-600 MCQ mark on white)
    iconForegroundImage: "icon-foreground.png",
    // Solid lime-600 background
    iconBackgroundColor: "#65a30d",
    iconBackgroundColorDark: "#4d7c0f",
    splashImage: "splash.png",
    splashBackgroundColor: "#ffffff",
    splashBackgroundColorDark: "#0a0a0a",
  },
  android: {
    iconForegroundImage: "icon-foreground.png",
    iconBackgroundColor: "#65a30d",
    iconBackgroundColorDark: "#4d7c0f",
    splashImage: "splash.png",
    splashBackgroundColor: "#ffffff",
    splashBackgroundColorDark: "#0a0a0a",
  },
}

export default config
