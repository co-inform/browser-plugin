# Co-Inform Browser Extension
Here you can find the source code for the browser plugin extension of Co-Inform.

As of right now this extension is compatible with Mozilla Firefox and Google Chrome. It has not been tested in other browsers yet.

## Project Structure
The `src` folder is divided in two:

- `js`: this is where the JavaScript code of the extension resides.
- `plugin`: this is where the metadata, configuration and resources of the extension are.
    - `manifest.json`: this is the file the browsers use to know the details about the plugin, i.e, name, description, author, icons, etc. More information [here](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json).
    - `resources`: in this folder you can find the icons as well as the CSS the extension uses.
    - `config.json`: configuration for the behaviour of the plugin. This file, for example, specifies the URL of the API used.
    - `_locales`: in this folder you can find the messages of the plugin in different languages.

Also, inside `spec` you may find the test files.

## How Does It Work?
1. `browser-plugin.js` is the plugin page "main" script code. It reads the configuration and starts parsing the social network websites.
1. `background-script.js` is the browser background "main" script code. It listen for messages from the page script, perform comunications with the API, and answer the result back to the page script.
2. `publication.js` is the generic file that represents a publication found in a social network, e.g, a tweet or a Facebook post.
3. `change-observer.js`: a wrapper for [`MutationObserver`](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver) for easier use. Given a DOM object and a callback, it will execute/call the callback everytime the DOM object is modified. In the case of Twitter, it will only do so when a subelement is added.
4. `coinform-client.js` provides functions for interacting with the API.
5. `facebook-parser.js` and `tweet-parser.js`: these read Facebook and Twitter respectively, calling a specified callback for any new publication that has been detected in the feed.
6. `coinform-logger.js` provides functions to log messages to the console. It let us manage the console messages we wish to see (info, warning, error, all or silent)
  
## How to Build
After cloning this repository and executing `npm install`, execute the following command to build:

```npm run build```

This will create a folder `build` with 2 scripts insude: `coinform.js` and `background-coinform.js`. This files are the result of `browserify`ing the 2 "main" scripts inside the `src/js` folder. This will also copy the necessary resources and place them inside `build`.

You may also execute `npm run test` to test the project.

## How to Install from build
After having built, on your browser open the menu for adding a local extension and select the `build` folder, where the `manifest.json` file will be found and parsed, and the plugin will be installed.

## How to Install from ZIP
The distributed packed plugin is a ZIP file containing the content of the build folder.

If you want to install the plugin from the distributed packed ZIP you can follow the next steps:

### Chrome:
1. Unzip the plugin ZIP file in some folder in your computer
2. Open Chrome, and go to the `Extensions` page. To reach that page the user has 2 different options:
    - Type the url [`chrome://extensions/`](chrome://extensions/)
    - Go to the browser top right corner 3 dots options menu, and choose the submenu: `More tools > Extensions`
3. Activate the `Developer mode` checkbox on the "Extensions" page top right corner
4. Click on the sub-header menu `Load unpacked` left corner option
5. Navigate to the folder where you unzipped the plugin release
6. Click the `Select Folder` button (without selecting any file)
7. At this point the plugin should be already installed and you should see it listed in the `Extensions` page
 
### Firefox:
1. For Firefox installation there is no need to unzip the plugin ZIP file
2. Open Firefox, and go to the `Add-ons Manager` page. To reach that page, the user has this 3 different options:
    - Type the url [`about:addons`](about:addons)
    - Press keys `Ctrl + Shift + A`
    - Go to the browser top right corner 3 lines options menu, and choose the menu option `Add-ons`
3. Click on the cogwheel top page button
4. Choose the `Debug Add-ons` option
5. On the new page click on the `Load Temporary Add-on` top page button
6. Navigate to the folder where you have the plugin ZIP file and select it
7. Click the `Open` button
8. At this point the plugin should be already installed and you should see it listen in the `Debugging` and `Add-ons Manager > Extensions` pages
