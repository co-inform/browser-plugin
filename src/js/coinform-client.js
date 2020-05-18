
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

  getCheckUrlInfo: function (url) {
    return getCheckUrl(this.baseURL + '/check-url/', url);
  },

  postEvaluateTweet: function (tweetId, tweetUrl, evaluation, userToken) {
    return postEvaluate(this.baseURL + '/twitter/evaluate/', tweetId, tweetUrl, evaluation, userToken);
  },

  postEvaluateLabel: function (tweetId, tweetUrl, ratedCredibility, moduleResponse, agreement, userToken) {
    return postEvaluateLabel(this.baseURL + '/twitter/evaluate/label', tweetId, tweetUrl, ratedCredibility, moduleResponse, agreement, userToken);
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

  postUserLogout: function (userToken) {
    return postLogout(this.baseURL + '/exit/', userToken);
  },

  postUserRegister: function (email, password) {
    return postRegister(this.baseURL + '/register/', email, password);
  },

  postRenewUserToken: function () {
    return postRenewToken(this.baseURL + '/renew-token/');
  },

  postUserChangePass: function (password, newpassword, userToken) {
    return postChangePass(this.baseURL + '/change-password/', password, newpassword, userToken);
  },

  postUserForgotPass: function (email) {
    return postForgotPass(this.baseURL + '/reset-password/', email);
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

function postEvaluateLabel(path, tweetId, tweetUrl, ratedCredibility, moduleResponse, agreement, userToken) {

  const data = {
    tweet_id: tweetId,
    rated_credibility: ratedCredibility,
    rated_moduleResponse: moduleResponse,
    url: tweetUrl,
    reaction: agreement
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

function getCheckUrl(path, url) {

  const data = {source: url};
  const urlParams = buildUrl(path, data);

  return new Promise((resolve, reject) => {
    f(urlParams, {
      method: 'GET',
      // mode: 'cors',
      headers: {
        'Accept': 'application/json',
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

function buildUrl(url, parameters) {
  let qs = "";
  for (const key in parameters) {
    if (parameters.hasOwnProperty(key)) {
      const value = parameters[key];
      qs += encodeURIComponent(key) + "=" + encodeURIComponent(value) + "&";
    }
  }
  if (qs.length > 0) {
    qs = qs.substring(0, qs.length - 1); //chop off last "&"
    url = url + "?" + qs;
  }
  return url;
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

function postChangePass(path, password, newpassword, userToken) {
  
  const data = {oldPassword: password, newPassword: newpassword};

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

function postLogout(path, userToken) {

  return new Promise((resolve, reject) => {
    f(path, {
      method: 'GET',
      // mode: 'cors',
      headers: {
        'Authorization': 'Bearer ' + userToken,
        'Accept': 'application/json',
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

function postRenewToken(path) {

  return new Promise((resolve, reject) => {
    f(path, {
      method: 'GET',
      // mode: 'cors',
      headers: {
        'Accept': 'application/json',
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

function postForgotPass(path, email) {
  
  const data = {email: email};

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
