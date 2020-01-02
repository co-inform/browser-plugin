/* jshint esversion: 6, devel: true */

const jQuery = require('jquery');
// const Publication = require('./publication');
const ChangeObserver = require('./change-observer');

module.exports = TweetParser;

let tweetIdIndex = 0;
const idAttribute = "coinform-id";
const mainWrapperSelector = "main";
const tweetJQuerySelector = "article";
const usernameSelector = "[data-testid='tweet'] > div:nth-child(2) > div:first-child > div:first-child a > div > div:nth-child(2)";
const tweetIdSelector = "[data-testid='tweet'] > div:nth-child(2) > div:first-child > div:first-child  > a";
const usernameAttribute = "coinform-username";
const textSelector = "[data-testid='tweet'] > div:nth-child(2) > div:nth-child(2)";
const textSelectorTweetPageCase = "article > div:first-child div[lang]";
const textSelectorTweetPageResponsesCase = "[data-testid='tweet'] > div:nth-child(2) > div[lang]";
const $ = jQuery;
let tweetsList = [];
let pageCase = null;

function TweetParser() {
}

TweetParser.prototype = {

  triggerFirstTweetBatch: (callback) => {

    tweetsListUpdate();
    indexTweets(callback);

  },
  listenForMainChanges: (newTweetCallback) => {

    const mainNode = $(mainWrapperSelector);
    const mainObserver = new ChangeObserver(mainNode[0], newTweet => twitterMainChangeCallback(newTweet, newTweetCallback));

    mainObserver.listenSubtree(true);
    mainObserver.observe();

  },
  usernameAttribute: usernameAttribute,
  trustedAttribute: "coinform-trusted",
  untrustedAttribute: "coinform-untrusted"

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

}

const getTweetInfo = (tweet, num) => {

  const user = tweet.querySelector(usernameSelector) ? tweet.querySelector(usernameSelector).textContent : null;
  let text = null;
  const link = tweet.querySelector(tweetIdSelector) ? tweet.querySelector(tweetIdSelector) : null;
  let tweetid = null;

  // Case when we are in a Tweet Page, with its responses
  if (pageCase == "tweet") {
    // The first one is the main Tweet
    if (num === 0) {
      let auxMatch = window.location.href.match(/\d+\b/g);
      if (auxMatch.length > 0) tweetid = auxMatch[auxMatch.length - 1];
      text = tweet.querySelector(textSelectorTweetPageCase) ? tweet.querySelector(textSelectorTweetPageCase).textContent : null;
    }
    // The other cases are the responses tweets
    else {
      let auxMatch = link.href.match(/\d+\b/g);
      if (auxMatch.length > 0) tweetid = auxMatch[auxMatch.length - 1];
      text = tweet.querySelector(textSelectorTweetPageResponsesCase) ? tweet.querySelector(textSelectorTweetPageResponsesCase).textContent : null;
    }
  }
  // Case when we are in the Tweeter Home Page, or a User Page
  else if (link && link.href.match(/\d+\b/g)) {
    let auxMatch = link.href.match(/\d+\b/g);
    if (auxMatch.length > 0) tweetid = auxMatch[auxMatch.length - 1];
    text = tweet.querySelector(textSelector) ? tweet.querySelector(textSelector).textContent : null;
  }

  const isAnalyzed = false;
  const containsLogo = false;

  
  return {
    username: user,
    text: text,
    id: tweetid,
    links: getLinks(tweet),
    domObject: tweet,
    analyzed: isAnalyzed,
    logo: containsLogo
  };

};

const indexTweets = (callback) => {

  tweetsList.forEach((tweet, num) => {

    const tweetInfo = getTweetInfo(tweet, num);

    if (tweetInfo.username) {

      idAssignator(tweet);
      tweet.setAttribute(usernameAttribute, tweetInfo.username);
      callback(tweetInfo);

    }

  });

};

const twitterMainChangeCallback = (change, callback) => {

  if (!!change.querySelector(tweetJQuerySelector)) {

    tweetsListUpdate();
    indexTweets(callback);
  }

};

// TBD return links array
const getLinks = (tweet) => {

  return [1, 2, 3];

};

const tweetsListUpdate = () => {

  checkPageCase();
  tweetsList = document.querySelectorAll(tweetJQuerySelector);

};

const idAssignator = (node) => {

  if (!node.hasAttribute(idAttribute)) {
    node.setAttribute(idAttribute, tweetIdIndex);
    tweetIdIndex++;
  }

};