
module.exports = ChangeObserver;

function ChangeObserver(domObject, onMutationCallback) {

  this.observer = newMutationObserver(onMutationCallback);
  this.domObject = domObject;
  this.observerConfig = {
    childList: true
  }
  
}

ChangeObserver.prototype = {

  listenSubtree: function (b) {
    this.observerConfig.subtree = b
  },

  listenChildList: function (b) {
    this.observerConfig.childList = b
  },

  setAttributeFilter: function (list) {
    this.observerConfig.attributeFilter = list;
  },

  observe: function () {
    this.observer.observe(this.domObject, this.observerConfig)
  }

};

function newMutationObserver(onMutationCallback) {
  return new MutationObserver(mutations => {
    for (const mutation of mutations) {
      const newNodes = mutation.addedNodes;
      if (newNodes !== null) {
        for (const newNode of newNodes) {
          onMutationCallback(newNode);
        }
      }
    }
  });
}
