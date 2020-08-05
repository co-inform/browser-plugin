
const $ = require('jquery');
const Swal2 = require('sweetalert2');
const ShowDown = require('showdown');
const TweetParser = require('./tweet-parser');
const FacebookParser = require('./facebook-parser');
const CoInformLogger = require('./coinform-logger');

const browserAPI = chrome || browser;

let pluginCache = {};
const PLUGIN_CACHE_SIZE = 250; // Cache size (number of elements) from where the plugin will try to remove old unused entries
const PLUGIN_CACHE_TIME = 900; // Time (in seconds) to consider an entry enough old and unused

let logoURL = "/resources/logo_36_20.png";
let claimURL = "/resources/bubble_claim.png";
let infoLogoURL = "/resources/info.png";
let claimURLWhite = "/resources/bubble_claim_w.png";
let disagreeURL = "/resources/disagree.png";
let agreeURL = "/resources/agree.png";
let minlogoURL = "/resources/coinform_biglogo.png";
let imgsPath = "/resources/";
const mainColor = "#693c5e"; // coinform color (violet)
const buttonColor = "#62B9AF"; // coinform green color (old: #3085d6)

// Hack to force a misinformation url detection, and a missinformation user tweets detection
// Active only in test use mode
const misInfoUrlRegExpTest = new RegExp("https://www\.breitbart\.com.*");
const misInfoTestTweetUser = "BreitbartNews";

const TIME_PUBLISH_AWAIT = 10;
const MAX_RETRIES = 10;
let configuration;
let logger;
let parser;

let coinformUserToken = null;
let coinformUserMail = null;

// Read the configuration file and if it was successful, start
browserAPI.runtime.sendMessage({
  messageId: "GetConfig"
}, function(res) {
  if (res.configuration) {
    configuration = res.configuration;
    logger = new CoInformLogger(CoInformLogger.logTypes[configuration.coinform.logLevel]);
    setTimeout(start, 1000);
  }
  else {
    console.error('Could not load plugin configuration');
  }
});

// Set listener for background scrpit messages
browserAPI.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.messageId === "userLogin") {
    logger.logMessage(CoInformLogger.logTypes.info, `User logged in: ${request.userMail}`);
    coinformUserToken = request.token;
    coinformUserMail = request.userMail;
    coinformUserID = request.userID;
  }
  else if (request.messageId === "userLogout") {
    logger.logMessage(CoInformLogger.logTypes.info, `User logged out`);
    coinformUserToken = null;
    coinformUserMail = null;
    coinformUserID = null;
  }
  else if (request.messageId === "renewUserToken") {
    logger.logMessage(CoInformLogger.logTypes.debug, `Renewed User Token`);
    coinformUserToken = request.token;
    coinformUserMail = request.userMail;
    coinformUserID = request.userID;
  }
  else if (request.messageId === "OptionsChange") {
    if (request.options !== undefined) {
      configuration.coinform.options = request.options;
    }
  }
});

// Initialize objects, variables, and listeners
const start = () => {

  logoURL = browserAPI.extension.getURL(logoURL);
  claimURL = browserAPI.extension.getURL(claimURL);
  minlogoURL = browserAPI.extension.getURL(minlogoURL);
  infoLogoURL = browserAPI.extension.getURL(infoLogoURL);
  disagreeURL = browserAPI.extension.getURL(disagreeURL);
  agreeURL = browserAPI.extension.getURL(agreeURL);

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
  });

  if (window.location.hostname.indexOf('twitter.com') >= 0) {
    parser = new TweetParser();
    parser.initContext();
    parser.listenForMainChanges(newTweetCallback);
    parser.listenPublishTweet(publishTweetCallback);
    parser.listenRetweetTweet(retweetTweetCallback);
    parser.triggerFirstTweetBatch(newTweetCallback);
  }
  else if (window.location.hostname.indexOf('facebook.com') >= 0) {
    parser = new FacebookParser();
    parser.fromBrowser(newFacebookPostCallback);
    parser.listenForNewPosts(newFacebookPostCallback);
  }

};

const publishTweetCallback = (clickEvent, targetButton) => {

  // click situation when we already procesed the tweet and the await time has finished
  if (targetButton.coInformed) {
    if (targetButton.foundMisinfo) {
      // TODO: if the content is missinfo, put a timer of 5 or 10 seconds before publishing it, and then set the CoInformed property tu false and raise the click event again
      targetButton.setAttribute("disabled", "");
      targetButton.setAttribute("aria-disabled", "true");
      let msg = document.getElementById("coinformPublishMessages");
      let txtContent = document.createElement("SPAN");
      txtContent.classList.add("blink_me");
      let txt = document.createTextNode(browserAPI.i18n.getMessage("published_in_seconds", `${TIME_PUBLISH_AWAIT}`));
      txtContent.append(txt);
      msg.append(document.createTextNode(". "));
      msg.append(txtContent);
      setTimeout(function() {
        publishTweetCountdown(targetButton, (TIME_PUBLISH_AWAIT - 1));
      }, 1000);
    }
    else {
      targetButton.coInformed = false;
      logger.logMessage(CoInformLogger.logTypes.debug, `Publish button procesed!!`);
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
  //get urls from text
  let urls = null;
  if (tweetText) {
    urls = tweetText.match(/((ftp|https?):\/\/([^\s]+)([^.,;:\s]))/g);
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

    targetButton.foundMisinfo = false;

    for (let i = 0; i < urls.length; i++) {

      browserAPI.runtime.sendMessage({
        messageId: "CheckUrl",
        url: urls[i]
      }, function(res) {
        
        let resStatus = JSON.stringify(res.status).replace(/['"]+/g, '');

        // Hack to force a misinformation url detection, and a missinformation user tweets detection
        // Active only in test use mode
        if ((configuration.coinform.options.testMode.localeCompare("true") === 0) && urls[i].match(misInfoUrlRegExpTest)) {
          targetButton.foundMisinfo = targetButton.foundMisinfo || publishTweetCheckLabel("not_credible", urls[i]);
        }

        else if ((resStatus.localeCompare('400') === 0)) {
          logger.logMessage(CoInformLogger.logTypes.error, `Request 400 response`);
        }
        else if (resStatus.localeCompare('200') === 0) {
          let data = res.data;
          let accuracyLabel = JSON.stringify(data.final_credibility).replace(/['"]+/g, '').replace(/\s+/g,'_');
          targetButton.foundMisinfo = targetButton.foundMisinfo || publishTweetCheckLabel(accuracyLabel, urls[i]);
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
  if (!targetButton.foundMisinfo) {
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

const publishTweetCheckLabel = (label, url) => {
  let misInfo = false;
  if (label) {
    let labelCategory = configuration.coinform.categories[label];
    if (!labelCategory) {
      logger.logMessage(CoInformLogger.logTypes.warning, `Unexpected Label: ${label}`);
    }
    else if (labelCategory.localeCompare("blur") === 0) {
      publishTweetAlertMisinfo(label, url);
      misInfo = true;
    }
  }
  return misInfo;
};

const publishTweetAlertMisinfo = (label, url) => {

  let auxlabel = browserAPI.i18n.getMessage(label);
  if (!auxlabel) auxlabel = label;
  let popupTitle = browserAPI.i18n.getMessage('content_tagged_as', auxlabel);
  let popupButtonText = browserAPI.i18n.getMessage('ok');
  
  return Swal2.fire({
    type: 'info',
    title: popupTitle,
    showCloseButton: true,
    showCancelButton: false,
    confirmButtonColor: buttonColor,
    confirmButtonText: popupButtonText,
    html:
      '<span>' + browserAPI.i18n.getMessage('url_detected_misinformation', auxlabel) + '</span><br/>'+
      '<a href="' + url + '">' + url + '</a><br/><br/>'+
      '<span>' + browserAPI.i18n.getMessage('check_content_before_publish') + '</span>',
    footer:
      `<img class="coinformPopupLogo" src="${minlogoURL}"/>` +
      '<span>' + browserAPI.i18n.getMessage('popup_footer_text') + '</span>',
    focusConfirm: true,
  }).then(function (result) {
    if(result.value === true){
    }
  });
  
};

const publishTweetCountdown = (targetButton, iteration) => {
  let msg = document.getElementById("coinformPublishMessages");
  if (iteration > 0) {
    msg.querySelector("span").innerText = browserAPI.i18n.getMessage("published_in_seconds", `${iteration}`);
    setTimeout(function() {
      publishTweetCountdown(targetButton, (iteration - 1));
    }, 1000);
  }
  else {
    targetButton.foundMisinfo = false;
    targetButton.removeAttribute("disabled");
    targetButton.removeAttribute("aria-disabled");
    if (msg) msg.parentNode.removeChild(msg);
    targetButton.click();
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
    let labelCategory = configuration.coinform.categories[tweet.coInformLabel];
    if (!labelCategory) {
      logger.logMessage(CoInformLogger.logTypes.warning, `Unexpected Label: ${label}`);
    }
    else if (labelCategory.localeCompare("blur") === 0) {
      retweetTweetAlertMisinfo(tweet.coInformLabel);
    }
  }
  else {
    targetButton.click();
  }

};

const retweetTweetAlertMisinfo = (label) => {

  let auxlabel = browserAPI.i18n.getMessage(label);
  if (!auxlabel) auxlabel = label;
  let popupTitle = browserAPI.i18n.getMessage('content_tagged_as', auxlabel);
  let popupButtonText = browserAPI.i18n.getMessage('ok');
  
  return Swal2.fire({
    type: 'info',
    title: popupTitle,
    showCloseButton: true,
    showCancelButton: false,
    confirmButtonColor: buttonColor,
    confirmButtonText: popupButtonText,
    html:
      '<span>' + browserAPI.i18n.getMessage('content_tagged_as', auxlabel) + '</span><br/>'+
      '<span>' + browserAPI.i18n.getMessage('check_content_before_publish') + '</span>',
    footer:
      `<img class="coinformPopupLogo" src="${minlogoURL}"/>` +
      '<span>' + browserAPI.i18n.getMessage('popup_footer_text') + '</span>',
    focusConfirm: true,
  }).then(function (result) {
    if(result.value === true){
    }
  });
  
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
    if (Object.keys(pluginCache).length > PLUGIN_CACHE_SIZE) {
      freePluginCache();
    }

  }

  if (!tweetInfo.domObject.toolBar) {
    let toolbar = createToolbar(tweetInfo);
    tweetInfo.domObject.prepend(toolbar);
    tweetInfo.domObject.toolBar = true;
  } else {
    logger.logMessage(CoInformLogger.logTypes.debug, `Toolbar already inserted`, tweetInfo.id);
  }

  // If the tweet has already been tagged then we directly classify it
  if (pluginCache[tweetInfo.id].status) {
    logger.logMessage(CoInformLogger.logTypes.debug, `Already analyzed tweet`, tweetInfo.id);
    pluginCache[tweetInfo.id].lastTime = Math.round(Date.now() / 1000);
    tweetInfo.domObject.queryStatus = pluginCache[tweetInfo.id].status;
    tweetInfo.domObject.queryId = pluginCache[tweetInfo.id].queryId;
    classifyTweet(tweetInfo, pluginCache[tweetInfo.id].label, pluginCache[tweetInfo.id].modules);
    if (pluginCache[tweetInfo.id].feedback) {
      if (pluginCache[tweetInfo.id].feedback == "agree") {
        tweetInfo.domObject.querySelector(".coinformToolbarPositiveLogo").classList.add("coinformToolbarFeedbackAfterClick");
      }
      else if (pluginCache[tweetInfo.id].feedback == "disagree") {
        tweetInfo.domObject.querySelector(".coinformToolbarNegativeLogo").classList.add("coinformToolbarFeedbackAfterClick");
      }
    }
    if (pluginCache[tweetInfo.id].status == "done") {
      tweetInfo.domObject.coInfoAnalyzed = true;
      finalizeTweetClassify(tweetInfo, 'done');
      return;
    }
  }

  tweetInfo.domObject.coInfoCounter = 0;

  // First API call to the endpoint /twitter/tweet/
  browserAPI.runtime.sendMessage({
    messageId: "CheckTweetInfo",
    id: tweetInfo.id,
    username: tweetInfo.username,
    text: tweetInfo.text
  }, function (res) {
    let resStatus = JSON.stringify(res.status).replace(/['"]+/g, '');
    
    // Hack to force a misinformation url detection, and a missinformation user tweets detection
    // Active only in test use mode
    if ((configuration.coinform.options.testMode.localeCompare("true") === 0) && (tweetInfo.username.localeCompare(misInfoTestTweetUser) === 0)) {
      parseApiResponse({
        status: "done",
        query_id: -1,
        response: {
          rule_engine: {
            final_credibility: "not_credible",
            module_labels: [],
            module_values: []
          }
        }
      }, tweetInfo);
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

  let td3 = tr.insertCell();
  td3.setAttribute("id", `coinformToolbarFeedback-${tweetInfo.id}`);
  
  td3.appendChild(createLogoClaim(tweetInfo.id, function () {
    claimClickAction(tweetInfo);
  }));
  td3.classList.add("coinformToolbarButton");
  td3.classList.add("coinformToolbarClaim");
  
  let auxtext = document.createElement("SPAN");
  let txt = document.createTextNode(browserAPI.i18n.getMessage('make_claim'));
  auxtext.append(txt);
  td3.appendChild(auxtext);
  
  td3.addEventListener('click', (event) => { 
    // prevent opening the tweet
    event.stopImmediatePropagation();
    event.preventDefault();
    event.stopPropagation();
    claimClickAction(tweetInfo);
  });

  let td4 = tr.insertCell();
  td4.setAttribute("id", `coinformToolbarFeedbackNegative-${tweetInfo.id}`);

  td4.appendChild(createLogoNegativeFeedback(tweetInfo.id, function () {
    feedbackClickAction(td4, tweetInfo, "disagree");
  }));
  let positiveFeedbackText = document.createElement("SPAN");
  let positiveText = document.createTextNode(browserAPI.i18n.getMessage('negative_feedback'));
  positiveFeedbackText.append(positiveText);
  td4.appendChild(positiveFeedbackText);
  td4.classList.add("coinformToolbarNegativeLogo");

  td4.addEventListener('click', (event) => { 
    // prevent opening the tweet
    event.stopImmediatePropagation();
    event.preventDefault();
    event.stopPropagation();
    feedbackClickAction(td4, tweetInfo, "disagree");
  });

  let td5 = tr.insertCell();
  td5.setAttribute("id", `coinformToolbarFeedbackPositive-${tweetInfo.id}`);

  td5.appendChild(createLogoPositiveFeedback(tweetInfo.id, function () {
    feedbackClickAction(td5, tweetInfo, "agree");
  }));

  let negativeFeedbackText = document.createElement("SPAN");
  let negativeText = document.createTextNode(browserAPI.i18n.getMessage('positive_feedback'));
  negativeFeedbackText.append(negativeText);
  td5.appendChild(negativeFeedbackText);
  td5.classList.add("coinformToolbarPositiveLogo");

  td5.addEventListener('click', (event) => { 
    // prevent opening the tweet
    event.stopImmediatePropagation();
    event.preventDefault();
    event.stopPropagation();
    feedbackClickAction(td5, tweetInfo, "agree");
  });

  return tbl;
};

const createLogoClaim = (tweetId, callback) => {

  let claim = document.createElement("IMG");
  claim.setAttribute("id", `coinformToolbarClaim-${tweetId}`);
  claim.classList.add("coinformClaimLogo");
  claim.setAttribute("src", claimURL);

  claim.addEventListener('click', (event) => {
    // prevent opening the tweet
    event.stopImmediatePropagation();
    event.preventDefault();
    event.stopPropagation();
    callback();
  });

  return claim;
};

const createLogoPositiveFeedback = (tweetId, callback) => {

  let agree = document.createElement("IMG");
  agree.setAttribute("id", `coinformPositiveLogo-${tweetId}`);
  agree.classList.add("coinformPositiveLogo");
  agree.setAttribute("src", agreeURL);

  agree.addEventListener('click', (event) => {
    // prevent opening the tweet
    event.stopImmediatePropagation();
    event.preventDefault();
    event.stopPropagation();
    callback();
  });

  return agree;
};

const createLogoNegativeFeedback = (tweetId, callback) => {

  let disagree = document.createElement("IMG");
  disagree.setAttribute("id", `coinformNegativeLogo-${tweetId}`);
  disagree.classList.add("coinformNegativeLogo");
  disagree.setAttribute("src", disagreeURL);

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
  img.setAttribute("src", logoURL);

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

  if (tweetInfo.domObject.coInfoCounter > MAX_RETRIES) {

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
    // Call retry in random (between 0.5 and 2.5) seconds
    setTimeout(function() {
      retryTweetQuery(tweetInfo, data.query_id);
    }, randomInt(500, 2500));
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

        classifyPost(post, res);

      })
      .catch(err => {
        logger.logMessage(CoInformLogger.logTypes.error, `Request error: ${err}`);
        //console.error(err)
      });
  }*/

};

const classifyPost = (post, score) => {

  /*const misinformationScore = score.misinformationScore;
  const dom = post.domObject;

  $(dom.find('._3ccb')[0]).css('opacity', `${1 - misinformationScore / 100}`);
  dom.prepend(createWhyButton(score, 'post', true));*/

};

const classifyTweet = (tweet, credibilityLabel, credibilityModules) => {

  const node = tweet.domObject;

  if (!node.coInformLabel || (node.coInformLabel.localeCompare(credibilityLabel) !== 0)) {

    if (node.coInformLabel) {
      logger.logMessage(CoInformLogger.logTypes.info, `ReClassifying Tweet Label: ${node.coInformLabel} -> ${credibilityLabel}`, tweet.id);
      removeTweetLabel(tweet);
      // check if it was blurred
      let previousCategory = configuration.coinform.categories[node.coInformLabel];
      if (previousCategory && (previousCategory.localeCompare("blur") === 0)) {
        removeTweetBlurry(tweet);
      }
      // remove feedback as label changed
      let auxPrevious = tweet.domObject.querySelector(".coinformToolbarFeedbackAfterClick");
      if (auxPrevious || pluginCache[tweet.id].feedback) {
        pluginCache[tweet.id].feedback = null;
        auxPrevious.classList.remove("coinformToolbarFeedbackAfterClick");
      }
    }
    else {
      logger.logMessage(CoInformLogger.logTypes.info, `Classifying Tweet label: ${credibilityLabel}`, tweet.id);
    }

    node.coInformLabel = credibilityLabel;
    node.coInformModules = credibilityModules;
    let newCategory = configuration.coinform.categories[credibilityLabel];
    if (!newCategory) {
      createTweetLabel(tweet, credibilityLabel, credibilityModules, function() {
        openLabelPopup(tweet);
      });
      logger.logMessage(CoInformLogger.logTypes.warning, `Unexpected Label: ${credibilityLabel}`, tweet.id);
    }
    else {
      if ((newCategory.localeCompare("blur") === 0) || (newCategory.localeCompare("label") === 0)) {
        createTweetLabel(tweet, credibilityLabel, credibilityModules, function() {
          openLabelPopup(tweet);
        });
      }
      if (newCategory.localeCompare("blur") === 0) {
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

  let buttonContainer = createCannotSeeTweetButton(tweet.id, function() {
    openLabelPopup(tweet);
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

  let node = tweet.domObject.querySelector(`#coinformToolbarLabelContent-${tweet.id}`);

  // create the label inside the toolbar
  let labelcat = document.createElement("SPAN");
  labelcat.setAttribute("id", `coinformToolbarLabel-${tweet.id}`);
  labelcat.setAttribute("class", "coinformToolbarLabel");
  let auxLabel = browserAPI.i18n.getMessage(label);
  if (!auxLabel) auxLabel = label;
  let txt = document.createTextNode(auxLabel);
  labelcat.append(txt);

  labelcat.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    callback();
  });

  node.append(labelcat);

  // create a info logo
  let infoContent = document.createElement("DIV");
  infoContent.setAttribute("id", `coinformLabelInfoContent-${tweet.id}`);
  infoContent.setAttribute("class", "coinformLabelInfoContent");
  let infoLogo = document.createElement("IMG");
  infoLogo.setAttribute("id", `coinformLabelInfoLogo-${tweet.id}`);
  infoLogo.setAttribute("class", "coinformLabelInfoLogo");
  infoLogo.setAttribute("src", infoLogoURL);
  infoContent.append(infoLogo);
  
  // create tooltip div with detailed modules info
  let infoTooltip = document.createElement("DIV");
  infoTooltip.setAttribute("id", `coinformLabelInfoTooltip-${tweet.id}`);
  infoTooltip.setAttribute("class", "coinformLabelInfoTooltip");
  let infoTooltipContent = createLabelModulesInfoContent(label, modules);
  infoTooltip.append(infoTooltipContent);

  infoContent.append(infoTooltip);

  infoContent.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
  });

  node.append(infoContent);

};

const createLabelModulesInfoContent = (label, modules) => {

  let infoTooltipContent = document.createElement("DIV");
  infoTooltipContent.setAttribute("class", "coinformAnalysisExplainability");
  let infoTooltipText = document.createElement("SPAN");
  let auxLabel = browserAPI.i18n.getMessage(label);
  if (!auxLabel) auxLabel = label;
  let textHtml = browserAPI.i18n.getMessage('content_deemed_due_analysis__html', [auxLabel, Object.keys(modules).length]);
  infoTooltipText.innerHTML = textHtml;
  infoTooltipContent.append(infoTooltipText);
  let infoTooltipList = document.createElement("UL");
  if (modules) {
    for (let [key, value] of Object.entries(modules)) {
      let infoTooltipListItem = document.createElement("LI");

      let moduleName = browserAPI.i18n.getMessage(key);
      let moduleAnalysisInfoHtml = browserAPI.i18n.getMessage('module_analysis_short_info__html', moduleName);

      let moduleLabelTxt = browserAPI.i18n.getMessage(modules[key].label);
      let moduleCredibility = '?';
      if (modules[key].credibility != null) moduleCredibility = modules[key].credibility;
      let moduleConfidence = '?';
      if (modules[key].confidence != null) moduleConfidence = Math.round(parseFloat(modules[key].confidence) * 100);
      let moduleAnalysisValuesHtml = browserAPI.i18n.getMessage('module_analysis_result__html', [moduleLabelTxt, moduleCredibility, moduleConfidence]);

      infoTooltipListItem.innerHTML = `${moduleAnalysisInfoHtml}<br>${moduleAnalysisValuesHtml}`;
      infoTooltipList.append(infoTooltipListItem);
    }
  }
  infoTooltipContent.append(infoTooltipList);
  
  let infoTooltipMoreinfo = document.createElement("SPAN");
  let moreinfoTxt = document.createTextNode(browserAPI.i18n.getMessage('more_analysis_info'));
  infoTooltipMoreinfo.append(moreinfoTxt);
  infoTooltipContent.append(infoTooltipMoreinfo);

  return infoTooltipContent;

};

const createLabelModulesExplainabilityContent = (label, modules) => {

  let infoTooltipContent = document.createElement("DIV");
  infoTooltipContent.setAttribute("class", "coinformAnalysisExplainability");
  let infoTooltipText = document.createElement("SPAN");
  let auxLabel = browserAPI.i18n.getMessage(label);
  if (!auxLabel) auxLabel = label;
  let textHtml = browserAPI.i18n.getMessage('content_deemed_due_analysis__html', [auxLabel, Object.keys(modules).length]);
  infoTooltipText.innerHTML = textHtml;
  infoTooltipContent.append(infoTooltipText);
  let infoTooltipList = document.createElement("UL");
  if (modules) {
    for (let [key, value] of Object.entries(modules)) {
      let infoTooltipListItem = document.createElement("LI");

      let moduleName = browserAPI.i18n.getMessage(key);
      let moduleBased = browserAPI.i18n.getMessage(`${key}_based_info`);
      let moduleAnalysisInfoHtml = browserAPI.i18n.getMessage('module_analysis_long_info__html', [moduleName, moduleBased]);

      let moduleLabelTxt = browserAPI.i18n.getMessage(modules[key].label);
      let moduleCredibility = '?';
      if (modules[key].credibility != null) moduleCredibility = modules[key].credibility;
      let moduleConfidence = '?';
      if (modules[key].confidence != null) moduleConfidence = Math.round(parseFloat(modules[key].confidence) * 100);
      let moduleAnalysisValuesHtml = browserAPI.i18n.getMessage('module_analysis_result__html', [moduleLabelTxt, moduleCredibility, moduleConfidence]);

      let moduleExplainabilityHtml = null;
      if (modules[key].explanationFormat != null) {
        if (modules[key].explanationFormat.localeCompare('text') === 0) {
          moduleExplainabilityHtml = '<details><summary>' + browserAPI.i18n.getMessage('module_explainability_text') + ':</summary><p>' + modules[key].explanation + '</p></details>';
        }
        else if ((modules[key].explanationFormat.localeCompare('link') === 0) || (modules[key].explanationFormat.localeCompare('url') === 0)) {
          moduleExplainabilityHtml = '<details><summary>' + browserAPI.i18n.getMessage('module_explainability_link') + ' <a href="' + modules[key].explanation + '"  target="_blank" rel="noopener noreferrer">' + browserAPI.i18n.getMessage('here') + '</a></summary></details>';
        }
        else if (modules[key].explanationFormat.localeCompare('markdown') === 0) {
          let ShowDownConverter = new ShowDown.Converter();
          let auxHtmlExplanationHtml = ShowDownConverter.makeHtml(modules[key].explanation);
          moduleExplainabilityHtml = '<details><summary>' + browserAPI.i18n.getMessage('module_explainability_text') + ':</summary><p>' + auxHtmlExplanationHtml + '</p></details>';
        }
      }

      infoTooltipListItem.innerHTML = `${moduleAnalysisInfoHtml}<br>${moduleAnalysisValuesHtml}`;
      if (moduleExplainabilityHtml) infoTooltipListItem.innerHTML = infoTooltipListItem.innerHTML + '<br><br>' + moduleExplainabilityHtml;

      infoTooltipList.append(infoTooltipListItem);
    }
  }
  infoTooltipContent.append(infoTooltipList);

  return infoTooltipContent;

};

const removeTweetLabel = (tweet) => {

  let node = tweet.domObject.querySelector(`#coinformToolbarLabelContent-${tweet.id}`);
  node.querySelectorAll('.coinformToolbarLabel').forEach(n => n.remove());
  node.querySelectorAll('.coinformLabelInfoContent').forEach(n => n.remove());

};

const createCannotSeeTweetButton = (tweetId, callback) => {

  const div = document.createElement('DIV');
  div.setAttribute('id', `feedback-button-container-${tweetId}`);
  div.setAttribute('class', 'feedback-button-container');

  const button = document.createElement('BUTTON');
  button.setAttribute('id', `whyButton-${tweetId}`);
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

function openLabelPopup(tweet) {

  const elementTxt = browserAPI.i18n.getMessage('tweet_post');

  let node = tweet.domObject;
  let nodeBlurred = isBlurred(tweet);
  let nodeBlurrable = false;
  let showConfirm = false;
  let buttonText = "";

  let popupPreTitle = '';
  let popupTitle = browserAPI.i18n.getMessage('not_tagged', elementTxt);
  let moreInfo = document.createElement('DIV');

  //let meterLogoSrc = browserAPI.extension.getURL(imgsPath + "meter.png");
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
    meterLogoSrc = browserAPI.extension.getURL(imgsPath + "meter_" + node.coInformLabel + ".png");
    moreInfo.append(document.createElement('BR'));

    let auxModules = node.coInformModules;
    let auxContent = createLabelModulesExplainabilityContent(node.coInformLabel, auxModules);
    moreInfo.append(auxContent);

    let category = configuration.coinform.categories[node.coInformLabel];
    if (category && (category.localeCompare("blur") === 0)) {
      nodeBlurrable = true;
    }
  }
  else {
    let auxText = document.createElement('SPAN');
    auxText.innerHTML = browserAPI.i18n.getMessage('not_tagged__info', elementTxt);
    moreInfo.append(auxText);
  }

  if (nodeBlurred) {
    showConfirm = true;
    buttonText = browserAPI.i18n.getMessage('see_anyway', elementTxt);
  }
  else if (nodeBlurrable) {
    showConfirm = true;
    buttonText = browserAPI.i18n.getMessage('blur_again', elementTxt);
  }

  return Swal2.fire({
    type: (meterLogoSrc ? null : 'question'),
    width: 500,
    imageUrl: meterLogoSrc,
    imageHeight: 100,
    title: '<h3 id="swal2-pretitle" class="swal2-title swal2-pretitle">' + popupPreTitle + '</h3>' + 
      '<h2 id="swal2-title" class="swal2-title">' + popupTitle + '</h2>',
    showConfirmButton: showConfirm,
    showCloseButton: true,
    showCancelButton: true,
    cancelButtonColor: buttonColor,
    confirmButtonColor: buttonColor,
    cancelButtonText: browserAPI.i18n.getMessage('ok'),
    confirmButtonText: buttonText,
    reverseButtons: true,
    focusCancel: true,
    html:
      '<span>' + moreInfo.outerHTML + '</span>',
    footer:
      `<img class="coinformPopupLogo" src="${minlogoURL}"/>` +
      '<span>' + browserAPI.i18n.getMessage('popup_footer_text') + '</span>',
    focusConfirm: true
  }).then(function (result) {
    if(result.value === true){
      if (nodeBlurred) {
        removeTweetBlurry(tweet);
      }
      else if (nodeBlurrable) {
        createTweetBlurry(tweet);
      }
    }
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
    coinformUserToken: coinformUserToken
  }, function (res) {
    let resStatus = JSON.stringify(res.status).replace(/['"]+/g, '');

    if (resStatus.localeCompare('200') === 0) {
      logger.logMessage(CoInformLogger.logTypes.info, `Reaction registered successfully`);
      Swal2.fire(browserAPI.i18n.getMessage('sent'), browserAPI.i18n.getMessage("feedback_sent"), 'success');
      let auxPrevious = tweetInfo.domObject.querySelector(".coinformToolbarFeedbackAfterClick");
      if (auxPrevious) auxPrevious.classList.remove("coinformToolbarFeedbackAfterClick");
      targetButton.classList.add("coinformToolbarFeedbackAfterClick");
      pluginCache[tweetInfo.id].feedback = agreement;
    } 
    else {
      Swal2.fire(browserAPI.i18n.getMessage('error'), browserAPI.i18n.getMessage('feedback_not_sent'), 'error');
    }

  });
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

  const elementTxt = browserAPI.i18n.getMessage('tweet_post');

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
  let provideClaimText1 = browserAPI.i18n.getMessage("provide_claim_text1");
  let provideClaimText2 = browserAPI.i18n.getMessage("provide_claim_text2", elementTxt);

  //let meterLogoSrc = browserAPI.extension.getURL(imgsPath + "meter.png");
  let meterLogoSrc = null;

  if (node.coInformLabel) {
    let auxlabel = browserAPI.i18n.getMessage(node.coInformLabel);
    if (!auxlabel) auxlabel = node.coInformLabel;
    popupPreTitle = browserAPI.i18n.getMessage('element_tagged_as', elementTxt);
    popupTitle = auxlabel;
    moreInfo = browserAPI.i18n.getMessage(node.coInformLabel + '__info', elementTxt);
    //provideClaimText = browserAPI.i18n.getMessage("provide_claim");
    meterLogoSrc = browserAPI.extension.getURL(imgsPath + "meter_" + node.coInformLabel + ".png");
  }

  return Swal2.fire({
    type: (meterLogoSrc ? null : 'question'),
    imageUrl: meterLogoSrc,
    imageHeight: 100,
    title: '<h3 id="swal2-pretitle" class="swal2-title swal2-pretitle">' + popupPreTitle + '</h3>' + 
      '<h2 id="swal2-title" class="swal2-title">' + popupTitle + '</h2>',
    showCloseButton: true,
    showCancelButton: false,
    confirmButtonColor: buttonColor,
    confirmButtonText: browserAPI.i18n.getMessage('submit'),
    focusConfirm: true,
    preConfirm: () => {
      let claimOpt = document.getElementById('swal-input-select').value;
      let url = document.getElementById('swal-input1').value;
      let comment = document.getElementById('swal-input2').value;
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
      return [ claimOpt, url, comment ];
    },
    html:
      '<div class="coinformPopupSubtitle">' + 
        '<span>' + moreInfo + '</span>' + 
      '</div>' + 
      '<div class="coinformProvideClaimText">' +
        '<span class="coinformProvideClaimTitle">' + provideClaimTitle + '</span><br/>' +
        '<span>' + provideClaimText1 + '</span>' +
        '<span>' + provideClaimText2 + '</span>' +
      '</div>' +
      '<select id="swal-input-select" class="swal2-select" required>' +
        htmlSelectInputOptions +
      '</select>' +
      '<input id="swal-input1" placeholder="' + browserAPI.i18n.getMessage('link_to_claim') + ' (' + browserAPI.i18n.getMessage('optional') + ')' + '" type="url" pattern="(ftp|https?):\\/\\/[^\\s]+" class="swal2-input">' +
      '<textarea id="swal-input2" placeholder="' + browserAPI.i18n.getMessage('additional_info') + '" class="swal2-textarea" required>',
    footer:
      `<img class="coinformPopupLogo" src="${minlogoURL}"/>` +
      '<span>' + browserAPI.i18n.getMessage('popup_footer_text') + '</span>'
  }).then(function (result) {

    if (result.value) {
      
      let claimAccuracyLabel = result.value[0];
      let claimUrl = result.value[1];
      let claimComment = result.value[2];

      let evaluation = {
        'label': claimAccuracyLabel, 
        'url': claimUrl, 
        'comment': claimComment
      }; 

      browserAPI.runtime.sendMessage({
        messageId: "EvaluateTweet",
        id: tweet.id,
        url: tweet.url,
        evaluation: evaluation, 
        coinformUserToken: coinformUserToken
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

    }
    
  });

}

function openNotTaggedFeedbackPopup(tweet) {
  
  const elementTxt = browserAPI.i18n.getMessage('tweet_post');

  let popupTitle = browserAPI.i18n.getMessage('not_tagged', elementTxt);
  let popupButtonText = browserAPI.i18n.getMessage('ok');

  //let meterLogoSrc = browserAPI.extension.getURL(imgsPath + "meter.png");
  let meterLogoSrc = null;
  
  return Swal2.fire({
    type: 'warning',
    title: popupTitle,
    showCloseButton: true,
    showCancelButton: false,
    confirmButtonColor: buttonColor,
    confirmButtonText: popupButtonText,
    html:
      '<span>' + browserAPI.i18n.getMessage('wait_label_for_feedback', elementTxt) + '</span>',
    footer:
      `<img class="coinformPopupLogo" src="${minlogoURL}"/>` +
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
  
  return Swal2.fire({
    type: 'warning',
    title: popupTitle,
    showCloseButton: true,
    showCancelButton: false,
    confirmButtonColor: buttonColor,
    confirmButtonText: popupButtonText,
    html:
      '<span>' + browserAPI.i18n.getMessage('provide_feedback_with_login') + '</span><br/>' +
      '<span>' + browserAPI.i18n.getMessage('login_register_instructions') + '</span>',
    footer:
      `<img class="coinformPopupLogo" src="${minlogoURL}"/>` +
      '<span>' + browserAPI.i18n.getMessage('popup_footer_text') + '</span>',
    focusConfirm: true,
  }).then(function (result) {
    if(result.value === true){
    }
  });

}

function openNotLoggedClaimPopup(tweet) {
  
  const elementTxt = browserAPI.i18n.getMessage('tweet_post');

  let node = tweet.domObject;

  let popupPreTitle = '';
  let popupTitle = browserAPI.i18n.getMessage('not_tagged', elementTxt);
  let popupButtonText = browserAPI.i18n.getMessage('ok');

  //let meterLogoSrc = browserAPI.extension.getURL(imgsPath + "meter.png");
  let meterLogoSrc = null;

  if (node.coInformLabel) {
    let auxlabel = browserAPI.i18n.getMessage(node.coInformLabel);
    if (!auxlabel) auxlabel = node.coInformLabel;
    popupPreTitle = browserAPI.i18n.getMessage('element_tagged_as', elementTxt);
    popupTitle = auxlabel;
    meterLogoSrc = browserAPI.extension.getURL(imgsPath + "meter_" + node.coInformLabel + ".png");
  }
  
  return Swal2.fire({
    type: (meterLogoSrc ? null : 'question'),
    imageUrl: meterLogoSrc,
    imageHeight: 100,
    title: '<h3 id="swal2-pretitle" class="swal2-title swal2-pretitle">' + popupPreTitle + '</h3>' + 
      '<h2 id="swal2-title" class="swal2-title">' + popupTitle + '</h2>',
    showCloseButton: true,
    showCancelButton: false,
    confirmButtonColor: buttonColor,
    confirmButtonText: popupButtonText,
    html:
      '<span>' + browserAPI.i18n.getMessage('provide_claim_with_login') + '</span><br/>' +
      '<span>' + browserAPI.i18n.getMessage('login_register_instructions') + '</span>',
    footer:
      `<img class="coinformPopupLogo" src="${minlogoURL}"/>` +
      '<span>' + browserAPI.i18n.getMessage('popup_footer_text') + '</span>',
    focusConfirm: true,
  }).then(function (result) {
    if(result.value === true){
    }
  });

}

function freePluginCache() {
  let now = Math.round(Date.now() / 1000);
  for (const [key, value] of Object.entries(pluginCache)) {
    if ((now - value.lastTime) > PLUGIN_CACHE_TIME) {
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

