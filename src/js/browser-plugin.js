
const $ = require('jquery');
const Swal2 = require('sweetalert2');
const CoinformClient = require('./coinform-client');
const TweetParser = require('./tweet-parser');
const FacebookParser = require('./facebook-parser');
const CoInformLogger = require('./coinform-logger');

const browserAPI = chrome || browser;

const pluginCache = {};

let logoURL = "/resources/coinform48.png";
let minlogoURL = "/resources/coinform_biglogo.png";
const mainColor = "#693c5e"; // coinform
const buttonColor = "#62B9AF"; // old: #3085d6

const MAX_RETRIES = 10;
let configuration;
let logger;
let client;
let parser;

let coinformUserToken = null;
let coinformUserMail = null;

//Read the configuration file and if it was successful, start
fetch(browserAPI.runtime.getURL('../resources/config.json'), {
  mode: 'cors',
  header: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
})
  .then(res => res.json())
  .then(res => {

    configuration = res;
    setTimeout(start, 1000);

  })
  .catch(err => {
    console.error('Could not load configuration file', err)
  });

browserAPI.runtime.sendMessage({
  messageId: "GetCookie",
  cookieName: "userToken"
}, function(cookie) {
  if (cookie) {
    logger.logMessage(CoInformLogger.logTypes.debug, `User already logged. Token: ${cookie.value}`);
    coinformUserToken = cookie.value;
  }
  else {
    logger.logMessage(CoInformLogger.logTypes.debug, "User not logged");
  }
});

browserAPI.runtime.sendMessage({
  messageId: "GetCookie",
  cookieName: "userMail"
}, function(cookie) {
  if (cookie) {
    logger.logMessage(CoInformLogger.logTypes.debug, `User already logged. Mail: ${cookie.value}`);
    coinformUserMail = cookie.value;
  }
});

browserAPI.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.messageId === "userLogin") {
    logger.logMessage(CoInformLogger.logTypes.info, `User logged in: ${request.userMail}`);
    coinformUserToken = request.jwt;
    coinformUserMail = request.userMail;
  }
  else if (request.messageId === "userLogout") {
    logger.logMessage(CoInformLogger.logTypes.info, `User logged out`);
    coinformUserToken = null;
    coinformUserMail = null;
  }
  else if (request.messageId === "renewUserToken") {
    logger.logMessage(CoInformLogger.logTypes.debug, `Renewed User Token`);
    coinformUserToken = request.jwt;
  }
});

const start = () => {

  logger = new CoInformLogger(CoInformLogger.logTypes[configuration.coinform.logLevel]);
  client = new CoinformClient(fetch, configuration.coinform.apiUrl);

  logoURL = browserAPI.extension.getURL(logoURL);
  minlogoURL = browserAPI.extension.getURL(minlogoURL);

  if (window.location.hostname.indexOf('twitter.com') >= 0) {

    parser = new TweetParser();
    parser.initContext();
    parser.listenForMainChanges(newTweetCallback);
    parser.listenPublishTweet(publishTweetCallback);
    parser.listenRetweetTweet(retweetTweetCallback);
    parser.triggerFirstTweetBatch(newTweetCallback);

  } else if (window.location.hostname.indexOf('facebook.com') >= 0) {

    parser = new FacebookParser();
    parser.fromBrowser(newFacebookPostCallback);
    parser.listenForNewPosts(newFacebookPostCallback);

  }

};

const publishTweetCallback = (clickEvent, targetButton) => {

  // click situation when we already procesed the tweet and the await time has finished
  if (targetButton.coInformed) {
    targetButton.coInformed = false;
    logger.logMessage(CoInformLogger.logTypes.debug, `Publish button procesed!!`);
    return true;
  }

  // prevent the submiting of the tweet
  clickEvent.stopImmediatePropagation();
  clickEvent.preventDefault();
  clickEvent.stopPropagation();

  // if disabled we are still waiting
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
    let loadingSpinner = document.createElement("DIV");
    loadingSpinner.classList.add("spinner-border");
    loadingSpinner.setAttribute("role", "status");
    let span = document.createElement("SPAN");
    span.classList.add("sr-only");
    let auxtxt = document.createTextNode("Loading...");
    span.append(auxtxt);
    loadingSpinner.append(span);
    targetButton.children[0].style.display = "none";
    targetButton.append(loadingSpinner);
    
    // attach loading text
    let loadingMessage = document.createElement("SPAN");
    loadingMessage.classList.add("publishTweetCoinformMessage");
    loadingMessage.classList.add("blink_me");
    let txt = document.createTextNode(browserAPI.i18n.getMessage("checking_tweet_coinform"));
    loadingMessage.append(txt);
    loadingMessage.setAttribute("id", `coinformCheckingMessage`);
    let toolBar = targetButton.offsetParent;
    for ( ; toolBar && toolBar !== document; toolBar = toolBar.parentNode ) {
      if ( toolBar.matches("[data-testid='toolBar']") ) break;
    }
    if (toolBar && (toolBar !== document)) {
      toolBar.offsetParent.append(loadingMessage);
    }

    for (let i = 0; i < urls.length; i++) {

      let foundMisinfo = false;

      browserAPI.runtime.sendMessage({
        messageId: "CheckUrl",
        url: urls[i]
      }, function(res) {

        let resStatus = JSON.stringify(res.status).replace(/['"]+/g, '');
        if ((resStatus.localeCompare('400') === 0)) {
          logger.logMessage(CoInformLogger.logTypes.error, `Request 400 response`);
        }
        else if (resStatus.localeCompare('200') === 0) {
          let data = res.data;
          let accuracyLabel = JSON.stringify(data.final_credibility).replace(/['"]+/g, '').replace(/\s+/g,'_');
          foundMisinfo = foundMisinfo || publishTweetCheckLabel(accuracyLabel,urls[i]);
        }
        else {
          logger.logMessage(CoInformLogger.logTypes.error, `Request unknown (${resStatus}) response`);
        }
        if (i == (urls.length - 1)) {
          // postpone the submiting of the tweet
          /*setTimeout(function() {
            publishTweetPostAction(targetButton);
          }, 5000);*/
          publishTweetPostAction(targetButton, foundMisinfo);
        }

      });

    }

  }
  else {
    publishTweetPostAction(targetButton);
  }

};

const publishTweetPostAction = (targetButton, misInfo) => {
  // Undo changes to the publish button
  let load = targetButton.querySelector('.spinner-border');
  if (load) load.parentNode.removeChild(load);
  let msg = document.getElementById("coinformCheckingMessage");
  if (msg) msg.parentNode.removeChild(msg);
  targetButton.children[0].style.display = "";
  targetButton.removeAttribute("disabled");
  targetButton.removeAttribute("aria-disabled");
  targetButton.coInformed = true;
  // Only re-do the clicking if we do not detected misinformation
  if (!misInfo) {
    targetButton.click();
  }
  else {
    // TODO: attach some warning message and change the text of the publish button
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
      // function when confirm button is clicked
    }
  });
  
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
  
  if (tweet.coInformLabel) {
    logger.logMessage(CoInformLogger.logTypes.info, `Retweet Tweet Label: ${tweet.coInformLabel}`);
  }
  
  targetButton.coInformed = true;
  targetButton.click();

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
    pluginCache[tweetInfo.id] = false;
  }

  if (!tweetInfo.domObject.coInfoLogo) {

    let cologo = createClickableLogo(tweetInfo.id, function() {
      logoClickAction(tweetInfo);
    });
    tweetInfo.domObject.append(cologo);

    tweetInfo.domObject.coInfoLogo = true;
  }

  // If the tweet has already been tagged then we directly classify it
  if (pluginCache[tweetInfo.id]) {
    logger.logMessage(CoInformLogger.logTypes.debug, `Already analyzed tweet`, tweetInfo.id);
    tweetInfo.domObject.coInfoAnalyzed = true;
    classifyTweet(tweetInfo, pluginCache[tweetInfo.id]);
    return;
  }

  tweetInfo.domObject.coInfoCounter = 0;

  // First API call to the endpoint /twitter/tweet/
  client.postCheckTweetInfo(tweetInfo.id, tweetInfo.username, tweetInfo.text).then(function (res) {

    let resStatus = JSON.stringify(res.status).replace(/['"]+/g, '');
    if ((resStatus.localeCompare('400') === 0)) {
      logger.logMessage(CoInformLogger.logTypes.error, `Request 400 (invalid input) response (${tweetInfo.domObject.coInfoCounter})`, tweetInfo.id);
    }
    else if (resStatus.localeCompare('200') === 0) {
      parseApiResponse(res.data, tweetInfo);
    }
    else {
      logger.logMessage(CoInformLogger.logTypes.error, `Request unknown (${resStatus}) response (${tweetInfo.domObject.coInfoCounter})`, tweetInfo.id);
    }

  }).catch(err => {

    logger.logMessage(CoInformLogger.logTypes.error, `Request Error: ${err}`, tweetInfo.id);
    // console.error(err);

  });

};

const createClickableLogo = (tweetId, callback) => {

  let img = document.createElement("IMG");
  img.setAttribute("class", "coinformTweetLogo");
  img.setAttribute("id", `coinformTweetLogo-${tweetId}`);
  img.setAttribute("src", logoURL);

  img.addEventListener('click', (event) => {
    // prevent opening the tweet
    event.stopImmediatePropagation();
    event.preventDefault();
    event.stopPropagation();
    callback();
  });

  return img;

};

const retryTweetQuery = (tweetInfo, queryId) => {

  if (tweetInfo.domObject.coInfoCounter === undefined) {
    tweetInfo.domObject.coInfoCounter = 0;
  }

  if (tweetInfo.domObject.coInfoCounter > MAX_RETRIES) {

    logger.logMessage(CoInformLogger.logTypes.warning, `MAX retries situation (${tweetInfo.domObject.coInfoCounter}). Giving up on tweet.`, tweetInfo.id);
    return false;

  } else {

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
      }

    });

  }

};

const parseApiResponse = (data, tweetInfo) => {

  let resStatus = JSON.stringify(data.status).replace(/['"]+/g, '');
  let acurracyLabel = null;

  logger.logMessage(CoInformLogger.logTypes.debug, `${resStatus} response (${tweetInfo.domObject.coInfoCounter})`, tweetInfo.id);

  // If the result ststus is "done" or "partly_done", then we can classify (final or temporary, respectively) the tweet
  if (resStatus && ((resStatus.localeCompare('done') === 0) || (resStatus.localeCompare('partly_done') === 0))) {
    // Result from API call
    acurracyLabel = JSON.stringify(data.response.rule_engine.final_credibility).replace(/['"]+/g, '').replace(/\s+/g,'_');
    classifyTweet(tweetInfo, acurracyLabel);
  }
  if (resStatus && (resStatus.localeCompare('done') === 0)) {
    // Tweet analyzed
    pluginCache[tweetInfo.id] = acurracyLabel;
    tweetInfo.domObject.coInfoAnalyzed = true;
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

const classifyTweet = (tweet, accuracyLabel) => {

  const node = tweet.domObject;
  const label = accuracyLabel.replace(/['"]+/g, '');

  if (!node.coInformLabel || (node.coInformLabel.localeCompare(label) !== 0)) {

    if (node.coInformLabel) {
      logger.logMessage(CoInformLogger.logTypes.info, `ReClassifying Tweet Label: ${node.coInformLabel} -> ${label}`, tweet.id);
      removeTweetLabel(tweet);
      let previousCategory = configuration.coinform.categories[node.coInformLabel];
      if (previousCategory && (previousCategory.localeCompare("blur") === 0)) {
        removeTweetBlurry(tweet);
      }
    }
    else {
      logger.logMessage(CoInformLogger.logTypes.info, `Classifying Tweet label: ${label}`, tweet.id);
    }

    node.coInformLabel = label;
    let newCategory = configuration.coinform.categories[label];
    if (!newCategory) {
      logger.logMessage(CoInformLogger.logTypes.warning, `Unexpected Label: ${label}`, tweet.id);
    }
    else if (newCategory.localeCompare("blur") === 0) {
      createTweetLabel(tweet, label, function() {
        openLabelPopup(tweet);
      });
      createTweetBlurry(tweet);
    }
    else if (newCategory.localeCompare("label") === 0) {
      createTweetLabel(tweet, label, function() {
        openLabelPopup(tweet);
      });
    }

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

const createTweetLabel = (tweet, label, callback) => {

  let node = tweet.domObject;

  let labelcat = document.createElement("SPAN");
  labelcat.setAttribute('id', `coinformTweetLabel-${tweet.id}`);
  labelcat.setAttribute('class', "coinformTweetLabel");
  let txt = document.createTextNode(browserAPI.i18n.getMessage(label));
  labelcat.append(txt);

  labelcat.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    callback();
  });

  node.prepend(labelcat);

};

const removeTweetLabel = (tweet) => {

  let node = tweet.domObject;
  let auxPrevious = node.querySelector(`#coinformTweetLabel-${tweet.id}`);
  if (auxPrevious) {
    auxPrevious.remove();
  }

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

  let node = tweet.domObject;
  let nodeBlurred = isBlurred(tweet);
  let nodeBlurrable = false;
  let showConfirm = false;
  let buttonText = "";

  if (node.coInformLabel) {
    let category = configuration.coinform.categories[node.coInformLabel];
    if (category && (category.localeCompare("blur") === 0)) {
      nodeBlurrable = true;
    }
  }

  if (nodeBlurred) {
    showConfirm = true;
    buttonText = browserAPI.i18n.getMessage('see_tweet');
  }
  else if (nodeBlurrable) {
    showConfirm = true;
    buttonText = browserAPI.i18n.getMessage('blur_tweet');
  }

  return Swal2.fire({
    type: 'info',
    title: browserAPI.i18n.getMessage('tweet_tagged_as', browserAPI.i18n.getMessage(node.coInformLabel)),
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
      '<span>' + browserAPI.i18n.getMessage(node.coInformLabel + '__info') + '</span>',
    footer:
      `<img class="coinformPopupLogo" src="${minlogoURL}"/>` +
      '<span>' + browserAPI.i18n.getMessage('popup_footer_text') + '</span>',
    focusConfirm: true
  }).then(function (result) {
    if(result.value === true){
      // function when confirm button is clicked
      if (nodeBlurred) {
        removeTweetBlurry(tweet);
      }
      else if (nodeBlurrable) {
        createTweetBlurry(tweet);
      }
    }
  });

}

function logoClickAction(tweet) {

  let nodeBlurred = isBlurred(tweet);

  if (nodeBlurred) {
    openLabelPopup(tweet);
  }
  else if (coinformUserToken) {
    openClaimPopup(tweet);
  }
  else {
    openNotLoggedClaimPopup(tweet);
  }

}

function openClaimPopup(tweet) {

  let node = tweet.domObject;

  let resultDropdown;

  let categoryOptions = {};

  Object.keys(configuration.coinform.accuracy).forEach(function(key) {
    categoryOptions[key] = browserAPI.i18n.getMessage('tweet_is', browserAPI.i18n.getMessage(key));
  });

  let popupTitle = browserAPI.i18n.getMessage('tweet_not_tagged');
  let moreInfo = browserAPI.i18n.getMessage('tweet_not_tagged__info');
  let provideClaim = browserAPI.i18n.getMessage("provide_claim_untagged");

  if (node.coInformLabel) {
    let auxlabel = browserAPI.i18n.getMessage(node.coInformLabel);
    if (!auxlabel) auxlabel = node.coInformLabel;
    popupTitle = browserAPI.i18n.getMessage('tweet_tagged_as', auxlabel);
    moreInfo = browserAPI.i18n.getMessage(node.coInformLabel + '__info');
    provideClaim = browserAPI.i18n.getMessage("provide_claim");
  }

  return Swal2.fire({
    type: 'info',
    title: popupTitle,
    showCloseButton: true,
    showCancelButton: false,
    confirmButtonColor: buttonColor,
    confirmButtonText: browserAPI.i18n.getMessage('submit'),
    focusConfirm: true,
    preConfirm: () => {
      let url = document.getElementById('swal-input1').value;
      let comment = document.getElementById('swal-input2').value;
      if (!isURL(url)) {
        Swal2.showValidationMessage(browserAPI.i18n.getMessage('invalid_url'));
        return false;
      }
      else if (!comment) {
        Swal2.showValidationMessage(browserAPI.i18n.getMessage('provide_additional_info'));
        return false;
      }
      else {
        return [ url, comment ];
      }
    },
    input: 'select',
    inputPlaceholder: browserAPI.i18n.getMessage('choose_claim'),
    inputOptions: categoryOptions,
    inputValidator: (value) => {
      return new Promise((resolve) => {
        if (value.localeCompare('') !== 0) {
          resultDropdown = value;
        } else {
          resolve(browserAPI.i18n.getMessage('please_choose_claim'));
        }
        resolve();
      });
    },
    html:
      '<div class="subtitle">' + 
        '<span>' + moreInfo + '</span>' + 
      '</div>' + 
      '<div class="contentText">' +
        '<span>' + provideClaim + '</span>' +
      '</div>' +
      '<input id="swal-input1" placeholder="' + browserAPI.i18n.getMessage('link_to_claim') + '" type="url" pattern="(ftp|https?):\\/\\/[^\\s]+" class="swal2-input">' +
      '<textarea id="swal-input2" placeholder="' + browserAPI.i18n.getMessage('additional_info') + '" class="swal2-textarea">',
    footer:
      `<img class="coinformPopupLogo" src="${minlogoURL}"/>` +
      '<span>' + browserAPI.i18n.getMessage('popup_footer_text') + '</span>'
  }).then(function (result) {

    if (result.value) {

      return new Promise((resolve) => {
        let returned = result[Object.keys(result)[0]];
        returned = returned.toString();
        let array = returned.split(',');
        let url = array[0];
        let comment = array[1];
        let evaluation = {
          'label': resultDropdown, 
          'url': url, 
          'comment': comment
        };
        client.postTwitterEvaluate(tweet.id, evaluation).then(function (res) {

          let resStatus = JSON.stringify(res.status).replace(/['"]+/g, '');
          if (resStatus.localeCompare('400') === 0) {
            logger.logMessage(CoInformLogger.logTypes.error, `Request 400 (invalid input) response (${tweetInfo.domObject.coInfoCounter})`, tweetInfo.id);
            Swal2.fire(browserAPI.i18n.getMessage('error'), browserAPI.i18n.getMessage('feedback_not_sent'), 'error');
          }
          else if (resStatus.localeCompare('403') === 0) {
            logger.logMessage(CoInformLogger.logTypes.error, `Request 403 (access denied) response (${tweetInfo.domObject.coInfoCounter})`, tweetInfo.id);
            Swal2.fire(browserAPI.i18n.getMessage('error'), browserAPI.i18n.getMessage('feedback_not_sent'), 'error');
          }
          else if (resStatus.localeCompare('200') === 0) {
            
            let data = res.data;
            if (data.evaluation_id) {
              let resEvalId = JSON.stringify(data.evaluation_id).replace(/['"]+/g, '');
              logger.logMessage(CoInformLogger.logTypes.info, `Claim sent. Evaluation ID = ${resEvalId}`, tweet.id);
              Swal2.fire(browserAPI.i18n.getMessage('sent'), browserAPI.i18n.getMessage('feedback_sent'), 'success');
            }
            else {
              logger.logMessage(CoInformLogger.logTypes.error, `Request "evaluation_id" Error`, tweet.id);
              Swal2.fire(browserAPI.i18n.getMessage('error'), browserAPI.i18n.getMessage('feedback_not_sent'), 'error');
            }

          }
          else {
            logger.logMessage(CoInformLogger.logTypes.error, `Request unknown (${resStatus}) response (${tweetInfo.domObject.coInfoCounter})`, tweetInfo.id);
            Swal2.fire(browserAPI.i18n.getMessage('error'), browserAPI.i18n.getMessage('feedback_not_sent'), 'error');
          }

        }).catch(err => {
          logger.logMessage(CoInformLogger.logTypes.error, `Request error: ${err}`, tweet.id);
          Swal2.fire(browserAPI.i18n.getMessage('error'), browserAPI.i18n.getMessage('feedback_not_sent'), 'error');
          //console.error(err);
        });
        resolve();
      });

    }
    
  });

}

function openNotLoggedClaimPopup(tweet) {

  let node = tweet.domObject;

  let popupTitle = browserAPI.i18n.getMessage('tweet_not_tagged');
  let popupButtonText = browserAPI.i18n.getMessage('ok');

  if (node.coInformLabel) {
    let auxlabel = browserAPI.i18n.getMessage(node.coInformLabel);
    if (!auxlabel) auxlabel = node.coInformLabel;
    popupTitle = browserAPI.i18n.getMessage('tweet_tagged_as', auxlabel);
  }
  
  return Swal2.fire({
    type: 'info',
    title: popupTitle,
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
      // function when confirm button is clicked
    }
  });

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

