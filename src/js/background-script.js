
const CoinformClient = require('./coinform-client');
const CoInformLogger = require('./coinform-logger');

const browserAPI = chrome || browser;

let configuration;
let client;
let logger;

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

const listenerRuntime = function(request, sender, sendResponse) {

  if (request.contentScriptQuery === "ConfigureBackground") {
    
    if (request.coinformApiUrl) {
      client = new CoinformClient(fetch, request.coinformApiUrl);
    }
    if (request.logLevel) {
      logger = new CoInformLogger(CoInformLogger.logTypes[request.logLevel]);
    }

  }
  else if (request.contentScriptQuery === "RetryAPIQuery") {

    if (!client) {
      if (request.coinformApiUrl) {
        client = new CoinformClient(fetch, request.coinformApiUrl);
      }
      else if (configuration.coinform.apiUrl) {
        client = new CoinformClient(fetch, configuration.coinform.apiUrl);
      }
    }

    logger.logMessage(CoInformLogger.logTypes.debug, `Retrying API query (id ${request.queryId})`, sender.id);

    client.getResponseTweetInfo(request.queryId).then(res => sendResponse(res)).catch(err => {
      logger.logMessage(CoInformLogger.logTypes.error, `Request error: ${err}`, sender.id);
      // console.error(err);
    });

  }
  return true;

};
