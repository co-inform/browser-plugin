
module.exports = CoinformClient;

let f;

function CoinformClient(fetch, host, basePath = '') {
  this.baseURL = host + basePath;
  f = fetch
}

CoinformClient.prototype = {

  postLog2Server: function (logTime, logCategory, relatedItemUrl, relatedItemData, logAction, userToken) {
    return postUserLog2Server(this.baseURL + '/user/evaluation-log/', logTime, logCategory, relatedItemUrl, relatedItemData, logAction, userToken);
  },

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

  postUserLogin: function (email, password, pluginVersion) {
    return postLogin(this.baseURL + '/login/', email, password, pluginVersion);
  },

  postUserLogout: function (userToken) {
    return postLogout(this.baseURL + '/exit/', userToken);
  },

  postUserRegister: function (email, password) {
    return postRegister(this.baseURL + '/register/', email, password);
  },

  postRenewUserToken: function (pluginVersion) {
    return postRenewToken(this.baseURL + '/renew-token/', pluginVersion);
  },

  postUserChangePass: function (password, newpassword, userToken) {
    return postChangePass(this.baseURL + '/change-password/', password, newpassword, userToken);
  },

  postUserForgotPass: function (email) {
    return postForgotPass(this.baseURL + '/reset-password/', email);
  }

};

function postUserLog2Server(path, logTime, logCategory, relatedItemUrl, relatedItemData, logAction, userToken) {

  const data = {
    log_time: logTime,
    log_category: logCategory,
    related_item_url: relatedItemUrl,
    related_item_data: relatedItemData,
    log_action: logAction
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

function postEvaluate(path, tweetId, tweetUrl, evaluation, userToken) {

  const data = {
    tweet_id: tweetId,
    rating: evaluation.label,
    comment: evaluation.comment,
    supportingUrl: [],
    request_factcheck: evaluation.factcheck,
    url: tweetUrl
  };

  if (evaluation.url) {
    data.supportingUrl.push(evaluation.url);
  }

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

  let fetchUrl = new URL(path);
  let getParams = {source: url};
  Object.keys(getParams).forEach(key => fetchUrl.searchParams.append(key, getParams[key]));

  return new Promise((resolve, reject) => {
    f(fetchUrl, {
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

function postLogin(path, email, password, pluginVersion) {

  let fetchUrl = new URL(path);
  let getParams = {plugin_version: pluginVersion};
  Object.keys(getParams).forEach(key => fetchUrl.searchParams.append(key, getParams[key]));

  const postData = {email: email, password: password};

  return new Promise((resolve, reject) => {
    f(fetchUrl, {
      method: 'POST',
      mode: 'cors',
      body: JSON.stringify(postData),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(postData)),
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

function postRenewToken(path, pluginVersion) {

  let fetchUrl = new URL(path);
  let getParams = {plugin_version: pluginVersion};
  Object.keys(getParams).forEach(key => fetchUrl.searchParams.append(key, getParams[key]));

  return new Promise((resolve, reject) => {
    f(fetchUrl, {
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
