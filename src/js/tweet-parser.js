/* jshint esversion: 6, devel: true */

const jQuery = require('jquery');
// const Publication = require('./publication');
const ChangeObserver = require('./change-observer');

module.exports = TweetParser;

let tweetIdIndex = 0;
const idAttribute = "coinform-id";
const usernameAttribute = "coinform-username";

// selector for main div
// const mainWrapperSelector = "main";
const mainWrapperSelector = "[role='main']"; // with this selector we reach both user logged and no user logged cases

// selector for tweets section div
const sectionSelector = "[role='main'] [data-testid='primaryColumn'] section"; // user logged case
const sectionAlternativeSelector = "[role='main'] #timeline"; // no user logged case

// selectors for tweets divs
const tweetSelector = "article"; // user logged case
const tweetAlternativeSelector = "li[data-item-type='tweet'] > div[data-tweet-id]"; // no user logged case

// selectors for tweet username
const usernameSelector = "[data-testid='tweet'] > div:nth-child(2) > div:first-child > div:first-child a > div > div:nth-child(2)";
// selector for tweet username for no user logged case
const usernameAlternativeSelector = "[data-tweet-id] > div:nth-child(2) > div:first-child > a:first-child > span:nth-child(3)";

// selectors for tweet id
const tweetIdSelector = "[data-testid='tweet'] > div:nth-child(2) > div:first-child > div:first-child  > a";
// selector for tweet id for no user logged case
const tweetIdAlternativeSelector = "[data-tweet-id]";
const tweetIdAlternativeAttribute = "data-tweet-id";

//selectors for tweet text
const textSelector = "[data-testid='tweet'] > div:nth-child(2) > div:nth-child(2)"; // home and user page case
const textSelectorTweetPageCase = "article > div:first-child div[lang]"; // tweet page case (main tweet)
const textSelectorTweetPageResponsesCase = "[data-testid='tweet'] > div:nth-child(2) > div[lang]"; // tweet page case (response tweets)
// selector for tweet text for no user logged case
const textAlternativeSelector = "[data-tweet-id] > div:nth-child(2) > div:nth-child(2)"

// selector for publish tweet button
const publisTweetButtonSelector = "[data-testid='toolBar'] [data-testid^='tweetButton']"; // we detected 2 cases for the second data-testid (tweetButton and tweetButtonInline)

// selector for user presentation menu item
const userPresentationSelector = "header[role='banner'] a[role='link'] div[role='presentation']";

const $ = jQuery;
let tweetsList = [];
let pageCase = null;
let userCase = null;

/*window.addEventListener('locationchange', function(){
  checkPageCase();
}, true);

window.addEventListener('hashchange', function(){
  checkPageCase();
}, true);

window.addEventListener('popstate', function(){
  checkPageCase();
}, true);

chrome.tabs.onUpdated.addListener(function(){
  checkPageCase();
});*/

function TweetParser() {

  this.usernameAttribute = usernameAttribute;
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
      let target = event.target;
      let targetParent = event.target.offsetParent;
      if (target.matches(publisTweetButtonSelector) || (targetParent && targetParent.matches(publisTweetButtonSelector))) {
        if (!target.matches(publisTweetButtonSelector) && targetParent) {
          target = targetParent;
        }
        publishTweetCallback(event, target);
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

  let user = null;
  let tweetid = null;
  let text = null;

  // Get the tweet User Id
  if (userCase === null) {
    user = tweet.querySelector(usernameAlternativeSelector) ? tweet.querySelector(usernameAlternativeSelector).textContent : null;
  }
  else {
    user = tweet.querySelector(usernameSelector) ? tweet.querySelector(usernameSelector).textContent : null;
  }

  // Get the tweet Id
  if (userCase === null) {
    tweetid = tweet.getAttribute(tweetIdAlternativeAttribute) ? tweet.getAttribute(tweetIdAlternativeAttribute) : null;
  }
  else {
    // Case when we are in a Tweet Page, with its responses, the first one is the main Tweet
    if ( (pageCase === "tweet") && (num === 0) ) {
      let auxMatch = window.location.href.match(/\d+\b/g);
      if (auxMatch.length > 0) tweetid = auxMatch[auxMatch.length - 1];
    }
    else {
      let link = tweet.querySelector(tweetIdSelector) ? tweet.querySelector(tweetIdSelector) : null;
      if (link && link.href.match(/\d+\b/g)) {
        let auxMatch = link.href.match(/\d+\b/g);
        if (auxMatch.length > 0) tweetid = auxMatch[auxMatch.length - 1];
      }
    }
  }

  // Get the tweet content text
  if (userCase === null) {
    text = tweet.querySelector(textAlternativeSelector) ? tweet.querySelector(textAlternativeSelector).textContent : null;
  }
  else {
    // Case when we are in a Tweet Page, with its responses
    if (pageCase === "tweet") {
      // The first one is the main Tweet
      if (num === 0) {
        text = tweet.querySelector(textSelectorTweetPageCase) ? tweet.querySelector(textSelectorTweetPageCase).textContent : null;
      }
      // The other cases are the responses tweets
      else {
        text = tweet.querySelector(textSelectorTweetPageResponsesCase) ? tweet.querySelector(textSelectorTweetPageResponsesCase).textContent : null;
      }
    }
    // Case when we are in the Tweeter Home Page, or a User Page
    else {
      text = tweet.querySelector(textSelector) ? tweet.querySelector(textSelector).textContent : null;
    }
  }
  
  return {
    username: user,
    text: text,
    id: tweetid,
    domObject: tweet,
    analyzed: false,
    logo: false
  };

};

const treatNewTweet = (tweet, num, callback) => {
  const tweetInfo = getTweetInfo(tweet, null);

  if (tweetInfo.username) {

    idAssignator(tweet);
    tweet.setAttribute(usernameAttribute, tweetInfo.username);
    callback(tweetInfo);

  }
};

const indexTweets = (callback) => {

  tweetsList.forEach((tweet, num) => {

    treatNewTweet(tweet, num, callback);

  });

};

const mainChangeCallback = (newNode, callback) => {

  let auxTweetNode = null;
  let auxSectionNode = null;
  let newTweetNode = null;

  // we have to check if there was a new tweet, or a new section
  // to check it we have to consider whick user case we are in (logged / not logged)
  if (userCase === null) {
    try {
      // we check if the new node is a new tweet itself
      if (newNode.matches(tweetAlternativeSelector)) {
        newTweetNode = newNode;
      }
      else {
        // we check if the new node contains a new tweet
        auxTweetNode = newNode.querySelector(tweetAlternativeSelector);
        if (auxTweetNode) {
          newTweetNode = auxTweetNode;
          auxTweetNode = true;
        }
      }
      // we check if the new node is a new section itself
      auxSectionNode = newNode.matches(sectionAlternativeSelector);
      if (!auxSectionNode) {
        // we check if the new node contains a new section
        auxSectionNode = newNode.querySelector(sectionAlternativeSelector);
      }
    } catch (e) {}
  }
  else {
    try {
      // we check if the new node is a new tweet itself
      if (newNode.matches(tweetSelector)) {
        newTweetNode = newNode;
      }
      else {
        // we check if the new node contains a new tweet
        auxTweetNode = newNode.querySelector(tweetSelector);
        if (auxTweetNode) {
          newTweetNode = auxTweetNode;
          auxTweetNode = true;
        }
      }
      // we check if the new node is a new section itself
      auxSectionNode = newNode.matches(sectionSelector);
      if (!auxSectionNode) {
        // we check if the new node contains a new section
        auxSectionNode = newNode.querySelector(sectionSelector);
      }
    } catch (e) {}
  }

  if (auxSectionNode) {
    // new section added, we parse and treat all tweets
    checkPageCase();
    tweetsListUpdate();
    indexTweets(callback);
  }
  else if (auxTweetNode) {
    // new tweet added, we parse and treat the tweet
    treatNewTweet(newTweetNode, tweetIdIndex, callback);
  }

};

const tweetsListUpdate = () => {

  if (userCase === null) {
    tweetsList = document.querySelectorAll(tweetAlternativeSelector);
  }
  else {
    tweetsList = document.querySelectorAll(tweetSelector);
  }

};

const idAssignator = (node) => {

  if (!node.hasAttribute(idAttribute)) {
    node.setAttribute(idAttribute, tweetIdIndex);
    tweetIdIndex++;
  }

};