
const jQuery = require('jquery');
// const Publication = require('./publication');
const ChangeObserver = require('./change-observer');

module.exports = TweetParser;

const coinformParsedAttribute = "coinform-parsed";

// selector for main div
const mainWrapperSelector = "main[role='main']";
const tweetDeckMainWrapperId = "container";

// _Note: after some twitter changes, now the html structure seems to be the same for the both user cases. But anyway we leave this prepared for future changes that may differ again the user logged and user not logget html structure

// selectors for tweets section div
// for different user cases: user-logged and not-user-logged cases
const sectionSelectors = {
  "user-logged": "[role='main'] [data-testid='primaryColumn'] section",
  "not-user-logged": "[role='main'] [data-testid='primaryColumn'] section"
};

// selectors for tweets divs
// for different user cases: user-logged and not-user-logged cases
const tweetSelectors = {
  "user-logged": "article",
  "not-user-logged": "article"
};

// selectors for tweet username
// for different user cases: user-logged and not-user-logged cases
// _Note: the id is dynamically removed, so we can not use it ("[data-testid='tweet'] div#tweet-user-screen-name")
const usernameSelectors = {
  "user-logged": "[data-testid='tweet'] > div:nth-child(2) > div:first-child a[href^='/'] span",
  "not-user-logged": "[data-testid='tweet'] > div:nth-child(2) > div:first-child a[href^='/'] span",
  "tweetDeck": "header.tweet-header span.account-inline span.username"
};

// selectors for tweet id
// for different user cases: user-logged and not-user-logged cases
// _Note: the id is dynamically removed, so we can not use it ("[data-testid='tweet'] a#tweet-timestamp")
const tweetIdSelectors = {
  "user-logged": "[data-testid='tweet'] > div:nth-child(2) > div:first-child a[href*='/status/'] > time",
  "not-user-logged": "[data-testid='tweet'] > div:nth-child(2) > div:first-child a[href*='/status/'] > time",
  "tweetDeck": "header.tweet-header time.tweet-timestamp"
};
// const tweetIdAttribute = "data-tweet-id";

// selectors for tweet text
// for different page cases: tweet-page-main-tweet case, tweet-page-response-tweet case, and tweet-default (home and user page) case
const textSelectors = {
  "tweet-default": "[data-testid='tweet'] > div:nth-child(2) > div:nth-child(2) div[lang]",
  "tweet-page-main-tweet": "article > div:first-child div[lang]",
  "tweet-page-response-tweet": "[data-testid='tweet'] > div:nth-child(2) > div:nth-child(2) div[lang]",
  "tweetDeck": "div.tweet-body p.tweet-text"
};

// selector for publish tweet button
const publisTweetButtonSelector = "[data-testid='toolBar'] [data-testid^='tweetButton']"; // we detected 2 cases for the second data-testid (tweetButton and tweetButtonInline)

const retweetTweetButtonSelector = "[role='group'] [data-testid='retweet']";

const likeTweetButtonSelector = "[role='group'] [data-testid='like']";

const unlikeTweetButtonSelector = "[role='group'] [data-testid='unlike']";

// selector for user presentation menu item
const userPresentationSelector = "header[role='banner'] a[role='link'] div[role='presentation']";

// Selector for the currently logged user
const userlogged = {
  "twitter": "header[role='banner'] > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > nav",
  "tweetDeck": "header.app-header div.js-accout-summary span.username"
};

// [data-testid='tweet'] > div:nth-child(2)

const $ = jQuery;

function TweetParser(siteCase) {

  this.trustedAttribute = "coinform-trusted";
  this.untrustedAttribute = "coinform-untrusted";
  this.siteCase = siteCase;
  this.lastPageUrl = null;
  this.tweetPageIndex = 0;
  this.pageCase = null;
  this.userCase = null;
  this.mainTweetPageFound = false;

}

TweetParser.prototype = {

  initContext: function() {

    checkUserCase(this);
    checkPageCase(this);

    // _Note: This listeners would help to detect page cases changes, but they dont seem to work from a content script
    /*window.addEventListener('locationchange', function(){
      checkPageCase(this);
    }, true);
    
    window.addEventListener('hashchange', function(){
      checkPageCase(this);
    }, true);
    
    window.addEventListener('popstate', function(){
      checkPageCase(this);
    }, true);*/

  },
  triggerFirstTweetBatch: function(callback) {

    let tweetsList = getTweetsList(this);
    indexTweets(this, tweetsList, callback);

  },
  listenForMainChanges: function(newTweetCallback) {

    let mainNodeDom = null;
    if (this.siteCase == 'tweetDeck') mainNodeDom = document.getElementById(tweetDeckMainWrapperId);
    else {
      const mainNode = $(mainWrapperSelector);
      if (mainNode && mainNode[0]) mainNodeDom = mainNode[0];
    }

    if (mainNodeDom) {
      const mainObserver = new ChangeObserver(mainNodeDom, newNode => mainChangeCallback(this, newNode, newTweetCallback));

      mainObserver.listenSubtree(true);
      mainObserver.listenChildList(true);
      mainObserver.setAttributeFilter(['data-testid', 'data-tweet-id', 'role']);
      mainObserver.observe();
    }

  },
  listenPublishTweet: function(publishTweetCallback) {

    document.addEventListener('click', function (event) {
      let target = event.target.closest(publisTweetButtonSelector);
      if (target) {
        publishTweetCallback(event, target);
      }
    }, true); // important to set it true so the event propagation is capturing and not bubbling

  },
  listenRetweetTweet: function(retweetTweetCallback) {

    document.addEventListener('click', function (event) {
      let target = event.target.closest(retweetTweetButtonSelector);
      if (target) {
        retweetTweetCallback(event, target);
      }
    }, true); // important to set it true so the event propagation is capturing and not bubbling

  },
  listenLikeTweet: function(likeTweetCallback) {

    document.addEventListener('click', function (event) {
      let target = event.target.closest(likeTweetButtonSelector);
      if (target) {
        likeTweetCallback(event, target);
      }
    }, true); // important to set it true so the event propagation is capturing and not bubbling

  },
  listenUnlikeTweet: function(unlikeTweetCallback) {

    document.addEventListener('click', function (event) {
      let target = event.target.closest(unlikeTweetButtonSelector);
      if (target) {
        unlikeTweetCallback(event, target);
      }
    }, true); // important to set it true so the event propagation is capturing and not bubbling

  },
  getPageCase: function() {
    return this.pageCase;
  },
  getUserCase: function() {
    return this.userCase;
  }

};

function checkPageCase(thatParser) {

  // Case when we are in a Tweet Page, with its responses
  if (window.location.href.match(/http(?:s)?:\/\/(?:www\.)?twitter\.com\/[\w]+\/status\/[0-9]+/)) {
    thatParser.pageCase = "tweet";
  }
  // Case when we are in the Twitter Home Page
  else if (window.location.href.match(/http(?:s)?:\/\/(?:www\.)?twitter\.com\/home/)) {
    thatParser.pageCase = "home";
  }
  // Case when we are in a Twitter User Timeline Page
  else if (window.location.href.match(/http(?:s)?:\/\/(?:www\.)?twitter\.com\/[\w]+\/timelines\/[0-9]+/)) {
    thatParser.pageCase = "timeline";
  }
  // Case when we are in a Twitter User Page
  else if (window.location.href.match(/http(?:s)?:\/\/(?:www\.)?twitter\.com\/[\w]+/)) {
    thatParser.pageCase = "user";
  }
  // Case when we are in the TweetDeck Page
  else if (window.location.href.match(/http(?:s)?:\/\/(?:www\.)?tweetdeck\.twitter\.com/)) {
    thatParser.pageCase = "tweetDeck";
  }
  else {
    thatParser.pageCase = "unknown";
  }

  if (window.location.href != thatParser.lastPageUrl) {
    thatParser.lastPageUrl = window.location.href;
    thatParser.tweetPageIndex = 0;
    thatParser.mainTweetPageFound = false;
  }

}

function checkUserCase(thatParser) {

  let userName = null;
  if (this.siteCase == 'tweetDeck') {
    let user = document.querySelector(userlogged['tweetDeck']);
    if (user && user[0]) {
      userName = user[0].textContent;
    }
  }
  else {
    let user = document.querySelector(userlogged['twitter']);
    if (user) {
      let childs = user.childNodes;
      if (childs && childs[6]) {
        if (childs[6].getAttribute("href")) {
          userName = childs[6].getAttribute("href").replace(/[^\w\s]/gi, '');
        }
      }
    }
  }

  // Check if we are in the User logged case or not
  /*let presentationNode = document.querySelector(userlogged);
  if (presentationNode) {
    let userMenuLink = presentationNode.offsetParent;
    for ( ; userMenuLink && userMenuLink !== document; userMenuLink = userMenuLink.parentNode ) {
      if ( userMenuLink.matches("[role='link']") ) break;
    }
    if (userMenuLink) {
      userName = userMenuLink.getAttribute("href");
      if (userName) {
        userCase = userName;
      }
    }
  }*/

  if (userName) {
    thatParser.userCase = userName;
  }

}

function getTweetInfo(thatParser, tweet) {

  let tweetid = null;
  let tweetUrl = null;
  let user = null;
  let text = null;

  let selectorUserCase = (thatParser.userCase === null) ? "not-user-logged" : "user-logged";
  if (thatParser.pageCase == "tweetDeck") selectorUserCase = "tweetDeck";

  // Trying to see if we can check the kind of tweet (main page tweet) from it's style
  //let tweetStyles = getComputedStyle(tweet);

  // Get the tweet Id (normally found on a link on the tweet time div)
  let timeNode = tweet.querySelector(tweetIdSelectors[selectorUserCase]) ? tweet.querySelector(tweetIdSelectors[selectorUserCase]) : null;
  if (timeNode) {
    let link = timeNode.parentNode;
    if (!link || (link.tagName.toUpperCase().localeCompare("A") !== 0)) {
      link = timeNode.querySelector("a");
    }
    if (link && (link.tagName.toUpperCase().localeCompare("A") === 0) && link.href.match(/\d+\b/g)) {
      tweetUrl = link.href;
      let auxMatch = link.href.match(/\d+\b/g);
      if (auxMatch.length > 0) tweetid = auxMatch[auxMatch.length - 1];
    }
  }
  //  Special case when we are in a Tweet Page, since and we do not have the tweet link to parse the id, we 
  //  get the id from the url. Sometimes this main Tweet is not located at the top of the page, that's why we need 
  //  to check and retrieve this main Tweet's id from the url
  else if ( (thatParser.pageCase === "tweet") && (timeNode === null) && !thatParser.mainTweetPageFound) {
    tweetUrl = window.location.href;
    let auxMatch = tweetUrl.match(/\d+\b/g);
    if (auxMatch.length > 0) {
      tweetid = auxMatch[auxMatch.length - 1];
    }
    thatParser.mainTweetPageFound = true;
  }
  if (!tweetid) {
    // Detected tweet id NULL case when the Tweet is advertisment, or promoted
    // console.log("Tweed ID NULL Error!!");
  }

  // Get the tweet User Id
  let userNode = querySelectorContains(tweet, usernameSelectors[selectorUserCase], /^\@/);
  if (userNode && userNode.length) {
    user = userNode[0].textContent.replace(/\@/, '');
  }

  // Get the tweet content text
  if (thatParser.pageCase == "tweetDeck") {
    text = tweet.querySelector(textSelectors['tweetDeck']) ? tweet.querySelector(textSelectors['tweetDeck']).textContent : null;
  }
  // Case when we are in a Tweet Page, with its responses
  else if (thatParser.pageCase === "tweet") {
    // The first one is the main Tweet
    if (thatParser.tweetPageIndex === 0) {
      text = tweet.querySelector(textSelectors['tweet-page-main-tweet']) ? tweet.querySelector(textSelectors['tweet-page-main-tweet']).textContent : null;
    }
    // The other cases are the responses tweets
    else {
      text = tweet.querySelector(textSelectors['tweet-page-response-tweet']) ? tweet.querySelector(textSelectors['tweet-page-response-tweet']).textContent : null;
    }
  }
  // Case when we are in the Tweeter Home Page, or a User Page
  else {
    text = tweet.querySelector(textSelectors['tweet-default']) ? tweet.querySelector(textSelectors['tweet-default']).textContent : null;
  }
  
  return {
    username: user,
    text: text,
    id: tweetid,
    url: tweetUrl,
    domObject: tweet
  };

}

function treatNewTweet(thatParser, tweet, callback) {

  const tweetInfo = getTweetInfo(thatParser, tweet);

  if (tweetInfo.id != null) {

    if (!tweet.hasAttribute(coinformParsedAttribute)) {
      tweet.setAttribute(coinformParsedAttribute, 'true');
      thatParser.tweetPageIndex++;
    }

    callback(tweetInfo);

  }

}

function indexTweets(thatParser, tweetsList, callback) {

  tweetsList.forEach((tweet, num) => {
    treatNewTweet(thatParser, tweet, callback);
  });

}

function mainChangeCallback(thatParser, newNode, callback) {

  let auxTweetNode = null;
  let auxSectionNode = null;
  let newTweetNode = null;

  // conditional to avoid exceptions when treating an strange element (like new text nodes)
  if (newNode && (typeof newNode.querySelector !== "undefined")) {

    // we have to check if there was a new tweet, or a new section
    // to check it we have to consider whick user case we are in (logged / not logged)
    let selectorCase = (thatParser.userCase === null) ? "not-user-logged" : "user-logged";
    // we check if the new node is a new tweet itself
    if (newNode.matches(tweetSelectors[selectorCase])) {
      newTweetNode = newNode;
      auxTweetNode = true;
    }
    else {
      // we check if the new node contains a new tweet
      auxTweetNode = newNode.querySelector(tweetSelectors[selectorCase]);
      if (auxTweetNode) {
        newTweetNode = auxTweetNode;
        auxTweetNode = true;
      }
    }
    // we check if the new node is a new section itself
    auxSectionNode = newNode.matches(sectionSelectors[selectorCase]);
    if (!auxSectionNode) {
      // we check if the new node contains a new section
      auxSectionNode = newNode.querySelector(sectionSelectors[selectorCase]);
    }

  } else {
    // Detected strange node
    // console.log("Error: Strange node added: "+(typeof newNode));
  }

  if (auxSectionNode) {
    // new section added, we parse and treat all tweets
    checkPageCase(thatParser);
    let tweetsList = getTweetsList(thatParser);
    indexTweets(thatParser, tweetsList, callback);
  }
  else if (auxTweetNode) {
    // new tweet added, we parse and treat the tweet
    treatNewTweet(thatParser, newTweetNode, callback);
  }

}

function getTweetsList(thatParser) {

  let selectorCase = (thatParser.userCase === null) ? "not-user-logged" : "user-logged";
  return document.querySelectorAll(tweetSelectors[selectorCase]);

}

/**
 * Query and return "node" childs that fit a "selector" and that their content text fits the "text" regExp
 * Adaptation of this solution: https://stackoverflow.com/a/37098508/743194
 * @param {*} node element from where to start the search (e.g. document)
 * @param {*} selector css selector string (e.g. 'div')
 * @param {*} text regular expression that must fit the text content of the elements found (e.g. 'sometext')
 */
function querySelectorContains(node, selector, text) {
  let elements = node.querySelectorAll(selector);
  return Array.prototype.filter.call(elements, function(element){
    return RegExp(text).test(element.textContent);
  });
}
