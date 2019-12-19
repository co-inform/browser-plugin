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
const textSelector = "[data-testid='tweet'] > div:nth-child(2) >  div:nth-child(2)";
const $ = jQuery;
let tweetsList = [];

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

const getTweetInfo = (tweet) => {

  const user = tweet.querySelector(usernameSelector) ? tweet.querySelector(usernameSelector).textContent : null;
  const text = tweet.querySelector(textSelector) ? tweet.querySelector(textSelector).textContent : null;
  const tweetid = tweet.querySelector(tweetIdSelector) ? tweet.querySelector(tweetIdSelector).href.match(/\d+\b/g)[0] : null;
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

  tweetsList.forEach(tweet => {

    const tweetInfo = getTweetInfo(tweet);

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

  tweetsList = document.querySelectorAll(tweetJQuerySelector);

};

const idAssignator = (node) => {

  if (!node.hasAttribute(idAttribute)) {
    node.setAttribute(idAttribute, tweetIdIndex);
    tweetIdIndex++;
  }

};