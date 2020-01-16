


const CoinformClient = require('./coinform-client');
const CoInformLogger = require('./coinform-logger');
let logger;

// let browser = browser || chrome;
let client;

const listenerRuntime = function(request, sender, sendResponse) {

  if (request.contentScriptQuery === "ConfigureBackground") {

    logger = new CoInformLogger();
    logger.setLogLevel(logger.logTypes.all);
    
    client = new CoinformClient(fetch, request.coinformApiUrl);

  }
  else if (request.contentScriptQuery === "RetryAPIQuery") {

    logger.logConsoleDebug(logger.logTypes.info, `Retrying API query (id ${request.queryId})`, sender.id);

    client.getResponseTweetInfo(request.queryId).then(res => sendResponse(res)).catch(err => {
      logger.logConsoleDebug(logger.logTypes.error, `Request error: ${err}`, sender.id);
      // console.error(err);
    });

  }
  return true;

};

// browser.runtime.onMessage.addListener(listenerRuntime);
chrome.runtime.onMessage.addListener(listenerRuntime);
