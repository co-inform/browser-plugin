module.exports = Object.freeze({
  COINFORM_MAIN_COLOR: "#693c5e", // coinform color (violet)
  COINFORM_BUTTON_COLOR: "#62B9AF", // coinform green color (old: #3085d6)
  WEBSITE_URL: "https://coinform.eu",
  PROJECT_URL: "https://coinform.eu/about/the-project/",
  TEAM_URL: "https://coinform.eu/about/the-consortium/",
  CONTACT_URL: "https://coinform.eu/42-2",
  WELCOME_URL: "https://coinform.eu/tools/plugin-welcome-page/",
  TUTORIAL_URL: "https://coinform.eu/tools/plugin-tutorial/",
  ANALYSIS_INFO_URL: "https://coinform.eu/tools/misinformation-detection-services/",
  MODULES_INFO_URLS: {
    MISINFOME: "https://coinform.eu/tools/misinformation-detection-services/#misinfome",
    CLAIM_SIMILARITY: "https://coinform.eu/tools/misinformation-detection-services/#claimsimilarity",
    CONTENT_ANALYSIS: "https://coinform.eu/tools/misinformation-detection-services/#contentstance",
  },
  // Variables used only in test use mode. Hacked to force a misinformation url detection, and a missinformation user tweets detection
  MISINFO_TEST_URL_REGEXP: "https://coinform\.eu.*",
  MISINFO_TEST_TW_USERNAME: "co_inform"
});
