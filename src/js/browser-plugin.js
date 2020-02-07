
const $ = require('jquery');
const Swal2 = require('sweetalert2');
const CoinformClient = require('./coinform-client');
const TweetParser = require('./tweet-parser');
const FacebookParser = require('./facebook-parser');
const CoInformLogger = require('./coinform-logger');

const browserAPI = chrome || browser;

const pluginCache = {};

let logoURL = "/resources/coinform48.png";
let minlogoURL = "/resources/coinform_logotext21.png";
const mainColor = "#693c5e"; // coinform
const buttonColor = "#62B9AF"; // old: #3085d6

const MAX_RETRIES = 10;
let configuration;
let logger;
let client;
let parser;

let coinformUserToken = null;

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

browserAPI.storage.local.get(['userToken'], (data) => {
  if (data.userToken) {
    coinformUserToken = data.userToken;
  }
});

browserAPI.storage.onChanged.addListener(function(changes, namespace) {
  for (let key in changes) {
    if (key === "userToken") {
      let storageChange = changes[key];
      if (storageChange.newValue) {
        if (logger) {
          logger.logMessage(CoInformLogger.logTypes.info, `User logged in: ${storageChange.newValue}`);
        }
        coinformUserToken = storageChange.newValue;
      }
      else {
        if (logger) {
          logger.logMessage(CoInformLogger.logTypes.info, `User logged out: ${storageChange.oldValue}`);
        }
        coinformUserToken = null;
      }
    }
  }
});

const start = () => {

  logger = new CoInformLogger(CoInformLogger.logTypes[configuration.coinform.logLevel]);
  client = new CoinformClient(fetch, configuration.coinform.apiUrl);

  logoURL = browserAPI.extension.getURL(logoURL);
  minlogoURL = browserAPI.extension.getURL(minlogoURL);

  browserAPI.runtime.sendMessage({
    contentScriptQuery: "ConfigureBackground", 
    coinformApiUrl: configuration.coinform.apiUrl
  });

  if (window.location.hostname.indexOf('twitter.com') >= 0) {

    parser = new TweetParser();
    parser.initContext();
    parser.listenForMainChanges(newTweetCallback);
    parser.listenPublishTweet(publishTweetCallback);
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
    logger.logMessage(CoInformLogger.logTypes.info, `Publish button procesed!!`);
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

  logger.logMessage(CoInformLogger.logTypes.info, `Publish button clicked!!`);
  
  targetButton.setAttribute("disabled", "");
  targetButton.setAttribute("aria-disabled", "true");

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
  
  // attach text
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
  toolBar.offsetParent.append(loadingMessage);

  // postpone the submiting of the tweet
  setTimeout(function() {
    publishTweetDoit(targetButton);
  }, 5000);

};

const publishTweetDoit = (targetButton) => {
  let msg = document.getElementById("coinformCheckingMessage");
  msg.parentNode.removeChild(msg);
  let load = targetButton.querySelector('.spinner-border');
  load.parentNode.removeChild(load);
  targetButton.children[0].style.display = "";
  targetButton.removeAttribute("disabled");
  targetButton.removeAttribute("aria-disabled");
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

    parseApiResponse(res, tweetInfo);

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
      contentScriptQuery: "RetryAPIQuery",
      coinformApiUrl: configuration.coinform.apiUrl,
      queryId: queryId
    }, function(res) {

      parseApiResponse(res, tweetInfo);

    });

    /*function (err) {

      logger.logMessage(CoInformLogger.logTypes.error, `Request Error (${tweetInfo.domObject.coInfoCounter}): ${err}`, tweetInfo.id);
      // console.error(err);

      // Call retry in random (between 0.5 and 2.5) seconds
      setTimeout(function() {
        retryTweetQuery(tweetInfo, queryId);
      }, randomInt(500, 2500));

    });*/

  }

};

const parseApiResponse = (res, tweetInfo) => {

  let resStatus = null;
  let acurracyLabel = null;

  if (res && res.status) {
    resStatus = JSON.stringify(res.status).replace(/['"]+/g, '');
  }

  // Discard requests with 400 http return codes
  if ((resStatus.localeCompare('400') === 0) || (resStatus.localeCompare('404') === 0)) {
    logger.logMessage(CoInformLogger.logTypes.error, `Request ${resStatus} Error (${tweetInfo.domObject.coInfoCounter})`, tweetInfo.id);
    return;
  }

  logger.logMessage(CoInformLogger.logTypes.debug, `${resStatus} response (${tweetInfo.domObject.coInfoCounter})`, tweetInfo.id);

  if (resStatus && ((resStatus.localeCompare('done') === 0) || (resStatus.localeCompare('partly_done') === 0))) {

    // Result from API call
    acurracyLabel = JSON.stringify(res.response.rule_engine.final_credibility).replace(/['"]+/g, '').replace(/\s+/g,'_');
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
      retryTweetQuery(tweetInfo, res.query_id);
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

    let newCategory = configuration.coinform.categories[label];
    if (!newCategory) {
      logger.logMessage(CoInformLogger.logTypes.warning, `Unexpected Label: ${label}`, tweet.id);
    }
    else if (newCategory.localeCompare("blur") === 0) {
      createTweetLabel(tweet, label);
      createTweetBlurry(tweet, label);
    }
    else if (newCategory.localeCompare("label") === 0) {
      createTweetLabel(tweet, label);
    }

    node.coInformLabel = label;

  }

};

const createTweetBlurry = (tweet, label) => {

  let node = tweet.domObject;
  node.setAttribute(parser.untrustedAttribute, 'true');

  let buttonContainer = createCannotSeeTweetButton(tweet.id, function() {
    openCannotSeePopup(tweet, label);
  });

  node.append(buttonContainer);

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

const createTweetLabel = (tweet, label) => {

  let node = tweet.domObject;

  let labelcat = document.createElement("SPAN");
  labelcat.setAttribute('id', `coinformTweetLabel-${tweet.id}`);
  labelcat.setAttribute('class', "coinformTweetLabel");
  let txt = document.createTextNode(browserAPI.i18n.getMessage(label));
  labelcat.append(txt);

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

function openCannotSeePopup(tweet, label) {

  return Swal2.fire({
    type: 'info',
    title: browserAPI.i18n.getMessage('tweet_tagged_as', browserAPI.i18n.getMessage(label)),
    showCloseButton: true,
    showCancelButton: false,
    confirmButtonColor: buttonColor,
    confirmButtonText: browserAPI.i18n.getMessage('see_tweet'),
    html:
      '<span>' + browserAPI.i18n.getMessage(label + '__info') + '</span>',
    footer:
      `<img class="coinformPopupLogo" src="${minlogoURL}"/>`,
    focusConfirm: true
  }).then(function (result) {
    if(result.value === true){
      // function when confirm button is clicked
      removeTweetBlurry(tweet);
    }
  });

}

function logoClickAction(tweet) {

  if (coinformUserToken) {
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
    categoryOptions[key] = browserAPI.i18n.getMessage(key);
  });

  let popupTitle = browserAPI.i18n.getMessage('tweet_not_tagged');

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
      '<span>' + browserAPI.i18n.getMessage('provide_claim') + '</span>' +
      '<input id="swal-input1" placeholder="' + browserAPI.i18n.getMessage('url') + '" type="url" pattern="https?://.*" class="swal2-input">' +
      '<textarea id="swal-input2" placeholder="' + browserAPI.i18n.getMessage('comment') + '" class="swal2-textarea">',
    footer:
      `<img class="coinformPopupLogo" src="${minlogoURL}"/>`
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
          if (res.evaluation_id) {
            let resEvalId = JSON.stringify(res.evaluation_id).replace(/['"]+/g, '');
            logger.logMessage(CoInformLogger.logTypes.info, `Claim sent. Evaluation ID = ${resEvalId}`, tweet.id);
            Swal2.fire(browserAPI.i18n.getMessage('sent'), browserAPI.i18n.getMessage('feedback_sent'), 'success');
          }
          else {
            let resStatus = "Unknown";
            if (res.status) resStatus = JSON.stringify(res.status).replace(/['"]+/g, '');
            logger.logMessage(CoInformLogger.logTypes.error, `Claim sending ${resStatus} Error`, tweet.id);
            Swal2.fire(browserAPI.i18n.getMessage('error'), browserAPI.i18n.getMessage('feedback_not_sent'), 'error');
          }
        }).catch(err => {
          logger.logMessage(CoInformLogger.logTypes.error, `Claim sending error: ${err}`, tweet.id);
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
      `<img class="coinformPopupLogo" src="${minlogoURL}"/>`,
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
  let pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
  '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.?)+[a-z]{2,}|'+ // domain name
  '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
  '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
  '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
  '(\\#[-a-z\\d_]*)?$','i'); // fragment locator
  return pattern.test(str);
}

