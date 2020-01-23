
const CoinformClient = require('./coinform-client');
const CoInformLogger = require('./coinform-logger');

let browserAPI = chrome || browser;

let configuration;
let client;
let logger;

let logoURL = "/resources/coinform48.png";
let minlogoURL = "/resources/coinform_logotext21.png";

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

  document.getElementById('popup-title').innerHTML = "Co-Inform";
  document.getElementById('login-mail-label').innerHTML = browserAPI.i18n.getMessage("user_mail");
  document.getElementById('login-pass-label').innerHTML = browserAPI.i18n.getMessage("password");
  document.getElementById('register-mail-label').innerHTML = browserAPI.i18n.getMessage("user_mail");
  document.getElementById('register-pass-label').innerHTML = browserAPI.i18n.getMessage("password");
  document.getElementById('register-pass2-label').innerHTML = browserAPI.i18n.getMessage("retype_password");

  let img = document.createElement("IMG");
  img.setAttribute("src", logoURL);
  document.getElementById('popup-header').append(img);

  let loginButton = document.getElementById('login-button');
  loginButton.innerHTML = browserAPI.i18n.getMessage("log_in");
  loginButton.addEventListener('click', (event) => {
    loginAction();
  });
  
  let logoutButton = document.getElementById('logout-button');
  logoutButton.innerHTML = browserAPI.i18n.getMessage("log_out");
  logoutButton.addEventListener('click', (event) => {
    logoutAction();
  });
  
  let registerButton = document.getElementById('register-button');
  registerButton.innerHTML = browserAPI.i18n.getMessage("register");
  registerButton.addEventListener('click', (event) => {
    registerAction();
  });
  
  let registerStartButton = document.getElementById('registerStart-button');
  registerStartButton.innerHTML = browserAPI.i18n.getMessage("register_form");
  registerStartButton.addEventListener('click', (event) => {
    registerStartAction();
  });
  
  let loginStartButton = document.getElementById('loginStart-button');
  loginStartButton.innerHTML = browserAPI.i18n.getMessage("login_form");
  loginStartButton.addEventListener('click', (event) => {
    loginStartAction();
  });

});

// Init the login form
const init = () => {

  logger = new CoInformLogger(CoInformLogger.logTypes[configuration.coinform.logLevel]);
  client = new CoinformClient(fetch, configuration.coinform.apiUrl);

  browserAPI.storage.local.get(['userId'], (data) => {
    if (data.userId) {
      logger.logMessage(CoInformLogger.logTypes.debug, "User already logged");
      displayLogout();
    }
    else {
      logger.logMessage(CoInformLogger.logTypes.debug, "User not logged");
      displayLogin();
    }
  });

};

const displayLogin = () => {
  document.getElementById('loginStart-button').style.display = "none";
  document.getElementById('logout-button').style.display = "none";
  document.getElementById('register-button').style.display = "none";
  document.getElementById('register-form').style.display = "none";
  document.getElementById('popup-title').innerHTML = browserAPI.i18n.getMessage("login_title");
  document.getElementById('login-form').style.display = "grid";
  document.getElementById('login-button').style.display = "inline";
  document.getElementById('registerStart-button').style.display = "inline";
};

const displayLogout = () => {
  document.getElementById('registerStart-button').style.display = "none";
  document.getElementById('loginStart-button').style.display = "none";
  document.getElementById('login-form').style.display = "none";
  document.getElementById('login-button').style.display = "none";
  document.getElementById('register-button').style.display = "none";
  document.getElementById('register-form').style.display = "none";
  document.getElementById('popup-title').innerHTML = browserAPI.i18n.getMessage("already_logged");
  document.getElementById('logout-button').style.display = "inline";
};

const displayRegister = () => {
  document.getElementById('logout-button').style.display = "none";
  document.getElementById('login-form').style.display = "none";
  document.getElementById('login-button').style.display = "none";
  document.getElementById('registerStart-button').style.display = "none";
  document.getElementById('popup-title').innerHTML = browserAPI.i18n.getMessage("register_title");
  document.getElementById('register-form').style.display = "grid";
  document.getElementById('register-button').style.display = "inline";
  document.getElementById('loginStart-button').style.display = "inline";
};

// Parse login, comunicate with API and save user to Chrome local Storage.
const loginAction = () => {

  const userMail = document.querySelector('input[name="login-usermail"]').value || null;
  const userPass = document.querySelector('input[name="login-userpass"]').value || null;

  if (userMail && userPass) {

    client.postUserLogin(userMail, userPass).then(function (data) {

      let resStatus = JSON.stringify(data.status).replace(/['"]+/g, '');
      // Discard requests with 400 http return codes
      if (resStatus.localeCompare('404') === 0) {
        logger.logMessage(CoInformLogger.logTypes.warning, "Login 404 response (User not found)");
        showMessage(browserAPI.i18n.getMessage("mail_password_not_found"));
        setTimeout(function() {
          clearMessages();
        }, 2000);
      }
      else if (resStatus.localeCompare('200') === 0) {
        logger.logMessage(CoInformLogger.logTypes.debug, "Login 200 response: "+JSON.stringify(data));
        let resToken = JSON.stringify(data.token);
        if (resToken) {
          logger.logMessage(CoInformLogger.logTypes.info, "Login succesful");
          browserAPI.storage.local.set({'userId': data.token});
          showMessage(browserAPI.i18n.getMessage("login_ok"));
          setTimeout(function() {
            window.close();
          }, 1000);
        }
        else {
          logger.logMessage(CoInformLogger.logTypes.error, "Login token error");
          showMessage(browserAPI.i18n.getMessage("login_error"));
        }
      }
      else {
        logger.logMessage(CoInformLogger.logTypes.error, "Login unknown response: "+resStatus);
        showMessage(browserAPI.i18n.getMessage("login_error"));
      }
    }).catch(err => {
      logger.logMessage(CoInformLogger.logTypes.error, "Login exception: "+JSON.stringify(err));
      showMessage(browserAPI.i18n.getMessage("login_error"));
    });

  }
  else {
    showMessage(browserAPI.i18n.getMessage("login_not_valid"));
    setTimeout(function() {
      clearMessages();
    }, 2000);
  }
  
};

const registerAction = () => {

  const userMail = document.querySelector('input[name="register-usermail"]').value || null;
  const userPass = document.querySelector('input[name="register-userpass"]').value || null;
  const userPass2 = document.querySelector('input[name="register-userpass2"]').value || null;

  if (userMail && userPass && userPass2 && (userPass === userPass2)) {

    client.postUserLogin(userMail, userPass).then(function (data) {

      let resStatus = JSON.stringify(data.status).replace(/['"]+/g, '');
      // Discard requests with 400 http return codes
      if (resStatus.localeCompare('400') === 0) {
        logger.logMessage(CoInformLogger.logTypes.warning, "Register 400 response (Something went wrong)");
        showMessage(browserAPI.i18n.getMessage("register_problem"));
        setTimeout(function() {
          clearMessages();
        }, 2000);
      }
      else if (resStatus.localeCompare('201') === 0) {
        logger.logMessage(CoInformLogger.logTypes.info, "Register succesful");
        showMessage(browserAPI.i18n.getMessage("register_ok"));
        setTimeout(function() {
          displayLogin();
        }, 1000);
      }
      else {
        logger.logMessage(CoInformLogger.logTypes.error, "Register unknown response: "+resStatus);
        showMessage(browserAPI.i18n.getMessage("register_error"));
      }
    }).catch(err => {
      logger.logMessage(CoInformLogger.logTypes.error, "Register exception: "+JSON.stringify(err));
      showMessage(browserAPI.i18n.getMessage("register_error"));
      setTimeout(function() {
        clearMessages();
      }, 2000);
    });

  }
  else {
    showMessage(browserAPI.i18n.getMessage("register_not_valid"));
    setTimeout(function() {
      clearMessages();
    }, 2000);
  }

};

const showMessage = (message) => {
  let msgDiv = document.getElementById('login-messages');
  let span = document.createElement("SPAN");
  span.classList.add("login-message");
  let auxtxt = document.createTextNode(message);
  span.append(auxtxt);
  msgDiv.append(span);
  msgDiv.style.display = "block";
};

const clearMessages = () => {
  let msgDiv = document.getElementById('login-messages');
  msgDiv.style.display = "none";
  while (msgDiv.firstChild) {
    msgDiv.removeChild(msgDiv.firstChild);
  }
};

const logoutAction = () => {
  browserAPI.storage.local.remove(['userId']);
  logger.logMessage(CoInformLogger.logTypes.info, "Logout succesful");
  showMessage(browserAPI.i18n.getMessage("logout_ok"));
  setTimeout(function() {
    window.close();
  }, 1000);
};

const registerStartAction = () => {
  displayRegister();
};

const loginStartAction = () => {
  displayLogin();
};

