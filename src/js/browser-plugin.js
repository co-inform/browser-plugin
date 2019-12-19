const $ = require('jquery');
const Swal2 = require('sweetalert2');
const CoinformClient = require('./coinform-client');
const TweetParser = require('./tweet-parser');
const FacebookParser = require('./facebook-parser');
let counter = 1;
let tweetData;
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
    } else if (window.location.hostname.includes('facebook.com')) {
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
  const dom = tweetInfo.domObject;
  if (tweetInfo.links.length > 0) {

    if (usersCache[tweetInfo.id] == null) {
      usersCache[tweetInfo.id] = false;
    }

    // If the tweet has already been analyzed then skip
    if (usersCache[tweetInfo.id]) {
      return;
    }

    // First API call to the endpoint /twitter/tweet/
    client.postCheckTweetInfo(tweetInfo.id, tweetInfo.username, tweetInfo.text).then(function (res) {

      let firstCallStatus = JSON.stringify(res.status).replace(/['"]+/g, '');

      // Discard requests with 400 http return codes
      if (firstCallStatus.localeCompare('400') === 0) {
        return;
      }

      // If the result status has not reached the 'done' status then make a second API call to retrieve the 
      // result with a maximum of 10 retries
      if (firstCallStatus.localeCompare('done') !== 0) {

        // Add random sleep time between 0.5 and 2.5 seconds
        sleep(randomInt(500, 2500));
        let firstQueryId = JSON.stringify(res.query_id);

        if (counter > MAX_RETRIES) {
          counter = 1;
        } else {
          counter++;
          client.getResponseTweetInfo(firstQueryId).then(function (res) {

            // Result from second API call
            let secondCallStatus = JSON.stringify(res.status).replace(/['"]+/g, '');

            if (secondCallStatus.localeCompare('done') === 0) {
              // As the tweet has been analized then remove the loading spinner
              let secondRes = JSON.stringify(res);

              let acurracyLabel = JSON.stringify(res.response.rule_engine.final_credibility);
              console.log("LABEL = " + acurracyLabel);

              // Tweet analyzed
              usersCache[tweetInfo.id] = true;
              tweetInfo.analyzed = true;
              classifyTweet(tweetInfo, acurracyLabel);

            }
          }).catch(err => console.log(err));
        }
      } else {
        // Result from first API call
        let firstRes = JSON.stringify(res);
        let accuracyLabel = JSON.stringify(res.response.rule_engine.final_credibility);

        // Tweet analyzed
        usersCache[tweetInfo.id] = true;
        tweetInfo.analyzed = true;
        classifyTweet(tweetInfo, accuracyLabel);
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

const classifyTweet = (tweet, accuracyLabel) => {

  const node = tweet.domObject;
  const label = accuracyLabel.replace(/['"]+/g, '');

  if (!(node.hasAttribute(parser.untrustedAttribute) && node.getAttribute(parser.untrustedAttribute) !== 'undefined')) {
    const misinformationLabels = configuration.coinform.misinformation;

    let button;
    for (let i = 0; i < misinformationLabels.length; i++) {
      if (label.localeCompare(misinformationLabels[i]) === 0) {
        node.setAttribute(parser.untrustedAttribute, 0);
        button = createCannotSeeTweetButton(tweet, label);
        // button = createClickableLogo(tweet, acurracyLabel);  
        break;
      }
    }

    if (!button) {
      button = createClickableLogo(tweet, label);
    }
  
   // createClickableLogo(tweet, label);
    node.append(button);
  }
};

const createClickableLogo = (tweet, label) => {
  let img = document.createElement("IMG");
  img.setAttribute("width", "60");
  img.setAttribute("height", "60");
  img.setAttribute("position", "relative");
  img.setAttribute("align-items", "flex-end");
  img.setAttribute("id", "coinformLogo");

  let imgURL = chrome.extension.getURL("/resources/coinform128.png");
  img.setAttribute("src", imgURL);

  img.addEventListener('click', (event) => {
    event.preventDefault();
    
    createExtendedTweetMenu(tweet, label, false);
  });
  let node = tweet.domObject;
  node.append(img);
  return img;
};

const createCannotSeeTweetButton = (tweet, label) => {
  const div = document.createElement('div');
  div.setAttribute('class', 'feedback-button-container');

  const button = document.createElement('button');
  button.innerText = `Why I cannot see this?`;
  button.setAttribute('type', 'button');
  button.setAttribute('class', 'coinform-button coinform-button-primary');
  button.setAttribute("id", "whyButton");

  div.addEventListener('click', (event) => {

    event.preventDefault();
    event.stopPropagation();
    createBasicTweetMenu(tweet, label);
  });

  // div.append(createClickableLogo(tweet, label));

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
    title: `This tweet has been tagged as ${label}.`,
    showCloseButton: true,
    showCancelButton: false,
    confirmButtonColor: '#3085d6',
    confirmButtonText: 'See tweet anyways',
    focusConfirm: true,
  }).then(function (result) {
    // function when cancel button is clicked
    const node = tweet.domObject;
    node.removeAttribute(parser.untrustedAttribute);
    document.getElementById("whyButton").remove();
    if (!node.logo) {
      node.logo = true;
      createClickableLogo(tweet, label);
    }
  });
}

function createExtendedTweetMenu(tweet, label, isTweetHidden) {

  let resultDropdown;

  return Swal2.fire({
    type: 'info',
    title: `This tweet has been tagged as ${label}.\n`
      + `If you think this is not accurate please provide a claim and a URL to a post that supports that claim.`,
    showCloseButton: true,
    showCancelButton: false,
    confirmButtonColor: '#3085d6',
    confirmButtonText: 'Submit',
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
    inputPlaceholder: 'Choose a claim',
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
        } else {
          resolve('Please choose a claim');
        }

        resolve();
      });
    }
  }).then(function (result) {
    if (result.value) {
      return new Promise((resolve) => {
        let returned = result[Object.keys(result)[0]];
        returned = returned.toString();
        let array = returned.split(',');
        let url = array[0], comment = array[1];

        if (url.localeCompare('') === 0) {
          alert('Please provide a URL');
        } else if (comment.localeCompare('') === 0) {
          alert('Please provide some additional information in the comment');
        } else {

          Swal2.fire('Sent!', 'Your feedback has been sent.', 'success');

          // url comment resultDropdown
          let evaluation = {
            'evaluation': [{'label': resultDropdown, 'url': url, 'comment': comment}]
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
}

function randomInt(low, high) {
  return Math.floor(Math.random() * (high - low + 1) + low);
}

function sleep(delay) {
  let start = new Date().getTime();
  while (new Date().getTime() < start + delay) ;
}

