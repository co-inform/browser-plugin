# Workflow browser-plugin.js


## Initialization:

- Get the config.json file configuration through the background script
- Get the user account session information through the background script
- Set a Timer of 2 sec to start the initialization ( method `start()` )
- Configure the listeners for messages sent by the background script related to the logging in / out, the token renew, or the configurations change events

### Method: start()
Initialize objects, APIs, variables and listeners
- Initialize listeners for twitter changes (facebook page listeners disabled)
  - Listener when the button Publish New Tweet is clicked: `publishTweetCallback()`
  - Lisnener when the button Retweet Tweet is clicked: `retweetTweetCallback()`
  - Lisnener when the button Like Tweet is clicked: `likeTweetCallback()`
  - Lisnener when the button UnLike Tweet is clicked: `unlikeTweetCallback()`
  - Lisnener when the TweetParser detect a tew tweet DOM and parses it: `newTweetCallback()`


## Listener for Publish Tweet Button Clicked:

### Method: publishTweetCallback()
When the button Publish New Tweet is pressed, it parses the content for if there is some URL and checks if the URL is detected to be missinformation, and informs it to the user
- Check if the publish content has been already analyzed
- Stop event propagation, to postpone the publishing
- Get the publish content
- Check if the content contains URLs
- Change the button interface with a coinform message
- For each URL call the "check-url" API GW endpoint, through the background script messages
- Parse the endpoint response URL credibility label ( method `checkLabelMisinfo()` )
- If some URL is misinformation open alert popup ( method `publishTweetAlertMisinfo()`)
- Actuate due to the endpoint response ( method `publishTweetPostAction()` )

### Method: checkLabelMisinfo()
Check if the label is configured as missinformation ("blur")

### Method:  publishTweetAlertMisinfo()
Show an alert popup that the content may contain missinformation. If available show link to assessment articles.

### Method: publishTweetPostAction()
Check if missinformation was detected and attach messages to the Publish window


## Listener for Retweet Tweet Button Clicked:

### Method: retweetTweetCallback()
When the Retweet button is pressed, it checks if the tweet is tagged to be missinformation, and informs it to the user
- Check if the retweet has been already analyzed
- Stop event propagation, to postpone the retweeting
- Check if the tweet has a coinform label

### Method: retweetTweetAlertMisinfo()
Show an alert popup that the tweet may contain missinformation


## Listeners for Like and Unlike Tweet Buttons Clicked:

### Method: likeTweetCallback()
When the Like button is pressed, it checks if the user has activated the anonymous data research participation to send a log to the server

### Method: unlikeTweetCallback()
When the UnLike button is pressed, it checks if the user has activated the anonymous data research participation to send a log to the server 


## Listener for when a tweet is parsed:

### Method: newTweetCallback()
When the TweetParser has detected and parsed a new Tweet DOM object, it attach the CoInform toolbar to the tweet DOM, and checks if the tweet must be tagged as missinformation
- Check if the tweet has been already analyzed
- Check if the tweet has the Coinform Toolbar
  - Create the tweet Coinform Toolbar ( method `createToolbar()` )
- Check if the tweet was already tagged before through the variable `pluginCache`
  - Classify the tweet with the previous alrerady tagged label ( method `classifyTweet()` )
- Call the "/twitter/tweet" API GW endpoint, through the Background script CoinformClient API
- Parse the endpoint response Tweet credibility label ( method `parseApiResponse()` )

### Method: createToolbar()
Create the Coinform Toolbar DOM object with the plugin buttons and attach it to the Tweet
- Add the Coinform logo ( method `createLogoCoinform()` )
- Add the Analysis status icon, and the Tweet pointing arrow icon
- Add the Claim button and action ( method `createLogoClaim()` )
  - Attach the listener to the click of the Claim button ( method `claimClickAction()` )
- Add the Disagree button and action ( method `createLogoNegativeFeedback()` )
  - Attach the listener to the click of the Disagree button ( method `feedbackClickAction()` )
- Add the Agree button and action ( method `createLogoPositiveFeedback()` )
  - Attach the listener to the click of the Agree button ( method `feedbackClickAction()` )

### Method: parseApiResponse()
Parses the response from the API GW and checks if the tweet has been tagged and actuates on it
- Check if the status of the response is "done" / "partly_done"
- Classify the tweet with the response credibility label ( method `classifyTweet()` )
- If the status of the response is "done", save the tweet as already tagged into the variable `plugginCache`, and finalize the labeling process ( method `finalizeTweetClassify()` ) 
- If the status of the response is not "done", set a Timer of random time (1 - 2.5 sec) to retry to parse the tweet label ( method `retryTweetQuery()` )

### Method: retryTweetQuery()
Checks again if the tweet has been already tagged in the API GW
- Check if the tweet has already been retried for a maximum of times (12)
  - If the limit is reached, finalize the labeling process ( method `finalizeTweetClassify()` ) 
- Call the "/response/{query_id}" API GW endpoint, through the background script messages 
- Parse the endpoint response Tweet credibility label ( method `parseApiResponse()` )

### Method: classifyTweet()
Sets the credibility label to the tweet, and if it's the case, blurs it
- Check if the tweet DOM has already a tagged label, and if it is different from the new one
- If the tweet DOM had a different label, remove the previous label ( method `removeTweetLabel()` )
- If the tweet was blurred, remove the blurry ( method `removeTweetBlurry()` )
- Set the new tweet label ( method `createTweetLabel()` )
  - Attach the listener to the click of the tweet label ( method `openLabelPopup()` )
- Check if the new label is configured as missinformation ("blur"), and do the blurry ( method `createTweetBlurry()` )

### Method: createTweetLabel()
Add or update the Coinform label, and attach the analysis info tooltip
- Add listener on mouseenter to open the label info tooltip ( method `openLabelInfoTooltip()` )
- Add listener on mouseleave to close the label info tooltip ( method `closeLabelInfoTooltip()` )


### Method: createTweetBlurry()
Blurs a tweet
- Add the attribute to the tweet that makes it blurred (by css)
- Create a why can not see button ( method `createCannotSeeTweetButton()` )
  - Attach the listener to the click of the button ( method `openLabelPopup()` )

### Method: openLabelPopup()
Open a popup with info about the tagged label
- Check if the tweet is blurred
- Check if the tweet label is blurrable
- Configure the texts and buttons according to the blurrable / blurred situation
- Create the explainability content due to the modules metadata ( method `createLabelModulesExplainabilityContent()` )
- Show the popup with explainability info and buttons
  - If the tweet was blurrable and the unblur / blur button is pressed, do it ( methods `removeTweetBlurry()` and `createTweetBlurry()` )

### Method: createLabelModulesExplainabilityContent()
Parse the modules object, iterate through each module metadata, and create the DOM objects with the HTML to show the explainability content


### Method: feedbackClickAction()
Opens a diferent popup depending on the situation of the tweet and user
- Check if the tweet is labeled and if the user is logged
- Open the appropiate popup depending on the labeled and logged situation
  - If the tweet is not labeled open the tweet not labeled popup ( method `openNotTaggedFeedbackPopup()` )
  - If the user is not logged open the not logged popup ( method `openNotLoggedFeedbackPopup()` )
  - If the user is logged and the tweet labeled send the feedback ( method `sendLabelEvaluation()` )

### Method: sendLabelEvaluation()
Send the label feedback, through the background script CoinformClient API
- If the response is successful
  - Update the user Feedback status ( method `updateLabelEvaluation()` )
  - Update the label Feedback aggregated status ( method `updateLabelEvaluationAgg()` )


### Method: claimClickAction()
Opens a diferent popup depending on the situation of the user
- Check if the user is logged
- Open the appropiate popup depending on the logged situation
  - If the user is not logged open the not logged popup ( method `openNotLoggedClaimPopup()` )
  - If the user is logged open the claim popup ( method `openClaimPopup()` )

### Method: openClaimPopup()
Opens a popup to allow the user to send a claim about the tweet accuracy label
- Get the accuracy options from the configuration object
- If the tweet has been tagged with credibility label, adapt the popup texts
- Show the popup with info about the label situation and a form to send a claim with the accuracy options
- If the send claim button is pressed parse the form and send the claim
  - Parse the form inputs
  - Call the "/twitter/evaluate" API GW endpoint, through the background script CoinformClient API
  - Parse the endpoint response Evaluation result

### Method: openNotLoggedClaimPopup()
Opens a popup to inform the user that he must log in to send a claim
- Check if the tweet has been tagged with credibility label, and adapt the popup texts
- Show the popup with info about the label situation and the info that to send a claim the user must be logged
