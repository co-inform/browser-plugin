module.exports = Object.freeze({
  TIME_PUBLISH_AWAIT: 10, // Timeout on await misinformation publish
  MAX_RETRIES: 12, // Retries timeout for each post credibility query
  PLUGIN_CACHE_SIZE: 250, // Cache size (number of elements) from where the plugin will try to remove old unused entries
  PLUGIN_CACHE_TIME: 900, // Time (in seconds) to consider an entry enough old and unused
  FEEDBACK_NUM_SHOW_THRESHOLD: 5,
  COINFORM_MAIN_COLOR: "#693c5e", // coinform color (violet)
  COINFORM_BUTTON_COLOR: "#62B9AF", // coinform green color (old: #3085d6)
  IMAGES_PATH: "/resources/",
  COINFORM_LOGO_IMG_NAME: "logo_36_20.png",
  MIN_LOGO_IMG_NAME: "coinform_biglogo.png",
  INFO_ICON_NAME: "info.png",
  CLAIM_ICON_NAME: "bubble_claim.png",
  AGREE_ICON_NAME: "agree.png",
  DISAGREE_ICON_NAME: "disagree.png",
  METER_ICON_NAME: "meter.png",
  METER_LABEL_ICON_PREFIX: "meter_",
  METER_LABEL_ICON_EXTENSION: ".png",
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
