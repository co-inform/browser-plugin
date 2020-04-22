
module.exports = CoinformClient;

let f;

function CoinformClient(fetch, host, basePath = '') {
  this.baseURL = host + basePath;
  f = fetch
}

CoinformClient.prototype = {

  postCheckTweetInfo: function (tweetId, author, tweetText) {
    return postCheckTweet(this.baseURL + '/twitter/tweet/', tweetId, author, tweetText);
  },

  getResponseTweetInfo: function (queryID) {
    return getResponseTweet(this.baseURL + '/response/' + queryID.replace(/['"]+/g, ''));
  },

  postTwitterEvaluate: function (tweetId, tweetUrl, evaluation, userToken) {
    return postEvaluate(this.baseURL + '/twitter/evaluate/', tweetId, tweetUrl, evaluation, userToken);
  },

  getDomainDetails: function (domain) {
    return getHttpRequest(this.baseURL + '/toop/domain/' + domain);
  },

  getTwitterUserScore: function (username) {
    return getHttpRequest(this.baseURL + '/twitter/user/' + username);
  },

  postUserLogin: function (email, password) {
    return postLogin(this.baseURL + '/login/', email, password);
  },

  postUserRegister: function (email, password) {
    return postRegister(this.baseURL + '/register/', email, password);
  }
};

function postEvaluate(path, tweetId, tweetUrl, evaluation, userToken) {

  const data = {
    tweet_id: tweetId,
    rating: evaluation.label,
    comment: evaluation.comment,
    supportingUrl: [
      evaluation.url
    ],
    url: tweetUrl
  };

  return new Promise((resolve, reject) => {
    f(path, {
      method: 'POST',
      mode: 'cors',
      body: JSON.stringify(data),
      headers: {
        'Authorization': 'Bearer ' + userToken,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(data)),
        'Connection': 'keep-alive',
        'rejectUnauthorized': false
      }
    })
      .then(res => res.json().then(json => ({
        status: res.status,
        data: json
      })))
      .then(res => resolve(res))
      .catch(err => reject(err));
  });

}

function postCheckTweet(path, tweetId, author, tweetText) {

  const data = {tweet_id: tweetId, tweet_author: author, tweet_text: tweetText};

  return new Promise((resolve, reject) => {
    f(path, {
      method: 'POST',
      mode: 'cors',
      body: JSON.stringify(data),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(data)),
        'Connection': 'keep-alive',
        'rejectUnauthorized': false
      }
    })
      .then(res => res.json().then(json => ({
        status: res.status,
        data: json
      })))
      .then(res => resolve(res))
      .catch(err => reject(err));
  });
}

function getResponseTweet(path) {

  return new Promise((resolve, reject) => {
    f(path, {
      method: 'GET',
      // mode: 'cors',
      headers: {
        'Accept': 'application/json',
        // 'Content-Type': 'application/json',
        'Connection': 'keep-alive',
        'rejectUnauthorized': false
      }
    })
      .then(res => res.json().then(json => ({
        status: res.status,
        data: json
      })))
      .then(res => resolve(res))
      .catch(err => reject(err));
  });

}

function getHttpRequest(path) {

  return new Promise((resolve, reject) => {
    f(path)
      .then(res => res.json().then(json => ({
        status: res.status,
        data: json
      })))
      .then(res => resolve(res))
      .catch(err => reject(err));
  });

}

function postLogin(path, email, password) {

  const data = {email: email, password: password};

  return new Promise((resolve, reject) => {
    f(path, {
      method: 'POST',
      mode: 'cors',
      body: JSON.stringify(data),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(data)),
        'Connection': 'keep-alive',
        'rejectUnauthorized': false
      }
    })
      .then(res => res.json().then(json => ({
        status: res.status,
        data: json
      })))
      .then(res => resolve(res))
      .catch(err => reject(err));
  });

}

function postRegister(path, email, password) {

  const data = {email: email, password: password};

  return new Promise((resolve, reject) => {
    f(path, {
      method: 'POST',
      mode: 'cors',
      body: JSON.stringify(data),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(data)),
        'Connection': 'keep-alive',
        'rejectUnauthorized': false
      }
    })
      .then(res => res.json().then(json => ({
        status: res.status,
        data: json
      })))
      .then(res => resolve(res))
      .catch(err => reject(err));
  });

}
