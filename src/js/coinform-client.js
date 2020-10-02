/* eslint-disable camelcase */

module.exports = CoinformClient;

let f;

function CoinformClient(fetch, host, basePath = '') {
  this.baseURL = host + basePath;
  f = fetch
}

CoinformClient.prototype = {

  postLog2Server: function (logData, userToken) {
    return postUserLog2Server(this.baseURL + '/user/evaluation-log/', logData, userToken);
  },

  postCheckTweetInfo: function (tweetId, author, tweetText, coinformUserID, userToken) {
    return postCheckTweet(this.baseURL + '/twitter/tweet/', tweetId, author, tweetText, coinformUserID, userToken);
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

  postUserRegister: function (email, password, options) {
    return postRegister(this.baseURL + '/register/', email, password, options);
  },

  postRenewUserToken: function (pluginVersion) {
    return postRenewToken(this.baseURL + '/renew-token/', pluginVersion);
  },

  postUserChangePass: function (password, newpassword, userToken) {
    return postChangePass(this.baseURL + '/change-password/', password, newpassword, userToken);
  },

  postUserForgotPass: function (email) {
    return postForgotPass(this.baseURL + '/reset-password/', email);
  },

  postUserChangeSettings: function (settings, userToken) {
    return postChangeSettings(this.baseURL + '/user/change-settings/', settings, userToken);
  }

};

function postUserLog2Server(path, logData, userToken) {

  const data = [
    {
      log_time: logData.log_time,
      log_category: logData.log_category,
      related_item_url: logData.related_item_url,
      related_item_data: logData.related_item_data,
      log_action: logData.log_action
    }
  ];

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

function postCheckTweet(path, tweetId, author, tweetText, coinformUserID, userToken) {

  const data = {
    tweet_id: tweetId, 
    tweet_author: author, 
    tweet_text: tweetText
  };

  if (coinformUserID) {
    data.coinform_user_id = coinformUserID;
  }

  /*let headers = ...;
  if (userToken) {
    headers['Authorization'] = 'Bearer ' + userToken;
  }*/

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

function postRegister(path, email, password, options) {

  const data = {
    email: email,
    password: password,
    research: options.research,
    communication: options.communication
  };

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

function postChangeSettings(path, settings, userToken) {

  const data = {research: settings.participation, communication: settings.followup};

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
