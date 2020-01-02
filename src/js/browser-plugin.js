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
let LANG;
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

    //Read the language file
    fetch(browser.extension.getURL('/resources/lang.en.json'), {
      mode: 'cors',
      header: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })
      .then(res => res.json())
      .then(res => {

        LANG = res.LANG;
        Object.keys(res.CATEGORIES).forEach(function(key) {
          LANG[key] = res.CATEGORIES[key]['label'];
          LANG[key+'_info'] = res.CATEGORIES[key]['description'];
        });

      })
      .catch(err => console.error('Could not load language file', err));

    if (window.location.hostname.indexOf('twitter.com') >= 0) {

      parser = new TweetParser();

    } else if (window.location.hostname.indexOf('facebook.com') >= 0) {

      parser = new FacebookParser();

    }

    setTimeout(start, 5000);
  })
  .catch(err => console.error('Could not load configuration file', err));

const start = () => {

  client = new CoinformClient(fetch, configuration.coinform.url);

  if (window.location.hostname.indexOf('twitter.com') >= 0) {

    parser.listenForMainChanges(newTweetCallback);
    parser.triggerFirstTweetBatch(newTweetCallback);

  } else if (window.location.hostname.indexOf('facebook.com') >= 0) {

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
        console.log(`${tweetInfo.id} - Not Done response :(`);

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
              console.log(`${tweetInfo.id} - ReDone response :)`);
              // As the tweet has been analized then remove the loading spinner
              let secondRes = JSON.stringify(res);

              let acurracyLabel = JSON.stringify(res.response.rule_engine.final_credibility);
              console.log(`${tweetInfo.id} LABEL = ` + acurracyLabel);

              // Tweet analyzed
              usersCache[tweetInfo.id] = true;
              tweetInfo.analyzed = true;
              classifyTweet(tweetInfo, acurracyLabel);

            }
          }).catch(err => console.log(err));
        }
      } else {
        console.log(`${tweetInfo.id} - Done response :)`);
        // Result from first API call
        let firstRes = JSON.stringify(res);
        let acurracyLabel = JSON.stringify(res.response.rule_engine.final_credibility);
        console.log(`${tweetInfo.id} LABEL = ` + acurracyLabel);

        // Tweet analyzed
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

const classifyTweet = (tweet, accuracyLabel) => {

  const node = tweet.domObject;
  const label = accuracyLabel.replace(/['"]+/g, '');

  if (!(node.hasAttribute(parser.untrustedAttribute) && node.getAttribute(parser.untrustedAttribute) !== 'undefined')) {
    const misinformationLabels = configuration.coinform.misinformation;

    let button;

    if (configuration.coinform.categories[label].localeCompare("misinformation") === 0) {
      node.setAttribute(parser.untrustedAttribute, 0);
      button = createCannotSeeTweetButton(tweet, label);
      // button = createClickableLogo(tweet, acurracyLabel);  
    }
    else {
      button = createClickableLogo(tweet, label);
    }
  
    // createClickableLogo(tweet, label);
    node.append(button);
  }
};

const createClickableLogo = (tweet, label) => {
  let img = document.createElement("IMG");
  img.setAttribute("class", "coinformTweetLogo");
  img.setAttribute("id", `coinformTweetLogo-${tweet.id}`);

  let imgURL = chrome.extension.getURL("/resources/coinform48.png");
  img.setAttribute("src", imgURL);

  img.addEventListener('click', (event) => {
    event.preventDefault();
    
    createExtendedTweetMenu(tweet, label, false);
  });
  let node = tweet.domObject;
  node.append(img);
  return img;
};

const createTweetLabel = (tweet, label) => {
  let labelcat = document.createElement("SPAN");
  labelcat.setAttribute("class", "coinformTweetLabel");
  let txt = document.createTextNode(LANG[label]);
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
  button.innerText = LANG['why cant see'];
  button.setAttribute('type', 'button');
  button.setAttribute('class', 'coinform-button coinform-button-primary whyButton');
  button.setAttribute("id", `whyButton-${tweet.id}`);

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    createBasicTweetMenu(tweet, label);
  });

  div.addEventListener('click', ignoreTweetClick);

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
    title: strParse(LANG['tweet tagged as'], LANG[label]),
    showCloseButton: true,
    showCancelButton: false,
    confirmButtonColor: '#3085d6',
    confirmButtonText: LANG['see tweet'],
    focusConfirm: true,
  }).then(function (result) {
    if(result.value === true){
      // function when confirm button is clicked
      const node = tweet.domObject;
      node.removeAttribute(parser.untrustedAttribute);
      document.getElementById(`whyButton-${tweet.id}`).remove();
      document.getElementById(`feedback-button-container-${tweet.id}`).remove();
      if (!node.logo) {
        node.logo = true;
        createClickableLogo(tweet, label);
        createTweetLabel(tweet, label);
      }
    }
  });
}

function createExtendedTweetMenu(tweet, label, isTweetHidden) {

  let resultDropdown;

  let categoryOptions = {};

  Object.keys(configuration.coinform.categories).forEach(function(key) {
    categoryOptions[key] = LANG[key + '_info'];
  });

  return Swal2.fire({
    type: 'info',
    title: strParse(LANG['tweet tagged as'], LANG[label]),
    showCloseButton: true,
    showCancelButton: false,
    confirmButtonColor: '#3085d6',
    confirmButtonText: LANG['submit'],
    html:
      '<span>' + LANG['provide claim'] + '</span>' +
      '<input id="swal-input1" placeholder="' + LANG['url'] + '" class="swal2-input">' +
      '<input id="swal-input2" placeholder="' + LANG['comment'] + '" class="swal2-input">',
    focusConfirm: true,
    preConfirm: () => {
      return [
        document.getElementById('swal-input1').value,
        document.getElementById('swal-input2').value
      ];
    },
    input: 'select',
    inputPlaceholder: LANG['choose claim'],
    inputOptions: categoryOptions,
    inputValidator: (value) => {
      return new Promise((resolve) => {
        if (value.localeCompare('') !== 0) {
          resultDropdown = value;
        } else {
          resolve(LANG['please choose claim']);
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
          alert(LANG['provide url']);
        } else if (comment.localeCompare('') === 0) {
          alert(LANG['provide additional info']);
        } else {

          Swal2.fire(LANG['sent'], LANG['feedback sent'], 'success');

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

function sleep(delay) {
  let start = new Date().getTime();
  while (new Date().getTime() < start + delay) ;
}

