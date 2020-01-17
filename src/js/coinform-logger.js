module.exports = CoInformLogger;

const logTypes = {
  silent: 0,
  error: 1,
  warning: 2,
  info: 3,
  all: 4
};
module.exports.logTypes = logTypes;

const logLabels = ['', 'Err', 'Warn', 'Info', 'All'];

function CoInformLogger(logSet = logTypes.error) {
  this.logLevel = logSet;
}

CoInformLogger.prototype = {

  setLogLevel: function (logSet) {
    this.logLevel = logSet;
  },
  logConsoleDebug: function (logType, message, nodeId) {

    if (logType <= this.logLevel) {
      if (nodeId) {
        console.log(`${nodeId} [${logLabels[logType]}]: ${message}`);
      }
      else {
        console.log(`[${logLabels[logType]}]: ${message}`);
      }
    }
    
  }

};
