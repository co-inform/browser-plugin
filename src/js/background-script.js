
const CoinformClient = require('./coinform-client');
const CoInformLogger = require('./coinform-logger');

const browserAPI = chrome || browser;

let configuration;
let client;
let logger;

let coinformUserToken = null;

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

  })
  .catch(err => {
    console.error('Could not load configuration file', err)
  });

browserAPI.storage.local.get(['userToken'], (data) => {
  if (data.userToken) {
    coinformUserToken = data.userToken;
  }
});

browserAPI.storage.onChanged.addListener(function(changes, namespace) {
  for (let key in changes) {
    if (key === "userToken") {
      let storageChange = changes[key];
      if (storageChange.newValue) {
        if (logger) {
          logger.logMessage(CoInformLogger.logTypes.info, `User logged in: ${storageChange.newValue}`);
        }
        coinformUserToken = storageChange.newValue;
      }
      else {
        if (logger) {
          logger.logMessage(CoInformLogger.logTypes.info, `User logged out: ${storageChange.oldValue}`);
        }
        coinformUserToken = null;
      }
    }
  }
});

const listenerRuntime = function(request, sender, sendResponse) {

  if (request.contentScriptQuery === "ConfigureBackground") {
    
    if (request.coinformApiUrl) {
      logger.logMessage(CoInformLogger.logTypes.debug, `Configuriong client API url: ${request.coinformApiUrl}`);
      client = new CoinformClient(fetch, request.coinformApiUrl);
    }
    if (request.logLevel) {
      logger.logMessage(CoInformLogger.logTypes.debug, `Configuring Log level: ${request.logLevel}`);
      logger = new CoInformLogger(CoInformLogger.logTypes[request.logLevel]);
    }

  }
  else if (request.contentScriptQuery === "RetryAPIQuery") {

    logger.logMessage(CoInformLogger.logTypes.debug, `Retrying API query (id ${request.queryId})`, sender.id);

    if (!client) {
      if (request.coinformApiUrl) {
        client = new CoinformClient(fetch, request.coinformApiUrl);
      }
      else if (configuration.coinform.apiUrl) {
        client = new CoinformClient(fetch, configuration.coinform.apiUrl);
      }
    }

    client.getResponseTweetInfo(request.queryId).then(res => sendResponse(res)).catch(err => {
      logger.logMessage(CoInformLogger.logTypes.error, `Request error: ${err}`, sender.id);
      // console.error(err);
    });

  }
  return true;

};
