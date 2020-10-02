
const jwtDecode = require('jwt-decode');
const CoinformClient = require('./coinform-client');
const CoInformLogger = require('./coinform-logger');
const browserAPI = chrome || browser;

// Retry a total of 6 times (6 * 5sec = 30sec)
const MAX_TOKEN_RENEW_RETRIES = 6;
const TOKEN_RENEW_RETRY_TIME = 5000;
const TOKEN_RENEW_BEFORE_TIME = 30000;

let configuration;
let client;
let logger;

let coinformUserToken = null;
let coinformUserMail = null;
let coinformUserID = null;

//Read the configuration file and if it was successful, start
fetch(browserAPI.runtime.getURL('../resources/config.json'), {
  mode: 'cors',
  header: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
})
  .then(res => res.json())
  .then(res => {

    configuration = res;
    configuration.coinform.defaultOptions = Object.assign({}, configuration.coinform.options);
    logger = new CoInformLogger(CoInformLogger.logTypes[configuration.coinform.logLevel]);
    client = new CoinformClient(fetch, configuration.coinform.apiUrl);

    let manifestData = chrome.runtime.getManifest();
    if (manifestData && manifestData.version_name) {
      configuration.pluginVersion = manifestData.version_name;
    }
    else if (manifestData && manifestData.version) {
      configuration.pluginVersion = manifestData.version;
    }
    else {
      configuration.pluginVersion = "?";
    }

    browserAPI.runtime.onMessage.addListener(listenerRuntime);

    browserAPI.cookies.getAll({
      url: configuration.coinform.apiUrl
    }, cookies => {

      // parse all cookies
      for (let i = 0; i < cookies.length; i++) {
        if (cookies[i].name == "userToken") coinformUserToken = cookies[i].value;
        else if (cookies[i].name == "userMail") coinformUserMail = cookies[i].value;
        else if (cookies[i].name == "userID") coinformUserID = cookies[i].value;
      }

      if (coinformUserToken) {
        let res = checkAndSaveToken(coinformUserToken);
        if (res.ok) {
          sendMessageToAllScripts({
            messageId: "renewUserToken",
            userMail: res.userMail,
            userID: res.userID,
            token: res.token,
            userOptions: configuration.coinform.options
          });
        }
        else {
          renewUserToken();
        }
      }
      else {
        renewUserToken();
      }

      //checkStoredUserOptions();

    });

  })
  .catch(err => {
    console.error('Could not load plugin configuration', err);
  });

browserAPI.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.url) {
    browserAPI.tabs.sendMessage( tabId, {
      message: 'tabUrlChanged',
      url: changeInfo.url
    });
  }
});

const listenerRuntime = function(request, sender, sendResponse) {

  if (request.messageId === "GetCookie") {
    getCookie(request.cookieName, sendResponse);
  }
  else if (request.messageId === "SetCookie") {
    setCookie(request.cookieData, sendResponse);
  }
  else if (request.messageId === "RemoveCookie") {
    removeCookie(request.cookieName, sendResponse);
  }
  else if (request.messageId === "LogIn") {
    logInAPI(request, sender.id, sendResponse);
  }
  else if (request.messageId === "LogOut") {
    logOutAPI(request, sender.id, sendResponse);
  }
  else if (request.messageId === "Register") {
    registerAPI(request, sender.id, sendResponse);
  }
  else if (request.messageId === "ForgotPass") {
    forgotPass(request, sender.id, sendResponse);
  }
  else if (request.messageId === "ChangePass") {
    changePass(request, sender.id, sendResponse);
  }
  else if (request.messageId === "GetSession") {
    sendResponse({
      userMail: coinformUserMail,
      userID: coinformUserID,
      token: coinformUserToken
    });
  }
  else if (request.messageId === "GetConfig") {
    sendResponse({
      configuration: configuration
    });
  }
  else if (request.messageId === "GetOptions") {
    sendResponse({
      options: configuration.coinform.options
    });
  }
  else if (request.messageId === "OptionsChange") {
    changeOptions(request, sender.id, sendResponse);
    sendMessageToAllScripts(request);
    sendResponse({
      options: configuration.coinform.options
    });
  }
  else if (request.messageId === "CheckUrl") {
    checkUrlAPI(request, sender.id, sendResponse);
  }
  else if (request.messageId === "CheckTweetInfo") {
    checkTweetInfo(request, sender.id, sendResponse);
  }
  else if (request.messageId === "RetryAPIQuery") {
    retryAPIQuery(request, sender.id, sendResponse);
  }
  else if (request.messageId === "EvaluateLabel") {
    evaluateLabel(request, sender.id, sendResponse);
  }
  else if (request.messageId === "EvaluateTweet") {
    evaluateTweet(request, sender.id, sendResponse);
  }
  else if (request.messageId === "SendLog2Server") {
    sendLog2Server(request, sender.id, sendResponse);
  }

  return true;

};

const sendLog2Server = function(request, scriptId, logCallback) {

  const userOpts = configuration.coinform.options;

  if (coinformUserToken && userOpts && (userOpts.participation == "true")) {

    let logData = request.logData;

    logger.logMessage(CoInformLogger.logTypes.debug, `New Server Log: ${logData.log_time} | ${logData.log_category} | ${logData.log_action}`, scriptId);

    client.postLog2Server(request.logData, request.userToken).then(res => {
      let resStatus = JSON.stringify(res.status).replace(/['"]+/g, '');
      if (resStatus.localeCompare('200') === 0) {
        if (logCallback) logCallback(res);
      }
      else {

      }
    }).catch(err => {
      logger.logMessage(CoInformLogger.logTypes.error, `Request Error: ${err}`, scriptId);
    });

  }

};

const logInAPI = function(request, scriptId, loginCallback) {

  logger.logMessage(CoInformLogger.logTypes.debug, `Logging In (user ${request.userMail})`, scriptId);

  client.postUserLogin(request.userMail, request.userPass, configuration.pluginVersion).then(res => {
    
    let resStatus = JSON.stringify(res.status).replace(/['"]+/g, '');
    if (resStatus.localeCompare('200') === 0) {
      let data = res.data;
      if (data.token) {
        let resToken = JSON.stringify(data.token).replace(/['"]+/g, '');
        let res = checkAndSaveToken(resToken, scriptId);
        if (res.ok) {
          logger.logMessage(CoInformLogger.logTypes.info, `User logged in: ${res.userMail}`, scriptId);
          sendMessageToAllScripts({
            messageId: "userLogin",
            userMail: res.userMail,
            userID: res.userID,
            token: res.token,
            userOptions: configuration.coinform.options
          });
        }
        else {
          logger.logMessage(CoInformLogger.logTypes.error, `Token Check Error. Login Aborted`, scriptId);
        }
      }
      else {
        logger.logMessage(CoInformLogger.logTypes.error, "Login Token Error", scriptId);
      }
    }
    if (loginCallback) loginCallback(res);

  }).catch(err => {
    logger.logMessage(CoInformLogger.logTypes.error, `Request Error: ${err}`, scriptId);
  });

};

const checkAndSaveToken = function(token, scriptId) {

  let res = {
    ok: false
  };
  const tokenDecoded = jwtDecode(token);
  const now = new Date();
  const secondsSinceEpoch = Math.round(now.getTime() / 1000);
  let userMail = null;
  let userID = null;
  if (tokenDecoded.user && tokenDecoded.user.email) {
    userMail = tokenDecoded.user.email;
    if (tokenDecoded.user.uuid) {
      userID = tokenDecoded.user.uuid;
    }
  }
  if (tokenDecoded.user && tokenDecoded.user.research) {
    configuration.coinform.options.participation = tokenDecoded.user.research;
  }
  if (tokenDecoded.user && tokenDecoded.user.communication) {
    configuration.coinform.options.followup = tokenDecoded.user.communication;
  }
  if (tokenDecoded.exp < secondsSinceEpoch) {
    logger.logMessage(CoInformLogger.logTypes.warning, `JWT expiring time passed`, scriptId);
  }
  else {
    res.ok = true;
    res.userMail = userMail;
    res.userID = userID;
    res.token = token;
    coinformUserMail = userMail;
    coinformUserID = userID;
    coinformUserToken = token;
    setCookie({
      name: "userToken",
      value: token,
      expirationDate: tokenDecoded.exp
    });
    setCookie({
      name: "userMail",
      value: userMail,
      expirationDate: tokenDecoded.exp
    });
    setCookie({
      name: "userID",
      value: userID,
      expirationDate: tokenDecoded.exp
    });
    // set timer to renew the token, TOKEN_RENEW_BEFORE_TIME before expiring time
    let timeToRenew = ((tokenDecoded.exp - secondsSinceEpoch) * 1000) - TOKEN_RENEW_BEFORE_TIME;
    setTimeout(function() {
      renewUserToken();
    }, timeToRenew);

    //checkStoredUserOptions();
  }
  return res;

};

const sendMessageToAllScripts = function(message) {

  // Send login message to the popup page script
  browserAPI.runtime.sendMessage(message);
  // Send login message to all the twitter content page scripts
  chrome.tabs.query({url: '*://*.twitter.com/*'}, tabs => {
    for (let i = 0; i < tabs.length; i++) {
      chrome.tabs.sendMessage(tabs[i].id, message);
    }
  });
  // Send login message to all the facebook content page scripts
  chrome.tabs.query({url: '*://*.facebook.com/*'}, tabs => {
    for (let i = 0; i < tabs.length; i++) {
      chrome.tabs.sendMessage(tabs[i].id, message);
    }
  });

};

const renewUserToken = function(retryNum = 0) {

  logger.logMessage(CoInformLogger.logTypes.debug, `Requesting New Token..`);

  client.postRenewUserToken(configuration.pluginVersion).then(res => {

    let resStatus = JSON.stringify(res.status).replace(/['"]+/g, '');
    // Discard requests with 400 http return codes
    if (resStatus.localeCompare('404') === 0) {
      logger.logMessage(CoInformLogger.logTypes.warning, `RenewToken ${resStatus} Response. Logging Out..`);
      logOutActions();
    }
    else if (resStatus.localeCompare('200') === 0) {
      let data = res.data;
      if (data.token) {
        //renewTokenOKactions(data.token);
        let resToken = JSON.stringify(data.token).replace(/['"]+/g, '');
        let res = checkAndSaveToken(resToken);
        if (res.ok) {
          logger.logMessage(CoInformLogger.logTypes.info, `User Token Renewed: ${res.userMail}`);
          sendMessageToAllScripts({
            messageId: "renewUserToken",
            userMail: res.userMail,
            userID: res.userID,
            token: res.token,
            userOptions: configuration.coinform.options
          });
        }
        else {
          logger.logMessage(CoInformLogger.logTypes.error, "RenewToken Token Check Error");
          retryRenewVsLogout(retryNum);
        }
      }
      else {
        logger.logMessage(CoInformLogger.logTypes.error, "RenewToken No Token Error");
        retryRenewVsLogout(retryNum);
      }
    }
    else {
      logger.logMessage(CoInformLogger.logTypes.error, `RenewToken Unknown (${resStatus}) Response`);
      retryRenewVsLogout(retryNum);
    }

  }).catch(err => {
    logger.logMessage(CoInformLogger.logTypes.error, `Request Error: ${err}`);
    retryRenewVsLogout(retryNum);
  });

};

const retryRenewVsLogout = function (retryNum) {
  // check if we did retried a total of MAX_TOKEN_RENEW_RETRIES times
  if (retryNum < MAX_TOKEN_RENEW_RETRIES) {
    logger.logMessage(CoInformLogger.logTypes.debug, `Retrying again in short time..`);
    setTimeout(function() {
      renewUserToken(retryNum + 1);
    }, TOKEN_RENEW_RETRY_TIME);
  }
  else {
    // if it failed MAX_TOKEN_RENEW_RETRIES times, we do the log out
    logger.logMessage(CoInformLogger.logTypes.debug, `Too many retries. Logging Out..`);
    logOutActions();
  }
};

const logOutAPI = function(request, scriptId, logoutCallback) {

  logger.logMessage(CoInformLogger.logTypes.debug, `Logging Out (token ${request.userToken})`, scriptId);

  client.postUserLogout(request.userToken).then(res => {
    
    let resStatus = JSON.stringify(res.status).replace(/['"]+/g, '');
    if (resStatus.localeCompare('200') === 0) {
      logOutActions(scriptId);
    }
    if (logoutCallback) logoutCallback(res);

  }).catch(err => {
    logger.logMessage(CoInformLogger.logTypes.error, `Request error: ${err}`, scriptId);
  });

};

const logOutActions = function(scriptId) {

  coinformUserToken = null;
  coinformUserMail = null;
  coinformUserID = null;

  removeCookie("userToken");
  removeCookie("userMail");
  removeCookie("userID");

  sendMessageToAllScripts({
    messageId: "userLogout",
    defaultOptions: configuration.coinform.defaultOptions
  });

  logger.logMessage(CoInformLogger.logTypes.info, `User logged out`, scriptId);

}

const registerAPI = function(request, scriptId, registerCallback) {

  logger.logMessage(CoInformLogger.logTypes.debug, `Registering (user ${request.userMail})`, scriptId);

  client.postUserRegister(request.userMail, request.userPass, request.userOptions).then(res => registerCallback(res)).catch(err => {
    logger.logMessage(CoInformLogger.logTypes.error, `Request error: ${err}`, scriptId);
  });

};

const checkUrlAPI = function(request, scriptId, checkUrlCallback) {

  logger.logMessage(CoInformLogger.logTypes.debug, `Check URL: ${request.url}`, scriptId);

  client.getCheckUrlInfo(request.url).then(res => checkUrlCallback(res)).catch(err => {
    logger.logMessage(CoInformLogger.logTypes.error, `Request error: ${err}`, scriptId);
    if (checkUrlCallback) checkUrlCallback({
      status: -1,
      error: err
    });
  });

};

const checkTweetInfo = function(request, scriptId, tweetInfoCallback) {

  logger.logMessage(CoInformLogger.logTypes.debug, `Check Tweet Info (tweet id ${request.id})`, scriptId);

  client.postCheckTweetInfo(request.id, request.username, request.text, request.coinformUserID, request.userToken).then(res => tweetInfoCallback(res)).catch(err => {
    logger.logMessage(CoInformLogger.logTypes.error, `Request Error: ${err}`, scriptId);

    if (tweetInfoCallback) tweetInfoCallback({
      status: -1,
      error: err
    });

  });

};

const retryAPIQuery = function(request, scriptId, queryCallback) {

  logger.logMessage(CoInformLogger.logTypes.debug, `Retrying Tweet Query (query id ${request.queryId})`, scriptId);

  client.getResponseTweetInfo(request.queryId).then(res => queryCallback(res)).catch(err => {
    logger.logMessage(CoInformLogger.logTypes.error, `Request error: ${err}`, scriptId);
  });

};

const evaluateLabel = function(request, scriptId, evaluateTweetCallback) {

  logger.logMessage(CoInformLogger.logTypes.debug, `Sending Label Evaluation (tweet id ${request.id}): ${request.agreement}`, scriptId);

  client.postEvaluateLabel(request.id, request.url, request.ratedCredibility, request.moduleResponse, request.agreement, request.userToken).then(res => evaluateTweetCallback(res)).catch(err => {
    logger.logMessage(CoInformLogger.logTypes.error, `Request error: ${err}`, scriptId);

    if (evaluateTweetCallback) evaluateTweetCallback({
      status: -1,
      error: err
    });
  });

};

const evaluateTweet = function(request, scriptId, twitterEvaluateCallback) {

  logger.logMessage(CoInformLogger.logTypes.debug, `Sending Tweet Evaluation (tweet id ${request.id})`, scriptId);

  client.postEvaluateTweet(request.id, request.url, request.evaluation, request.userToken).then(res => twitterEvaluateCallback(res)).catch (err => {
    logger.logMessage(CoInformLogger.logTypes.error, `Request error: ${err}`, scriptId);

    if (twitterEvaluateCallback) twitterEvaluateCallback({
      status: -1,
      error: err
    });
  });

};

const forgotPass = function(request, scriptId, forgotPassCallback) {

  logger.logMessage(CoInformLogger.logTypes.debug, `Requesting Forgot Password (user ${request.userMail})`, scriptId);

  client.postUserForgotPass(request.userMail).then(res => forgotPassCallback(res)).catch(err => {
    logger.logMessage(CoInformLogger.logTypes.error, "ForgotPass exception: "+JSON.stringify(err), scriptId);
    
    if (forgotPassCallback) forgotPassCallback({
      status: -1,
      error: err
    });
    
  });

};

const changePass = function(request, scriptId, changePassCallback) {

  logger.logMessage(CoInformLogger.logTypes.debug, `Requesting Password Change`, scriptId);

  client.postUserChangePass(request.userPass, request.userNewPass, request.userToken).then(res => {
    
    let resStatus = JSON.stringify(res.status).replace(/['"]+/g, '');
    if (resStatus.localeCompare('200') === 0) {
      let data = res.data;
      if (data.token) {
        let resToken = JSON.stringify(data.token).replace(/['"]+/g, '');
        let res = checkAndSaveToken(resToken);
        if (res.ok) {
          logger.logMessage(CoInformLogger.logTypes.info, `ChangePass Token Renewed: ${res.userMail}`);
          sendMessageToAllScripts({
            messageId: "renewUserToken",
            userMail: res.userMail,
            userID: res.userID,
            token: res.token
          });
        }
        else {
          logger.logMessage(CoInformLogger.logTypes.error, "ChangePass Token Check Error");
        }
      }
      else {
        logger.logMessage(CoInformLogger.logTypes.error, "ChangePass No Token Error");
      }
    }
    if (changePassCallback) changePassCallback(res);

  }).catch(err => {

    logger.logMessage(CoInformLogger.logTypes.error, "ChangePass exception: "+JSON.stringify(err), scriptId);
    
    if (changePassCallback) changePassCallback({
      status: -1,
      error: err
    });
    
  });

};

const changeOptions = function (request, scriptId, changeOptionsCallback) {

  if (request.options !== undefined) {

    logger.logMessage(CoInformLogger.logTypes.debug, `Requesting Settings Change`, scriptId);
  
    client.postUserChangeSettings(request.options, request.userToken).then(res => {
      
      let resStatus = JSON.stringify(res.status).replace(/['"]+/g, '');
      if (resStatus.localeCompare('200') === 0) {
        logger.logMessage(CoInformLogger.logTypes.info, `ChangeSettings successful`);
      }
      if (changeOptionsCallback) changeOptionsCallback(res);
  
    }).catch(err => {
      logger.logMessage(CoInformLogger.logTypes.error, "ChangeSettings exception: "+JSON.stringify(err), scriptId);
    });

    configuration.coinform.options = request.options;

    //saveStorageUserOptions(request.options);

  }

};

const getCookie = function(cookieName, cookieCallback) {
    
  if (cookieName) {
    browserAPI.cookies.get({
      url: configuration.coinform.apiUrl,
      name: cookieName
    }, cookie => {
      if (cookie) logger.logMessage(CoInformLogger.logTypes.debug, `Cookie ${cookieName} Get OK: ${cookie.value}`);
      else logger.logMessage(CoInformLogger.logTypes.debug, `Cookie ${cookieName} Not Found`);
      if (cookieCallback) cookieCallback(cookie)
    });
  }
  else {
    logger.logMessage(CoInformLogger.logTypes.error, `Cokkie Get Parameters Error`);
  }

};

const setCookie = function(data, cookieCallback) {
  
  if (data.name) {
    data.url = configuration.coinform.apiUrl;
    browserAPI.cookies.set(data, cookie => {
      if (cookie) logger.logMessage(CoInformLogger.logTypes.debug, `Cookie ${cookie.name} Set OK: ${cookie.value}`);
      else logger.logMessage(CoInformLogger.logTypes.debug, `Cookie ${cookie.name} Set Problem`);
      if (cookieCallback) cookieCallback(cookie);
    });
  }
  else {
    logger.logMessage(CoInformLogger.logTypes.error, `Cokkie Set Parameters Error`);
  }

};

const removeCookie = function(cookieName, cookieCallback) {
    
  if (cookieName) {
    browserAPI.cookies.remove({
      url: configuration.coinform.apiUrl,
      name: cookieName
    }, cookie => {
      if (cookie) logger.logMessage(CoInformLogger.logTypes.debug, `Cookie ${cookieName} Removed OK`);
      else logger.logMessage(CoInformLogger.logTypes.debug, `Cookie ${cookieName} Not Found`);
      if (cookieCallback) cookieCallback(cookie)
    });
  }
  else {
    logger.logMessage(CoInformLogger.logTypes.error, `Cokkie Remove Parameters Error`);
  }

};

const saveStorageUserOptions = function (options) {
  // try to set local strored options
  let auxUserId = '';
  if (coinformUserID) auxUserId = coinformUserID;
  for (let [key, value] of Object.entries(options)) {
    let auxOption = {};
    auxOption[`coinform_${key}_${auxUserId}`] = value;
    chrome.storage.sync.set(auxOption, function() {});
  }
};

const checkStoredUserOptions = function () {
  // try to get local strored options
  let auxUserId = '';
  if (coinformUserID) auxUserId = coinformUserID;
  for (let [key, value] of Object.entries(configuration.coinform.options)) {
    let auxOptionName = `coinform_${key}_${auxUserId}`;
    browserAPI.storage.sync.get([auxOptionName], result => {
      if (result[auxOptionName]) {
        configuration.coinform.options[key] = result[auxOptionName];
      }
    });
  }
};
