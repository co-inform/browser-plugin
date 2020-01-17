
const jQuery = require('jquery')
const Publication = require('./publication')
const ChangeObserver = require('./change-observer')

const urlFilter = /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[\-;:&=\+\$,\w]+@)?[A-Za-z0-9\.\-]+|(?:www\.|[\-;:&=\+\$,\w]+@)[A-Za-z0-9\.\-]+)((?:\/[\+~%\/\.\w\-_]*)?\??(?:[\-\+=&;%@\.\w_]*)#?(?:[\.\!\/\\\w]*))?)/

module.exports = FacebookParser

function FacebookParser() { }

FacebookParser.prototype = {

  fromBrowser: function(newPostCallback) {
    parseLoadedPosts(jQuery, newPostCallback)
  },

  listenForNewPosts: function(newPostCallback) {
    const $ = jQuery
    const postFeed = $('div[role="feed"]')[0] || null
    if (postFeed !== null) {
      const observer = new ChangeObserver(postFeed, newPost => verifyPost($, $(newPost), newPostCallback))
      observer.listenSubtree(true)
      observer.observe()
    }
  }
}

function verifyPost($, post, newPostCallback) {
  const classAttr = post.attr('class') || ''
  if (classAttr.includes('mbm')) {
    parseSinglePost($, post, newPostCallback)
  }
}

function parseLoadedPosts($, newPostCallback) {
  //const posts = $('div[id^="hyperfeed_story_id"]')
  const posts = $('div.mbm')
  
  for (let i = 0; i < posts.length; i++) {
    const post = $(posts[i])
    parseSinglePost($, post, newPostCallback)
  }
}

function parseSinglePost($, post, newPostCallback) {
  let username = post.find('span .fwb > a')[0] || null
  
  if (username !== null) {
    username = $(username).text()
    
    const links = extractLinks($, post)
    const publication = new Publication(username, links, post)

    newPostCallback(publication)
  }
}

function extractLinks($, post) {
  let textContent = post.find('div .userContent p')
  let imageLink = post.find('div .mtm')[0] || null
  const links = []

  for (let i = 0; i < textContent.length; i++) {
    const paragraph = $(textContent[i])
    const linkTags = paragraph.find('a')

    for (let j = 0; j < linkTags.length; j++) {
      const url = $(linkTags[j]).text()
      if (urlFilter.test(url)) {
        links.push(url)
      }
    }
  }

  if (imageLink !== null) {
    const linkTag = $(imageLink).find('a._52c6')[0] || null

    if (linkTag !== null) {
      const url = $(linkTag).attr('href')
      if (urlFilter.test(url)) {
        links.push(url)
      }
    }
  }

  return links
}