
const CoInformLogger = require('./coinform-logger');

let browserAPI = chrome || browser;

let configuration;
let logger;

window.addEventListener("load", function(){

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
      init();
      
    })
    .catch(err => {
      console.error('Could not load configuration file', err)
    });

  document.getElementById('options-title').innerHTML = browserAPI.i18n.getMessage("misinformation_restriction_level");
  document.getElementById('treshold_1-label').innerHTML = browserAPI.i18n.getMessage("low");
  document.getElementById('treshold_2-label').innerHTML = browserAPI.i18n.getMessage("medium");
  document.getElementById('treshold_3-label').innerHTML = browserAPI.i18n.getMessage("high");

  let saveButton = document.getElementById('save-button');
  saveButton.innerHTML = browserAPI.i18n.getMessage("save");
  saveButton.addEventListener('click', (event) => {
    saveOptions();
  });

});

// Init the theshold value
const init = () => {

  logger = new CoInformLogger(CoInformLogger.logTypes[configuration.coinform.logLevel]);

  browserAPI.storage.local.get(['treshold'], (data) => {
    logger.logMessage(CoInformLogger.logTypes.debug, `User treshold level: ${data.treshold}`);
    if (data.treshold === 'low') {
      document.getElementById('treshold_1').checked = true;
    } else if (data.treshold === 'high') {
      document.getElementById('treshold_3').checked = true;
    } else {
      document.getElementById('treshold_2').checked = true;
    }
  });
  
};

// Saves options to Chrome local Storage.
const saveOptions = () => {
  const tresholdValue = document.querySelector('input[name="treshold"]:checked').value || 'medium';
  logger.logMessage(CoInformLogger.logTypes.info, `New user treshold level: ${tresholdValue}`);
  browserAPI.storage.local.set({'treshold': tresholdValue});
  window.close();
};
