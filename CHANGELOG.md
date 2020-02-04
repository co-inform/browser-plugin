
# Changelog
All notable changes to this project will be documented in this file.

## commit 04/02/2020 [branch: hackathon_stockholm]

src/js/background-script.js
- added code to maintain the user logged or not logged status in the background script

src/js/browser-plugin.js
- changed the variable name where we store the user logged token
- added listener to detect and maintain when a user has been logged in or out (when the local variable is changed)
- fixed some bugs when parsing the tweet query responses accuracy label
- implemented the new classifying tweet way to decide what action to take from the configuration object (for the moment just blur and label)
- update the claim labels to the appropriate ones from the configuration object
- add inputs verification code to the claim raising popup (url and comment)
- fixed some bug when sending a claim
- added the success and error popup when sending a claim

src/js/popup.js
- changed the name of the local stored variable used for the logged user token, from userId to userToken
- new functions showMessage and clearMessage, to raise and remove timeout messages on the login and register popup
- added demo code to simulate the user logging in and registering, by using the password "1234"

src/js/tweet-parser.js
- fixing bugs related to twitter changes to its html structure
- changed the way of storing the selector variables, by using objects and properties with the different user or page cases (user logged/not-logged, home/user/tweet page)
- new function querySelectorContains, to get some node elements that fit a selector and at the same time contain some text (by regular expression)
- changed the way of getting the tweet Id by reaching the link "time" node, and from there climbing back to the parent link to get the Id
- changed the way of getting the tweet user Id by getting the user screen name "span" node and removing the "@" from the content text
- removed the special codes to parse tweet info when the user is not logged, as now it seems that the html structure is the same as when the user is logged
- fixed bug that was not parsing the main tweet in the case of a tweet responses page
- merged the 2 cases of user logged and not logged when new nodes are added (detected by the changeObserver)
- replaced the try.. catch.. block with an if statement to avoid the treating of strange basic nodes like "text" node (which do not have the method querySelector)

src/plugin/_locales/en/messages.json
- new language messages for the claim accurracy labels
- new language messages for the claim popup UI

src/plugin/content/coinform.css
- cursor pointer for the coinform logo

src/plugin/popup/popup.html
src/plugin/popup/popup.css
- basic styles for the login and register popup success and error messages

src/plugin/resources/config.json
- changed the way of configuring the misinformation category actions by using the labels "blur" and "label", for blurring the post and for just labeling it, respectively
- added the accuracy labels to the configuration file, for the raising of a claim


## commit 23/01/2020 [branch: hackathon_stockholm]

src/plugin/manifest.json
- version 2.0.0
- new folder structure with the distinct scripts
- fixed the Content Security Policy
- changed from "page action" to "browser action" plugin mode
- specified the popup page and script for user logging in / registering
- added new logo images

package.json
- fixed the main script reference
- changed the build action so it distributes the scripts within the new folder structure

src/plugin/resources/config.json
- new configuration property to define the log level
- updated the misinformation categories/labels with the ones specified in the API gateway

src/plugin/_locales/en/messages.json
- new text messages for the new categories/labels
- new text messages for the new popup page for user logging in / registering

src/plugin/content/
- new folder structure. Folder for the content script and css

src/plugin/options/
- new folder structure. Folder for the options page script and css
- html and css file with the structure and styles for the options page

src/plugin/popup/
- new folder structure. Folder for the popup page script and css for user logging in / registering
- new html and css file with the structure and styles for the popup page

src/plugin/resources/
- new image with the coinform logo for popups footer

src/js/background-script.js
- adapted the code to the new workflow where a tweet must be classified if we get a "partly_done" response, but we have to keep querying the API to try to get the "done" response and, if necessary, reclassify it
- removed the event listener por page load because it was not always raised, now it is set in the manifest to load the script after the page is loaded
- new variable to store the coinform user if it is logged in
- new constants to centralize some plugin images and colors setted during the script execution
- new reference name to acces the browser API, to be able in the developing to test the both methods from the chrome vs browser APIs (chrome vs firefox)
- new function parseApiResponse to centralize the parse of the both responses from the API queries about a tweet information
- commented the not used facebook functions
- refactor the classifyTweet function to check if the tweet was already classified before, so to remove the blurring and buttons or not
- new individual functions to blur the tweet, to create the why button, to undo the tweet blurring, to remove the tweet button, to create the tweet labeling, to remove the twwet labeling, etc..
- new common function for the logo click action that will call the apropiate popup depending if the user is a coinform user logged in or not
- new function that opens a information popup when the user is not a coinform user logged in

src/js/browser-plugin.js
- now it reads the config.json for setting the api gateway url and the log level
- fixed some configuration bugs and workflow

src/js/coinform-client.js
- new client methods for comunication with the API gateway to perform the user logging in and registering

src/js/coinform-logger.js
- new log type debug for more detailed messages than info

src/js/options.js
- script for the plugins options page adapted to new situations

src/js/popup.js
- new script for the plugin popup page to let the user log in or register to the coinform API, beta verison still not tested as the API gateway is still not ready


## commit 17/01/2020 [branch: post_madrid_implementations]

src/js/coinform-logger.js
- log module calling minor changes

src/js/browser-plugin.js
- detected and fixed bug when a tweet does not contain any ID to parse. Normaly the case of a promoted tweet or an advertisment tweet

src/js/tweet-parser.js
- detected and fixed bug when a tweet does not contain any ID to parse. Normaly the case of a promoted tweet or an advertisment tweet


## commit 16/01/2020 [branch: post_madrid_implementations]

package.json
- changed the build task so it will browserify the background-script.js in a separate script

src/plugin/manifest.json
- added the background script configurations
- added a default language "en"
- added the page_action configuration
- deleted the Content Security Policy to let the connections to the aPI work from the background script
- added a new css resource for bootstrap
- migrated the language messages to the i18n module
- added the permission to the API gateway url
- added the tabs and webNavigation permissions to try to listen to URL changes

src/plugin/resources/config.json
- replaced the configuration property url to apiUrl
- replaced spaces in the categories names with underscores

src/plugin/resources/coinform.css
- fixed z-index issues by replacing the 99999 value with the lower 999 value
- added css to correctly blur the tweets when the user is not logged
- added css styles for performing the publish tweet await functionality with a loading spinner and a blinking text

src/js/change-observer.js
- added the prototype methods to set the observer configurations childList and attributeFilter
- check that the mutations have the type "childList" before checking the addedNodes

src/js/coinform-client.js
- fixed bugs with the getResponseTweet API request: headers property misspelled, mode-cors commented, and Content-Type header commented

src/js/tweet-parser.js
- added many selector constants to correctly parse the tweet metadata in many cases (user not logged, home page, user page, tweet page, ...)
- added selectors to detect if the user is logged
- added selector to locate the publish tweet buttons
- added selector to locate the section div to observe for page cases changes (homepage,userpage,tweetpage,...)
- migrate class attributes to the constructor
- created prototype initContext method to check the user and page context one page initialized
- added childList and atributeFilter configurations to the main changes observer to improve performance
- created prototype method to listen for the publish tweet button and execute the appropiate callback
- new function to check the user case (logged / not logged)
- added the user and page case considerations when parsing info from a new Tweet
- deleted the tweet returned "links" property not used anymore
- new function to treat a single tweet to be able to use it from different situations (list of tweets to check / single new tweet)
- added the user case consideration and the node case consideration to the changes observer callback, to check if just a single new tweet has been added, or if a new section is added (because the page case changed), to improve performance
- treat and act in the both cases when the whole section has changed, or just a tweet was added
- added user case consideration when updating the tweets list

src/js/browser-plugin.js
- migrated the language messages to the i18n module
- added a new module CoInformLogger to treat the console logging messages
- changed the cache object so now we mantain the information about the credibility label of the already analysed tweets
- implemented the comunications from the extension content script with the new background page script so to migrate the API gateway GET request comunications to the background script
- implemented new code to treat the publish tweet button callback so the tweet is not published for some await time
- new code to detect already analysed tweets and already treated tweets in the new tweet callback, to improve performance
- now we add the coinform logo to all the new tweets
- removed the sleep call when a tweet is not yet procesed, and replaced it with more efficient timeouts callbacks, to improve performance
- replace spaces with underscores in the credibility labels returned from the API gateway
- new retryTweetQuery function to treat recursively the case when the tweet has not been procesed and we have to keep connecting to the API to check it untill it is procesed
- implmented the retryTweetQuery through communication with the new backgorund script, to delegate there the communication with the API
- fixed bugs in the classifyTweet function if the category is not found in the configuration
- fixed bugs when the coinform logo is clicked, preventing the tweet to be opened
- adapted the texts in the claim sending window for the case when the tweet is not tagged

src/js/background-script.js
- new script to run in the browser background to manage and perform the comunications with the API gateway, to avoid browser security blocking (i.e. corb)
- just implemented one endopoint comunication (GET request), still pending to migrate all the comunications to this background script

src/js/coinform-logger.js
- new module to manage the plugin logging to the console, with log types considerations, to be able to enable and disable the logs easily

src/plugin/resources/bootstrap.min.css
- new css from bootstrap to perform some visual efects like the loading spinner

## commit 02/01/2020 [branch: post_madrid_implementations]

package.json
- fix the repository URL

src/plugin/manifest.json
src/plugin/resources/lang.en.json
- add language file

src/plugin/resources/config.json
- change way to store categories in configuration object for future extended funcionalities development

src/plugin/resources/coinform.css
- improve CSS for case when we open an individual tweet page
- improve CSS for missinformation labels

src/js/browser-plugin.js
- change way to print text and messages to make easier to support multiple languages in the future
- get the language file configuration, and fill the new messages/languages object LANG
- new function "strParse" for formating texts with variables (to achieve the multilanguage)
- new way to check if the tweet retrieved category is consideren missinformation in our configuration object
- implement new way to retrieve the category options from the configuration object when raising a claim (not hardcoded anymore)

src/js/tweet-parser.js
- new selector constants to get the tweet data when we open an individual tweet page
- new funcion "checkPageCase" for checking the case page where we are (home/user/tweet)
- reimplemnt in "getTweetInfo" function the way of retrieveing the tweet metadata depending the page case where we are (home/user/tweet page), new parameter num with the tweet iteration, for tweet page case (the first tweet is different formated)
