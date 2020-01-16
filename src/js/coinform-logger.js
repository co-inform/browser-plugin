

module.exports = CoInformLogger;

function CoInformLogger(logSet = 'S') {

  this.logLevel = logSet;
  this.logTypes = {
    silent: 'S',
    info: 'I',
    warning: 'W',
    error: 'E',
    all: 'A'
  };
  
}

CoInformLogger.prototype = {

  setLogLevel: function (logSet) {
    this.logLevel = logSet;
  },
  logConsoleDebug: function (logType, message, nodeId) {

    if ((logType === this.logLevel) || (this.logLevel === this.logTypes.all)) {
      if (nodeId) {
        console.log(`${nodeId} [${logType}]: ${message}`);
      }
      else {
        console.log(`[${logType}]: ${message}`);
      }
    }
    
  },

}

function logConsoleDebug(logType, message, nodeId) {

  if ((logType === this.logLevel) || (this.logLevel === this.logTypes.all)) {
    if (nodeId) {
      console.log(`${nodeId} [${logType}]: ${message}`);
    }
    else {
      console.log(`[${logType}]: ${message}`);
    }
  }

}
