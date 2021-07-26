# Co-Inform Browser Extension
Here you can find the source code for the browser plugin extension of Co-Inform.

As of right now this extension is compatible with Google Chrome, Mozilla Firefox and Opera. It has not been tested in other browsers yet.

## Project Structure
The `src` folder is divided in two:

- `js/`: this is where the JavaScript code of the extension resides.
- `plugin/`: this is where the metadata, configuration and resources of the extension are.
    - `manifest.json`: this is the file the browsers use to know the details about the plugin, i.e, name, description, author, icons, etc. More information [here](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json).
    - `config.json`: configuration for the behaviour of the plugin. This file, for example, specifies the URL of the API used.
    - `resources/`: in this folder you can find some common icons and CSS styles used by the extension.
    - `_locales/`: in this folder you can find the messages of the plugin in different languages.
    - `content/`: in this folder you can find the pages script needed styles or html.
    - `options/`: in this folder you can find the options page script needed styles or html.
    - `popup/`: in this folder you can find the popup window script needed styles or html.

Also, inside `spec` you may find the test files. The tests have not been fully maintained.

## How Does It Work?
- `coinform-constants.js`: it contais some generic Constants used through the code.
- `background-script.js`: it contains the browser background script code. It loads the plugin configuration, and listen for messages from the pages scripts, perform comunications with the API, and answer the result back to the pages scripts.
- `browser-plugin.js`: it contains the plugin script code executed on the pages. It asks the configuration to the background script and starts parsing the social network websites.
- `popup.js`: it contains the plugin popup window script code, executed when clicked on the browser plugin logo. It implements the user registration, the user login, and the user plugin settings.
- `coinform-client.js`: it is a Client Class that provides functions for interacting with the API.
- `coinform-logger.js`: it is a Logger class that provides functions to log messages to the console. It let us manage the console messages we wish to see (info, warning, error, all or silent)
- `tweet-parser.js` and `facebook-parser.js`: these read Twitter and Facebook post elements respectively, calling a specified callback for any new publication that has been detected in the feed. It has yet only been fully implemented and tested for the Twitter posts case.
- `change-observer.js`: a wrapper for [`MutationObserver`](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver) for easier use. Given a DOM object and a callback, it will execute/call the callback everytime the DOM object is modified. In the case of Twitter, it will only do so when a subelement is added.
- `publication.js`: was intended to be the generic object that represents a publication found in a social network, e.g, a Tweet or a Facebook post. Actually it is not used.
  
## How to Build
After cloning this repository and executing `npm install`, execute the following command to build it:

```npm run build```

This will create a folder `build` with some subfolders and scripts inside. This files are the result of `browserify`ing the different scripts inside the `src/js` folder.
- `content/`: with the `coinform.js` script, and the `coinform.css` styles file.
- `background/`: with the `background-coinform.js` script.
- `popup/`: with the `popup.js` script, the `popup.html` HTML structure file, and the `popup.css` styles file.
- `options/`: with the `options.js` script, the `options.html` HTML structure file, and the `options.css` styles file.

This will also copy the necessary resources, and lenguages messages files, and place them inside `build`:
- `resources/`: with some common styles and images.
- `_locales/`: with the plugin different languages translated messages.

You may also execute `npm run test` to test the project. The tests have not been fully maintained and might not work.

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

### Opera:
1. Unzip the plugin ZIP file in some folder in your computer
2. Open Opera, and go to the `Extensions` page. To reach that page the user has 2 different options:
    - Type the url [`opera://extensions/`](chrome://extensions/)
    - Go to the browser top left corner chrome logo menu, and choose the submenu: `Extensions > Extensions`
3. Activate the `Developer mode` checkbox on the "Extensions" page top right corner
4. Click on top page `Load unpacked` button
5. Navigate to the folder where you unzipped the plugin release
6. Click the `Select Folder` button (without selecting any file)
7. At this point the plugin should be already installed and you should see it listed in the `Extensions` page
