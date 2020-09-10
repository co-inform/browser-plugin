
const $ = require('jquery');
const CoInformLogger = require('./coinform-logger');

let browserAPI = chrome || browser;

let configuration;
let logger;

let coinformUserToken = null;
let coinformUserMail = null;
let coinformUserID = null;

let logoURL = "/resources/coinform_biglogo.png";

window.addEventListener("load", function(){
  
  resetAllDisplays();

  // Read the configuration file and if it was successful, start
  browserAPI.runtime.sendMessage({
    messageId: "GetConfig"
  }, function(res) {
    if (res.configuration) {
      configuration = res.configuration;
      logger = new CoInformLogger(CoInformLogger.logTypes[configuration.coinform.logLevel]);

      let versionSpan = document.createElement("SPAN");
      versionSpan.classList.add("version-text");
      versionSpan.textContent = `ver ${configuration.pluginVersion}`;
      document.getElementById('popup-header').prepend(versionSpan);

      init();
    }
    else {
      showMessage("err", "error_loading_configuration");
    }
  });

  // Set language messages to the HTML
  document.getElementById('popup-title').innerHTML = browserAPI.i18n.getMessage("popup_plugin_title");
  document.getElementById('login-auth-mail').placeholder = browserAPI.i18n.getMessage("user_mail");
  document.getElementById('login-auth-pass').placeholder = browserAPI.i18n.getMessage("password");
  document.getElementById('register-auth-mail').placeholder = browserAPI.i18n.getMessage("user_mail");
  document.getElementById('register-auth-pass').placeholder = browserAPI.i18n.getMessage("password");
  document.getElementById('register-auth-pass2').placeholder = browserAPI.i18n.getMessage("retype_password");
  document.getElementById('account-auth-pass').placeholder = browserAPI.i18n.getMessage("password");
  document.getElementById('account-auth-newpass').placeholder = browserAPI.i18n.getMessage("new_password");
  document.getElementById('account-auth-newpass2').placeholder = browserAPI.i18n.getMessage("retype_new_password");
  document.getElementById('account-change-pass-info').innerHTML = browserAPI.i18n.getMessage("change_password_info");
  document.getElementById('account-info-title').innerHTML = browserAPI.i18n.getMessage("account_information");
  document.getElementById('logged-text').querySelector('span').innerHTML = browserAPI.i18n.getMessage("already_logged");
  document.getElementById('options-title').innerHTML = browserAPI.i18n.getMessage("options_title");
  document.getElementById('login-question').innerHTML = browserAPI.i18n.getMessage("dont_have_account_question");
  document.getElementById('register-login-question').innerHTML = browserAPI.i18n.getMessage("already_have_account_question");
  document.getElementById('options-test-mode-label').innerHTML = browserAPI.i18n.getMessage("options_test_mode");

  // Set the header logo image
  let img = document.createElement("IMG");
  img.classList.add("logo");
  img.setAttribute("src", logoURL);
  document.getElementById('popup-header').prepend(img);

  // Set Texts and Bind Actions to the buttons and clickable elements
  let loginButton = document.getElementById('login-button');
  loginButton.innerHTML = browserAPI.i18n.getMessage("log_in");
  loginButton.addEventListener('click', (event) => {
    loginAction(loginButton);
  });
  
  let forgotPasswordLink = document.getElementById('forgot-pass-question');
  forgotPasswordLink.innerHTML = browserAPI.i18n.getMessage("forgot_password_question");
  forgotPasswordLink.addEventListener('click', (event) => {
    forgotPasswordAction(forgotPasswordLink);
  });
  
  let loginAnswerLink = document.getElementById('login-answer');
  loginAnswerLink.innerHTML = browserAPI.i18n.getMessage("sign_up");
  loginAnswerLink.addEventListener('click', (event) => {
    registerStartAction();
  });
  
  let registerAnswerLink = document.getElementById('register-login-answer');
  registerAnswerLink.innerHTML = browserAPI.i18n.getMessage("login");
  registerAnswerLink.addEventListener('click', (event) => {
    loginStartAction();
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
  
  let changePasswordButton = document.getElementById('changePassword-button');
  changePasswordButton.innerHTML = browserAPI.i18n.getMessage("change");
  changePasswordButton.addEventListener('click', (event) => {
    changePasswordAction(changePasswordButton);
  });
  
  let optionsSaveButton = document.getElementById('saveOptions-button');
  optionsSaveButton.innerHTML = browserAPI.i18n.getMessage("save");
  optionsSaveButton.addEventListener('click', (event) => {
    optionsSaveAction(optionsSaveButton);
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
  
  let accountTabButton = document.getElementById('menu-account');
  accountTabButton.querySelector("span").title = browserAPI.i18n.getMessage("account");
  accountTabButton.addEventListener('click', (event) => {
    if (isAccountDisplayed()) {
      if (coinformUserToken) {
        displayLogout();
      }
      else {
        displayLogin();
      }
    }
    else {
      displayAccount();
    }
  });
  
  let optionsTabButton = document.getElementById('menu-options');
  optionsTabButton.querySelector("span").title = browserAPI.i18n.getMessage("options");
  optionsTabButton.addEventListener('click', (event) => {
    if (isOptionsDisplayed()) {
      if (coinformUserToken) {
        displayLogout();
      }
      else {
        displayLogin();
      }
    }
    else {
      displayOptions();
    }
  });

});

// Init the popup page with logged/not-logged status
const init = () => {

  resetAllDisplays();

  browserAPI.runtime.sendMessage({
    messageId: "GetSession"
  }, function(res) {
    if (res.token) {
      logger.logMessage(CoInformLogger.logTypes.debug, `User already logged: ${res.userMail}`);
      coinformUserToken = res.token;
      coinformUserMail = res.userMail;
      coinformUserID = res.userID;
      displayLogout();
      refreshDisplayedAccount(coinformUserMail);
    }
    else {
      displayLogin();
    }
  });

  browserAPI.runtime.sendMessage({
    messageId: "GetOptions"
  }, function(res) {
    if (res.options) {
      logger.logMessage(CoInformLogger.logTypes.debug, `Options retrieved`);
      refreshDisplayedOptions(res.options);
    }
  });

  browserAPI.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.messageId === "userLogin") {
      logger.logMessage(CoInformLogger.logTypes.info, `User logged in: ${request.userMail}`);
      coinformUserToken = request.token;
      coinformUserMail = request.userMail;
      coinformUserID = request.userID;
      refreshDisplayedAccount(request.userMail);
    }
    else if (request.messageId === "userLogout") {
      logger.logMessage(CoInformLogger.logTypes.info, `User logged out`);
      coinformUserToken = null;
      coinformUserMail = null;
      coinformUserID = null;
      refreshDisplayedAccount(null);
    }
    else if (request.messageId === "renewUserToken") {
      logger.logMessage(CoInformLogger.logTypes.debug, `Renewed User Token`);
      coinformUserToken = request.token;
      coinformUserMail = request.userMail;
      coinformUserID = request.userID;
      refreshDisplayedAccount(request.userMail);
    }
  });

};

// Functions for changing through interface displayed
const resetAllDisplays = () => {
  document.querySelectorAll("#popup-menu > .menu-toolbar").forEach(el => el.classList.add("hidden"));
  document.querySelectorAll("#popup-menu > .menu-toolbar > .menu-item").forEach(el => el.classList.remove("actual"));
  document.querySelectorAll(".form-control-group").forEach(el => el.classList.add("hidden"));
};

const displayLogin = () => {
  resetAllDisplays();
  document.getElementById('menu-notlogged').classList.remove("hidden");
  document.getElementById('menu-login').classList.add("actual");
  document.getElementById('login-form').classList.remove("hidden");
};

const displayLogout = () => {
  resetAllDisplays();
  document.getElementById('menu-logged').classList.remove("hidden");
  document.getElementById('registered-div').classList.remove("hidden");
};

const displayRegister = () => {
  resetAllDisplays();
  document.getElementById('menu-notlogged').classList.remove("hidden");
  document.getElementById('menu-register').classList.add("actual");
  document.getElementById('register-form').classList.remove("hidden");
};

const displayOptions = () => {
  resetAllDisplays();
  document.getElementById('menu-logged').classList.remove("hidden");
  document.getElementById('menu-options').classList.add("actual");
  document.getElementById('options-form').classList.remove("hidden");

  // check if options have changed
  browserAPI.runtime.sendMessage({
    messageId: "GetOptions"
  }, function(res) {
    if (res.options) {
      refreshDisplayedOptions(res.options);
    }
  });
};

const displayAccount = () => {
  resetAllDisplays();
  document.getElementById('menu-logged').classList.remove("hidden");
  document.getElementById('menu-account').classList.add("actual");
  document.getElementById('account-form').classList.remove("hidden");

  // check if account has changed or logged out
  browserAPI.runtime.sendMessage({
    messageId: "GetSession"
  }, function(res) {
    if (res.token) {
      refreshDisplayedAccount(res.userMail);
    }
    else {
      displayLogin();
    }
  });

};

const isOptionsDisplayed = () => {
  return (document.getElementById('menu-options').classList.contains("actual"));
};

const isAccountDisplayed = () => {
  return (document.getElementById('menu-account').classList.contains("actual"));
};

const refreshDisplayedAccount = (accountMail) => {
  document.querySelector('input[name="account-usermail"]').value = accountMail;
};

const refreshDisplayedOptions = (options) => {
  if (options.testMode !== undefined) {
    let valCheckbox = (options.testMode.localeCompare("true") === 0);
    document.querySelector('input[name="options-test-mode"]').checked = valCheckbox;
  }
};


// Parse login form, comunicate with API and save user token
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
    
    browserAPI.runtime.sendMessage({
      messageId: "LogIn",
      userMail: userMail,
      userPass: userPass
    }, function(res) {

      let resStatus = JSON.stringify(res.status).replace(/['"]+/g, '');
      // Discard requests with 400 http return codes
      if ((resStatus.localeCompare('401') === 0) || (resStatus.localeCompare('404') === 0)) {
        logger.logMessage(CoInformLogger.logTypes.warning, `Login 401/404 (no such user registered) response`);
        showMessage("err", "mail_password_not_found", 2000);
        targetButton.disabled = false;
      }
      else if (resStatus.localeCompare('200') === 0) {
        // The login response JWT parse and cookies is managed through the background script
        let data = res.data;
        if (data.token) {
          logger.logMessage(CoInformLogger.logTypes.info, "Login successful");
          // Other login actuations are managed through the userLogin message listener
          showMessage("ok", "login_ok", 1000);
          setTimeout(function() {
            displayLogout();
            targetButton.disabled = false;
          }, 1000);
          log2Server('login', null, null, `Co-Inform User Logged In`);
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

    });

  }
  
};

// Parse Register form, and comunicate with API
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
    
    browserAPI.runtime.sendMessage({
      messageId: "Register",
      userMail: userMail,
      userPass: userPass
    }, function(res) {

      let resStatus = JSON.stringify(res.status).replace(/['"]+/g, '');
      // Discard requests with 400 http return codes
      if (resStatus.localeCompare('400') === 0) {
        logger.logMessage(CoInformLogger.logTypes.warning, "Register 400 (something went horribly wrong) response");
        showMessage("err", "register_problem", 2000);
        targetButton.disabled = false;
      }
      else if (resStatus.localeCompare('201') === 0) {
        logger.logMessage(CoInformLogger.logTypes.info, "Register successful");
        showMessage("ok", "register_ok");
        setTimeout(function() {
          displayLogin();
          targetButton.disabled = false;
        }, 1000);
        log2Server('register', null, null, `Co-Inform User Registered`);
      }
      else {
        logger.logMessage(CoInformLogger.logTypes.error, `Register unknown (${resStatus}) response`);
        showMessage("err", "register_error", 2000);
        targetButton.disabled = false;
      }

    });

  }

};

// Comunicate with API for Logout
const logoutAction = (targetButton) => {
  
  if (targetButton.disabled) {
    return false;
  }

  if (!coinformUserToken) {
    showMessage("err", "logout_error", 2000);
  }
  else {
    
    targetButton.disabled = true;

    log2Server('login', null, null, `Co-Inform User Logging Out`);
    
    browserAPI.runtime.sendMessage({
      messageId: "LogOut",
      userToken: coinformUserToken
    }, function(res) {

      let resStatus = JSON.stringify(res.status).replace(/['"]+/g, '');
      // Discard requests with 400 http return codes
      if (resStatus.localeCompare('401') === 0) {
        logger.logMessage(CoInformLogger.logTypes.warning, "Logout 400 response");
        showMessage("err", "logout_problem", 2000);
        targetButton.disabled = false;
      }
      else if (resStatus.localeCompare('200') === 0) {
        // The logout response parse and cookies is managed through the background script
        logger.logMessage(CoInformLogger.logTypes.info, "Logout successful");
        // Other logout actuations are managed through the userLogout message listener
        showMessage("ok", "logout_ok", 1000);
        setTimeout(function() {
          displayLogin();
          targetButton.disabled = false;
        }, 1000);

      }
      else {
        logger.logMessage(CoInformLogger.logTypes.error, `Logout unknown (${resStatus}) response`);
        showMessage("err", "logout_error", 2000);
        targetButton.disabled = false;
      }

    });

  }

};

// Parse Options form, and do the appropriate actions
const optionsSaveAction = (targetButton) => {
  
  if (targetButton.disabled) {
    return false;
  }
    
  targetButton.disabled = true;

  //TODO: here we can implement options save action
  let optionsObj = {
    testMode: "false"
  };
  let auxInput = document.querySelector('input[name="options-test-mode"]:checked');
  if (auxInput) {
    optionsObj.testMode = auxInput.value || "false";
  }

  browserAPI.runtime.sendMessage({
    messageId: "OptionsChange",
    options: optionsObj
  }, function (res) {

    logger.logMessage(CoInformLogger.logTypes.info, "Options saved");
    showMessage("ok", "options_save_ok", 2000);
    setTimeout(function() {
      if (coinformUserToken) {
        displayLogout();
      }
      else {
        displayLogin();
      }
      targetButton.disabled = false;
    }, 1000);
    
  });

};

// Parse Account Change Password form, and communicate with API
const changePasswordAction = (targetButton) => {
  
  if (targetButton.disabled) {
    return false;
  }
  
  if (!coinformUserToken) {
    showMessage("err", "change_password_error", 2000);
  }
  else {

    const userPass = document.querySelector('input[name="account-userpass"]').value || null;
    const userNewPass = document.querySelector('input[name="account-usernewpass"]').value || null;
    const userNewPass2 = document.querySelector('input[name="account-usernewpass2"]').value || null;

    if (!userPass || !userNewPass  || !userNewPass2 || (userNewPass !== userNewPass2) || !validatePass(userPass) || !validatePass(userNewPass)) {
      showMessage("err", "password_not_valid_info", 4000);
    }
    else {
      
      targetButton.disabled = true;

      browserAPI.runtime.sendMessage({
        messageId: "ChangePass",
        userPass: userPass,
        userNewPass: userNewPass,
        coinformUserToken: coinformUserToken
      }, function (res) {

        let resStatus = JSON.stringify(res.status).replace(/['"]+/g, '');
        // Discard requests with 400 http return codes
        if ((resStatus.localeCompare('401') === 0) || (resStatus.localeCompare('403') === 0)) {
          logger.logMessage(CoInformLogger.logTypes.warning, `ChangePass ${resStatus} response`);
          showMessage("err", "change_password_problem", 2000);
          targetButton.disabled = false;
        }
        else if (resStatus.localeCompare('200') === 0) {
          let data = res.data;
          logger.logMessage(CoInformLogger.logTypes.info, "ChangePass successful");
          showMessage("ok", "change_password_ok", 2000);
          setTimeout(function() {
            displayLogout();
            targetButton.disabled = false;
          }, 1000);
        }
        else {
          logger.logMessage(CoInformLogger.logTypes.error, `ChangePass unknown (${resStatus}) response`);
          showMessage("err", "change_password_error", 2000);
          targetButton.disabled = false;
        }

      });
    }
  }
};

// Parse the Login email form, and communicate with API
const forgotPasswordAction = (targetButton) => {
  
  if (targetButton.disabled) {
    return false;
  }

  const userMail = document.querySelector('input[name="login-usermail"]').value || null;

  if (!userMail) {
    showMessage("err", "provide_mail", 2000);
  }
  else if (!validateEmail(userMail)) {
    showMessage("err", "mail_not_valid", 2000);
  }
  else {
    
    targetButton.disabled = true;

    browserAPI.runtime.sendMessage({
      messageId: "ForgotPass",
      userMail: userMail
    }, function (res) {

      let resStatus = JSON.stringify(res.status).replace(/['"]+/g, '');
      // Discard requests with 400 http return codes
      if (resStatus.localeCompare('400') === 0) {
        logger.logMessage(CoInformLogger.logTypes.warning, "ForgotPass 400 response");
        showMessage("err", "forgot_password_problem", 2000);
      }
      else if (resStatus.localeCompare('200') === 0) {
        let data = res.data;
        logger.logMessage(CoInformLogger.logTypes.info, "ForgotPass successful");
        showMessage("ok", "forgot_password_ok");
      }
      else {
        logger.logMessage(CoInformLogger.logTypes.error, `ForgotPass unknown (${resStatus}) response`);
        showMessage("err", "forgot_password_error", 2000);
      }
      targetButton.disabled = false;

    });
  }

};

const registerStartAction = () => {
  displayRegister();
};

const loginStartAction = () => {
  displayLogin();
};

/**
 * Show a message on the page with a check button for removing it.
 * @param {} type type of message (info/error) changeable through CSS
 * @param {*} label label text of the message, defined in the language file
 * @param {*} time optional time for the message, after which it will be automaticly removed
 */
const showMessage = (type, label, time) => {
  let span = document.getElementById(label);
  if (!span) {
    let msgDiv = document.getElementById('popup-messages');
    span = document.createElement("SPAN");
    span.setAttribute("id", label);
    span.classList.add("popup-message");
    span.classList.add(type);
    span.append(document.createTextNode(browserAPI.i18n.getMessage(label)));
    let auxclose = document.createElement("SPAN");
    //auxclose.append(document.createTextNode("&times;"));
    auxclose.classList.add("popup-message-close");
    auxclose.addEventListener('click', (event) => {
      clearMessage(span);
    });
    span.append(auxclose);
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

function log2Server (category, itemUrl, itemData, message) {

  const logTime = new Date().toISOString();

  const logData = {
    log_time: logTime,
    log_category: category,
    related_item_url: itemUrl,
    related_item_data: itemData,
    log_action: message
  };

  browserAPI.runtime.sendMessage({
    messageId: "SendLog2Server",
    logData: logData, 
    userToken: coinformUserToken
  }, function(res) {
    if (!res) {
      logger.logMessage(CoInformLogger.logTypes.error, `Error sending Server Log`);
    }
  });
  
}

function validateEmail(email) {
  let re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(email);
}

function validatePass(pass) {
  let re = /^.{6,}$/;
  return re.test(pass);
}
