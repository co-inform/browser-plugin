# Workflow browser-plugin.js


## Initialization:

- Parse the config.json file configuration
- Set a Timer of 1 sec to start the initialization ( method `start()` )
- Configure the listeners for messages sent by the background script about the logging in / out / token renew

### Method: start()
Initialize objects, APIs, variables and listeners
- Check if we have account session cookies, through background script messages
- Initialize listeners for twitter changes (and, in the future, facebook)
  - Listener when the button Publish New Tweet is clicked: `publishTweetCallback()`
  - Lisnener when the button Retweet Tweet is clicked: `retweetTweetCallback()`
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
- Parse the endpoint response URL credibility label ( method `publishTweetCheckLabel()` )

### Method: publishTweetCheckLabel()
Check if the label is configured as missinformation ("blur")

### Method:  publishTweetAlertMisinfo()
Show an alert popup that the content is missinformation


## Listener for Retweet Tweet Button Clicked:

### Method: retweetTweetCallback()
When the button Retweet is pressed, it checks if the tweet is tagged to be missinformation, and informs it to the user
- Check if the retweet has been already analyzed
- Stop event propagation, to postpone the retweeting
- Check if the tweet has a coinform label


## Listener for when a tweet is parsed:

### Method: newTweetCallback()
When the TweetParser has detected and parsed a new Tweet DOM object, it attach some CoInform buttons to the tweet DOM, and checks if the tweet must be tagged as missinformation
- Check if the tweet has been already analyzed
- Check if the tweet has the Coinform Logo
  - Create the tweet Coinform Logo ( method `createClickableLogo()` )
  - Attach the listener to the logo click ( method `logoClickAction()` )
- Check if the tweet was already tagged before through the variable `plugginCache`
  - Classify the tweet with the previous alrerady tagged label ( method `classifyTweet()` )
- Call the "/twitter/tweet" API GW endpoint, through the CoinformClient API
- Parse the endpoint response Tweet credibility label ( method `parseApiResponse()` )

### Method: parseApiResponse()
Parses the response from the API GW and checks if the tweet has been tagged and actuates on it
- Check if the status of the response is "done" / "partly_done"
- Classify the tweet with the response credibility label ( method `classifyTweet()` )
- If the status of the response is "done", save the tweet as already tagged into the variable `plugginCache`
- If the status of the response is not "done", set a Timer of random (0.5-2.5) sec to retry to parse the tweet label ( method `retryTweetQuery()` )

### Method: retryTweetQuery()
Checks again if the tweet has been already tagged in the API GW
- Check if the tweet has already been retried for a maximum of 10 times
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
- Show the popup with info and buttons referred to the label
  - If the tweet was blurrable and the unblur / blur button is pressed, do it ( methods `removeTweetBlurry()` and `createTweetBlurry()` )

### Method: logoClickAction()
Opens a diferent popup depending on the situation of the tweet and user
- Check if the tweet is blurred and if the user is logged
- Open the appropiate popup depending on the blurred and logged situation
  - If the tweet is blurred open the label popup ( method `openLabelPopup()` )
  - If the user is logged open the claim popup ( method `openClaimPopup()` )
  - If the user is not logged open the not logged popup ( method `openNotLoggedClaimPopup()` )

### Method: openClaimPopup()
Opens a popup to allow the user to send a claim about the tweet accuracy label
- Get the accuracy options from the configuration objects
- If the tweet has been tagged with credibility label, adapt the popup texts
- Show the popup with info about the label situation and a form to send a claim with the accuracy options
- If the send claim button is pressed execute the Promise to parse and send the claim
  - Parse the form inputs
  - Call the "/twitter/evaluate" API GW endpoint, through the CoinformClient API
  - Parse the endpoint response Evaluation result

### Method: openNotLoggedClaimPopup()
Opens a popup to inform the user that he must log in to send a claim
- Check if the tweet has been tagged with credibility label, and adapt the popup texts
- Show the popup with info about the label situation and the info that to send a claim the user must be logged
