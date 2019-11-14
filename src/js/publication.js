/* jshint esversion: 6, devel: true */

module.exports = Publication

function Publication(username, text,  links, id, domObject) {
  this.username = username
  this.text = text
  this.links = links
  this.domObject = domObject
  this.id = id
}