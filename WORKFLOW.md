# Workflow browser-plugin.js


## Initialization:

1. Get config.json file configuration
2. Set a Timer of 1sec to start the initialization ( method `start()` )
3. Configure the listeners for messages sent by the background script about the logging in / out / token renew

### Method: start()
4. Initialize objects and variables
5. Check if we have account session cookies, through background script messages
6. Initialize listeners for twitter / facebook


## Listener for Publish Tweet Button Clicked:

### Method: publishTweetCallback()
1. Check if the publish content has been already analyzed
2. Stop event propagation, to postpone the publishing
3. Get the publish content
4. Check if the content contains URLs
5. Change the button interface with a coinform message
6. For each URL call the "check-url" API GW endpoint, through the background script messages
7. Parse the endpoint response URL credibility label ( method `publishTweetCheckLabel()` )

### Method: publishTweetCheckLabel()
8. Check if the label is configured as missinformation ("blur")

### Method:  publishTweetAlertMisinfo()
9. Show an alert popup that the content is missinformation


## Listener for Retweet Tweet Button Clicked:

### Method: retweetTweetCallback()
1. Check if the retweet has been already analyzed
2. Stop event propagation, to postpone the retweeting
3. Check if the tweet has a coinform label


## Listener for when a new tweet DOM is parsed:

### Method: newTweetCallback()
1. Check if the tweet has been already analyzed
2. Check if the tweet has the Coinform Logo
2.1. Create the tweet Coinform Logo ( method `createClickableLogo()` )
2.2. Attach the listener to the logo click ( method `logoClickAction()` )
3. Check if the tweet was already tagged before through the variable `plugginCache`
3.1. Classify the tweet with the previous alrerady tagged label ( method `classifyTweet()` )
4. Call the "/twitter/tweet" API GW endpoint, through the CoinformClient API
5. Parse the endpoint response Tweet credibility label ( method `parseApiResponse()` )

### Method: parseApiResponse()
6. Check if the status of the response is "done" / "partly_done"
7. Classify the tweet with the response credibility label ( method `classifyTweet()` )
8. If the status of the response is "done", save the tweet as already tagged into the variable `plugginCache`
9. If the status of the response is not "done", set a Timer of random 0.5-2.5sec to retry to parse the tweet label ( method `retryTweetQuery()` )

### Method: retryTweetQuery()
10. Check if the tweet has already been retried for a maximum of 10 times
11. Call the "/response/{query_id}" API GW endpoint, through the background script messages 
12. Parse the endpoint response Tweet credibility label ( method `parseApiResponse()` )

### Method: classifyTweet()
13. Check if the tweet DOM has already a tagged label, and if it is different from the new one
14. If the tweet DOM had a different label, remove the previous label ( method `removeTweetLabel()` )
15. If the tweet was blurred, remove the blurry ( method `removeTweetBlurry()` )
17. Set the new tweet label ( method `createTweetLabel()` )
17.1. Attach the listener to the click of the tweet label ( method `openLabelPopup()` )
16. Check if the new label is configured as missinformation ("blur"), and do the blurry ( method `createTweetBlurry()` )

### Method: createTweetBlurry()
17. Add the attribute to the tweet that makes it blurred (by css)
18. Create a why can not see button ( method `createCannotSeeTweetButton()` )
18.1. Attach the listener to the click of the button ( method `openLabelPopup()` )

### Method: openLabelPopup()
19. Check if the tweet is blurred
20. Check if the tweet label is blurrable
21. Configure the texts and buttons according to the blurrable / blurred situation
22. Show the popup with info and buttons referred to the label
22.1. If the tweet was blurrable and the unblur / blur button is pressed, do it ( methods `removeTweetBlurry()` and `createTweetBlurry()` )

### Method: logoClickAction()
23. Check if the tweet is blurred and if the user is logged
24. Open the appropiate popup depending on the blurred and logged situation
24.1. If the tweet is blurred open the label popup ( method `openLabelPopup()` )
24.2. If the user is logged open the claim popup ( method `openClaimPopup()` )
25.3. If the user is not logged open the not logged popup ( method `openNotLoggedClaimPopup()` )

### Method: openClaimPopup()
26. Get the accuracy options from the configuration objects
27. If the tweet has been tagged with credibility label, adapt the popup texts
28. Show the popup with info about the label situation and a form to send a claim with the accuracy options
29. If the send claim button is pressed execute the Promise to parse and send the claim
29.1. Parse the form inputs
29.2. Call the "/twitter/evaluate" API GW endpoint, through the CoinformClient API
29.3. Parse the endpoint response Evaluation result

### Method: openNotLoggedClaimPopup()
30. Check if the tweet has been tagged with credibility label, and adapt the popup texts
31. Show the popup with info about the label situation and the info that to send a claim the user must be logged
