
const $ = require('jquery');
const CoinformConstants = require('./coinform-constants');
const Swal2 = require('sweetalert2');
const ShowDown = require('showdown');
const TweetParser = require('./tweet-parser');
const FacebookParser = require('./facebook-parser');
const CoInformLogger = require('./coinform-logger');

const browserAPI = chrome || browser;

let pluginCache = {};

let coinformLogoPath;
let minLogoPath;
let infoIconPath;
let claimIconPath;
let disagreeIconPath;
let agreeIconPath;

let inDarkMode = false;

let configuration;
let logger;
let parser;

let coinformUserToken = null;
let coinformUserMail = null;
let coinformUserID = null;

const misinfoApiQueryResp = {
  status: "done",
  // eslint-disable-next-line camelcase
  query_id: -1,
  response: {
    // eslint-disable-next-line camelcase
    rule_engine: {
      // eslint-disable-next-line camelcase
      final_credibility: "not_credible",
      // eslint-disable-next-line camelcase
      module_labels: [],
      // eslint-disable-next-line camelcase
      module_values: []
    }
  }
};

// Read the configuration file and if it was successful, start
browserAPI.runtime.sendMessage({
  messageId: "GetConfig"
}, function(res) {
  if (res.configuration) {
    configuration = res.configuration;
    logger = new CoInformLogger(CoInformLogger.logTypes[configuration.coinform.logLevel]);

    browserAPI.runtime.sendMessage({
      messageId: "GetSession"
    }, function(res) {
      if (res.token) {
        logger.logMessage(CoInformLogger.logTypes.debug, `User already logged: ${res.userMail}`);
        coinformUserToken = res.token;
        coinformUserMail = res.userMail;
        coinformUserID = res.userID;
      }
      else {
        logger.logMessage(CoInformLogger.logTypes.debug, "User not logged");
      }

      logger.logMessage(CoInformLogger.logTypes.debug, `Url opened: ${window.location.href}`);
      log2Server('page', window.location.href, null, `Opened User Page Url`);
      
      setTimeout(start, 2000);
    });

  }
  else {
    console.error('Could not load plugin configuration');
  }
});

// Set listener for background script messages
browserAPI.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.message === 'tabUrlChanged') {
    logger.logMessage(CoInformLogger.logTypes.debug, `Url changed: ${request.url}`);
    log2Server('page', request.url, null, `Changed User Page Url`);
  }
  else if (request.messageId === "userLogin") {
    logger.logMessage(CoInformLogger.logTypes.info, `User logged in: ${request.userMail}`);
    coinformUserToken = request.token;
    coinformUserMail = request.userMail;
    coinformUserID = request.userID;
    configuration.coinform.options = request.userOptions;
  }
  else if (request.messageId === "userLogout") {
    logger.logMessage(CoInformLogger.logTypes.info, `User logged out`);
    coinformUserToken = null;
    coinformUserMail = null;
    coinformUserID = null;
    configuration.coinform.options = null;
    if (request.defaultOptions) {
      configuration.coinform.options = request.defaultOptions;
    }
  }
  else if (request.messageId === "renewUserToken") {
    logger.logMessage(CoInformLogger.logTypes.debug, `Renewed User Token`);
    coinformUserToken = request.token;
    coinformUserMail = request.userMail;
    coinformUserID = request.userID;
    configuration.coinform.options = request.userOptions;
  }
  else if (request.messageId === "OptionsChange") {
    if (request.options !== undefined) {
      configuration.coinform.options = request.options;
    }
  }
});

// Initialize objects, variables, and listeners
const start = () => {

  coinformLogoPath = browserAPI.extension.getURL(CoinformConstants.IMAGES_PATH + CoinformConstants.COINFORM_LOGO_IMG_NAME);
  minLogoPath = browserAPI.extension.getURL(CoinformConstants.IMAGES_PATH + CoinformConstants.MIN_LOGO_IMG_NAME);
  infoIconPath = browserAPI.extension.getURL(CoinformConstants.IMAGES_PATH + CoinformConstants.INFO_ICON_NAME);
  claimIconPath = browserAPI.extension.getURL(CoinformConstants.IMAGES_PATH + CoinformConstants.CLAIM_ICON_NAME);
  disagreeIconPath = browserAPI.extension.getURL(CoinformConstants.IMAGES_PATH + CoinformConstants.DISAGREE_ICON_NAME);
  agreeIconPath = browserAPI.extension.getURL(CoinformConstants.IMAGES_PATH + CoinformConstants.AGREE_ICON_NAME);

  inDarkMode = false;
  let bodyColor = document.body.style.backgroundColor;
  if (bodyColor && ((bodyColor.indexOf("#FFFFFF") < 0) && (bodyColor.indexOf("rgb(255, 255, 255)") < 0 ))) {
    inDarkMode = true;
  }

  if (window.location.hostname.indexOf('twitter.com') >= 0) {
    parser = new TweetParser();
    parser.initContext();
    parser.listenForMainChanges(newTweetCallback);
    parser.listenPublishTweet(publishTweetCallback);
    parser.listenRetweetTweet(retweetTweetCallback);
    parser.listenLikeTweet(likeTweetCallback);
    parser.listenUnlikeTweet(unlikeTweetCallback);
    parser.triggerFirstTweetBatch(newTweetCallback);
  }
  else if (window.location.hostname.indexOf('facebook.com') >= 0) {
    /*parser = new FacebookParser();
    parser.fromBrowser(newFacebookPostCallback);
    parser.listenForNewPosts(newFacebookPostCallback);*/
  }

};

const publishTweetCallback = (clickEvent, targetButton) => {

  // get text
  let tweetText = null;
  let parentTextBox = targetButton.offsetParent;
  for ( ; parentTextBox && parentTextBox !== document; parentTextBox = parentTextBox.parentNode ) {
    let auxTextSelector = parentTextBox.querySelector("[role='textbox'][data-testid*='tweetTextarea']");
    if (auxTextSelector) {
      tweetText = auxTextSelector.innerText;
      break;
    }
  }

  // click situation when we already procesed the tweet and the await time has finished
  if (targetButton.coInformed) {
    if (targetButton.hasMisinfo) {

      // if the content is missinfo, put a timer of 5 or 10 seconds before publishing it, and then set the CoInformed property to false and raise the click event again
      targetButton.setAttribute("disabled", "");
      targetButton.setAttribute("aria-disabled", "true");
      let msg = document.getElementById("coinformPublishMessages");
      let txtContent = document.createElement("SPAN");
      txtContent.classList.add("blink_me");
      let txt = document.createTextNode(browserAPI.i18n.getMessage("published_in_seconds", `${CoinformConstants.TIME_PUBLISH_AWAIT}`));
      txtContent.append(txt);
      msg.append(document.createTextNode(". "));
      msg.append(txtContent);
      setTimeout(function() {
        publishTweetCountdown(targetButton, (CoinformConstants.TIME_PUBLISH_AWAIT - 1), tweetText);
      }, 1000);
      log2Server('publish tweet', null, `Tweet content: ${tweetText}`, `Click on publish tweet anyway`);
    }
    else {
      targetButton.coInformed = false;
      logger.logMessage(CoInformLogger.logTypes.debug, `Publish button processed!!`);
      return true;
    }
  }

  // prevent the submiting of the tweet
  clickEvent.stopImmediatePropagation();
  clickEvent.preventDefault();
  clickEvent.stopPropagation();

  // if disabled we are still waiting, so just finish it, with the click event propagation stopped
  if (targetButton.hasAttribute("disabled")) {
    return true;
  }

  logger.logMessage(CoInformLogger.logTypes.debug, `Publish button clicked!!`);

  targetButton.setAttribute("disabled", "");
  targetButton.setAttribute("aria-disabled", "true");

  //get urls from text
  let urls = null;
  if (tweetText) {
    // check user option that disables await nudging action is not set to false
    if (!(configuration.coinform.options.config && configuration.coinform.options.config.await && (configuration.coinform.options.config.await.localeCompare("false") === 0))) {
      urls = tweetText.match(/((ftp|https?):\/\/([^\s]+)([^.,;:\s]))/g);
    }
  }

  if (urls) {

    logger.logMessage(CoInformLogger.logTypes.debug, `Detected ${urls.length} URLs`);

    // replace the text of the button with a loading
    /*let loadingSpinner = document.createElement("DIV");
    loadingSpinner.classList.add("spinner-border");
    loadingSpinner.setAttribute("role", "status");
    let span = document.createElement("SPAN");
    span.classList.add("sr-only");
    let auxtxt = document.createTextNode("Loading...");
    span.append(auxtxt);
    loadingSpinner.append(span);
    targetButton.children[0].style.display = "none";
    targetButton.append(loadingSpinner);*/
    
    // attach loading text
    let loadingMessage = document.createElement("SPAN");
    loadingMessage.classList.add("publishTweetCoinformMessage");
    loadingMessage.classList.add("blink_me");
    let txt = document.createTextNode(browserAPI.i18n.getMessage("checking_tweet_coinform"));
    loadingMessage.append(txt);
    loadingMessage.setAttribute("id", "coinformPublishMessages");
    let toolBar = targetButton.offsetParent;
    for ( ; toolBar && toolBar !== document; toolBar = toolBar.parentNode ) {
      if ( toolBar.matches("[data-testid='toolBar']") ) break;
    }
    if (toolBar && (toolBar !== document)) {
      toolBar.offsetParent.append(loadingMessage);
    }

    targetButton.hasMisinfo = false;

    for (let i = 0; i < urls.length; i++) {

      browserAPI.runtime.sendMessage({
        messageId: "CheckUrl",
        url: urls[i]
      }, function(res) {
        
        let resStatus = JSON.stringify(res.status).replace(/['"]+/g, '');
        let assessments = null;

        // Hack to force a misinformation url detection, and a missinformation user tweets detection
        // Active only in test use mode
        if ((configuration.coinform.options.testMode.localeCompare("true") === 0) && urls[i].match(new RegExp(CoinformConstants.MISINFO_TEST_URL_REGEXP))) {
          targetButton.hasMisinfo = true; 
          publishTweetAlertMisinfo("not_credible", urls[i], tweetText, assessments);
        }

        else if ((resStatus.localeCompare('400') === 0)) {
          logger.logMessage(CoInformLogger.logTypes.error, `Request 400 response`);
        }
        else if (resStatus.localeCompare('200') === 0) {
          let data = res.data;
          let accuracyLabel = JSON.stringify(data.final_credibility).replace(/['"]+/g, '').replace(/\s+/g,'_');
          targetButton.hasMisinfo = checkLabelMisinfo(accuracyLabel);
          if (data.assessments) {
            assessments = data.assessments;
          }
          if (targetButton.hasMisinfo) {
            publishTweetAlertMisinfo(accuracyLabel, urls[i], tweetText, assessments);
          }
        }
        else {
          logger.logMessage(CoInformLogger.logTypes.error, `Request unknown (${resStatus}) response`);
        }
        if (i == (urls.length - 1)) {
          publishTweetPostAction(targetButton);
        }

      });

    }

  }
  else {
    publishTweetPostAction(targetButton);
  }

};

const publishTweetPostAction = (targetButton) => {

  // Undo changes to the publish button
  /*let load = targetButton.querySelector('.spinner-border');
  if (load) load.parentNode.removeChild(load);
  targetButton.children[0].style.display = "";*/
  targetButton.removeAttribute("disabled");
  targetButton.removeAttribute("aria-disabled");
  targetButton.coInformed = true;
  let msg = document.getElementById("coinformPublishMessages");
  // Only re-do the clicking if we do not detected misinformation
  if (!targetButton.hasMisinfo) {
    if (msg) msg.parentNode.removeChild(msg);
    targetButton.click();
  }
  else {
    // Attach warning message and change the text of the publish button
    let txt = document.createTextNode(browserAPI.i18n.getMessage("detected_misinfo_content"));
    msg.removeChild(msg.firstChild);
    msg.classList.remove("blink_me");
    msg.append(txt);
    let buttText = browserAPI.i18n.getMessage("publish_anyway");
    targetButton.querySelectorAll("span").forEach(function(elem) {
      elem.childNodes.forEach(function(elem) {
        if (elem.nodeType == Node.TEXT_NODE) {
          elem.parentNode.innerText = buttText;
        }
      });
    });
  }
};

const publishTweetAlertMisinfo = (label, url, tweetText, assessments) => {

  let auxlabel = browserAPI.i18n.getMessage(label);
  if (!auxlabel) auxlabel = label;
  let popupTitle = browserAPI.i18n.getMessage('content_tagged_as', auxlabel);
  let popupButtonText = browserAPI.i18n.getMessage('ok');
  
  log2Server('publish tweet', null, `Tweet content: ${tweetText}\nContent label: ${label}`, `Opened Await misinformation popup when publishing new tweet`);

  let assessmentsHtml = "";
  if (assessments) {
    for (let [key, value] of Object.entries(assessments)) {
      if (value.url) {
        if (!assessmentsHtml) {
          assessmentsHtml += '<span>' + browserAPI.i18n.getMessage('check_assessments_before_publish') + '</span>';
          assessmentsHtml += "<span><ul>";
        }
        assessmentsHtml += '<li><a href="' + value.url + '" target="_blank">' + value.url + '</a></li>'
      }
    }
  }
  if (assessmentsHtml) {
    assessmentsHtml += "</ul></span>";
  }
  else {
    assessmentsHtml = '<span>' + browserAPI.i18n.getMessage('check_content_before_publish') + '</span>';
  }
  Swal2.fire({
    type: 'info',
    title: popupTitle,
    showCloseButton: true,
    showCancelButton: false,
    showConfirmButton: true,
    confirmButtonColor: CoinformConstants.COINFORM_BUTTON_COLOR,
    confirmButtonText: popupButtonText,
    html:
      '<span>' + browserAPI.i18n.getMessage('url_detected_misinformation', auxlabel) + '</span><br/>' +
      '<a href="' + url + '" target="_blank">' + url + '</a><br/><br/>' +
      assessmentsHtml,
    footer:
      `<img class="coinformPopupLogo" src="${minLogoPath}"/>` +
      '<span>' + browserAPI.i18n.getMessage('popup_footer_text') + '</span>',
    focusConfirm: true,
  }).then(function (result) {

    if (result.value) {
      log2Server('publish tweet', null, `Tweet content: ${tweetText}`, 'Click on "ok" on Await misinformation popup'); 

    } else if (result.dismiss) {
      log2Server('publish tweet', null, `Tweet content: ${tweetText}`, 'Click on "close" on Await misinformation popup');
    }

  });
  
};

const publishTweetCountdown = (targetButton, iteration, tweetText) => {
  let msg = document.getElementById("coinformPublishMessages");
  if (msg) {
    if (iteration > 0) {
      msg.querySelector("span").innerText = browserAPI.i18n.getMessage("published_in_seconds", `${iteration}`);
      setTimeout(function() {
        publishTweetCountdown(targetButton, (iteration - 1), tweetText);
      }, 1000);
    }
    else {
      targetButton.hasMisinfo = false;
      targetButton.removeAttribute("disabled");
      targetButton.removeAttribute("aria-disabled");
      msg.parentNode.removeChild(msg);
      targetButton.click();
      // Countdown finished
      log2Server('publish tweet', null, `Tweet content: ${tweetText}`, 'New tweet published after Await countdown finished');
    }
  }
  else {
    log2Server('publish tweet', null, `Tweet content: ${tweetText}`, 'Await countdown interrupted. New tweet not published');
  }
};

const retweetTweetCallback = (clickEvent, targetButton) => {

  // click situation when we already procesed the tweet
  if (targetButton.coInformed) {
    targetButton.coInformed = false;
    logger.logMessage(CoInformLogger.logTypes.debug, `Retweet button procesed!!`);
    return true;
  }

  // prevent the submiting of the tweet
  clickEvent.stopImmediatePropagation();
  clickEvent.preventDefault();
  clickEvent.stopPropagation();

  logger.logMessage(CoInformLogger.logTypes.debug, `Retweet button clicked!!`);

  // get tweet
  let tweet = targetButton.closest("article");

  targetButton.coInformed = true;

  if (tweet.coInformLabel) {
    logger.logMessage(CoInformLogger.logTypes.info, `Retweet Tweet Label: ${tweet.coInformLabel}`);
  }

  targetButton.isMisinfo = checkLabelMisinfo(tweet.coInformLabel);
  if (targetButton.isMisinfo) {
    // check user option that disables await nudging action is not set to false
    if (!(configuration.coinform.options.config && configuration.coinform.options.config.await && (configuration.coinform.options.config.await.localeCompare("false") === 0))) {
      retweetTweetAlertMisinfo(tweet, tweet.coInformLabel);
    }
    else {
      targetButton.click();
    }
  }
  else {
    targetButton.click();
  }

};

const retweetTweetAlertMisinfo = (tweet, label) => {

  let auxlabel = browserAPI.i18n.getMessage(label);
  if (!auxlabel) auxlabel = label;
  let popupTitle = browserAPI.i18n.getMessage('content_tagged_as', auxlabel);
  let popupButtonText = browserAPI.i18n.getMessage('ok');
  
  log2Server('retweet', tweet.coInformTweetUrl, `Tweet id: ${tweet.coInformTweetId}\nTweet label: ${tweet.coInformLabel}`, `Retweet misinformation popup opened`);

  Swal2.fire({
    type: 'info',
    title: popupTitle,
    showCloseButton: true,
    showCancelButton: false,
    confirmButtonColor: CoinformConstants.COINFORM_BUTTON_COLOR,
    confirmButtonText: popupButtonText,
    html:
      '<span>' + browserAPI.i18n.getMessage('content_tagged_as', auxlabel) + '</span><br/>'+
      '<span>' + browserAPI.i18n.getMessage('check_content_before_publish') + '</span>',
    footer:
      `<img class="coinformPopupLogo" src="${minLogoPath}"/>` +
      '<span>' + browserAPI.i18n.getMessage('popup_footer_text') + '</span>',
    focusConfirm: true,
  }).then(function (result) {

    if (result.value) {
      log2Server('retweet', tweet.url, `Tweet id: ${tweet.id}\nTweet label: ${tweet.coInformLabel}`, 'Click on "ok" on retweet misinformation popup'); 

    } else if (result.dismiss) {
      log2Server('retweet', tweet.url, `Tweet id: ${tweet.id}\nTweet label: ${tweet.coInformLabel}`, 'Click on "close" on retweet misinformation popup');
    }
    
  });
  
};

const likeTweetCallback = (clickEvent, targetButton) => {

  logger.logMessage(CoInformLogger.logTypes.debug, `Like button clicked!!`);

  // get tweet
  let tweet = targetButton.closest("article");

  if (tweet.coInformLabel) {
    log2Server('like', tweet.coInformTweetUrl, `Tweet id: ${tweet.coInformTweetId}\nTweet label: ${tweet.coInformLabel}`, 'Click on "like" tweet');
    logger.logMessage(CoInformLogger.logTypes.info, `Like Tweet Label: ${tweet.coInformLabel}`);
  }

  let isMisinfo = checkLabelMisinfo(tweet.coInformLabel);
  if (isMisinfo) {
    logger.logMessage(CoInformLogger.logTypes.info, `Like Tweet Misinfo Label: ${tweet.coInformLabel}`);
  }

};

const unlikeTweetCallback = (clickEvent, targetButton) => {

  logger.logMessage(CoInformLogger.logTypes.debug, `Unlike button clicked!!`);

  // get tweet
  let tweet = targetButton.closest("article");

  if (tweet.coInformLabel) {
    log2Server('like', tweet.coInformTweetUrl, `Tweet id: ${tweet.coInformTweetId}\nTweet label: ${tweet.coInformLabel}`, 'Click on "unlike" tweet');
    logger.logMessage(CoInformLogger.logTypes.info, `Unlike Tweet Label: ${tweet.coInformLabel}`);
  }

  let isMisinfo = checkLabelMisinfo(tweet.coInformLabel);
  if (isMisinfo) {
    logger.logMessage(CoInformLogger.logTypes.info, `Unlike Tweet Misinfo Label: ${tweet.coInformLabel}`);
  }

};

const checkLabelMisinfo = (label) => {
  let isMisInfo = false;
  if (label) {
    let labelCategory = configuration.coinform.categories[label];
    if (!labelCategory) {
      logger.logMessage(CoInformLogger.logTypes.warning, `Unexpected Label: ${label}`);
    }
    else if (labelCategory.action.localeCompare("blur") === 0) {
      isMisInfo = true;
    }
  }
  return isMisInfo;
};

const newTweetCallback = (tweetInfo) => {

  if (!tweetInfo.id) {
    // Detected tweet id NULL case, normally found when the Tweet is advertisment, or promoted
    logger.logMessage(CoInformLogger.logTypes.warning, `Tweet with no ID found`);
    return;
  }

  if (!tweetInfo.domObject.coInfoAnalyzed) {
    tweetInfo.domObject.coInfoAnalyzed = false;
  }

  // If the tweet has already been analyzed then skip
  if (tweetInfo.domObject.coInfoAnalyzed) {
    logger.logMessage(CoInformLogger.logTypes.debug, `Already treated tweet object`, tweetInfo.id);
    return;
  }
  
  if (!pluginCache[tweetInfo.id]) {
    pluginCache[tweetInfo.id] = {};
    pluginCache[tweetInfo.id].feedback = {};
    if (Object.keys(pluginCache).length > CoinformConstants.PLUGIN_CACHE_SIZE) {
      freePluginCache();
    }

  }

  if (!tweetInfo.domObject.hasToolbar) {
    let toolbar = createToolbar(tweetInfo);
    tweetInfo.domObject.prepend(toolbar);
    tweetInfo.domObject.hasToolbar = true;
  } else {
    logger.logMessage(CoInformLogger.logTypes.debug, `Toolbar already inserted`, tweetInfo.id);
  }

  // If the tweet has already been tagged then we directly classify it
  if (pluginCache[tweetInfo.id].status) {
    logger.logMessage(CoInformLogger.logTypes.debug, `Already analyzed tweet`, tweetInfo.id);
    pluginCache[tweetInfo.id].lastTime = Math.round(Date.now() / 1000);
    tweetInfo.domObject.queryStatus = pluginCache[tweetInfo.id].status;
    tweetInfo.domObject.queryId = pluginCache[tweetInfo.id].queryId;
    if (pluginCache[tweetInfo.id].label) {
      classifyTweet(tweetInfo, pluginCache[tweetInfo.id].label, pluginCache[tweetInfo.id].modules);
      if (pluginCache[tweetInfo.id].feedback) {
        let feedbackObject = pluginCache[tweetInfo.id].feedback;
        setLabelEvaluation(tweetInfo, feedbackObject);
      }
    }
    if (pluginCache[tweetInfo.id].status == "done") {
      tweetInfo.domObject.coInfoAnalyzed = true;
      finalizeTweetClassify(tweetInfo, 'done');
      return;
    }
  }

  tweetInfo.domObject.coInfoCounter = 0;

  // First API call to the GW endpoint /twitter/tweet/
  browserAPI.runtime.sendMessage({
    messageId: "CheckTweetInfo",
    id: tweetInfo.id,
    username: tweetInfo.username,
    text: tweetInfo.text,
    coinformUserID: coinformUserID,
    userToken: coinformUserToken
  }, function (res) {
    let resStatus = JSON.stringify(res.status).replace(/['"]+/g, '');
    
    // Hack to force misinformation tweet detection
    // Active only in test use mode
    if ((configuration.coinform.options.testMode.localeCompare("true") === 0) && (tweetInfo.username.toLowerCase().localeCompare(CoinformConstants.MISINFO_TEST_TW_USERNAME.toLowerCase()) === 0)) {
      parseApiResponse(misinfoApiQueryResp, tweetInfo);
    }

    else if ((resStatus.localeCompare('400') === 0)) {
      logger.logMessage(CoInformLogger.logTypes.error, `Request 400 (invalid input) response (${tweetInfo.domObject.coInfoCounter})`, tweetInfo.id);
    }
    else if (resStatus.localeCompare('200') === 0) {
      parseApiResponse(res.data, tweetInfo);
    }
    else {
      logger.logMessage(CoInformLogger.logTypes.error, `Request unknown (${resStatus}) response (${tweetInfo.domObject.coInfoCounter})`, tweetInfo.id);
    }
  });

};

const createToolbar = (tweetInfo) => {

  let tbl = document.createElement('table');
  tbl.classList.add("coinformToolbar");

  if (inDarkMode) {
    tbl.classList.add("darkMode");
  }
  
  tbl.addEventListener('click', (event) => { 
    // prevent opening the tweet
    event.stopImmediatePropagation();
    event.preventDefault();
    event.stopPropagation();
  });
  
  let tr = tbl.insertRow();

  let td1 = tr.insertCell();
  td1.classList.add("coinformToolbarLogoContent");
  td1.appendChild(createLogoCoinform(tweetInfo.id));

  let td2 = tr.insertCell();
  td2.classList.add("coinformToolbarLabelContent");
  td2.setAttribute("id", `coinformToolbarLabelContent-${tweetInfo.id}`);

  let statusContent = document.createElement("DIV");
  statusContent.classList.add("coinformStatus");
  let statusIcon = document.createElement("DIV");
  statusIcon.classList.add("coinformStatusIcon");
  statusIcon.classList.add("coinformStatusLoading");
  statusContent.appendChild(statusIcon);
  td2.appendChild(statusContent);

  let tooltipStatus = document.createElement("DIV");
  tooltipStatus.classList.add("coinformStatusTooltip");
  tooltipStatus.textContent = browserAPI.i18n.getMessage("processing_labeling");
  statusContent.appendChild(tooltipStatus);

  let arrowContent = document.createElement("DIV");
  arrowContent.classList.add("coinformRelationArrow");
  td2.appendChild(arrowContent);

  let td3 = tr.insertCell();
  td3.setAttribute("id", `coinformToolbarFeedback-${tweetInfo.id}`);
  
  td3.appendChild(createLogoClaim(tweetInfo, function () {
    claimClickAction(tweetInfo);
  }));
  td3.classList.add("coinformToolbarButton");
  td3.classList.add("coinformToolbarClaim");
  
  let claimDescription = document.createElement("SPAN");
  claimDescription.classList.add("coinformToolbarButtonDescription");
  let claimText = document.createTextNode(browserAPI.i18n.getMessage('make_claim'));
  claimDescription.append(claimText);
  td3.appendChild(claimDescription);
  
  td3.addEventListener('click', (event) => { 
    // prevent opening the tweet
    event.stopImmediatePropagation();
    event.preventDefault();
    event.stopPropagation();
    claimClickAction(tweetInfo);
  });

  let td4 = tr.insertCell();
  td4.setAttribute("id", `coinformToolbarFeedbackNegative-${tweetInfo.id}`);

  td4.appendChild(createLogoNegativeFeedback(tweetInfo, function () {
    feedbackClickAction(td4, tweetInfo, "disagree");
  }));

  let negativeFeedbackAgg = document.createElement("SPAN");
  negativeFeedbackAgg.classList.add("coinformFeedbackAgg");
  td4.appendChild(negativeFeedbackAgg);

  let negativeFeedbackDescription = document.createElement("SPAN");
  negativeFeedbackDescription.classList.add("coinformToolbarButtonDescription");
  let negativeFeedbackText = document.createTextNode(browserAPI.i18n.getMessage('negative_feedback'));
  negativeFeedbackDescription.append(negativeFeedbackText);
  td4.appendChild(negativeFeedbackDescription);
  td4.classList.add("coinformToolbarButton");
  td4.classList.add("coinformToolbarFeedbackNegative");

  td4.addEventListener('click', (event) => { 
    // prevent opening the tweet
    event.stopImmediatePropagation();
    event.preventDefault();
    event.stopPropagation();
    feedbackClickAction(td4, tweetInfo, "disagree");
  });

  let td5 = tr.insertCell();
  td5.setAttribute("id", `coinformToolbarFeedbackPositive-${tweetInfo.id}`);

  td5.appendChild(createLogoPositiveFeedback(tweetInfo, function () {
    feedbackClickAction(td5, tweetInfo, "agree");
  }));

  let positiveFeedbackAgg = document.createElement("SPAN");
  positiveFeedbackAgg.classList.add("coinformFeedbackAgg");
  td5.appendChild(positiveFeedbackAgg);

  let positiveFeedbackDescription = document.createElement("SPAN");
  positiveFeedbackDescription.classList.add("coinformToolbarButtonDescription");
  let positiveFeedbackText = document.createTextNode(browserAPI.i18n.getMessage('positive_feedback'));
  positiveFeedbackDescription.append(positiveFeedbackText);
  td5.appendChild(positiveFeedbackDescription);
  td5.classList.add("coinformToolbarButton");
  td5.classList.add("coinformToolbarFeedbackPositive");

  td5.addEventListener('click', (event) => { 
    // prevent opening the tweet
    event.stopImmediatePropagation();
    event.preventDefault();
    event.stopPropagation();
    feedbackClickAction(td5, tweetInfo, "agree");
  });

  return tbl;
};

const createLogoClaim = (tweet, callback) => {

  let claim = document.createElement("IMG");
  claim.setAttribute("id", `coinformToolbarClaim-${tweet.id}`);
  claim.classList.add("coinformClaimLogo");
  claim.setAttribute("src", claimIconPath);

  claim.addEventListener('click', (event) => {
    // prevent opening the tweet
    event.stopImmediatePropagation();
    event.preventDefault();
    event.stopPropagation();
    callback();
  });

  return claim;
};

const createLogoPositiveFeedback = (tweet, callback) => {

  let agree = document.createElement("IMG");
  agree.setAttribute("id", `coinformPositiveLogo-${tweet.id}`);
  agree.classList.add("coinformFeedbackLogo");
  agree.setAttribute("src", agreeIconPath);

  agree.addEventListener('click', (event) => {
    // prevent opening the tweet
    event.stopImmediatePropagation();
    event.preventDefault();
    event.stopPropagation();
    callback();
  });

  return agree;
};

const createLogoNegativeFeedback = (tweet, callback) => {

  let disagree = document.createElement("IMG");
  disagree.setAttribute("id", `coinformNegativeLogo-${tweet.id}`);
  disagree.classList.add("coinformFeedbackLogo");
  disagree.setAttribute("src", disagreeIconPath);

  disagree.addEventListener('click', (event) => {
    // prevent opening the tweet
    event.stopImmediatePropagation();
    event.preventDefault();
    event.stopPropagation();
    callback();
  });

  return disagree;
};

const createLogoCoinform = (tweetId) => {

  let img = document.createElement("IMG");
  img.classList.add("coinformToolbarLogo");
  img.setAttribute("id", `coinformToolbarLogo-${tweetId}`);
  img.setAttribute("src", coinformLogoPath);

  img.addEventListener('click', (event) => {
    // prevent opening the tweet
    event.stopImmediatePropagation();
    event.preventDefault();
    event.stopPropagation();
  });

  return img;
};

const retryTweetQuery = (tweetInfo, queryId) => {

  if (tweetInfo.domObject.coInfoCounter === undefined) {
    tweetInfo.domObject.coInfoCounter = 0;
  }

  if (tweetInfo.domObject.offsetParent === null) {

    logger.logMessage(CoInformLogger.logTypes.debug, `Tweet DOM obj disapeared. Stop requests.`, tweetInfo.id);
    return false;
    
  }
  else if (tweetInfo.domObject.coInfoCounter > CoinformConstants.MAX_RETRIES) {

    logger.logMessage(CoInformLogger.logTypes.warning, `MAX retries situation (${tweetInfo.domObject.coInfoCounter}). Giving up on tweet.`, tweetInfo.id);
    if ((tweetInfo.domObject.queryStatus.localeCompare('done') === 0) || (tweetInfo.domObject.queryStatus.localeCompare('partly_done') === 0)) {
      finalizeTweetClassify(tweetInfo, tweetInfo.domObject.queryStatus);
    }
    else {
      finalizeTweetClassify(tweetInfo, "timeout");
    }
    return false;

  }
  else {

    tweetInfo.domObject.coInfoCounter++;

    // Retry API call to the GW endpoint /response/${queryId}/
    browserAPI.runtime.sendMessage({
      messageId: "RetryAPIQuery",
      queryId: queryId
    }, function(res) {

      let resStatus = JSON.stringify(res.status).replace(/['"]+/g, '');

      if ((resStatus.localeCompare('404') === 0)) {
        logger.logMessage(CoInformLogger.logTypes.error, `Request 404 (no such query) response (${tweetInfo.domObject.coInfoCounter})`, tweetInfo.id);
      }
      else if (resStatus.localeCompare('200') === 0) {
        parseApiResponse(res.data, tweetInfo);
      }
      else {
        logger.logMessage(CoInformLogger.logTypes.error, `Request unknown (${resStatus}) response (${tweetInfo.domObject.coInfoCounter})`, tweetInfo.id);

        // Call retry in random (between 0.5 and 2.5) seconds
        setTimeout(function() {
          retryTweetQuery(tweetInfo, queryId);
        }, randomInt(500, 2500));
      }

    });

  }

};

const parseApiResponse = (data, tweetInfo) => {

  let resStatus = JSON.stringify(data.status).replace(/['"]+/g, '');
  let credibilityLabel = null;
  let credibilityModules = null;

  logger.logMessage(CoInformLogger.logTypes.debug, `${resStatus} response (${tweetInfo.domObject.coInfoCounter})`, tweetInfo.id);

  tweetInfo.domObject.coInformTweetId = tweetInfo.id;
  tweetInfo.domObject.coInformTweetUrl = tweetInfo.url;
  tweetInfo.domObject.queryStatus = resStatus;
  tweetInfo.domObject.queryId = data.query_id;

  // If the result ststus is "done" or "partly_done", then we can classify (final or temporary, respectively) the tweet
  if (resStatus && ((resStatus.localeCompare('done') === 0) || (resStatus.localeCompare('partly_done') === 0))) {
    // Result from API call
    credibilityLabel = JSON.stringify(data.response.rule_engine.final_credibility).replace(/['"]+/g, '').replace(/\s+/g, '_');
    let moduleExplanations = null;
    if (data.response.rule_engine.module_explanations) {
      moduleExplanations = data.response.rule_engine.module_explanations;
    }
    credibilityModules = parseModulesValues(data.response.rule_engine.module_labels, data.response.rule_engine.module_values, moduleExplanations);
    classifyTweet(tweetInfo, credibilityLabel, credibilityModules);
    let feedbackObject = null;
    if (data.response["(dis)agreement_feedback"] && data.response["(dis)agreement_feedback"][credibilityLabel]) {
      feedbackObject = data.response["(dis)agreement_feedback"][credibilityLabel];
      setLabelEvaluation(tweetInfo, feedbackObject);
    }
  }

  // Save/replace tweet analyzed status
  pluginCache[tweetInfo.id].status = resStatus;
  pluginCache[tweetInfo.id].queryId = data.query_id;
  pluginCache[tweetInfo.id].label = credibilityLabel;
  pluginCache[tweetInfo.id].modules = credibilityModules;
  pluginCache[tweetInfo.id].lastTime = Math.round(Date.now() / 1000);

  if (resStatus && (resStatus.localeCompare('done') === 0)) {
    tweetInfo.domObject.coInfoAnalyzed = true;
    finalizeTweetClassify(tweetInfo, 'done');
  }
  else {
    // If the result status has not reached the 'done' status then make a second API call to retrieve the 
    // result with a maximum of 10 retries
    // Call retry in random (between 1 and 2.5) seconds
    setTimeout(function() {
      retryTweetQuery(tweetInfo, data.query_id);
    }, randomInt(1000, 2500));
  }
  
};

const parseModulesValues = (moduleLabels, moduleValues, moduleExplanations) => {
  let credibilityModules = {};

  if (moduleLabels) {
    for (let [key, value] of Object.entries(moduleLabels)) {
      let conf = null;
      let cred = null;
      let expFormat = null;
      let expContent = null;
      if (moduleValues && moduleValues[key] && (moduleValues[key].confidence != null)) conf = parseFloat(moduleValues[key].confidence).toFixed(2);
      if (moduleValues && moduleValues[key] && (moduleValues[key].credibility != null)) cred = parseFloat(moduleValues[key].credibility).toFixed(2);
      if (moduleExplanations && moduleExplanations[key] && (moduleExplanations[key].rating_explanation_format != null)) expFormat = moduleExplanations[key].rating_explanation_format;
      if (moduleExplanations && moduleExplanations[key] && (moduleExplanations[key].rating_explanation != null)) expContent = moduleExplanations[key].rating_explanation;
      credibilityModules[key] = {
        label: value,
        confidence: conf,
        credibility: cred,
        explanationFormat: expFormat,
        explanation: expContent
      }
    }
  }

  return credibilityModules;
};

const newFacebookPostCallback = (post) => {

  /*if (post.links.length > 0) {
    // Just for the proof of concept, use Twitter's score (even though we're in Facebook)
    client.getTwitterUserScore(post.username)
      .then(res => {

        classifyFbPost(post, res);

      })
      .catch(err => {
        logger.logMessage(CoInformLogger.logTypes.error, `Request error: ${err}`);
        //console.error(err)
      });
  }*/

};

const classifyFbPost = (post, score) => {

  /*const misinformationScore = score.misinformationScore;
  const dom = post.domObject;

  $(dom.find('._3ccb')[0]).css('opacity', `${1 - misinformationScore / 100}`);
  dom.prepend(createWhyButton(score, 'post', true));*/

};

const classifyTweet = (tweet, credibilityLabel, credibilityModules) => {

  const node = tweet.domObject;

  if (!node.coInformLabel || (node.coInformLabel.localeCompare(credibilityLabel) !== 0)) {

    removeTweetLabel(tweet);
    if (node.coInformLabel) {
      logger.logMessage(CoInformLogger.logTypes.info, `ReClassifying Tweet Label: ${node.coInformLabel} -> ${credibilityLabel}`, tweet.id);
      // check if it was blurred
      let previousCategory = configuration.coinform.categories[node.coInformLabel];
      if (previousCategory && (previousCategory.action.localeCompare("blur") === 0)) {
        removeTweetBlurry(tweet);
      }
      // remove feedback as label changed
      let auxPrevious = tweet.domObject.querySelector(".coinformToolbarFeedbackAfterClick");
      if (auxPrevious || pluginCache[tweet.id].feedback.user_feedback) {
        // eslint-disable-next-line camelcase
        pluginCache[tweet.id].feedback.user_feedback = null;
        auxPrevious.classList.remove("coinformToolbarFeedbackAfterClick");
      }
    }
    else {
      logger.logMessage(CoInformLogger.logTypes.info, `Classifying Tweet label: ${credibilityLabel}`, tweet.id);
    }

    node.coInformLabel = credibilityLabel;
    node.coInformModules = credibilityModules;

    createTweetLabel(tweet, credibilityLabel, credibilityModules, function() {
      openLabelPopup(tweet);
      let auxScoresLog = createModulesCredibilityScoresLog(credibilityModules);
      log2Server('explainability', tweet.url, `Tweet id: ${tweet.id}\nTweet label: ${credibilityLabel}\nCredibility Scores: ${auxScoresLog}`, 'Opened explainability popup through label click');
    });

    let newCategory = configuration.coinform.categories[credibilityLabel];
    if (!newCategory) {
      logger.logMessage(CoInformLogger.logTypes.warning, `Unexpected Label: ${credibilityLabel}`, tweet.id);
    }
    else if (newCategory.action.localeCompare("blur") === 0) {
      // check user option that disables blur nudging action is not set to false
      if (!(configuration.coinform.options.config && configuration.coinform.options.config.blur && (configuration.coinform.options.config.blur.localeCompare("false") === 0))) {
        createTweetBlurry(tweet);
      }
    }

  }

};

const finalizeTweetClassify = (tweet, status) => {

  let node = tweet.domObject.querySelector(`.coinformStatus`);

  let iconNode = node.querySelector(`.coinformStatusIcon`);

  iconNode.classList.remove("coinformStatusLoading");
  iconNode.classList.remove("coinformStatusDone");
  iconNode.classList.remove("coinformStatusUnDone");

  let subNode = node.querySelector(`.coinformStatusTooltip`);
  if (status.localeCompare('done') === 0) {
    iconNode.classList.add("coinformStatusDone");
    subNode.textContent = browserAPI.i18n.getMessage("labeling_done");
  }
  else if (status.localeCompare('partly_done') === 0) {
    iconNode.classList.add("coinformStatusUnDone");
    subNode.textContent = browserAPI.i18n.getMessage("labeling_partly_done");
  }
  else if (status.localeCompare('timeout') === 0) {
    iconNode.classList.add("coinformStatusUnDone");
    subNode.textContent = browserAPI.i18n.getMessage("labeling_timeout");
  }
  else {
    iconNode.classList.add("coinformStatusUnDone");
    subNode.textContent = browserAPI.i18n.getMessage("labeling_undone");
  }

};

const createTweetBlurry = (tweet) => {

  let node = tweet.domObject;
  node.setAttribute(parser.untrustedAttribute, 'true');

  let buttonContainer = createCannotSeeTweetButton(tweet, function() {
    openLabelPopup(tweet);
    let auxScoresLog = createModulesCredibilityScoresLog(node.coInformModules);
    log2Server('explainability', tweet.url, `Tweet id: ${tweet.id}\nTweet label: ${node.coInformLabel}\nCredibility Scores: ${auxScoresLog}`, 'Opened explainability popup through "why cannot see" button');
  });

  node.querySelector("article > div").append(buttonContainer);

};

const removeTweetBlurry = (tweet) => {

  let node = tweet.domObject;
  node.removeAttribute(parser.untrustedAttribute);

  let auxPrevious = null;
  auxPrevious = node.querySelector(`#whyButton-${tweet.id}`);
  if (auxPrevious) {
    auxPrevious.remove();
  }
  auxPrevious = node.querySelector(`#feedback-button-container-${tweet.id}`);
  if (auxPrevious) {
    auxPrevious.remove();
  }

};

const isBlurred = (tweet) => {

  let node = tweet.domObject;
  let attrVal = node.getAttribute(parser.untrustedAttribute);
  return (attrVal === 'true');

};

const createTweetLabel = (tweet, label, modules, callback) => {

  let node = tweet.domObject;
  let toolbarNode = node.querySelector(`#coinformToolbarLabelContent-${tweet.id}`);

  // create the label inside the toolbar
  let labelcat = document.createElement("SPAN");
  labelcat.setAttribute("id", `coinformToolbarLabel-${tweet.id}`);
  labelcat.setAttribute("class", "coinformToolbarLabel");
  let auxLabel = browserAPI.i18n.getMessage(label);
  if (!auxLabel) auxLabel = label;
  let txt = document.createTextNode(auxLabel);
  labelcat.append(txt);
  let labelCategory = configuration.coinform.categories[label];
  if (labelCategory && labelCategory.labelColor) {
    labelcat.style.color = labelCategory.labelColor;
  }

  labelcat.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    callback();
  });

  toolbarNode.append(labelcat);

  // create a info logo
  let infoContent = document.createElement("DIV");
  infoContent.setAttribute("id", `coinformLabelInfoContent-${tweet.id}`);
  infoContent.setAttribute("class", "coinformLabelInfoContent");
  let infoLogo = document.createElement("IMG");
  infoLogo.setAttribute("id", `coinformLabelInfoLogo-${tweet.id}`);
  infoLogo.setAttribute("class", "coinformLabelInfoLogo");
  infoLogo.setAttribute("src", infoIconPath);
  infoContent.append(infoLogo);
  
  let auxHoverTime = null;
  //let auxScoresLog = createModulesCredibilityScoresLog(modules);

  infoLogo.addEventListener("mouseenter", (event) => {
    openLabelInfoTooltip(event, tweet, label, modules);
    auxHoverTime = Date.now();
    log2Server('explainability', tweet.url, `Tweet id: ${tweet.id}\nTweet label: ${label}`, 'Opened explainability tooltip on hover');
  });

  infoLogo.addEventListener("mouseleave", (event) => {
    closeLabelInfoTooltip(event, tweet);
    let auxHoverSpentTime = "?";
    if (auxHoverTime) {
      auxHoverSpentTime = Math.round((Date.now() - auxHoverTime) / 1000);
    }
    auxHoverTime = null;
    log2Server('explainability', tweet.url, `Tweet id: ${tweet.id}\nTweet label: ${label}`, `Closed explainability tooltip on hover out\nTooltip time spent: ${auxHoverSpentTime} sec`);
  });

  infoContent.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
  });

  toolbarNode.append(infoContent);
  
  let arrowContent = document.createElement("DIV");
  arrowContent.classList.add("coinformRelationArrow");
  toolbarNode.appendChild(arrowContent);

};

const createModulesCredibilityScoresLog = (modules) => {
  let resTxt = null;
  if (modules) {
    resTxt = ''
    for (let [key, value] of Object.entries(modules)) {
      let moduleName = browserAPI.i18n.getMessage(key);
      resTxt = resTxt + `\n${moduleName}: `;
      if (modules[key].credibility != null) resTxt = resTxt + `${modules[key].credibility} credibility`;
      if (modules[key].confidence != null) {
        let moduleConfidence = Math.round(parseFloat(modules[key].confidence) * 100);
        resTxt = resTxt + ` (${moduleConfidence}% confidence)`;
      }
    }
  }
  return resTxt;
};

const createLabelTooltipInfoContent = (label) => {

  let shortInfoContent = document.createElement("DIV");
  shortInfoContent.setAttribute("class", "coinformAnalysisExplainability");
  let shortInfoText = document.createElement("SPAN");
  let auxLabel = browserAPI.i18n.getMessage(label);
  if (!auxLabel) auxLabel = label;
  let textHtml = browserAPI.i18n.getMessage('content_tagged_with__html', [auxLabel]);
  shortInfoText.innerHTML = textHtml;
  shortInfoContent.append(shortInfoText);

  let shortInfoPart2 = document.createElement("SPAN");
  let shortInfoPart2Txt = document.createTextNode(browserAPI.i18n.getMessage('coinfomr_plugin_check_content_description'));
  shortInfoPart2.append(shortInfoPart2Txt);
  shortInfoContent.append(shortInfoPart2);
  
  let shortInfoMoreinfo = document.createElement("SPAN");
  shortInfoMoreinfo.setAttribute("class", "coinformAnalysisPopupInfo");
  let moreinfoTxt = document.createTextNode(browserAPI.i18n.getMessage('click_label_for_more_info'));
  shortInfoMoreinfo.append(moreinfoTxt);
  shortInfoContent.append(shortInfoMoreinfo);

  return shortInfoContent;

};

const createLabelModulesExplainabilityContent = (label, modules) => {

  let explainInfoContent = document.createElement("DIV");
  explainInfoContent.setAttribute("class", "coinformAnalysisExplainability");
  let explainInfoText = document.createElement("SPAN");
  let auxLabel = browserAPI.i18n.getMessage(label);
  if (!auxLabel) auxLabel = label;
  let textHtml = browserAPI.i18n.getMessage('content_tagged_by__html', [auxLabel, Object.keys(modules).length]);
  explainInfoText.innerHTML = textHtml;
  explainInfoContent.append(explainInfoText);

  let explainInfoPart2 = document.createElement("SPAN");
  let explainInfoPart2Txt1 = document.createTextNode(browserAPI.i18n.getMessage('modules_check_description'));
  explainInfoPart2.append(explainInfoPart2Txt1);
  let notVerifiableTxt = browserAPI.i18n.getMessage('not_verifiable');
  let explainInfoPart2Txt2 = document.createTextNode(browserAPI.i18n.getMessage('not_verifiable_case_description', notVerifiableTxt));
  explainInfoPart2.append(document.createTextNode(" "));
  explainInfoPart2.append(explainInfoPart2Txt2);
  explainInfoContent.append(document.createElement("BR"));
  explainInfoContent.append(explainInfoPart2);

  let explainInfoPart3 = document.createElement("SPAN");
  let explainInfoPart3Txt = browserAPI.i18n.getMessage('more_generic_analysis_info__html', CoinformConstants.ANALYSIS_INFO_URL);
  explainInfoPart3.innerHTML = explainInfoPart3Txt;
  explainInfoContent.append(document.createElement("BR"));
  explainInfoContent.append(explainInfoPart3);

  if (modules && (Object.keys(modules).length > 0)) {

    let explainInfoPart4 = document.createElement("SPAN");
    let specificallyTxt = document.createTextNode(browserAPI.i18n.getMessage('specifically'));
    explainInfoPart4.append(specificallyTxt);
    explainInfoContent.append(document.createElement("BR"));
    explainInfoContent.append(explainInfoPart4);

    let explainInfoList = document.createElement("UL");

    for (let [key, value] of Object.entries(modules)) {
      let explainInfoListItem = document.createElement("LI");
      explainInfoListItem.setAttribute("class", "coinformAnalysisModuleInfo");
      let explainInfoItemContent = document.createElement("SPAN");

      let moduleName = browserAPI.i18n.getMessage(key);
      let moduleBased = browserAPI.i18n.getMessage(`${key}_based_info`);
      let clickMoreInfo = browserAPI.i18n.getMessage(`click_more_info`);
      let moduleUrl = "#";
      if (CoinformConstants.MODULES_INFO_URLS[key.toUpperCase()]) {
        moduleUrl = CoinformConstants.MODULES_INFO_URLS[key.toUpperCase()];
      }
      let moduleAnalysisInfoHtml = browserAPI.i18n.getMessage('module_analysis_long_info__html', [moduleName, moduleBased, moduleUrl, clickMoreInfo]);

      let moduleLabelTxt = browserAPI.i18n.getMessage(modules[key].label);
      let moduleCredibility = '?';
      if (modules[key].credibility != null) moduleCredibility = modules[key].credibility;
      let moduleConfidence = '?';
      if (modules[key].confidence != null) moduleConfidence = Math.round(parseFloat(modules[key].confidence) * 100);
      let moduleAnalysisValuesHtml = browserAPI.i18n.getMessage('module_analysis_result__html', [moduleLabelTxt, moduleCredibility, moduleConfidence]);

      let moduleExplainabilityHtml = null;
      if (modules[key].explanationFormat != null) {
        if (modules[key].explanationFormat.localeCompare('text') === 0) {
          moduleExplainabilityHtml = '<details class="coinformAnalysisMoreInfo"><summary>' + browserAPI.i18n.getMessage('module_explainability_text') + '</summary><p>' + modules[key].explanation + '</p></details>';
        }
        else if ((modules[key].explanationFormat.localeCompare('link') === 0) || (modules[key].explanationFormat.localeCompare('url') === 0)) {
          moduleExplainabilityHtml = '<span class="coinformAnalysisMoreInfo">' + browserAPI.i18n.getMessage('module_explainability_link') + ' <a href="' + modules[key].explanation + '"  target="_blank" rel="noopener noreferrer">' + browserAPI.i18n.getMessage('here') + '</a>.</span>';
        }
        else if (modules[key].explanationFormat.localeCompare('markdown') === 0) {
          let ShowDownConverter = new ShowDown.Converter();
          let auxHtmlExplanationHtml = ShowDownConverter.makeHtml(modules[key].explanation);
          moduleExplainabilityHtml = '<details class="coinformAnalysisMoreInfo"><summary>' + browserAPI.i18n.getMessage('module_explainability_text') + '</summary>' + auxHtmlExplanationHtml + '</details>';
        }
      }

      explainInfoItemContent.innerHTML = `${moduleAnalysisInfoHtml}<br>${moduleAnalysisValuesHtml}`;
      if (moduleExplainabilityHtml) {
        explainInfoItemContent.innerHTML = explainInfoItemContent.innerHTML + moduleExplainabilityHtml;
      }

      explainInfoListItem.append(explainInfoItemContent);
      explainInfoList.append(explainInfoListItem);
    }

    explainInfoContent.append(explainInfoList);
  }

  return explainInfoContent;

};

const removeTweetLabel = (tweet) => {

  let node = tweet.domObject;
  let labelNode = node.querySelector(`#coinformToolbarLabelContent-${tweet.id}`);
  labelNode.querySelectorAll('.coinformToolbarLabel').forEach(n => n.remove());
  labelNode.querySelectorAll('.coinformLabelInfoContent').forEach(n => n.remove());
  labelNode.querySelectorAll('.coinformRelationArrow').forEach(n => n.remove());

};

const createCannotSeeTweetButton = (tweet, callback) => {

  const div = document.createElement('DIV');
  div.setAttribute('id', `feedback-button-container-${tweet.id}`);
  div.setAttribute('class', 'feedback-button-container');

  const button = document.createElement('BUTTON');
  button.setAttribute('id', `whyButton-${tweet.id}`);
  button.setAttribute('type', 'button');
  button.setAttribute('class', 'coinform-button coinform-button-primary whyButton');
  button.innerText = browserAPI.i18n.getMessage('why_cant_see');

  div.addEventListener('click', ignoreClick);
  
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    callback();
  });

  div.append(button);

  return div;

};

function openLabelInfoTooltip(event, tweet, label, modules) {

  let layersDiv = document.querySelector('#layers');
  if (!layersDiv) {
    layersDiv = document.querySelector("main");
  }
  
  let oldInfoTooltip = document.getElementById(`coinformLabelInfoTooltip-${tweet.id}`);
  if (oldInfoTooltip) {
    layersDiv.removeChild(oldInfoTooltip);
  }
  
  // create tooltip div with detailed modules info
  let infoTooltip = document.createElement("DIV");
  infoTooltip.setAttribute("id", `coinformLabelInfoTooltip-${tweet.id}`);
  infoTooltip.setAttribute("class", "coinformLabelInfoTooltip");
  //let infoTooltipContent = createLabelModulesInfoContent(label, modules);
  let infoTooltipContent = createLabelTooltipInfoContent(label);
  infoTooltip.append(infoTooltipContent);

  infoTooltip.style.left = (event.pageX + 8) + 'px';
  infoTooltip.style.top = (event.pageY + 8) + 'px';

  layersDiv.append(infoTooltip);

}

function closeLabelInfoTooltip(event, tweet) {

  let layersDiv = document.querySelector('#layers');
  if (!layersDiv) {
    layersDiv = document.querySelector("main");
  }
  
  let infoTooltip = document.getElementById(`coinformLabelInfoTooltip-${tweet.id}`);
  if (infoTooltip) {
    layersDiv.removeChild(infoTooltip);
  }

}

function openLabelPopup(tweet) {

  const elementTxt = browserAPI.i18n.getMessage('post');

  let node = tweet.domObject;
  let isBlurred = isBlurred(tweet);
  let isBlurrable = false;
  let buttonText = "";
  let buttonHtml = "";

  let popupPreTitle = '';
  let popupTitle = browserAPI.i18n.getMessage('not_tagged', elementTxt);
  let moreInfo = document.createElement('DIV');

  //let meterLogoSrc = browserAPI.extension.getURL(CoinformConstants.IMAGES_PATH + CoinformConstants.METER_ICON_NAME);
  let meterLogoSrc = null;

  if (node.coInformLabel) {
    let auxLabel = browserAPI.i18n.getMessage(node.coInformLabel);
    if (!auxLabel) auxLabel = node.coInformLabel;
    popupPreTitle = browserAPI.i18n.getMessage('element_tagged_as', elementTxt);
    popupTitle = auxLabel;
    let auxLabelMoreInfoText = browserAPI.i18n.getMessage(node.coInformLabel + '__info', elementTxt);
    if (auxLabelMoreInfoText) {
      let auxText = document.createElement('SPAN');
      auxText.innerHTML = auxLabelMoreInfoText;
      moreInfo.append(auxText);
    }
    meterLogoSrc = browserAPI.extension.getURL(CoinformConstants.IMAGES_PATH + CoinformConstants.METER_LABEL_ICON_PREFIX + node.coInformLabel + CoinformConstants.METER_LABEL_ICON_EXTENSION);
    moreInfo.append(document.createElement('BR'));

    let auxModules = node.coInformModules;
    let auxContent = createLabelModulesExplainabilityContent(node.coInformLabel, auxModules);
    moreInfo.append(auxContent);

    let category = configuration.coinform.categories[node.coInformLabel];
    isBlurrable = (category && (category.action.localeCompare("blur") === 0));
  }
  else {
    let auxText = document.createElement('SPAN');
    auxText.innerHTML = browserAPI.i18n.getMessage('not_tagged__info', elementTxt);
    moreInfo.append(auxText);
  }

  if (isBlurred) {
    buttonText = browserAPI.i18n.getMessage('see_anyway', elementTxt);
    buttonHtml = '<div class="blur-actions">' +
      '<button type="button" id="blur-unblur-'+tweet.id+'" class="blur-unblur-button swal2-styled">'+buttonText+'</button>' +
    '</div>';
  }
  else if (isBlurrable) {
    buttonText = browserAPI.i18n.getMessage('blur_elem', elementTxt);
    buttonHtml = '<div class="blur-actions">' +
      '<button type="button" id="blur-unblur-'+tweet.id+'" class="blur-unblur-button swal2-styled">'+buttonText+'</button>' +
    '</div>';
  }

  let auxPopupTime = Date.now();

  Swal2.fire({
    type: (meterLogoSrc ? null : 'question'),
    width: 500,
    imageUrl: meterLogoSrc,
    imageHeight: 100,
    title: '<h3 id="swal2-pretitle" class="swal2-title swal2-pretitle">' + popupPreTitle + '</h3>' + 
      '<h2 id="swal2-title" class="swal2-title">' + popupTitle + '</h2>',
    showCloseButton: true,
    showConfirmButton: true,
    confirmButtonColor: CoinformConstants.COINFORM_BUTTON_COLOR,
    confirmButtonText: browserAPI.i18n.getMessage('ok'),
    html:
      buttonHtml +
      moreInfo.outerHTML,
    footer:
      `<img class="coinformPopupLogo" src="${minLogoPath}"/>` +
      '<span>' + browserAPI.i18n.getMessage('popup_footer_text') + '</span>',
    focusConfirm: true
  }).then(function (result) {

    let auxPopupSpentTime = "?";
    if (auxPopupTime) {
      auxPopupSpentTime = Math.round((Date.now() - auxPopupTime) / 1000);
    }
    auxPopupTime = null;

    if (result.value) {      
      log2Server('explainability', tweet.url, `Tweet id: ${tweet.id}\nTweet label: ${node.coInformLabel}`, `Click on explainability popup "ok" button\nPopup time spent: ${auxPopupSpentTime} sec`);
    } else {
      log2Server('explainability', tweet.url, `Tweet id: ${tweet.id}\nTweet label: ${node.coInformLabel}`, `Click on explainability popup "close" button\nPopup time spent: ${auxPopupSpentTime} sec`);
    } 
  });
  
  $(document).on('click', '#blur-unblur-'+tweet.id, function() {

    let auxPopupSpentTime = "?";
    if (auxPopupTime) {
      auxPopupSpentTime = Math.round((Date.now() - auxPopupTime) / 1000);
    }
    auxPopupTime = null;
    
    if (isBlurred) {
      removeTweetBlurry(tweet);
      log2Server('blur', tweet.url, `Tweet id: ${tweet.id}\nTweet label: ${node.coInformLabel}`, `Click on "See tweet post anyway" to unblur tweet\nPopup time spent: ${auxPopupSpentTime} sec`);
    }
    else if (isBlurrable) {
      createTweetBlurry(tweet);
      log2Server('blur', tweet.url, `Tweet id: ${tweet.id}\nTweet label: ${node.coInformLabel}`, `Click on "Blur tweet post again"\nPopup time spent: ${auxPopupSpentTime} sec`);
    }
    
    Swal2.clickConfirm();
  });
}

function feedbackClickAction(targetButton, tweet, agreement) {

  let node = tweet.domObject;

  if (!targetButton.classList.contains("coinformToolbarFeedbackAfterClick")) {

    if (!node.coInformLabel) {
      openNotTaggedFeedbackPopup(tweet);
    }
    else if (!coinformUserToken) {
      openNotLoggedFeedbackPopup(tweet);
    }
    else {
      log2Server('feedback', tweet.url, `Tweet id: ${tweet.id}\nTweet label: ${node.coInformLabel}`, `Click on "${agreement}" feedback button for a "${node.coInformLabel}" tweet`);
      sendLabelEvaluation(targetButton, tweet, agreement);
    }

  }

}

function sendLabelEvaluation(targetButton, tweetInfo, agreement) {

  let ratedCredibility = tweetInfo.domObject.coInformLabel;
  let moduleResponse = tweetInfo.domObject.queryId;

  browserAPI.runtime.sendMessage({
    messageId: "EvaluateLabel",
    id: tweetInfo.id,
    url: tweetInfo.url,
    ratedCredibility: ratedCredibility,
    moduleResponse: moduleResponse,
    agreement: agreement,
    userToken: coinformUserToken
  }, function (res) {
    let resStatus = JSON.stringify(res.status).replace(/['"]+/g, '');

    if (resStatus.localeCompare('200') === 0) {
      logger.logMessage(CoInformLogger.logTypes.info, `Reaction registered successfully`);
      Swal2.fire(browserAPI.i18n.getMessage('sent'), browserAPI.i18n.getMessage("feedback_sent"), 'success');
      updateLabelEvaluation(targetButton, tweetInfo, agreement);
      updateLabelEvaluationAgg(targetButton, tweetInfo, agreement, "add", 1);
      //relaunch both updates to check the updated feedback numbers treshold
      let positiveFeedback = tweetInfo.domObject.querySelector(`#coinformToolbarFeedbackPositive-${tweetInfo.id}`);
      let negativeFeedback = tweetInfo.domObject.querySelector(`#coinformToolbarFeedbackNegative-${tweetInfo.id}`);
      updateLabelEvaluationAgg(positiveFeedback, tweetInfo, "agree", "add", 0);
      updateLabelEvaluationAgg(negativeFeedback, tweetInfo, "disagree", "add", 0);
    } 
    else {
      Swal2.fire(browserAPI.i18n.getMessage('error'), browserAPI.i18n.getMessage('feedback_not_sent'), 'error');
    }

  });

}

function setLabelEvaluation(tweetInfo, feedbackObject) {
  let positiveFeedback = tweetInfo.domObject.querySelector(`#coinformToolbarFeedbackPositive-${tweetInfo.id}`);
  let negativeFeedback = tweetInfo.domObject.querySelector(`#coinformToolbarFeedbackNegative-${tweetInfo.id}`);
  updateLabelEvaluationAgg(positiveFeedback, tweetInfo, "agree", "update", feedbackObject['total_agree']);
  updateLabelEvaluationAgg(negativeFeedback, tweetInfo, "disagree", "update", feedbackObject['total_disagree']);
  if (feedbackObject['user_feedback']) {
    if (feedbackObject['user_feedback'] == 'agree') {
      positiveFeedback.classList.add("coinformToolbarFeedbackAfterClick");
      // eslint-disable-next-line camelcase
      pluginCache[tweetInfo.id].feedback.user_feedback = feedbackObject['user_feedback'];
    }
    else if (feedbackObject['user_feedback'] == 'disagree') {
      negativeFeedback.classList.add("coinformToolbarFeedbackAfterClick");
      // eslint-disable-next-line camelcase
      pluginCache[tweetInfo.id].feedback.user_feedback = feedbackObject['user_feedback'];
    }
  }
}

function updateLabelEvaluation(targetButton, tweetInfo, agreement) {
  if (pluginCache[tweetInfo.id].feedback.user_feedback != undefined) {
    let auxPrevious = tweetInfo.domObject.querySelector(".coinformToolbarFeedbackAfterClick");
    if (auxPrevious) {
      auxPrevious.classList.remove("coinformToolbarFeedbackAfterClick");
    }
    updateLabelEvaluationAgg(auxPrevious, tweetInfo, pluginCache[tweetInfo.id].feedback.user_feedback, "remove", 1);
  }
  targetButton.classList.add("coinformToolbarFeedbackAfterClick");
  // eslint-disable-next-line camelcase
  pluginCache[tweetInfo.id].feedback.user_feedback = agreement;
}

function updateLabelEvaluationAgg(targetButton, tweetInfo, agreement, operation, num) {
  let totalNum = 0;
  if (pluginCache[tweetInfo.id].feedback[`total_${agreement}`] != undefined) {
    totalNum = parseInt(pluginCache[tweetInfo.id].feedback[`total_${agreement}`]);
  }
  if (operation == 'add') totalNum = totalNum + parseInt(num);
  else if (operation == 'remove') totalNum = totalNum - parseInt(num);
  else if (operation == 'update') totalNum = parseInt(num);
  pluginCache[tweetInfo.id].feedback[`total_${agreement}`] = totalNum;

  let totalNumAgree = (pluginCache[tweetInfo.id].feedback[`total_agree`] != undefined) ? parseInt(pluginCache[tweetInfo.id].feedback[`total_agree`]) : 0;
  let totalNumDisagree = (pluginCache[tweetInfo.id].feedback[`total_disagree`] != undefined) ? parseInt(pluginCache[tweetInfo.id].feedback[`total_disagree`]) : 0;

  if ((totalNumAgree < CoinformConstants.FEEDBACK_NUM_SHOW_THRESHOLD) && (totalNumDisagree < CoinformConstants.FEEDBACK_NUM_SHOW_THRESHOLD)) {
    targetButton.querySelector(".coinformFeedbackAgg").innerHTML = '';
  }
  else if (totalNum >= 1) {
    let numTxt = totalNum;
    if (totalNum > 999999) {
      let auxNumTxt = parseFloat(totalNum / 1000000).toFixed(1);
      numTxt = `${auxNumTxt}M`
    }
    else if (totalNum > 999) {
      let auxNumTxt = parseFloat(totalNum / 1000).toFixed(1);
      numTxt = `${auxNumTxt}K`
    }
    targetButton.querySelector(".coinformFeedbackAgg").innerHTML = numTxt;
  }
  else {
    targetButton.querySelector(".coinformFeedbackAgg").innerHTML = '';
  }
  
}

function claimClickAction(tweet) {

  if (coinformUserToken) {
    openClaimPopup(tweet);
  }
  else {
    openNotLoggedClaimPopup(tweet);
  }

}

function openClaimPopup(tweet) {

  const elementTxt = browserAPI.i18n.getMessage('post');

  let node = tweet.domObject;
  let resultDropdown;
  let categoryOptions = {};
  let htmlSelectInputOptions = "<option value>" + browserAPI.i18n.getMessage('choose_claim') + "</option>";

  Object.keys(configuration.coinform.accuracy).forEach(function(key) {
    categoryOptions[key] = browserAPI.i18n.getMessage(key + '__info', elementTxt);
    htmlSelectInputOptions += `\n<option value="${key}">` + categoryOptions[key] + '</option>';
  });

  let popupPreTitle = '';
  let popupTitle = browserAPI.i18n.getMessage('not_tagged', elementTxt);
  let moreInfo = browserAPI.i18n.getMessage('not_tagged__info', elementTxt);
  let provideClaimTitle = browserAPI.i18n.getMessage("provide_claim_title");
  //let provideClaimText = browserAPI.i18n.getMessage("provide_claim_untagged");
  //let provideClaimText1 = browserAPI.i18n.getMessage("provide_claim_text1");
  let provideClaimText2 = browserAPI.i18n.getMessage("provide_claim_text2", elementTxt);

  //let meterLogoSrc = browserAPI.extension.getURL(CoinformConstants.IMAGES_PATH + CoinformConstants.METER_ICON_NAME);
  let meterLogoSrc = null;

  if (node.coInformLabel) {
    let auxlabel = browserAPI.i18n.getMessage(node.coInformLabel);
    if (!auxlabel) auxlabel = node.coInformLabel;
    popupPreTitle = browserAPI.i18n.getMessage('element_tagged_as', elementTxt);
    popupTitle = auxlabel;
    moreInfo = browserAPI.i18n.getMessage(node.coInformLabel + '__info', elementTxt);
    //provideClaimText = browserAPI.i18n.getMessage("provide_claim");
    meterLogoSrc = browserAPI.extension.getURL(CoinformConstants.IMAGES_PATH + CoinformConstants.METER_LABEL_ICON_PREFIX + node.coInformLabel + CoinformConstants.METER_LABEL_ICON_EXTENSION);
  }

  let auxPopupTime = Date.now();

  log2Server('claim', tweet.url, `Tweet id: ${tweet.id}\nTweet label: ${node.coInformLabel}`, `Open claim popup for a "${node.coInformLabel}" tweet`);

  Swal2.fire({
    type: (meterLogoSrc ? null : 'question'),
    imageUrl: meterLogoSrc,
    imageHeight: 100,
    title: '<h3 id="swal2-pretitle" class="swal2-title swal2-pretitle">' + popupPreTitle + '</h3>' + 
      '<h2 id="swal2-title" class="swal2-title">' + popupTitle + '</h2>',
    showCloseButton: true,
    showCancelButton: false,
    confirmButtonColor: CoinformConstants.COINFORM_BUTTON_COLOR,
    confirmButtonText: browserAPI.i18n.getMessage('submit'),
    focusConfirm: true,
    preConfirm: () => {
      let claimOpt = document.getElementById('claim-input-select').value;
      let url = document.getElementById('claim-input-url').value;
      let comment = document.getElementById('claim-input-text').value;
      let factcheck = "false";
      let auxCheck = document.getElementById('claim-input-check').checked;
      if (auxCheck) factcheck = document.getElementById('claim-input-check').value;
      if (!claimOpt) {
        Swal2.showValidationMessage(browserAPI.i18n.getMessage('please_choose_claim'));
        return false;
      }
      if (url) {
        if (!isURL(url)) {
          Swal2.showValidationMessage(browserAPI.i18n.getMessage('invalid_url'));
          return false;
        }
      }
      if (!comment) {
        Swal2.showValidationMessage(browserAPI.i18n.getMessage('provide_additional_info'));
        return false;
      }
      return [ claimOpt, url, comment, factcheck ];
    },
    html:
      '<div class="coinformPopupSubtitle">' + 
        '<span>' + moreInfo + '</span>' + 
      '</div>' + 
      '<div class="coinformProvideClaimText">' +
        '<span class="coinformProvideClaimTitle">' + provideClaimTitle + '</span><br/>' +
        '<span>' + provideClaimText2 + '</span>' +
      '</div>' +
      '<select id="claim-input-select" class="swal2-select" required>' +
        htmlSelectInputOptions +
      '</select>' +
      '<input id="claim-input-url" placeholder="' + browserAPI.i18n.getMessage('link_to_claim') + ' (' + browserAPI.i18n.getMessage('optional') + ')' + '" type="url" pattern="(ftp|https?):\\/\\/[^\\s]+" class="swal2-input">' +
      '<textarea id="claim-input-text" placeholder="' + browserAPI.i18n.getMessage('additional_info') + '" class="swal2-textarea" required></textarea>' +
      '<input type="checkbox" value="true" id="claim-input-check" class="swal2-checkbox">' +
      '<label id="claim-label-check" for="claim-input-check" class="swal2-label">' + browserAPI.i18n.getMessage('request_factcheck') + '</label>',
    footer:
      `<img class="coinformPopupLogo" src="${minLogoPath}"/>` +
      '<span>' + browserAPI.i18n.getMessage('popup_footer_text') + '</span>'
  }).then(function (result) {

    let auxPopupSpentTime = "?";
    if (auxPopupTime) {
      auxPopupSpentTime = Math.round((Date.now() - auxPopupTime) / 1000);
    }
    auxPopupTime = null;

    if (result.value) {

      let claimAccuracyLabel = result.value[0];
      let claimUrl = result.value[1];
      let claimComment = result.value[2];
      let claimToFactCheck = result.value[3];

      let evaluation = {
        'label': claimAccuracyLabel, 
        'url': claimUrl, 
        'comment': claimComment,
        'factcheck': claimToFactCheck
      };
      
      let logMessage = `Click on "submit" claim button`;
      if (claimToFactCheck == "true") {
        logMessage = logMessage + " with request to Fact-Check"
      }
      logMessage = logMessage + `\nAccuracy: ${claimAccuracyLabel}\nUser claim: ${claimUrl}\nAdditional info: ${claimComment}\nPopup time spent: ${auxPopupSpentTime} sec`;
      log2Server('claim', tweet.url, `Tweet id: ${tweet.id}\nTweet label: ${node.coInformLabel}`, logMessage);

      browserAPI.runtime.sendMessage({
        messageId: "EvaluateTweet",
        id: tweet.id,
        url: tweet.url,
        evaluation: evaluation, 
        userToken: coinformUserToken
      }, function (res) {
        let resStatus = JSON.stringify(res.status).replace(/['"]+/g, '');
        if (resStatus.localeCompare('400') === 0) {
          logger.logMessage(CoInformLogger.logTypes.error, `Request 400 (invalid input) response`, tweet.id);
          Swal2.fire(browserAPI.i18n.getMessage('error'), browserAPI.i18n.getMessage('feedback_not_sent'), 'error');
        }
        else if (resStatus.localeCompare('403') === 0) {
          logger.logMessage(CoInformLogger.logTypes.error, `Request 403 (access denied) response`, tweet.id);
          Swal2.fire(browserAPI.i18n.getMessage('error'), browserAPI.i18n.getMessage('feedback_not_sent'), 'error');
        }
        else if (resStatus.localeCompare('200') === 0) {
          
          let data = res.data;
          // let resEvalId = JSON.stringify(data.evaluation_id).replace(/['"]+/g, '');
          logger.logMessage(CoInformLogger.logTypes.info, `Claim sent successfully`, tweet.id);
          Swal2.fire(browserAPI.i18n.getMessage('sent'), browserAPI.i18n.getMessage('feedback_sent'), 'success');

        }
        else {
          logger.logMessage(CoInformLogger.logTypes.error, `Request unknown (${resStatus}) response`, tweet.id);
          Swal2.fire(browserAPI.i18n.getMessage('error'), browserAPI.i18n.getMessage('feedback_not_sent'), 'error');
        }
      });

    } else if (result.dismiss) {
      log2Server('claim', tweet.url, `Tweet id: ${tweet.id}\nTweet label: ${node.coInformLabel}`, `Close and cancel claim popup\nPopup time spent: ${auxPopupSpentTime} sec`);
    } 
    
  });

}

function openNotTaggedFeedbackPopup(tweet) {
  
  const elementTxt = browserAPI.i18n.getMessage('post');

  let popupTitle = browserAPI.i18n.getMessage('not_tagged', elementTxt);
  let popupButtonText = browserAPI.i18n.getMessage('ok');

  //let meterLogoSrc = browserAPI.extension.getURL(CoinformConstants.IMAGES_PATH + CoinformConstants.METER_ICON_NAME);
  let meterLogoSrc = null;
  
  Swal2.fire({
    type: 'warning',
    title: popupTitle,
    showCloseButton: true,
    showCancelButton: false,
    confirmButtonColor: CoinformConstants.COINFORM_BUTTON_COLOR,
    confirmButtonText: popupButtonText,
    html:
      '<span>' + browserAPI.i18n.getMessage('wait_label_for_feedback', elementTxt) + '</span>',
    footer:
      `<img class="coinformPopupLogo" src="${minLogoPath}"/>` +
      '<span>' + browserAPI.i18n.getMessage('popup_footer_text') + '</span>',
    focusConfirm: true,
  }).then(function (result) {
    if(result.value === true){
    }
  });

}

function openNotLoggedFeedbackPopup(tweet) {

  let popupTitle = browserAPI.i18n.getMessage('not_logged');
  let popupButtonText = browserAPI.i18n.getMessage('ok');
  
  Swal2.fire({
    type: 'warning',
    title: popupTitle,
    showCloseButton: true,
    showCancelButton: false,
    confirmButtonColor: CoinformConstants.COINFORM_BUTTON_COLOR,
    confirmButtonText: popupButtonText,
    html:
      '<span>' + browserAPI.i18n.getMessage('provide_feedback_with_login') + '</span><br/>' +
      '<span>' + browserAPI.i18n.getMessage('login_register_instructions') + '</span>',
    footer:
      `<img class="coinformPopupLogo" src="${minLogoPath}"/>` +
      '<span>' + browserAPI.i18n.getMessage('popup_footer_text') + '</span>',
    focusConfirm: true,
  }).then(function (result) {
    if(result.value === true){
    }
  });

}

function openNotLoggedClaimPopup(tweet) {
  
  const elementTxt = browserAPI.i18n.getMessage('post');

  let node = tweet.domObject;

  let popupPreTitle = '';
  let popupTitle = browserAPI.i18n.getMessage('not_tagged', elementTxt);
  let popupButtonText = browserAPI.i18n.getMessage('ok');

  //let meterLogoSrc = browserAPI.extension.getURL(CoinformConstants.IMAGES_PATH + CoinformConstants.METER_ICON_NAME);
  let meterLogoSrc = null;

  if (node.coInformLabel) {
    let auxlabel = browserAPI.i18n.getMessage(node.coInformLabel);
    if (!auxlabel) auxlabel = node.coInformLabel;
    popupPreTitle = browserAPI.i18n.getMessage('element_tagged_as', elementTxt);
    popupTitle = auxlabel;
    meterLogoSrc = browserAPI.extension.getURL(CoinformConstants.IMAGES_PATH + CoinformConstants.METER_LABEL_ICON_PREFIX + node.coInformLabel + CoinformConstants.METER_LABEL_ICON_EXTENSION);
  }
  
  Swal2.fire({
    type: (meterLogoSrc ? null : 'question'),
    imageUrl: meterLogoSrc,
    imageHeight: 100,
    title: '<h3 id="swal2-pretitle" class="swal2-title swal2-pretitle">' + popupPreTitle + '</h3>' + 
      '<h2 id="swal2-title" class="swal2-title">' + popupTitle + '</h2>',
    showCloseButton: true,
    showCancelButton: false,
    confirmButtonColor: CoinformConstants.COINFORM_BUTTON_COLOR,
    confirmButtonText: popupButtonText,
    html:
      '<span>' + browserAPI.i18n.getMessage('provide_claim_with_login') + '</span><br/>' +
      '<span>' + browserAPI.i18n.getMessage('login_register_instructions') + '</span>',
    footer:
      `<img class="coinformPopupLogo" src="${minLogoPath}"/>` +
      '<span>' + browserAPI.i18n.getMessage('popup_footer_text') + '</span>',
    focusConfirm: true,
  }).then(function (result) {
    if(result.value === true){
    }
  });

}

function log2Server (category, itemUrl, itemData, message) {

  const userOpts = configuration.coinform.options;

  /*let userCase = parser.getUserCase();
  if (userCase) {
    message = message + `\nTwitter User: @${userCase}`;
  }*/

  if (coinformUserToken && userOpts && (userOpts.participation == "true")) {

    const logTime = new Date().toISOString();

    const logData = {
      logTime: logTime,
      logCategory: category,
      relatedItemUrl: itemUrl,
      relatedItemData: itemData,
      logAction: message
    };

    browserAPI.runtime.sendMessage({
      messageId: "SendLog2Server",
      logData: logData, 
      userToken: coinformUserToken
    }, function(res) {
      if (!res) {
        logger.logMessage(CoInformLogger.logTypes.error, `Error sending Server Log`);
      }
    });

  }
  
}

function freePluginCache() {
  let now = Math.round(Date.now() / 1000);
  for (const [key, value] of Object.entries(pluginCache)) {
    if ((now - value.lastTime) > CoinformConstants.PLUGIN_CACHE_TIME) {
      delete pluginCache[key];
    }
  }
}

function ignoreClick(event) {
  event.preventDefault();
  event.stopPropagation();
  return false;
}

/*function strParse(str) {
  let args = [].slice.call(arguments, 1), i = 0;
  return str.replace(/%s/g, () => args[i++]);
}*/

function randomInt(low, high) {
  return Math.floor(Math.random() * (high - low + 1) + low);
}

function isURL(str) {
  let pattern = new RegExp('^((ftp|https?):\\/\\/)?'+ // protocol
  '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.?)+[a-z]{2,}|'+ // domain name
  '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
  '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
  '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
  '(\\#[-a-z\\d_]*)?$','i'); // fragment locator
  return pattern.test(str);
}
