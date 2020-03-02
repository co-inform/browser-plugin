
const $ = require('jquery');
const CoinformClient = require('./coinform-client');
const CoInformLogger = require('./coinform-logger');

let browserAPI = chrome || browser;

let configuration;
let client;
let logger;

let logoURL = "/resources/coinform_biglogo.png";

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

  document.getElementById('popup-title').innerHTML = browserAPI.i18n.getMessage("popup_plugin_title");
  document.getElementById('login-auth-mail').placeholder = browserAPI.i18n.getMessage("user_mail");
  document.getElementById('login-auth-pass').placeholder = browserAPI.i18n.getMessage("password");
  document.getElementById('register-auth-mail').placeholder = browserAPI.i18n.getMessage("user_mail");
  document.getElementById('register-auth-pass').placeholder = browserAPI.i18n.getMessage("password");
  document.getElementById('register-auth-pass2').placeholder = browserAPI.i18n.getMessage("retype_password");

  let img = document.createElement("IMG");
  img.classList.add("logo");
  img.setAttribute("src", logoURL);
  document.getElementById('popup-header').prepend(img);

  let loginButton = document.getElementById('login-button');
  loginButton.innerHTML = browserAPI.i18n.getMessage("log_in");
  loginButton.addEventListener('click', (event) => {
    loginAction(loginButton);
  });
  
  let logoutButton = document.getElementById('logout-button');
  logoutButton.innerHTML = browserAPI.i18n.getMessage("log_out");
  logoutButton.addEventListener('click', (event) => {
    logoutAction(logoutButton);
  });
  
  let registerButton = document.getElementById('register-button');
  registerButton.innerHTML = browserAPI.i18n.getMessage("register");
  registerButton.addEventListener('click', (event) => {
    registerAction(registerButton);
  });
  
  let registerTabButton = document.getElementById('menu-register');
  registerTabButton.querySelector("span").innerHTML = browserAPI.i18n.getMessage("register");
  registerTabButton.addEventListener('click', (event) => {
    registerStartAction();
  });
  
  let loginTabButton = document.getElementById('menu-login');
  loginTabButton.querySelector("span").innerHTML = browserAPI.i18n.getMessage("login");
  loginTabButton.addEventListener('click', (event) => {
    loginStartAction();
  });

});

// Init the login form
const init = () => {

  logger = new CoInformLogger(CoInformLogger.logTypes[configuration.coinform.logLevel]);
  client = new CoinformClient(fetch, configuration.coinform.apiUrl);

  browserAPI.storage.local.get(['userToken'], (data) => {
    if (data.userToken) {
      logger.logMessage(CoInformLogger.logTypes.debug, `User already logged: ${data.userToken}`);
      displayLogout();
    }
    else {
      logger.logMessage(CoInformLogger.logTypes.debug, "User not logged");
      displayLogin();
    }
  });

};

const displayLogin = () => {
  document.getElementById('menu-logged').style.display = "none";
  document.getElementById('menu-notlogged').style.display = "flex";
  document.getElementById('menu-register').classList.remove("actual");
  document.getElementById('menu-login').classList.add("actual");

  document.getElementById('register-form').style.display = "none";
  document.getElementById('login-form').style.display = "grid";

  document.getElementById('logout-button').style.display = "none";
  document.getElementById('register-button').style.display = "none";
  document.getElementById('login-button').style.display = "block";
};

const displayLogout = () => {
  document.getElementById('menu-logged').style.display = "flex";
  document.getElementById('menu-notlogged').style.display = "none";
  document.getElementById('menu-register').classList.remove("actual");
  document.getElementById('menu-login').classList.remove("actual");

  document.getElementById('login-form').style.display = "none";
  document.getElementById('register-form').style.display = "none";

  document.getElementById('login-button').style.display = "none";
  document.getElementById('register-button').style.display = "none";
  document.getElementById('logout-button').style.display = "block";
};

const displayRegister = () => {
  document.getElementById('menu-logged').style.display = "none";
  document.getElementById('menu-notlogged').style.display = "flex";
  document.getElementById('menu-register').classList.add("actual");
  document.getElementById('menu-login').classList.remove("actual");

  document.getElementById('login-form').style.display = "none";
  document.getElementById('register-form').style.display = "grid";

  document.getElementById('login-button').style.display = "none";
  document.getElementById('register-button').style.display = "block";
  document.getElementById('logout-button').style.display = "none";
};

// Parse login, comunicate with API and save user to Chrome local Storage.
const loginAction = (targetButton) => {
  
  if (targetButton.disabled) {
    return false;
  }

  const userMail = document.querySelector('input[name="login-usermail"]').value || null;
  const userPass = document.querySelector('input[name="login-userpass"]').value || null;

  if (!userMail || !validateEmail(userMail)) {
    showMessage("err", "mail_not_valid", 2000);
  }
  else if (!userPass || !validatePass(userPass)) {
    showMessage("err", "password_not_valid", 2000);
  }
  else {

    targetButton.disabled = true;

    client.postUserLogin(userMail, userPass).then(function (res) {

      let resStatus = JSON.stringify(res.status).replace(/['"]+/g, '');
      // Discard requests with 400 http return codes
      if ((resStatus.localeCompare('401') === 0) || (resStatus.localeCompare('404') === 0)) {
        logger.logMessage(CoInformLogger.logTypes.warning, `Login 401/404 (no such user registered) response`);
        showMessage("err", "mail_password_not_found", 2000);
        targetButton.disabled = false;
      }
      else if (resStatus.localeCompare('200') === 0) {
        let data = res.data;
        if (data.token) {
          let resToken = JSON.stringify(data.token).replace(/['"]+/g, '');
          logger.logMessage(CoInformLogger.logTypes.info, "Login succesful");
          browserAPI.storage.local.set({'userToken': resToken});
          showMessage("ok", "login_ok", 1000);
          setTimeout(function() {
            displayLogout();
            targetButton.disabled = false;
          }, 1000);
        }
        else {
          logger.logMessage(CoInformLogger.logTypes.error, "Login token error");
          showMessage("err", "login_error", 2000);
          targetButton.disabled = false;
        }
      }
      else {
        logger.logMessage(CoInformLogger.logTypes.error, `Login unknown (${resStatus}) response`);
        showMessage("err", "login_error", 2000);
        targetButton.disabled = false;
      }

    }).catch(err => {
      logger.logMessage(CoInformLogger.logTypes.error, "Login exception: "+JSON.stringify(err));
      showMessage("err", "login_error", 2000);
      targetButton.disabled = false;
    });

  }
  
};

const registerAction = (targetButton) => {
  
  if (targetButton.disabled) {
    return false;
  }

  const userMail = document.querySelector('input[name="register-usermail"]').value || null;
  const userPass = document.querySelector('input[name="register-userpass"]').value || null;
  const userPass2 = document.querySelector('input[name="register-userpass2"]').value || null;

  if (!userMail || !validateEmail(userMail)) {
    showMessage("err", "mail_not_valid", 2000);
  }
  else if (!userPass || !userPass2 || (userPass !== userPass2) || !validatePass(userPass)) {
    showMessage("err", "password_not_valid_info", 4000);
  }
  else {
    
    targetButton.disabled = true;

    client.postUserRegister(userMail, userPass).then(function (res) {

      let resStatus = JSON.stringify(res.status).replace(/['"]+/g, '');
      // Discard requests with 400 http return codes
      if (resStatus.localeCompare('400') === 0) {
        logger.logMessage(CoInformLogger.logTypes.warning, "Register 400 (something went horribly wrong) response");
        showMessage("err", "register_problem", 2000);
        targetButton.disabled = false;
      }
      else if (resStatus.localeCompare('201') === 0) {
        let data = res.data;
        logger.logMessage(CoInformLogger.logTypes.info, "Register succesful");
        showMessage("ok", "register_ok", 2000);
        setTimeout(function() {
          displayLogin();
          targetButton.disabled = false;
        }, 1000);
      }
      else {
        logger.logMessage(CoInformLogger.logTypes.error, `Register unknown (${resStatus}) response`);
        showMessage("err", "register_error", 2000);
        targetButton.disabled = false;
      }

    }).catch(err => {
      logger.logMessage(CoInformLogger.logTypes.error, "Register exception: "+JSON.stringify(err));
      showMessage("err", "register_error", 2000);
      targetButton.disabled = false;
    });

  }

};

const showMessage = (type, label, time) => {
  let span = document.getElementById(label);
  if (!span) {
    let msgDiv = document.getElementById('popup-messages');
    span = document.createElement("SPAN");
    span.setAttribute("id", label);
    span.classList.add("popup-message");
    span.classList.add(type);
    let auxtxt = document.createTextNode(browserAPI.i18n.getMessage(label));
    span.append(auxtxt);
    $(span).hide();
    msgDiv.append(span);
    $(span).fadeIn(500);
    // if time is defined we remove the message after that time
    if (time && Number.isInteger(time)) {
      setTimeout(function() {
        clearMessage(span);
      }, time);
    }
  }
  return span;
};

const clearMessage = (elem) => {
  // let msgDiv = document.getElementById('popup-messages');
  // msgDiv.removeChild(elem);
  $(elem).fadeOut(500, function() {
    $(this).remove();
  });
};

const clearAllMessages = () => {
  let msgDiv = document.getElementById('popup-messages');
  while (msgDiv.firstChild) {
    msgDiv.removeChild(msgDiv.firstChild);
  }
};

const logoutAction = (targetButton) => {
  
  if (targetButton.disabled) {
    return false;
  }
  targetButton.disabled = true;

  browserAPI.storage.local.remove(['userToken']);
  logger.logMessage(CoInformLogger.logTypes.info, "Logout succesful");
  showMessage("ok", "logout_ok", 1000);

  setTimeout(function() {
    displayLogin();
    targetButton.disabled = false;
  }, 1000);

};

const registerStartAction = () => {
  displayRegister();
};

const loginStartAction = () => {
  displayLogin();
};

function validateEmail(email) {
  let re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(email);
}

function validatePass(pass) {
  let re = /^.{6,}$/;
  return re.test(pass);
}
