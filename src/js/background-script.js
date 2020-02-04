
const CoinformClient = require('./coinform-client');
const CoInformLogger = require('./coinform-logger');

// let browser = browser || chrome;
let client;
let logger;

logger = new CoInformLogger(CoInformLogger.logTypes.warning);

const listenerRuntime = function(request, sender, sendResponse) {

  if (request.contentScriptQuery === "ConfigureBackground") {
    
    client = new CoinformClient(fetch, request.coinformApiUrl);

  }
  else if (request.contentScriptQuery === "RetryAPIQuery") {

    if (!client) {
      client = new CoinformClient(fetch, request.coinformApiUrl);
    }

    logger.logConsoleDebug(CoInformLogger.logTypes.info, `Retrying API query (id ${request.queryId})`, sender.id);

    client.getResponseTweetInfo(request.queryId).then(res => sendResponse(res)).catch(err => {
      logger.logConsoleDebug(CoInformLogger.logTypes.error, `Request error: ${err}`, sender.id);
      // console.error(err);
    });

  }
  return true;

};

// browser.runtime.onMessage.addListener(listenerRuntime);
chrome.runtime.onMessage.addListener(listenerRuntime);
