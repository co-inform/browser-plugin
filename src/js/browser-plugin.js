/* jshint esversion: 6, devel: true */

const $ = require('jquery');
const Swal2 = require('sweetalert2');
const CoinformClient = require('./coinform-client');
const TweetParser = require('./tweet-parser');
const FacebookParser = require('./facebook-parser');
var counter = 1;
var tweetData;
const MAX_RETRIES = 10;
const browser = chrome || browser;
let client;
let configuration;
let parser;

const thresholdLevels = {
  high: 20,
  medium: 50,
  low: 80
};

var opts = {
  lines: 20, // The number of lines to draw
  length: 40, // The length of each line
  width: 20, // The line thickness
  radius: 35, // The radius of the inner circle
  scale: 1, // Scales overall size of the spinner
  corners: 1, // Corner roundness (0..1)
  color: '#ff0000', // CSS color or array of colors
  fadeColor: 'transparent', // CSS color or array of colors
  speed: 2.2, // Rounds per second
  rotate: 90, // The rotation offset
  animation: 'spinner-line-fade-more', // The CSS animation name for the lines
  direction: 1, // 1: clockwise, -1: counterclockwise
  zIndex: 2e9, // The z-index (defaults to 2000000000)
  className: 'spinner', // The CSS class to assign to the spinner
  top: '50%', // Top position relative to parent
  left: '50%', // Left position relative to parent
  shadow: '0 0 1px transparent', // Box-shadow for the lines
  position: 'absolute' // Element positioning
};

const usersCache = {};

/*
  Read the configuration file and if it was successful, start
*/
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
    chrome.storage.local.get(['treshold'], (data) => {
      configuration.coinform.hideThreshold = thresholdLevels[data.treshold] || thresholdLevels.medium;
  
    });

    if (window.location.hostname.includes('twitter.com')) {
      parser = new TweetParser();
    }
    else if (window.location.hostname.includes('facebook.com')) {
      parser = new FacebookParser();
    }

    setTimeout(start, 5000);
  })
  .catch(err => console.error('Could not load configuration file', err));

const start = () => {

  client = new CoinformClient(fetch, configuration.coinform.url);

  if (window.location.hostname.includes('twitter.com')) {

    parser.listenForMainChanges(newTweetCallback);
    parser.triggerFirstTweetBatch(newTweetCallback);

  } else if (window.location.hostname.includes('facebook.com')) {

    parser.fromBrowser(newFacebookPostCallback);
    parser.listenForNewPosts(newFacebookPostCallback);

  }
};

const newTweetCallback = (tweetInfo) => {

  tweetData = tweetInfo;
  if (tweetInfo.links.length > 0) {
    const score = {};

    if (usersCache.hasOwnProperty(tweetInfo.username)) {
      score.username = tweetInfo.username;
      score.misinformationScore = usersCache[tweetInfo.username];

    } else {

      usersCache[tweetInfo.username] = 30;
      score.username = tweetInfo.username;
      score.misinformationScore = 30;

      /* Create spinner that show that the tweet is being analized */
      const node = tweetInfo.domObject;
      const div = document.createElement('div');
      div.setAttribute('class', 'loader');
      div.setAttribute("id", "loader");
      node.append(div);

      // First API call to the endpoint /twitter/tweet/
      client.postCheckTweetInfo(tweetInfo.id, tweetInfo.username, tweetInfo.text).then(function(res) {
        var firstCallStatus = JSON.stringify(res.status).replace(/['"]+/g, '');
      
        // Discard request with 400 http error return codes
        if (firstCallStatus.localeCompare('400') === 0) {
          return;
        }

        // If the result status is not "done" then make a second API call with maximum 10 retries
        if (firstCallStatus.localeCompare('done') !== 0) {

          // Add random sleep time between 0 and 2 seconds
          sleep(randomInt(500, 2500));

          var firstQueryId = JSON.stringify(res.query_id);

          if (counter > MAX_RETRIES) {
            counter = 1;
            return;
          } else {
            counter++;
            client.getResponseTweetInfo(firstQueryId).then(function(res) {

              var secondCallStatus = JSON.stringify(res.status).replace(/['"]+/g, '');
              // Result from second api call
              if (secondCallStatus.localeCompare('done') === 0) {
                var secondRes = JSON.stringify(res);
                console.log(secondRes);
              }

            }).catch(err => console.log(err))
          }
        } else {
          // Result from the first api call
          var firstRes = JSON.stringify(res);
          console.log(firstRes);
        }
      }).catch(err => console.log(err));     
        
    }
  
    classifyTweet(tweetInfo, score);
  }
};

const newFacebookPostCallback = (post) => {
  if (post.links.length > 0) {
    //just for the proof of concept, use Twitter's score (even though we're in Facebook)
    client.getTwitterUserScore(post.username)
      .then(res => {
        classifyPost(post, res);

      })
      .catch(err => console.log(err));
  }
};

const classifyTweet = (tweet, score) => {

  const misinformationScore = score.misinformationScore;
  const node = tweet.domObject;

  if (node.hasAttribute(parser.untrustedAttribute) && node.getAttribute(parser.untrustedAttribute)!=='undefined') {

    return;

  } else if (misinformationScore >= configuration.coinform.hideThreshold) {

    /* Delete spinner 
    var loader = document.getElementById('loader');
    loader.parentNode.removeChild(loader); */

    node.setAttribute(parser.untrustedAttribute, misinformationScore);
    node.append(createWhyButton('tweet'));
    
  }

};

const classifyPost = (post, score) => {

  const misinformationScore = score.misinformationScore;
  const dom = post.domObject;

  $(dom.find('._3ccb')[0]).css('opacity', `${1 - misinformationScore/100}`);
  dom.prepend(createWhyButton(score, 'post', true));
};


const createWhyButton = (publicationName, addPaddingTop = false) => {

  const div = document.createElement('div');
  div.setAttribute('class', 'coinform-button-container');

  if (addPaddingTop) {

    div.addClass('coinform-padding-top-10');

  }

  const button = document.createElement('button');
  button.innerText=`This ${publicationName} contains misinformation, do you want to provide feedback?`;
  button.setAttribute('type', 'button');
  button.setAttribute('class', 'coinform-button coinform-button-primary');

  var resultDropdown;
  div.addEventListener('click', (event) => {

    event.preventDefault();
    Swal2.fire({

      type: 'info',
      title: `Provide any refuting/supporting links, comments and accuracy label`,
      text: `Provide any refuting/supporting links and any comments`,
      showCloseButton: true,
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      confirmButtonText: 'Submit',
      cancelButtonColor: '#d33',
      footer: '<a>Thank you for your feedback</a>',
      html:
      '<input id="swal-input1" placeholder="URL" class="swal2-input">' +
      '<input id="swal-input2" placeholder="comment" class="swal2-input">',
      focusConfirm: true,
      preConfirm: () => {
        return [
          document.getElementById('swal-input1').value,
          document.getElementById('swal-input2').value
        ]
      },
      input: 'select',
      inputPlaceholder: 'required',
      inputOptions: {
        'accurate': 'accurate',
        'accurate with considerations': 'accurate with considerations',
        'unsubstantiated': 'unsubstantiated',
        'inaccurate with considerations': 'inaccurate with considerations', 
        'inaccurate': 'inaccurate',
        'not verifiable': 'not verifiable'
      },
      inputValidator: (value) => {
        return new Promise((resolve) => {
          if (value.localeCompare('') !== 0) {
            resultDropdown = value;
          }  
          else {
            resolve('You need to select an accuracy label!');
          }

          resolve();
        })
      }
    }).then(function (result) {

      return new Promise((resolve) => {
        var returned = result[Object.keys(result)[0]];
        returned = returned.toString();
        var array = returned.split(',');
        var url = array[0], comment = array[1];

        if (url.localeCompare('') === 0) {
          alert('You need to insert an URL!');
        }
        else if (comment.localeCompare('') === 0) {
          alert('You need to insert a comment!');
        }
        else {
          // url comment resultDropdown
          // make api call here
          var evaluation = { 
            'evaluation': [ { 'label': resultDropdown, 'url': url, 'comment': comment}]
          }
          
          client.postTwitterEvaluate(tweetData.id, evaluation)
          .then(res => {
            
            console.log('Query ID = ' + JSON.stringify(res));
            
          })
          .catch(err => console.log(err));

          resolve();
        }
      })
    });
  });
  
  div.append(button);

  return div;
};

function randomInt(low, high) {
  return Math.floor(Math.random() * (high - low + 1) + low)
}

function sleep(delay) {
  var start = new Date().getTime();
  while (new Date().getTime() < start + delay);
}