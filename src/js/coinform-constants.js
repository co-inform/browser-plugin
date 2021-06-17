module.exports = Object.freeze({
  COINFORM_MAIN_COLOR: "#693c5e", // coinform color (violet)
  COINFORM_BUTTON_COLOR: "#62B9AF", // coinform green color (old: #3085d6)
  WELCOME_URL: "https://coinform.eu/plugin-welcome/",
  TUTORIAL_URL: "https://coinform.eu/plugin-tutorial/",
  MODULES_INFO_URL: "https://coinform.eu/modules-info/",
  // Variables used only in test use mode. Hacked to force a misinformation url detection, and a missinformation user tweets detection
  MISINFO_TEST_URL_REGEXP: "https://coinform\.eu.*",
  MISINFO_TEST_TW_USERNAME: "co_inform"
});
