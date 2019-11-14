# Co-Inform Browser Extension
Here you can find the source code for the browser extension of Co-Inform.

As of right now this extension is compatible with Mozilla Firefox and Google Chrome. It has not been tested in other browsers yet.

## Project Structure
The `src` folder is divided in two:

- `js`: this is where the JavaScript code of the extension resides.
- `plugin`: this is where the metadata, configuration and resources of the extension are.
    - `manifest.json`: this is the file the browsers use to know the details about the plugin, i.e, name, description, author, icons, etc. More information [here](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json).
    - `config.json`: configuration for the behaviour of the plugin. This file, for example, specifies the URL of the API used.
    - `resources`: in this folder you can find the icons as well as the CSS the extension uses.

Also, inside `spec` you may find the test files.

## How Does It Work?
1. `browser-plugin.js` is the "main" file. It reads the configuration and starts parsing the social network websites.
2. `publication.js` is the generic file that represents a publication found in a social network, e.g, a tweet or a Facebook post.
3. `change-observer.js`: a wrapper for [`MutationObserver`](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver) for easier use. Given a DOM object and a callback, it will execute/call the callback everytime the DOM object is modified. In the case of Twitter, it will only do so when a subelement is added.
4. `coinform-client.js` provides functions for interacting with the API.
5. `facebook-parser.js` and `tweet-parser.js`: these read Facebook and Twitter respectively, calling a specified callback for any new publication that has been detected in the feed.
  
## How to Build
After cloning this repository and executing `npm install`, execute the following command to build:

```npm run build```

This will create a folder `build` and a single `coinform.js` file inside. This file is the result of `browserify`ing everything inside the `src/js` folder. This will also copy the necessary resources and place them inside `build`.

You may also execute `npm run test` to test the project.

## How to Run
After having built, on your browser open the menu for adding a local extension and select the `build` folder, the `manifest.json` file will be found here.