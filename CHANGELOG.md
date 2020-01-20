
# Changelog

## commit 17/01/2020

src/js/coinform-logger.js
- log module calling minor changes

src/js/browser-plugin.js
- detected and fixed bug when a tweet does not contain any ID to parse. Normaly the case of a promoted tweet or an advertisment tweet

src/js/tweet-parser.js
- detected and fixed bug when a tweet does not contain any ID to parse. Normaly the case of a promoted tweet or an advertisment tweet


## commit 16/01/2020

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

## commit 02/01/2020

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



