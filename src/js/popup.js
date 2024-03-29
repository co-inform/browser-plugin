
const $ = require('jquery');
const CoinformConstants = require('./coinform-constants');
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
      showMessage("err", browserAPI.i18n.getMessage("error_loading_configuration"));
    }
  });

  // Set language messages to the HTML
  document.getElementById('popup-title').innerHTML = browserAPI.i18n.getMessage("popup_plugin_title");
  document.getElementById('login-auth-mail').placeholder = browserAPI.i18n.getMessage("user_mail");
  document.getElementById('login-mail-label').title = browserAPI.i18n.getMessage("user_mail");
  document.getElementById('login-auth-pass').placeholder = browserAPI.i18n.getMessage("password");
  document.getElementById('login-pass-label').title = browserAPI.i18n.getMessage("password");
  document.getElementById('register-auth-mail').placeholder = browserAPI.i18n.getMessage("user_mail");
  document.getElementById('register-mail-label').title = browserAPI.i18n.getMessage("user_mail");
  document.getElementById('register-auth-pass').placeholder = browserAPI.i18n.getMessage("password");
  document.getElementById('register-pass-label').title = browserAPI.i18n.getMessage("password");
  document.getElementById('register-auth-pass2').placeholder = browserAPI.i18n.getMessage("retype_password");
  document.getElementById('register-pass2-label').title = browserAPI.i18n.getMessage("retype_password");
  document.getElementById('account-auth-mail').placeholder = browserAPI.i18n.getMessage("user_mail");
  document.getElementById('account-auth-mail').title = browserAPI.i18n.getMessage("user_mail");
  document.getElementById('account-mail-label').title = browserAPI.i18n.getMessage("user_mail");
  document.getElementById('account-auth-id').placeholder = browserAPI.i18n.getMessage("user_id");
  document.getElementById('account-auth-id').title = browserAPI.i18n.getMessage("user_id");
  document.getElementById('account-id-label').title = browserAPI.i18n.getMessage("user_id");
  document.getElementById('account-auth-pass').placeholder = browserAPI.i18n.getMessage("password");
  document.getElementById('account-pass-label').title = browserAPI.i18n.getMessage("password");
  document.getElementById('account-auth-newpass').placeholder = browserAPI.i18n.getMessage("new_password");
  document.getElementById('account-newpass-label').title = browserAPI.i18n.getMessage("new_password");
  document.getElementById('account-auth-newpass2').placeholder = browserAPI.i18n.getMessage("retype_new_password");
  document.getElementById('account-newpass2-label').title = browserAPI.i18n.getMessage("retype_new_password");
  document.getElementById('account-change-pass-info').innerHTML = browserAPI.i18n.getMessage("change_password_info");
  document.getElementById('account-info-title').innerHTML = browserAPI.i18n.getMessage("account_information");
  document.getElementById('logged-text').querySelector('span').innerHTML = browserAPI.i18n.getMessage("already_logged");
  document.getElementById('options-title').innerHTML = browserAPI.i18n.getMessage("options_title");
  document.getElementById('login-question').innerHTML = browserAPI.i18n.getMessage("dont_have_account_question");
  document.getElementById('register-login-question').innerHTML = browserAPI.i18n.getMessage("already_have_account_question");
  
  document.getElementById('about-title').innerHTML = browserAPI.i18n.getMessage("about_title");
  document.getElementById('about-text1').innerHTML = browserAPI.i18n.getMessage("about_text1__html");
  document.getElementById('about-text2').innerHTML = browserAPI.i18n.getMessage("about_text2__html");
  document.getElementById('about-links-pretext').innerHTML = browserAPI.i18n.getMessage("about_links_pretext");
  document.getElementById('about-links-andtxt').innerHTML = browserAPI.i18n.getMessage("about_links_andtxt");
  document.getElementById('about-links-midtext').innerHTML = browserAPI.i18n.getMessage("about_links_midtext");
  document.getElementById('about-contact-pretext').innerHTML = browserAPI.i18n.getMessage("about_contact_pretext");

  let projectLink = document.getElementById('about-link-project-page');
  projectLink.innerHTML = browserAPI.i18n.getMessage("about_link_project_page");
  projectLink.href = CoinformConstants.PROJECT_URL;
  let teamLink = document.getElementById('about-link-team-page');
  teamLink.innerHTML = browserAPI.i18n.getMessage("about_link_team_page");
  teamLink.href = CoinformConstants.TEAM_URL;
  let tutorialLink = document.getElementById('about-link-plugin-page');
  tutorialLink.innerHTML = browserAPI.i18n.getMessage("about_link_plugin_page");
  tutorialLink.href = CoinformConstants.TUTORIAL_URL;
  let websiteLink = document.getElementById('about-link-website');
  websiteLink.innerHTML = browserAPI.i18n.getMessage("about_link_website");
  websiteLink.href = CoinformConstants.WEBSITE_URL;
  let contactLink = document.getElementById('about-contact-link');
  contactLink.innerHTML = browserAPI.i18n.getMessage("about_contact_link");
  contactLink.href = CoinformConstants.CONTACT_URL;

  document.getElementById('options-user-data-text').innerHTML = browserAPI.i18n.getMessage("options_user_data_group");
  document.getElementById('options-nudging-text').innerHTML = browserAPI.i18n.getMessage("options_nudging_group");
  document.getElementById('options-dev-text').innerHTML = browserAPI.i18n.getMessage("options_dev_group");

  document.getElementById('options-test-mode-label').innerHTML = browserAPI.i18n.getMessage("options_test_mode");
  document.getElementById('options-research-participation-label').innerHTML = browserAPI.i18n.getMessage("options_research_participation");
  document.getElementById('options-followup-communications-label').innerHTML = browserAPI.i18n.getMessage("options_followup_communications");
  document.getElementById('options-nudging-all-label').innerHTML = browserAPI.i18n.getMessage("options_nudging_all");
  document.getElementById('options-nudging-blur-label').innerHTML = browserAPI.i18n.getMessage("options_nudging_blur");
  document.getElementById('options-nudging-await-label').innerHTML = browserAPI.i18n.getMessage("options_nudging_await");
  
  let nungingOptionsAll = document.getElementById('options-nudging-all');
  nungingOptionsAll.addEventListener('change', (event) => {
    optionsNudgingChangeAction(nungingOptionsAll);
  });
  let nungingOptionsBlur = document.getElementById('options-nudging-blur');
  nungingOptionsBlur.addEventListener('change', (event) => {
    optionsNudgingChangeAction(nungingOptionsBlur);
  });
  let nungingOptionsAwait = document.getElementById('options-nudging-await');
  nungingOptionsAwait.addEventListener('change', (event) => {
    optionsNudgingChangeAction(nungingOptionsAwait);
  });

  document.getElementById('register-participation-input').querySelector('.consent-text details summary').innerHTML = browserAPI.i18n.getMessage("consent_participate_summary");
  document.getElementById('register-participation-input').querySelector('.consent-text details p').innerHTML = browserAPI.i18n.getMessage("consent_participate_text");
  document.getElementById('register-participation-yes-text').innerHTML = browserAPI.i18n.getMessage("i_agree");
  document.getElementById('register-participation-no-text').innerHTML = browserAPI.i18n.getMessage("i_disagree");
  document.getElementById('register-step2-text').querySelector('h3').innerHTML = browserAPI.i18n.getMessage("consent_participate_summary");
  document.getElementById('register-step2-text').querySelector('p').innerHTML = browserAPI.i18n.getMessage("consent_participate_text");

  document.getElementById('register-followup-input').querySelector('.consent-text details summary').innerHTML = browserAPI.i18n.getMessage("consent_followup_summary");
  document.getElementById('register-followup-input').querySelector('.consent-text details p').innerHTML = browserAPI.i18n.getMessage("consent_followup_text");
  document.getElementById('register-followup-yes-text').innerHTML = browserAPI.i18n.getMessage("i_agree");
  document.getElementById('register-followup-no-text').innerHTML = browserAPI.i18n.getMessage("i_disagree");
  document.getElementById('register-step3-text').querySelector('h3').innerHTML = browserAPI.i18n.getMessage("consent_followup_summary");
  document.getElementById('register-step3-text').querySelector('p').innerHTML = browserAPI.i18n.getMessage("consent_followup_text");

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
  registerAnswerLink.innerHTML = browserAPI.i18n.getMessage("log_in");
  registerAnswerLink.addEventListener('click', (event) => {
    loginStartAction();
  });
  
  let logoutButton = document.getElementById('logout-button');
  logoutButton.innerHTML = browserAPI.i18n.getMessage("log_out");
  logoutButton.addEventListener('click', (event) => {
    logoutAction(logoutButton);
  });
  
  let registerNext1Button = document.getElementById('register-next1-button');
  registerNext1Button.innerHTML = browserAPI.i18n.getMessage("next");
  registerNext1Button.addEventListener('click', (event) => {
    registerNextAction(registerNext1Button, 1);
  });
  
  let registerNext2Button = document.getElementById('register-next2-button');
  registerNext2Button.innerHTML = browserAPI.i18n.getMessage("next");
  registerNext2Button.addEventListener('click', (event) => {
    registerNextAction(registerNext2Button, 2);
  });
  
  let registerStep2AgreeButton = document.getElementById('register-step2-agree-button');
  registerStep2AgreeButton.innerHTML = browserAPI.i18n.getMessage("i_agree");
  registerStep2AgreeButton.addEventListener('click', (event) => {
    registerStep2Action(registerStep2AgreeButton, "agree");
  });
  
  let registerStep2DisagreeButton = document.getElementById('register-step2-disagree-button');
  registerStep2DisagreeButton.innerHTML = browserAPI.i18n.getMessage("i_disagree");
  registerStep2DisagreeButton.addEventListener('click', (event) => {
    registerStep2Action(registerStep2AgreeButton, "disagree");
  });
  
  let registerStep3AgreeButton = document.getElementById('register-step3-agree-button');
  registerStep3AgreeButton.innerHTML = browserAPI.i18n.getMessage("i_agree");
  registerStep3AgreeButton.addEventListener('click', (event) => {
    registerStep3Action(registerStep3AgreeButton, "agree");
  });
  
  let registerStep3DisagreeButton = document.getElementById('register-step3-disagree-button');
  registerStep3DisagreeButton.innerHTML = browserAPI.i18n.getMessage("i_disagree");
  registerStep3DisagreeButton.addEventListener('click', (event) => {
    registerStep3Action(registerStep3DisagreeButton, "disagree");
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
  
  let aboutTabButton = document.getElementById('menu-about');
  aboutTabButton.querySelector("span").title = browserAPI.i18n.getMessage("about");
  aboutTabButton.addEventListener('click', (event) => {
    if (isAboutDisplayed()) {
      if (coinformUserToken) {
        displayLogout();
      }
      else {
        displayLogin();
      }
    }
    else {
      displayAbout();
    }
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
      refreshDisplayedAccount(coinformUserMail, coinformUserID);
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
      configuration.coinform.options = res.options;
      refreshDisplayedOptions(res.options);
    }
  });

  browserAPI.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.messageId === "userLogin") {
      logger.logMessage(CoInformLogger.logTypes.info, `User logged in: ${request.userMail}`);
      coinformUserToken = request.token;
      coinformUserMail = request.userMail;
      coinformUserID = request.userID;
      configuration.coinform.options = request.userOptions;
      refreshDisplayedAccount(request.userMail, request.userID);
    }
    else if (request.messageId === "userLogout") {
      logger.logMessage(CoInformLogger.logTypes.info, `User logged out`);
      coinformUserToken = null;
      coinformUserMail = null;
      coinformUserID = null;
      configuration.coinform.options = null;
      if (request.defaultOptions) {
        configuration.coinform.options = request.defaultOptions;
      }
      refreshDisplayedAccount(null, null);
    }
    else if (request.messageId === "renewUserToken") {
      logger.logMessage(CoInformLogger.logTypes.debug, `Renewed User Token`);
      coinformUserToken = request.token;
      coinformUserMail = request.userMail;
      coinformUserID = request.userID;
      configuration.coinform.options = request.userOptions;
      refreshDisplayedAccount(request.userMail, request.userID);
    }
    else if (request.messageId === "OptionsChange") {
      if (request.options !== undefined) {
        configuration.coinform.options = request.options;
      }
    }
  });

};

// Functions for changing through interface displayed
const resetAllDisplays = () => {
  document.querySelectorAll("#popup-menu > .menu-group").forEach(el => el.classList.add("hidden"));
  resetDisplays();
};

const resetDisplays= () => {
  document.querySelectorAll("#popup-menu .menu-item").forEach(el => el.classList.remove("actual"));
  document.querySelectorAll(".popup-div-group").forEach(el => el.classList.add("hidden"));
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

const displayRegister = (step = 0) => {
  resetAllDisplays();
  document.getElementById('menu-notlogged').classList.remove("hidden");
  document.getElementById('menu-register').classList.add("actual");
  document.getElementById('register-form').classList.remove("hidden");
  if (step == 1) {
    document.getElementById('register-participation-input').classList.remove("hidden");
    document.getElementById('register-followup-input').classList.add("hidden");
    document.getElementById('register-next1-button').classList.add("hidden");
    document.getElementById('register-next2-button').classList.remove("hidden");
    document.getElementById('register-button').classList.add("hidden");
  }
  else if (step == 2) {
    document.getElementById('register-participation-input').classList.remove("hidden");
    document.getElementById('register-followup-input').classList.remove("hidden");
    document.getElementById('register-next1-button').classList.add("hidden");
    document.getElementById('register-next2-button').classList.add("hidden");
    document.getElementById('register-button').classList.remove("hidden");
  }
  else {
    document.getElementById('register-participation-input').classList.add("hidden");
    document.getElementById('register-followup-input').classList.add("hidden");
    document.getElementById('register-next1-button').classList.remove("hidden");
    document.getElementById('register-next2-button').classList.add("hidden");
    document.getElementById('register-button').classList.add("hidden");
  }
};

const displayRegisterStep2 = () => {
  resetAllDisplays();
  document.getElementById('menu-notlogged').classList.remove("hidden");
  document.getElementById('menu-register').classList.add("actual");
  document.getElementById('register-form-step2').classList.remove("hidden");
};

const displayRegisterStep3 = () => {
  resetAllDisplays();
  document.getElementById('menu-notlogged').classList.remove("hidden");
  document.getElementById('menu-register').classList.add("actual");
  document.getElementById('register-form-step3').classList.remove("hidden");
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

const displayAbout = () => {
  resetDisplays();
  document.getElementById('menu-about').classList.add("actual");
  document.getElementById('about-div').classList.remove("hidden");

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
      refreshDisplayedAccount(res.userMail, res.userID);
    }
    else {
      displayLogin();
    }
  });

};

const isOptionsDisplayed = () => {
  return (document.getElementById('menu-options').classList.contains("actual"));
};

const isAboutDisplayed = () => {
  return (document.getElementById('menu-about').classList.contains("actual"));
};

const isAccountDisplayed = () => {
  return (document.getElementById('menu-account').classList.contains("actual"));
};

const refreshDisplayedAccount = (accountMail, accountID) => {
  document.querySelector('input[name="account-usermail"]').value = accountMail;
  document.querySelector('input[name="account-userid"]').value = accountID;
};

const refreshDisplayedOptions = (options) => {
  if (options.testMode !== undefined) {
    let valCheckbox = (options.testMode.localeCompare("true") === 0);
    document.querySelector('input[name="options-test-mode"]').checked = valCheckbox;
  }
  if (options.participation !== undefined) {
    let valCheckbox = (options.participation.localeCompare("true") === 0);
    document.querySelector('input[name="options-research-participation"]').checked = valCheckbox;
  }
  if (options.followup !== undefined) {
    let valCheckbox = (options.followup.localeCompare("true") === 0);
    document.querySelector('input[name="options-followup-communications"]').checked = valCheckbox;
  }
  document.querySelector('input[name="options-nudging-all"]').checked = true;
  document.querySelector('input[name="options-nudging-blur"]').checked = true;
  if (options.config.blur !== undefined) {
    let valCheckbox = (options.config.blur.localeCompare("false") !== 0);
    document.querySelector('input[name="options-nudging-blur"]').checked = valCheckbox;
  }
  document.querySelector('input[name="options-nudging-await"]').checked = true;
  if (options.config.await !== undefined) {
    let valCheckbox = (options.config.await.localeCompare("false") !== 0);
    document.querySelector('input[name="options-nudging-await"]').checked = valCheckbox;
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
    showMessage("err", browserAPI.i18n.getMessage("mail_not_valid"), 2000);
  }
  else if (!userPass || !validatePass(userPass)) {
    showMessage("err", browserAPI.i18n.getMessage("password_not_valid"), 2000);
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
        showMessage("err", browserAPI.i18n.getMessage("mail_password_not_found"), 2000);
        targetButton.disabled = false;
      }
      else if (resStatus.localeCompare('200') === 0) {
        // The login response JWT parse and cookies is managed through the background script
        let data = res.data;
        if (data.token) {
          logger.logMessage(CoInformLogger.logTypes.info, "Login successful");
          // Other login actuations are managed through the userLogin message listener
          showMessage("ok", browserAPI.i18n.getMessage("login_ok"), 1000);
          setTimeout(function() {
            displayLogout();
            targetButton.disabled = false;
          }, 1000);
          log2Server('login', null, null, `Co-Inform User Logged In`);
        }
        else {
          logger.logMessage(CoInformLogger.logTypes.error, "Login token error");
          showMessage("err", browserAPI.i18n.getMessage("login_error"), 2000);
          targetButton.disabled = false;
        }
      }
      else {
        logger.logMessage(CoInformLogger.logTypes.error, `Login unknown (${resStatus}) response`);
        showMessage("err", browserAPI.i18n.getMessage("login_error"), 2000);
        targetButton.disabled = false;
      }

    });

  }
  
};

// Parse Register form
const registerNextAction = (targetButton, step) => {
  
  if (targetButton.disabled) {
    return false;
  }

  const userMail = document.querySelector('input[name="register-usermail"]').value || null;
  const userPass = document.querySelector('input[name="register-userpass"]').value || null;
  const userPass2 = document.querySelector('input[name="register-userpass2"]').value || null;

  if (!userMail || !validateEmail(userMail)) {
    showMessage("err", browserAPI.i18n.getMessage("mail_not_valid"), 2000);
  }
  else if (!userPass || !userPass2 || (userPass !== userPass2) || !validatePass(userPass)) {
    showMessage("err", browserAPI.i18n.getMessage("password_not_valid_info"), 4000);
  }
  else if (step == 1) {
    displayRegisterStep2();
  }
  else if (step == 2) {
    displayRegisterStep3();
  }

};

// Parse Register form
const registerStep2Action = (targetButton, agreement) => {
  
  if (targetButton.disabled) {
    return false;
  }

  if (agreement == "agree") {
    document.querySelector('input[name="register-participation"][id="register-participation-yes"]').checked = true;
  }
  else if (agreement == "disagree") {
    document.querySelector('input[name="register-participation"][id="register-participation-no"]').checked = true;
  }
  document.getElementById('register-participation-input').classList.remove("hidden");

  displayRegister(1);

};

// Parse Register form
const registerStep3Action = (targetButton, agreement) => {
  
  if (targetButton.disabled) {
    return false;
  }

  if (agreement == "agree") {
    document.querySelector('input[name="register-followup"][id="register-followup-yes"]').checked = true;
  }
  else if (agreement == "disagree") {
    document.querySelector('input[name="register-followup"][id="register-followup-no"]').checked = true;
  }
  document.getElementById('register-followup-input').classList.remove("hidden");

  displayRegister(2);

};

// Parse Register form, and comunicate with API
const registerAction = (targetButton) => {
  
  if (targetButton.disabled) {
    return false;
  }

  const userMail = document.querySelector('input[name="register-usermail"]').value || null;
  const userPass = document.querySelector('input[name="register-userpass"]').value || null;
  const userPass2 = document.querySelector('input[name="register-userpass2"]').value || null;
  const userParticipation = document.querySelector('input[name="register-participation"]:checked').value || null;
  const userFollowup = document.querySelector('input[name="register-followup"]:checked').value || null;

  if (!userMail || !validateEmail(userMail)) {
    showMessage("err", browserAPI.i18n.getMessage("mail_not_valid"), 2000);
  }
  else if (!userPass || !userPass2 || (userPass !== userPass2) || !validatePass(userPass)) {
    showMessage("err", browserAPI.i18n.getMessage("password_not_valid_info"), 4000);
  }
  else if (!userParticipation) {
    showMessage("err", browserAPI.i18n.getMessage("read_and_answer_participation"), 4000);
  }
  else if (!userFollowup) {
    showMessage("err", browserAPI.i18n.getMessage("read_and_answer_followup"), 4000);
  }
  else {
    
    targetButton.disabled = true;

    let userOptions = {
      research: userParticipation,
      communication: userFollowup
    };
    
    browserAPI.runtime.sendMessage({
      messageId: "Register",
      userMail: userMail,
      userPass: userPass,
      userOptions: userOptions
    }, function(res) {

      let resStatus = JSON.stringify(res.status).replace(/['"]+/g, '');
      // Discard requests with 400 http return codes
      if (resStatus.localeCompare('400') === 0) {
        logger.logMessage(CoInformLogger.logTypes.warning, "Register 400 (something went horribly wrong) response");
        showMessage("err", browserAPI.i18n.getMessage("register_problem"), 2000);
        targetButton.disabled = false;
      }
      else if (resStatus.localeCompare('201') === 0) {
        logger.logMessage(CoInformLogger.logTypes.info, "Register successful");
        showMessage("ok", browserAPI.i18n.getMessage("register_ok"));
        setTimeout(function() {
          displayLogin();
          targetButton.disabled = false;
        }, 1000);
        log2Server('register', null, null, `Co-Inform User Registered`);
      }
      else {
        logger.logMessage(CoInformLogger.logTypes.error, `Register unknown (${resStatus}) response`);
        showMessage("err", browserAPI.i18n.getMessage("register_error"), 2000);
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
    showMessage("err", browserAPI.i18n.getMessage("logout_error"), 2000);
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
        showMessage("err", browserAPI.i18n.getMessage("logout_problem"), 2000);
        targetButton.disabled = false;
      }
      else if (resStatus.localeCompare('200') === 0) {
        // The logout response parse and cookies is managed through the background script
        logger.logMessage(CoInformLogger.logTypes.info, "Logout successful");
        // Other logout actuations are managed through the userLogout message listener
        showMessage("ok", browserAPI.i18n.getMessage("logout_ok"), 1000);
        setTimeout(function() {
          displayLogin();
          targetButton.disabled = false;
        }, 1000);

      }
      else {
        logger.logMessage(CoInformLogger.logTypes.error, `Logout unknown (${resStatus}) response`);
        showMessage("err", browserAPI.i18n.getMessage("logout_error"), 2000);
        targetButton.disabled = false;
      }

    });

  }

};

// Action on nudging startegy checkboxes change
const optionsNudgingChangeAction = (targetCheckbox) => {

  if (targetCheckbox.classList.contains("nudging-options-all")) {
    if (targetCheckbox.checked) {
      document.querySelectorAll("input.nudging-options-elem").forEach(el => el.checked = "true");
    }
    else {
      document.querySelectorAll("input.nudging-options-elem").forEach(el => el.checked = null);
    }
  }
  else {
    if (targetCheckbox.checked) {
      document.querySelector('input.nudging-options-all').checked = "true";
    }
    else {
      let areAllFalse = true;
      document.querySelectorAll('input.nudging-options-elem').forEach(function(elem) {
        if (elem.checked) {
          areAllFalse = false;
        }
      });
      if (areAllFalse) {
        document.querySelector('input.nudging-options-all').checked = null;
      }
    }
  }

}

// Parse Options form, and do the appropriate actions
const optionsSaveAction = (targetButton) => {
  
  if (targetButton.disabled) {
    return false;
  }
    
  targetButton.disabled = true;

  let optionsObj = {
    testMode: "false",
    config: {}
  };

  let auxInput = document.querySelector('input[name="options-test-mode"]:checked');
  optionsObj.testMode = (auxInput && auxInput.value) ? auxInput.value : "false";

  auxInput = document.querySelector('input[name="options-research-participation"]:checked');
  optionsObj.participation = (auxInput && auxInput.value) ? auxInput.value : "false";

  auxInput = document.querySelector('input[name="options-followup-communications"]:checked');
  optionsObj.followup = (auxInput && auxInput.value) ? auxInput.value : "false";

  auxInput = document.querySelector('input[name="options-nudging-blur"]:checked');
  optionsObj.config.blur = (auxInput && auxInput.value) ? auxInput.value : "false";

  auxInput = document.querySelector('input[name="options-nudging-await"]:checked');
  optionsObj.config.await = (auxInput && auxInput.value) ? auxInput.value : "false";

  if (optionsObj.testMode.localeCompare('true') === 0) {
    logger.setLogLevel(CoInformLogger.logTypes['all']);
  }
  else {
    logger.resetLogLevel();
  }

  browserAPI.runtime.sendMessage({
    messageId: "OptionsChange",
    options: optionsObj,
    userToken: coinformUserToken
  }, function (res) {

    logger.logMessage(CoInformLogger.logTypes.info, "Options saved");
    showMessage("ok", browserAPI.i18n.getMessage("options_save_ok"), 2000);
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
    showMessage("err", browserAPI.i18n.getMessage("change_password_error"), 2000);
  }
  else {

    const userPass = document.querySelector('input[name="account-userpass"]').value || null;
    const userNewPass = document.querySelector('input[name="account-usernewpass"]').value || null;
    const userNewPass2 = document.querySelector('input[name="account-usernewpass2"]').value || null;

    if (!userPass || !userNewPass  || !userNewPass2 || (userNewPass !== userNewPass2) || !validatePass(userPass) || !validatePass(userNewPass)) {
      showMessage("err", browserAPI.i18n.getMessage("password_not_valid_info"), 4000);
    }
    else {
      
      targetButton.disabled = true;

      browserAPI.runtime.sendMessage({
        messageId: "ChangePass",
        userPass: userPass,
        userNewPass: userNewPass,
        userToken: coinformUserToken
      }, function (res) {

        let resStatus = JSON.stringify(res.status).replace(/['"]+/g, '');
        // Discard requests with 400 http return codes
        if ((resStatus.localeCompare('401') === 0) || (resStatus.localeCompare('403') === 0)) {
          logger.logMessage(CoInformLogger.logTypes.warning, `ChangePass ${resStatus} response`);
          showMessage("err", browserAPI.i18n.getMessage("change_password_problem"), 2000);
          targetButton.disabled = false;
        }
        else if (resStatus.localeCompare('200') === 0) {
          let data = res.data;
          logger.logMessage(CoInformLogger.logTypes.info, "ChangePass successful");
          showMessage("ok", browserAPI.i18n.getMessage("change_password_ok"), 2000);
          setTimeout(function() {
            displayLogout();
            targetButton.disabled = false;
          }, 1000);
        }
        else {
          logger.logMessage(CoInformLogger.logTypes.error, `ChangePass unknown (${resStatus}) response`);
          showMessage("err", browserAPI.i18n.getMessage("change_password_error"), 2000);
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
    showMessage("err", browserAPI.i18n.getMessage("provide_mail"), 2000);
  }
  else if (!validateEmail(userMail)) {
    showMessage("err", browserAPI.i18n.getMessage("mail_not_valid"), 2000);
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
        showMessage("err", browserAPI.i18n.getMessage("forgot_password_problem"), 2000);
      }
      else if (resStatus.localeCompare('200') === 0) {
        let data = res.data;
        logger.logMessage(CoInformLogger.logTypes.info, "ForgotPass successful");
        showMessage("ok", browserAPI.i18n.getMessage("forgot_password_ok"));
      }
      else {
        logger.logMessage(CoInformLogger.logTypes.error, `ForgotPass unknown (${resStatus}) response`);
        showMessage("err", browserAPI.i18n.getMessage("forgot_password_error"), 2000);
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
 * @param {*} message text of the message
 * @param {*} time optional time for the message, after which it will be automaticly removed
 */
const showMessage = (type, message, time) => {
  let msgDiv = document.getElementById('popup-messages');
  let span = document.createElement("SPAN");
  span.classList.add("popup-message");
  span.classList.add(type);
  span.append(document.createTextNode(message));
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

  const userOpts = configuration.coinform.options;

  if (coinformUserToken && userOpts && (userOpts.participation == "true")) {

    const logTime = new Date().toISOString();

    const logData = {
      logTime: logTime,
      logCategory: category,
      relatedItemUrl: itemUrl,
      relatedItemData: itemData,
      logAction: message
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
  
}

function validateEmail(email) {
  let re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(email);
}

function validatePass(pass) {
  let re = /^.{6,}$/;
  return re.test(pass);
}
