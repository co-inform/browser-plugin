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
  dom = tweetInfo.domObject;
  if (tweetInfo.links.length > 0) {

    if (usersCache[tweetInfo.id] == null) usersCache[tweetInfo.id] = false; 

    // If the tweet has already been analized then skip
    if (usersCache[tweetInfo.id]) {
      return;
    } 

    createSpinner(tweetInfo);

    // First API call to the endpoint /twitter/tweet/
    client.postCheckTweetInfo(tweetInfo.id, tweetInfo.username, tweetInfo.text).then(function(res) {

      var firstCallStatus = JSON.stringify(res.status).replace(/['"]+/g, '');
      
      // Discard requests with 400 http return codes
      if (firstCallStatus.localeCompare('400') === 0) {
        return;
      }

      // If the result status has not reached the 'done' status then make a second API call to retrieve the 
      // result with a maximum of 10 retries
      if(firstCallStatus.localeCompare('done') !== 0) {

        // Add random sleep time between 0 and 2 seconds
        sleep(randomInt(500, 2500));
        var firstQueryId = JSON.stringify(res.query_id);

        if (counter > MAX_RETRIES) {
          counter = 1;
          return;
        } else {
          counter++;
          client.getResponseTweetInfo(firstQueryId).then(function(res) {
            
            // Result from second API call
            var secondCallStatus = JSON.stringify(res.status).replace(/['"]+/g, '');

            if (secondCallStatus.localeCompare('done') === 0) {
              // As the tweet has been analized then remove the loading spinner

              var secondRes = JSON.stringify(res);

             // console.log("SECOND REPLY = " + secondRes);

              var acurracyLabel = JSON.stringify(res.response.rule_engine.final_credibility);

              // Remove spinner 

              // Tweet analized
              usersCache[tweetInfo.id] = true;
              tweetInfo.analyzed = true;
              classifyTweet(tweetInfo, acurracyLabel);

            } else {
              // Keep showing spinner, close the request and make another request
              return;
            }
          }).catch(err => console.log(err));
        }
      } else {
        // Remove spinner

        // Result from first API call
        var firstRes = JSON.stringify(res);
        
        // console.log("FIRST REPLY = " + firstRes);

        var acurracyLabel = JSON.stringify(res.response.rule_engine.final_credibility);

        // Remove spinner

        // Tweet analized
        usersCache[tweetInfo.id] = true;
        tweetInfo.analyzed = true;
        classifyTweet(tweetInfo, acurracyLabel);
      }
    }).catch(err => console.log(err));
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

const classifyTweet = (tweet, label) => {

  const node = tweet.domObject;
  var myLabel = label.replace(/['"]+/g, '');

  if (node.hasAttribute(parser.untrustedAttribute) && node.getAttribute(parser.untrustedAttribute)!=='undefined') {
    return;
  } else {
    
    var a = configuration.coinform.misinformation;
    for (i = 0; i < a.length; ++i) {
      if (myLabel.localeCompare(a[i]) == 0) {
        node.setAttribute(parser.untrustedAttribute, 0);
        node.append(createInfoButton('tweet'));
        node.append(createViewTweetButton(tweet));
        node.append(createLabelButton(label));
        node.append(createFeedbackButton());
      }
    }
  }
};

const classifyPost = (post, score) => {

  const misinformationScore = score.misinformationScore;
  const dom = post.domObject;

  $(dom.find('._3ccb')[0]).css('opacity', `${1 - misinformationScore/100}`);
  dom.prepend(createWhyButton(score, 'post', true));
};

const createLabelButton = (label) => {
  const div = document.createElement('div');
  div.setAttribute('class', 'label-button-container');

  const button = document.createElement('button');
  button.innerText = `Accuracy = ${label}`;
  button.setAttribute('type', 'button');
  button.setAttribute('class', 'coinform-button coinform-button-primary');

  div.append(button);
  return div;
}

const createFeedbackButton = () => {
  const div = document.createElement('div');
  div.setAttribute('class', 'feedback-button-container');

  const button = document.createElement('button');
  button.innerText = `Feedback`;
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
}

const createInfoButton = (publicationName, addPaddingTop = false) => {

  const div = document.createElement('div');
  div.setAttribute('class', 'info-button-container');

  if (addPaddingTop) {

    div.addClass('coinform-padding-top-10');

  }

  const button = document.createElement('button');
  button.innerText=`This ${publicationName} contains misinformation`;
  button.setAttribute('type', 'button');
  button.setAttribute('class', 'coinform-button coinform-button-primary');
  
  div.addEventListener('click', (event) => {

    event.preventDefault();
    Swal2.fire({
      type: 'info',
      title: `Misinformation`,
      text: `False information that is spread, regardless of whether there is intent to mislead`,
      showCloseButton: true,
    })
  });


  div.append(button);

  return div;
};

const createViewTweetButton = (tweet) => {
  const div = document.createElement('div');
  div.setAttribute('class', 'view-tweet-button-container');

  const button = document.createElement('button');
  button.innerText=`View tweet?`;
  button.setAttribute('type', 'button');
  button.setAttribute('class', 'coinform-button coinform-button-primary');  
  const node = tweet.domObject;

  div.addEventListener('click', (event) => {
    event.preventDefault();
    node.removeAttribute(parser.untrustedAttribute);
  });


  div.append(button);
  return div;
}

const createSpinner = (tweetInfo) => {
  const node = tweetInfo.domObject;
  const div = document.createElement('div');
  div.setAttribute('class', 'loader');
  div.setAttribute("id", "loader");
  node.append(div);
  return div;
}

function randomInt(low, high) {
  return Math.floor(Math.random() * (high - low + 1) + low)
}

function sleep(delay) {
  var start = new Date().getTime();
  while (new Date().getTime() < start + delay);
}

