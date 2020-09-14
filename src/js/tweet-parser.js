
const jQuery = require('jquery');
// const Publication = require('./publication');
const ChangeObserver = require('./change-observer');

module.exports = TweetParser;

let lastPageUrl = null;
let tweetPageIndex = 0;

const coinformParsedAttribute = "coinform-parsed";

// selector for main div
const mainWrapperSelector = "main[role='main']";

// _Note: after some twitter changes, now the html structure seems to be the same for the both user cases. But anyway we leave this prepared for future changes that may differ again the user logged and user not logget html structure

// selectors for tweets section div
// for different user cases: user-logged and not-user-logged cases
const sectionSelectors = {
  "user-logged": "[role='main'] [data-testid='primaryColumn'] section",
  "not-user-logged": "[role='main'] [data-testid='primaryColumn'] section"
}

// selectors for tweets divs
// for different user cases: user-logged and not-user-logged cases
const tweetSelectors = {
  "user-logged": "article",
  "not-user-logged": "article"
}

// selectors for tweet username
// for different user cases: user-logged and not-user-logged cases
// _Note: the id is dynamically removed, so we can not use it ("[data-testid='tweet'] div#tweet-user-screen-name")
const usernameSelectors = {
  "user-logged": "[data-testid='tweet'] > div:nth-child(2) > div:first-child a[href^='/'] span",
  "not-user-logged": "[data-testid='tweet'] > div:nth-child(2) > div:first-child a[href^='/'] span"
};

// selectors for tweet id
// for different user cases: user-logged and not-user-logged cases
// _Note: the id is dynamically removed, so we can not use it ("[data-testid='tweet'] a#tweet-timestamp")
const tweetIdSelectors = {
  "user-logged": "[data-testid='tweet'] > div:nth-child(2) > div:first-child a[href*='/status/'] > time",
  "not-user-logged": "[data-testid='tweet'] > div:nth-child(2) > div:first-child a[href*='/status/'] > time"
}
// const tweetIdAttribute = "data-tweet-id";

// selectors for tweet text
// for different page cases: tweet-page-main-tweet case, tweet-page-response-tweet case, and tweet-default (home and user page) case
const textSelectors = {
  "tweet-default": "[data-testid='tweet'] > div:nth-child(2) > div:nth-child(2)",
  "tweet-page-main-tweet": "article > div:first-child div[lang]",
  "tweet-page-response-tweet": "[data-testid='tweet'] > div:nth-child(2) > div[lang]"
}

// selector for publish tweet button
const publisTweetButtonSelector = "[data-testid='toolBar'] [data-testid^='tweetButton']"; // we detected 2 cases for the second data-testid (tweetButton and tweetButtonInline)

const retweetTweetButtonSelector = "[role='group'] [data-testid='retweet']";

const likeTweetButtonSelector = "[role='group'] [data-testid='like']";

const unlikeTweetButtonSelector = "[role='group'] [data-testid='unlike']";

// selector for user presentation menu item
const userPresentationSelector = "header[role='banner'] a[role='link'] div[role='presentation']";

const $ = jQuery;
let tweetsList = [];
let pageCase = null;
let userCase = null;

// _Note: This listeners would help to detect page cases changes, but they dont seem to work from a content script
/*window.addEventListener('locationchange', function(){
  checkPageCase();
}, true);

window.addEventListener('hashchange', function(){
  checkPageCase();
}, true);

window.addEventListener('popstate', function(){
  checkPageCase();
}, true);*/

function TweetParser() {

  this.trustedAttribute = "coinform-trusted";
  this.untrustedAttribute = "coinform-untrusted";

}

TweetParser.prototype = {

  initContext: () => {

    checkUserCase();
    checkPageCase();

  },
  triggerFirstTweetBatch: (callback) => {

    tweetsListUpdate();
    indexTweets(callback);

  },
  listenForMainChanges: (newTweetCallback) => {

    const mainNode = $(mainWrapperSelector);
    const mainObserver = new ChangeObserver(mainNode[0], newNode => mainChangeCallback(newNode, newTweetCallback));

    mainObserver.listenSubtree(true);
    mainObserver.listenChildList(true);
    mainObserver.setAttributeFilter(['data-testid', 'data-tweet-id', 'role']);
    mainObserver.observe();

  },
  listenPublishTweet: (publishTweetCallback) => {

    document.addEventListener('click', function (event) {
      let target = event.target.closest(publisTweetButtonSelector);
      if (target) {
        publishTweetCallback(event, target);
      }
    }, true); // important to set it true so the event propagation is capturing and not bubbling

  },
  listenRetweetTweet: (retweetTweetCallback) => {

    document.addEventListener('click', function (event) {
      let target = event.target.closest(retweetTweetButtonSelector);
      if (target) {
        retweetTweetCallback(event, target);
      }
    }, true); // important to set it true so the event propagation is capturing and not bubbling

  },
  listenLikeTweet: (likeTweetCallback) => {

    document.addEventListener('click', function (event) {
      let target = event.target.closest(likeTweetButtonSelector);
      if (target) {
        likeTweetCallback(event, target);
      }
    }, true); // important to set it true so the event propagation is capturing and not bubbling

  },
  listenUnlikeTweet: (unlikeTweetCallback) => {

    document.addEventListener('click', function (event) {
      let target = event.target.closest(unlikeTweetButtonSelector);
      if (target) {
        unlikeTweetCallback(event, target);
      }
    }, true); // important to set it true so the event propagation is capturing and not bubbling

  }

};

const checkPageCase = () => {

  // Case when we are in a Tweet Page, with its responses
  if (window.location.href.match(/http(?:s)?:\/\/(?:www\.)?twitter\.com\/[\w]+\/status\/[0-9]+/)) {
    pageCase = "tweet";
  }
  // Case when we are in the Twitter Home Page
  else if (window.location.href.match(/http(?:s)?:\/\/(?:www\.)?twitter\.com\/home/)) {
    pageCase = "home";
  }
  // Case when we are in a Twitter User Page
  else if (window.location.href.match(/http(?:s)?:\/\/(?:www\.)?twitter\.com\/[\w]+/)) {
    pageCase = "user";
  }
  else {
    pageCase = "unknown";
  }

  if (window.location.href != lastPageUrl) {
    lastPageUrl = window.location.href;
    tweetPageIndex = 0;
  }

};

const checkUserCase = () => {

  // Check if we are in the User logged case or not
  let presentationNode = document.querySelector(userPresentationSelector);
  if (presentationNode) {
    let userMenuLink = presentationNode.offsetParent;
    for ( ; userMenuLink && userMenuLink !== document; userMenuLink = userMenuLink.parentNode ) {
      if ( userMenuLink.matches("[role='link']") ) break;
    }
    if (userMenuLink) {
      let userName = userMenuLink.getAttribute("href");
      if (userName) {
        userCase = userName;
      }
    }
  }

};

const getTweetInfo = (tweet, num) => {

  let tweetid = null;
  let tweetUrl = null;
  let user = null;
  let text = null;

  let selectorUserCase = (userCase === null) ? "not-user-logged" : "user-logged";

  // Trying to see if we can check the kind of tweet (main page tweet) from it's style
  //let tweetStyles = getComputedStyle(tweet);

  // Get the tweet Id (normally found on a link on the twet time div)
  let timeNode = tweet.querySelector(tweetIdSelectors[selectorUserCase]) ? tweet.querySelector(tweetIdSelectors[selectorUserCase]) : null;
  if (timeNode) {
    let link = timeNode.parentNode;
    if (link && link.href.match(/\d+\b/g)) {
      tweetUrl = link.href;
      let auxMatch = link.href.match(/\d+\b/g);
      if (auxMatch.length > 0) tweetid = auxMatch[auxMatch.length - 1];
    }
  }
  //  Special case when we are in a Tweet Page, since and we do not have the tweet link to parse the id, we 
  //  get the id from the url. Sometimes this main Tweet is not located at the top of the page, that's why we need 
  //  to check and retrieve this main Tweet's id from the url
  else if ( (pageCase === "tweet") && timeNode === null) {
    tweetUrl = window.location.href;
    let auxMatch = tweetUrl.match(/\d+\b/g);
    if (auxMatch.length > 0) {
      tweetid = auxMatch[auxMatch.length - 1];
    }
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
  // Case when we are in a Tweet Page, with its responses
  if (pageCase === "tweet") {
    // The first one is the main Tweet
    if (num === 0) {
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
    domObject: tweet,
    analyzed: false,
    logo: false,
    toolbar: false
  };

};

const treatNewTweet = (tweet, callback) => {

  const tweetInfo = getTweetInfo(tweet, tweetPageIndex);

  if (tweetInfo.id != null) {

    if (!tweet.hasAttribute(coinformParsedAttribute)) {
      tweet.setAttribute(coinformParsedAttribute, 'true');
      tweetPageIndex++;
    }

    callback(tweetInfo);

  }

};

const indexTweets = (callback) => {

  tweetsList.forEach((tweet, num) => {

    treatNewTweet(tweet, callback);

  });

};

const mainChangeCallback = (newNode, callback) => {

  let auxTweetNode = null;
  let auxSectionNode = null;
  let newTweetNode = null;

  // conditional to avoid exceptions when treating an strange element (like new text nodes)
  if (newNode && (typeof newNode.querySelector !== "undefined")) {

    // we have to check if there was a new tweet, or a new section
    // to check it we have to consider whick user case we are in (logged / not logged)
    let selectorCase = (userCase === null) ? "not-user-logged" : "user-logged";
    // we check if the new node is a new tweet itself
    if (newNode.matches(tweetSelectors[selectorCase])) {
      newTweetNode = newNode;
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
    checkPageCase();
    tweetsListUpdate();
    indexTweets(callback);
  }
  else if (auxTweetNode) {
    // new tweet added, we parse and treat the tweet
    treatNewTweet(newTweetNode, callback);
  }

};

const tweetsListUpdate = () => {

  let selectorCase = (userCase === null) ? "not-user-logged" : "user-logged";
  tweetsList = document.querySelectorAll(tweetSelectors[selectorCase]);

};

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
