
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
    logger = new CoInformLogger(CoInformLogger.logTypes[configuration.coinform.logLevel]);
    client = new CoinformClient(fetch, configuration.coinform.apiUrl);

    browserAPI.runtime.onMessage.addListener(listenerRuntime);

    browserAPI.cookies.getAll({
      url: configuration.coinform.apiUrl
    }, cookies => {
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
            token: res.token
          });
        }
        else {
          renewUserToken();
        }
      }
      else {
        renewUserToken();
      }
    });

  })
  .catch(err => {
    console.error('Could not load configuration file', err)
  });

const listenerRuntime = function(request, sender, sendResponse) {

  if (request.messageId === "ConfigureBackground") {
    configureBackground(request, sendResponse);
  }
  else if (request.messageId === "RetryAPIQuery") {
    retryAPIQuery(request, sender.id, sendResponse);
  }
  else if (request.messageId === "GetCookie") {
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
  else if (request.messageId === "CheckUrl") {
    checkUrlAPI(request, sender.id, sendResponse);
  }
  else if (request.messageId === "GetSession") {
    sendResponse({
      userMail: coinformUserMail,
      userID: coinformUserID,
      token: coinformUserToken
    });
  }

  return true;

};

const configureBackground = function(request, configureCallback) {

  if (request.coinformApiUrl) {
    logger.logMessage(CoInformLogger.logTypes.debug, `Configuring client API url: ${request.coinformApiUrl}`);
    client = new CoinformClient(fetch, request.coinformApiUrl);
  }
  if (request.logLevel) {
    logger.logMessage(CoInformLogger.logTypes.debug, `Configuring Log level: ${request.logLevel}`);
    logger = new CoInformLogger(CoInformLogger.logTypes[request.logLevel]);
  }
  if (configureCallback) configureCallback();

};

const retryAPIQuery = function(request, scriptId, queryCallback) {

  logger.logMessage(CoInformLogger.logTypes.debug, `Retrying API query (id ${request.queryId})`, scriptId);

  client.getResponseTweetInfo(request.queryId).then(res => queryCallback(res)).catch(err => {
    logger.logMessage(CoInformLogger.logTypes.error, `Request error: ${err}`, scriptId);
    // console.error(err);
  });

};

const logInAPI = function(request, scriptId, loginCallback) {

  logger.logMessage(CoInformLogger.logTypes.debug, `Logging In (user ${request.userMail})`, scriptId);

  client.postUserLogin(request.userMail, request.userPass).then(res => {
    
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
            token: res.token
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
    // console.error(err);
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

  logger.logMessage(CoInformLogger.logTypes.debug, `Time to Renew User Token..`);

  client.postRenewUserToken().then(res => {

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
          if (res.ok) {
            sendMessageToAllScripts({
              messageId: "renewUserToken",
              userMail: res.userMail,
              userID: res.userID,
              token: res.token
            });
          }
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
    // console.error(err);
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
    // console.error(err);
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
    messageId: "userLogout"
  });

  logger.logMessage(CoInformLogger.logTypes.info, `User logged out`, scriptId);

}

const registerAPI = function(request, scriptId, registerCallback) {

  logger.logMessage(CoInformLogger.logTypes.debug, `Registering (user ${request.userMail})`, scriptId);

  client.postUserRegister(request.userMail, request.userPass).then(res => registerCallback(res)).catch(err => {
    logger.logMessage(CoInformLogger.logTypes.error, `Request error: ${err}`, scriptId);
    // console.error(err);
  });

};

const checkUrlAPI = function(request, scriptId, checkUrlCallback) {

  logger.logMessage(CoInformLogger.logTypes.debug, `Check URL: ${request.url}`, scriptId);

  client.getCheckUrlInfo(request.url).then(res => checkUrlCallback(res)).catch(err => {
    logger.logMessage(CoInformLogger.logTypes.error, `Request error: ${err}`, scriptId);
    // console.error(err);
    if (checkUrlCallback) checkUrlCallback({
      status: -1,
      error: err
    });
  });

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
