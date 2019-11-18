/* jshint esversion: 6, devel: true */

module.exports = CoinformClient

let f

function CoinformClient(fetch, host, basePath = '') {
  this.baseURL = host + basePath
  f = fetch
}

CoinformClient.prototype = {

  postCheckTweetInfo: function (tweetId, author, tweetText) {
    return postCheckTweet(this.baseURL + '/twitter/tweet/', tweetId, author, tweetText)
  }, 

  getResponseTweetInfo: function (queryID) {
    return getResponseTweet(this.baseURL + '/response/' + queryID.replace(/['"]+/g, ''))
  },

  postTwitterEvaluate: function (tweet_id, evaluation) {
    return postEvaluate(this.baseURL + '/twitter/evaluate/', tweet_id, evaluation)
  },

  getDomainDetails: function (domain) {
    return getHttpRequest(this.baseURL + '/toop/domain/' +  domain)
  },

  getTwitterUserScore: function (username) {
    return getHttpRequest(this.baseURL + '/twitter/user/' + username)
  }
}

function postEvaluate(path, tweet_id, evaluation) {

  var data = { tweet_id: tweet_id, evaluation: evaluation };

  return new Promise ((resolve, reject) => {
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
      .then(res => res.json())
      .then(res => resolve(res))
      .catch(err => reject(err))
  })

}

function postCheckTweet(path, tweetId, author, tweetText) {
  
  var data = { tweet_id: tweetId, tweet_author: author, tweet_text: tweetText };

  return new Promise ((resolve, reject) => {
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
      .then(res =>  res.json())
      .then(res => resolve(res))
      .catch(err => reject(err))
  })
} 

function getResponseTweet(path) {
    return new Promise ((resolve, reject) => {
      f(path, {
        method: 'GET',
        mode: 'cors',
        header: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Connection': 'keep-alive',
          'rejectUnauthorized': false 
        }, 
      })
      .then(res => res.json())
      .then(res => resolve(res))
      .catch(err => reject(err))
    })
}

function getHttpRequest(path) {
  return new Promise((resolve, reject) => {
    f(path)
      .then(res => res.json())
      .then(res => resolve(res))
      .catch(err => reject(err))
  })
}