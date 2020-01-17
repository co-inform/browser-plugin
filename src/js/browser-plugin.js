
const $ = require('jquery');
const Swal2 = require('sweetalert2');
const CoinformClient = require('./coinform-client');
const TweetParser = require('./tweet-parser');
const FacebookParser = require('./facebook-parser');
const CoInformLogger = require('./coinform-logger');

const pluginCache = {};

const MAX_RETRIES = 10;
const browser = chrome || browser;
let logger;
let client;
let configuration;
let parser;

window.addEventListener("load", function(){

  // console.log("Page loaded!");

  //Read the configuration file and if it was successful, start
  fetch(browser.extension.getURL('/resources/config.json'), {
    mode: 'cors',
    header: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  })
    .then(res => res.json())
    .then(res => {

      configuration = res;

      if (window.location.hostname.indexOf('twitter.com') >= 0) {

        parser = new TweetParser();

      } else if (window.location.hostname.indexOf('facebook.com') >= 0) {

        parser = new FacebookParser();

      }

      setTimeout(start, 1000);
    })
    .catch(err => {
      console.error('Could not load configuration file', err)
    });

});

const start = () => {

  logger = new CoInformLogger(CoInformLogger.logTypes.warning);
  
  client = new CoinformClient(fetch, configuration.coinform.apiUrl);

  browser.runtime.sendMessage({
    contentScriptQuery: "ConfigureBackground", 
    coinformApiUrl: configuration.coinform.apiUrl
  });

  if (window.location.hostname.indexOf('twitter.com') >= 0) {

    parser.initContext();
    parser.listenForMainChanges(newTweetCallback);
    parser.listenPublishTweet(publishTweetCallback);
    parser.triggerFirstTweetBatch(newTweetCallback);

  } else if (window.location.hostname.indexOf('facebook.com') >= 0) {

    parser.fromBrowser(newFacebookPostCallback);
    parser.listenForNewPosts(newFacebookPostCallback);

  }
};

const publishTweetCallback = (clickEvent, targetButton) => {

  // click situation when we already procesed the tweet and the await time has finished
  if (targetButton.coInformed) {
    logger.logConsoleDebug(CoInformLogger.logTypes.info, `Publish button procesed!!`);
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

  logger.logConsoleDebug(CoInformLogger.logTypes.info, `Publish button clicked!!`);
  
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
  let txt = document.createTextNode(browser.i18n.getMessage("checking_tweet_coinform"));
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
    logger.logConsoleDebug(CoInformLogger.logTypes.warning, `Tweet with no ID found`);
    return;
  }

  if (!tweetInfo.domObject.coInfoAnalyzed) {
    tweetInfo.domObject.coInfoAnalyzed = false;
  }

  // If the tweet has already been analyzed then skip
  if (tweetInfo.domObject.coInfoAnalyzed) {
    logger.logConsoleDebug(CoInformLogger.logTypes.info, `Already treated tweet object`, tweetInfo.id);
    return;
  }
  
  if (!pluginCache[tweetInfo.id]) {
    pluginCache[tweetInfo.id] = false;
  }

  if (!tweetInfo.domObject.coInfoLogo) {
    createClickableLogo(tweetInfo);
    tweetInfo.domObject.coInfoLogo = true;
  }

  // If the tweet has already been tagged then we directly classify it
  if (pluginCache[tweetInfo.id]) {
    logger.logConsoleDebug(CoInformLogger.logTypes.info, `Already analyzed tweet`, tweetInfo.id);
    tweetInfo.domObject.coInfoAnalyzed = true;
    classifyTweet(tweetInfo, pluginCache[tweetInfo.id]);
    return;
  }

  // First API call to the endpoint /twitter/tweet/
  client.postCheckTweetInfo(tweetInfo.id, tweetInfo.username, tweetInfo.text).then(function (res) {

    let resStatus = JSON.stringify(res.status).replace(/['"]+/g, '');

    // Discard requests with 400 http return codes
    if (resStatus.localeCompare('400') === 0) {
      logger.logConsoleDebug(CoInformLogger.logTypes.error, `Request 400 Error`, tweetInfo.id);
      return;
    }

    // If the result status has not reached the 'done' status then make a second API call to retrieve the 
    // result with a maximum of 10 retries
    if (resStatus.localeCompare('done') !== 0) {

      logger.logConsoleDebug(CoInformLogger.logTypes.info, `Not Done (${resStatus}) response`, tweetInfo.id);

      tweetInfo.domObject.coInfoCounter = 0;

      // Call retry in random (between 0.5 and 2.5) seconds
      setTimeout(function() {
        retryTweetQuery(tweetInfo, res.query_id);
      }, randomInt(500, 2500));

    } else {

      logger.logConsoleDebug(CoInformLogger.logTypes.info, `Done response`, tweetInfo.id);

      // Result from first API call
      // let firstRes = JSON.stringify(res);
      let acurracyLabel = JSON.stringify(res.response.rule_engine.final_credibility).replace(/\s+/g,'_');
      // logger.logConsoleDebug(CoInformLogger.logTypes.info, `LABEL = ${acurracyLabel}`, tweetInfo.id);

      // Tweet analyzed
      pluginCache[tweetInfo.id] = acurracyLabel;
      tweetInfo.domObject.coInfoAnalyzed = true;
      classifyTweet(tweetInfo, acurracyLabel);

    }
  }).catch(err => {
    logger.logConsoleDebug(CoInformLogger.logTypes.error, `Request Error: ${err}`, tweetInfo.id);
    // console.error(err);
  });

};

const retryTweetQuery = (tweetInfo, queryId) => {

  if (tweetInfo.domObject.coInfoCounter === undefined) {
    tweetInfo.domObject.coInfoCounter = 0;
  }

  if (tweetInfo.domObject.coInfoCounter > MAX_RETRIES) {

    logger.logConsoleDebug(CoInformLogger.logTypes.warning, `MAX retries situation (${tweetInfo.domObject.coInfoCounter}). Giving up on tweet..`, tweetInfo.id);
    return false;

  } else {

    tweetInfo.domObject.coInfoCounter++;

    chrome.runtime.sendMessage({
      contentScriptQuery: "RetryAPIQuery",
      coinformApiUrl: configuration.coinform.apiUrl,
      queryId: queryId
    }, function(res) {

      // Result from second API call
      let resStatus = null;

      if (res && res.status) {
        resStatus = JSON.stringify(res.status).replace(/['"]+/g, '');
      }

      if (!resStatus || (resStatus.localeCompare('done') !== 0)) {

        if (!resStatus) {
          logger.logConsoleDebug(CoInformLogger.logTypes.error, `NULL response (${tweetInfo.domObject.coInfoCounter})`, tweetInfo.id);
        }
        else {
          logger.logConsoleDebug(CoInformLogger.logTypes.info, `Not Done (${resStatus}) response (${tweetInfo.domObject.coInfoCounter})`, tweetInfo.id);
        }

        // Call retry in random (between 0.5 and 2.5) seconds
        setTimeout(function() {
          retryTweetQuery(tweetInfo, queryId);
        }, randomInt(500, 2500));

      }
      else {

        logger.logConsoleDebug(CoInformLogger.logTypes.info, `Done response (${tweetInfo.domObject.coInfoCounter})`, tweetInfo.id);
        
        // let secondRes = JSON.stringify(res);
        let acurracyLabel = JSON.stringify(res.response.rule_engine.final_credibility).replace(/\s+/g,'_');
        // logger.logConsoleDebug(CoInformLogger.logTypes.info, `LABEL = ${acurracyLabel}`, tweetInfo.id);

        // Tweet analyzed
        pluginCache[tweetInfo.id] = acurracyLabel;
        tweetInfo.domObject.coInfoAnalyzed = true;
        classifyTweet(tweetInfo, acurracyLabel);

      }

    });

    /*function (err) {

      logger.logConsoleDebug(CoInformLogger.logTypes.error, `Request Error (${tweetInfo.domObject.coInfoCounter}): ${err}`, tweetInfo.id);
      // console.error(err);

      // Call retry in random (between 0.5 and 2.5) seconds
      setTimeout(function() {
        retryTweetQuery(tweetInfo, queryId);
      }, randomInt(500, 2500));

    });*/

  }

};

const newFacebookPostCallback = (post) => {

  if (post.links.length > 0) {
    // Just for the proof of concept, use Twitter's score (even though we're in Facebook)
    client.getTwitterUserScore(post.username)
      .then(res => {
        classifyPost(post, res);

      })
      .catch(err => {
        logger.logConsoleDebug(CoInformLogger.logTypes.error, `Request error: ${err}`);
        //console.error(err)
      });
  }

};

const classifyTweet = (tweet, accuracyLabel) => {

  const node = tweet.domObject;
  const label = accuracyLabel.replace(/['"]+/g, '');
  node.coInformLabel = label;

  if (!(node.hasAttribute(parser.untrustedAttribute) && node.getAttribute(parser.untrustedAttribute) !== 'undefined')) {
    let button;
    let category = configuration.coinform.categories[label];
    if (category) {
      if (category.localeCompare("misinformation") === 0) {
        node.setAttribute(parser.untrustedAttribute, 0);
        button = createCannotSeeTweetButton(tweet, label);
        createTweetLabel(tweet, label);
        node.append(button);
      }
    }
    else {
      logger.logConsoleDebug(CoInformLogger.logTypes.warning, `Classifying Unknown Label (${label})`, tweet.id);
    }
  }

};

const createClickableLogo = (tweet) => {

  let node = tweet.domObject;
  let img = document.createElement("IMG");
  img.setAttribute("class", "coinformTweetLogo");
  img.setAttribute("id", `coinformTweetLogo-${tweet.id}`);

  let imgURL = browser.extension.getURL("/resources/coinform48.png");
  img.setAttribute("src", imgURL);

  img.addEventListener('click', (event) => {
    // prevent opening the tweet
    event.stopImmediatePropagation();
    event.preventDefault();
    event.stopPropagation();
    createExtendedTweetMenu(tweet);
  });
  node.append(img);

  return img;

};

const createTweetLabel = (tweet, label) => {

  let labelcat = document.createElement("SPAN");
  labelcat.setAttribute("class", "coinformTweetLabel");
  let txt = document.createTextNode(browser.i18n.getMessage(label));
  labelcat.append(txt);
  labelcat.setAttribute("id", `coinformTweetLabel-${tweet.id}`);
  let node = tweet.domObject;
  node.prepend(labelcat);

  return labelcat;

};

const createCannotSeeTweetButton = (tweet, label) => {

  const div = document.createElement('div');
  div.setAttribute('class', 'feedback-button-container');
  div.setAttribute('id', `feedback-button-container-${tweet.id}`);

  const button = document.createElement('button');
  button.innerText = browser.i18n.getMessage('why_cant_see');
  button.setAttribute('type', 'button');
  button.setAttribute('class', 'coinform-button coinform-button-primary whyButton');
  button.setAttribute("id", `whyButton-${tweet.id}`);

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    createBasicTweetMenu(tweet, label);
  });

  div.addEventListener('click', ignoreTweetClick);

  div.append(button);

  return div;

};

const classifyPost = (post, score) => {

  const misinformationScore = score.misinformationScore;
  const dom = post.domObject;

  $(dom.find('._3ccb')[0]).css('opacity', `${1 - misinformationScore / 100}`);
  dom.prepend(createWhyButton(score, 'post', true));

};

function createBasicTweetMenu(tweet, label) {

  return Swal2.fire({
    type: 'info',
    title: strParse(browser.i18n.getMessage('tweet_tagged_as'), browser.i18n.getMessage(label)),
    showCloseButton: true,
    showCancelButton: false,
    confirmButtonColor: '#3085d6',
    confirmButtonText: browser.i18n.getMessage('see_tweet'),
    focusConfirm: true,
  }).then(function (result) {
    if(result.value === true){
      // function when confirm button is clicked
      const node = tweet.domObject;
      node.removeAttribute(parser.untrustedAttribute);
      document.getElementById(`whyButton-${tweet.id}`).remove();
      document.getElementById(`feedback-button-container-${tweet.id}`).remove();
    }
  });

}

function createExtendedTweetMenu(tweet) {

  let node = tweet.domObject;

  let resultDropdown;

  let categoryOptions = {};

  Object.keys(configuration.coinform.categories).forEach(function(key) {
    categoryOptions[key] = browser.i18n.getMessage(key + '__info');
  });

  let menuTitle = browser.i18n.getMessage('tweet_not_tagged');

  if (node.coInformLabel) {
    let auxlabel = browser.i18n.getMessage(node.coInformLabel);
    if (!auxlabel) auxlabel = node.coInformLabel;
    menuTitle = strParse(browser.i18n.getMessage('tweet_tagged_as'), auxlabel);
  }

  return Swal2.fire({
    type: 'info',
    title: menuTitle,
    showCloseButton: true,
    showCancelButton: false,
    confirmButtonColor: '#3085d6',
    confirmButtonText: browser.i18n.getMessage('submit'),
    html:
      '<span>' + browser.i18n.getMessage('provide_claim') + '</span>' +
      '<input id="swal-input1" placeholder="' + browser.i18n.getMessage('url') + '" class="swal2-input">' +
      '<input id="swal-input2" placeholder="' + browser.i18n.getMessage('comment') + '" class="swal2-input">',
    focusConfirm: true,
    preConfirm: () => {
      return [
        document.getElementById('swal-input1').value,
        document.getElementById('swal-input2').value
      ];
    },
    input: 'select',
    inputPlaceholder: browser.i18n.getMessage('choose_claim'),
    inputOptions: categoryOptions,
    inputValidator: (value) => {
      return new Promise((resolve) => {
        if (value.localeCompare('') !== 0) {
          resultDropdown = value;
        } else {
          resolve(browser.i18n.getMessage('please_choose_claim'));
        }

        resolve();
      });
    }
  }).then(function (result) {
    if (result.value === true) {
      return new Promise((resolve) => {
        let returned = result[Object.keys(result)[0]];
        returned = returned.toString();
        let array = returned.split(',');
        let url = array[0], comment = array[1];

        if (url.localeCompare('') === 0) {
          alert(browser.i18n.getMessage('provide_url'));
        } else if (comment.localeCompare('') === 0) {
          alert(browser.i18n.getMessage('provide_additional_info'));
        } else {

          // url comment resultDropdown
          let evaluation = {
            'evaluation': [{'label': resultDropdown, 'url': url, 'comment': comment}]
          };

          client.postTwitterEvaluate(tweet.id, evaluation).then(function (res) {
            
            let resStatus = JSON.stringify(res.status).replace(/['"]+/g, '');
            let resEvalId = JSON.stringify(res.evaluation_id).replace(/['"]+/g, '');
            logger.logConsoleDebug(CoInformLogger.logTypes.info, `Claim sent. Evaluation ID = ${resEvalId}`, tweet.id);

          }).catch(err => {

            logger.logConsoleDebug(CoInformLogger.logTypes.error, `Request error: ${err}`, tweet.id);
            //console.error(err);

          });

          Swal2.fire(browser.i18n.getMessage('sent'), browser.i18n.getMessage('feedback_sent'), 'success');

          resolve();
        }
      });
    }
  });

}

function ignoreTweetClick(event) {
  event.preventDefault();
  event.stopPropagation();
  return false;
}

function strParse(str) {
  let args = [].slice.call(arguments, 1), i = 0;
  return str.replace(/%s/g, () => args[i++]);
}

function randomInt(low, high) {
  return Math.floor(Math.random() * (high - low + 1) + low);
}
