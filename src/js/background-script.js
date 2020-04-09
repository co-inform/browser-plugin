
const jwtDecode = require('jwt-decode');
const CoinformClient = require('./coinform-client');
const CoInformLogger = require('./coinform-logger');

const browserAPI = chrome || browser;

let configuration;
let client;
let logger;

let coinformUserToken = null;
let coinformUserMail = null;

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
      }
      if (coinformUserToken) {
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
    setCookie(request, sendResponse);
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
        logInOKactions(request.userMail, data.token, scriptId);
      }
      else {
        logger.logMessage(CoInformLogger.logTypes.error, "Login token error", scriptId);
        // console.error(err);
      }
    }
    if (loginCallback) loginCallback(res);

  }).catch(err => {
    logger.logMessage(CoInformLogger.logTypes.error, `Request error: ${err}`, scriptId);
    // console.error(err);
  });

};

const logInOKactions = function(userMail, token, scriptId) {
        
  let resToken = JSON.stringify(token).replace(/['"]+/g, '');
  let tokenDecoded = jwtDecode(resToken);

  const now = new Date();
  const secondsSinceEpoch = Math.round(now.getTime() / 1000);
  if (tokenDecoded.exp < secondsSinceEpoch) {
    logger.logMessage(CoInformLogger.logTypes.warning, `Request warning: JWT expiring time error`, scriptId);
  }
  else {
    // set timer to renew the token, 30 seconds before expiring time
    let timeToRenew = (tokenDecoded.exp - secondsSinceEpoch) - 30000;
    setTimeout(function() {
      renewUserToken();
    }, timeToRenew);
  }

  setCookie({
    cookieName: "userToken",
    cookieValue: resToken,
    cookieExpirationDate: tokenDecoded.exp
  });
  setCookie({
    cookieName: "userMail",
    cookieValue: userMail,
    cookieExpirationDate: tokenDecoded.exp
  });

  sendMessageToAllScripts({
    messageId: "userLogin",
    userMail: userMail,
    jwt: resToken
  });


  logger.logMessage(CoInformLogger.logTypes.info, `User logged in: ${userMail}`, scriptId);
  coinformUserToken = resToken;
  coinformUserMail = userMail;

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

const renewUserToken = function() {

  logger.logMessage(CoInformLogger.logTypes.debug, `Time to Renew User Token (token ${coinformUserToken})..`);

  client.postRenewUserToken(coinformUserToken).then(res => {
    
    let resStatus = JSON.stringify(res.status).replace(/['"]+/g, '');
    // Discard requests with 400 http return codes
    if (resStatus.localeCompare('404') === 0) {
      logger.logMessage(CoInformLogger.logTypes.warning, `RenewToken ${resStatus} response. Logging Out..`);
      logOutAPI({
        userToken: coinformUserToken
      });
    }
    else if (resStatus.localeCompare('200') === 0) {
      let data = res.data;
      if (data.token) {
        renewTokenOKactions(data.token);
      }
      else {
        logger.logMessage(CoInformLogger.logTypes.error, "RenewToken error. Logging Out..", scriptId);
        logOutAPI({
          userToken: coinformUserToken
        });
      }
    }
    else {
      logger.logMessage(CoInformLogger.logTypes.error, `RenewToken unknown (${resStatus}) response. Logging Out..`);
      logOutAPI({
        userToken: coinformUserToken
      });
    }

  }).catch(err => {
    logger.logMessage(CoInformLogger.logTypes.error, `Request error: ${err}. Logging Out..`);
    logOutAPI({
      userToken: coinformUserToken
    });
    // console.error(err);
  });

};

const renewTokenOKactions = function(token) {
        
  let resToken = JSON.stringify(token).replace(/['"]+/g, '');
  let tokenDecoded = jwtDecode(resToken);

  const now = new Date();
  const secondsSinceEpoch = Math.round(now.getTime() / 1000);
  if (tokenDecoded.exp < secondsSinceEpoch) {
    logger.logMessage(CoInformLogger.logTypes.warning, `Request warning: JWT expiring time error`);
  }
  else {
    // set timer to renew the token, 30 seconds before expiring time
    let timeToRenew = (tokenDecoded.exp - secondsSinceEpoch) - 30000;
    setTimeout(function() {
      renewUserToken();
    }, timeToRenew);
  }

  setCookie({
    cookieName: "userToken",
    cookieValue: resToken,
    cookieExpirationDate: tokenDecoded.exp
  });
  setCookie({
    cookieName: "userMail",
    cookieValue: coinformUserMail,
    cookieExpirationDate: tokenDecoded.exp
  });

  sendMessageToAllScripts({
    messageId: "renewUserToken",
    jwt: resToken
  });

  logger.logMessage(CoInformLogger.logTypes.info, `User Token Renewed: ${coinformUserMail}`);
  coinformUserToken = resToken;

};

const logOutAPI = function(request, scriptId, logoutCallback) {

  logger.logMessage(CoInformLogger.logTypes.debug, `Logging Out (token ${request.userToken})`, scriptId);

  client.postUserLogout(request.userToken).then(res => {
    
    let resStatus = JSON.stringify(res.status).replace(/['"]+/g, '');
    if (resStatus.localeCompare('200') === 0) {
      logOutOKactions(scriptId);
    }
    if (logoutCallback) logoutCallback(res);

  }).catch(err => {
    logger.logMessage(CoInformLogger.logTypes.error, `Request error: ${err}`, scriptId);
    // console.error(err);
  });

};

const logOutOKactions = function(scriptId) {

  removeCookie("userToken");
  removeCookie("userMail");

  sendMessageToAllScripts({
    messageId: "userLogout"
  });

  logger.logMessage(CoInformLogger.logTypes.info, `User logged out`, scriptId);
  coinformUserToken = null;
  coinformUserMail = null;

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

};

const setCookie = function(data, cookieCallback) {
    
  if (data.cookieName && data.cookieValue) {
    let cookieParams = {
      url: configuration.coinform.apiUrl,
      name: data.cookieName,
      value: data.cookieValue
    };
    if (data.cookieExpirationDate) {
      cookieParams.expirationDate = data.cookieExpirationDate;
    }
    browserAPI.cookies.set(cookieParams, cookie => {
      if (cookie) logger.logMessage(CoInformLogger.logTypes.debug, `Cookie ${data.cookieName} Set OK: ${cookie.value}`);
      else logger.logMessage(CoInformLogger.logTypes.debug, `Cookie ${data.cookieName} Set Problem`);
      if (cookieCallback) cookieCallback(cookie);
    });
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

};
