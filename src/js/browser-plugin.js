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

    if (usersCache[tweetInfo.id] == null) {
      usersCache[tweetInfo.id] = false; 
    } 

    // If the tweet has already been analized then skip
    if (usersCache[tweetInfo.id]) {
      return;
    } 

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

        // Add random sleep time between 0.5 and 2.5 seconds
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

              var acurracyLabel = JSON.stringify(res.response.rule_engine.final_credibility);
              console.log("LABEL = " + acurracyLabel);

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
        // Result from first API call
        var firstRes = JSON.stringify(res);
        var acurracyLabel = JSON.stringify(res.response.rule_engine.final_credibility);

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
    // Just for the proof of concept, use Twitter's score (even though we're in Facebook)
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

  if (node.hasAttribute(parser.untrustedAttribute) && node.getAttribute(parser.untrustedAttribute) !== 'undefined') {
    return;
  } else {

    var x = 0;
    var a = configuration.coinform.misinformation;
    for (i = 0; i < a.length; ++i) {
      if (myLabel.localeCompare(a[i]) == 0) {
        //if (myLabel.localeCompare('not verifiable post') != 0) 
        node.setAttribute(parser.untrustedAttribute, 0);
        node.append(whyCannotSeeTweetButton(tweet, label));
        x = 1;
      }
    }

    if (x == 0) {
      node.append(addCoinformLogo(tweet));
    }
  }
};

const addCoinformLogo = (tweet) => {
  var x = document.createElement("img");
  x.setAttribute("src", 'https://en.gravatar.com/userimage/157153645/613b113e876d7942df3056fe07436977?size=200');
  x.setAttribute("width", "50");
  x.setAttribute("height", "60");
  x.setAttribute("position", "relative");
  x.setAttribute("align-items", "flex-end");
  x.setAttribute("id", "coinformLogo");

  x.addEventListener('click', (event) => {
    event.preventDefault();

    Swal2.fire({
      type: 'info',
      title: `Explanatory text`,
      showCloseButton: true,
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      confirmButtonText: 'Submit',
      cancelButtonColor: '#f11606',
      cancelButtonText: 'Cancel',
      html:
      '<input id="swal-input1" placeholder="URL" class="swal2-input">' +
      '<input id="swal-input2" placeholder="Comment" class="swal2-input">',
      focusConfirm: true,
      preConfirm: () => {
        return [
          document.getElementById('swal-input1').value,
          document.getElementById('swal-input2').value
        ];
      },
      input: 'select',
      inputPlaceholder: '*',
      inputOptions: {
        'accurate': 'Reputable source with no disagreement and no related false claims',
        'accurate with considerations': 'Reputable source with little disagreement and related false claims',
        'unsubstantiated': 'Mixture of reputability and disagreement associated to claim reviews',
        'inaccurate with considerations': 'Not credible', 
        'inaccurate': 'Not credible source with high disagreement',
        'not verifiable post': 'Absolutely not a credible source with highly-biased content'
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
        });
      }
    }).then(function(result) {
      if (result.value) {
        return new Promise((resolve) => {
          var returned = result[Object.keys(result)[0]];
          returned = returned.toString();
          var array = returned.split(',');
          var url = array[0], comment = array[1];

          if (url.localeCompare('') === 0) {
            alert('Please provide a valid URL');
          }
          else if (comment.localeCompare('') === 0) {
            alert('Please provide some comment');
          }
          else {
            
            Swal2.fire('Sent!', 'Your feedback has been sent.', 'success');

            // url comment resultDropdown
            var evaluation = { 
              'evaluation': [ { 'label': resultDropdown, 'url': url, 'comment': comment}]
            };
            
            client.postTwitterEvaluate(tweetData.id, evaluation)
            .then(res => {
              
              console.log('Query ID = ' + JSON.stringify(res));
              
            })
            .catch(err => console.log(err));

            resolve();
          }  
        });
      }
    });
  });

  const node = tweet.domObject;
  node.append(x);
  return x;
};

const classifyPost = (post, score) => {

  const misinformationScore = score.misinformationScore;
  const dom = post.domObject;

  $(dom.find('._3ccb')[0]).css('opacity', `${1 - misinformationScore/100}`);
  dom.prepend(createWhyButton(score, 'post', true));
};

const whyCannotSeeTweetButton = (tweet, label) => {
  const div = document.createElement('div');
  div.setAttribute('class', 'feedback-button-container');

  const button = document.createElement('button');
  button.innerText = `Why I cannot see this?`;
  button.setAttribute('type', 'button');
  button.setAttribute('class', 'coinform-button coinform-button-primary');
  button.setAttribute("id", "whyButton");

  var resultDropdown;
  div.addEventListener('click', (event) => {

    event.preventDefault();

    Swal2.fire({
      type: 'warning',
      title: `${label}` + `\n` + `This tweet contains misinformation, do you want to provide any refuting/supporting links, comments and accuracy label`,
      showCloseButton: true,
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      confirmButtonText: 'Submit',
      cancelButtonColor: '#118f1b',
      cancelButtonText: 'See tweet anyways',
      html:
      '<input id="swal-input1" placeholder="URL" class="swal2-input">' +
      '<input id="swal-input2" placeholder="Comment" class="swal2-input">',
      focusConfirm: true,
      preConfirm: () => {
        return [
          document.getElementById('swal-input1').value,
          document.getElementById('swal-input2').value
        ];
      },
      input: 'select',
      inputPlaceholder: '*',
      inputOptions: {
        'accurate': 'Reputable source with no disagreement and no related false claims',
        'accurate with considerations': 'Reputable source with little disagreement and related false claims',
        'unsubstantiated': 'Mixture of reputability and disagreement associated to claim reviews',
        'inaccurate with considerations': 'Not credible', 
        'inaccurate': 'Not credible source with high disagreement',
        'not verifiable post': 'Absolutely not a credible source with highly-biased content'
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
        });
      }
    }).then(function(result) {
      if (result.value) {
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
            
            Swal2.fire('Sent!', 'Your feedback has been sent.', 'success');

            // url comment resultDropdown
            var evaluation = { 
              'evaluation': [ { 'label': resultDropdown, 'url': url, 'comment': comment}]
            };
            
            client.postTwitterEvaluate(tweetData.id, evaluation)
            .then(res => {
              
              console.log('Query ID = ' + JSON.stringify(res));
              
            })
            .catch(err => console.log(err));

            resolve();
          }  
        });
      } else if (result.dismiss === 'cancel') {
        
        // function when cancel button is clicked
        const node = tweet.domObject;
        node.removeAttribute(parser.untrustedAttribute);
        document.getElementById("whyButton").remove();
      }
    });
  });

  div.append(button);
  return div;
};

function randomInt(low, high) {
  return Math.floor(Math.random() * (high - low + 1) + low);
}

function sleep(delay) {
  var start = new Date().getTime();
  while (new Date().getTime() < start + delay);
}

