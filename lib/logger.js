'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var LOG_LEVEL_MAPPINGS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

var Logger = function () {
  function Logger(logLevelstr) {
    _classCallCheck(this, Logger);

    this.logLevel = LOG_LEVEL_MAPPINGS[logLevelstr];
  }

  _createClass(Logger, [{
    key: 'debug',
    value: function debug(msg) {
      if (console && console.debug && this.logLevel <= LOG_LEVEL_MAPPINGS.debug) {
        console.debug(msg);
      }
    }
  }, {
    key: 'info',
    value: function info(msg) {
      if (console && console.info && this.logLevel <= LOG_LEVEL_MAPPINGS.info) {
        console.info(msg);
      }
    }
  }, {
    key: 'warn',
    value: function warn(msg) {
      if (console && console.warn && this.logLevel <= LOG_LEVEL_MAPPINGS.warn) {
        console.warn(msg);
      }
    }
  }, {
    key: 'error',
    value: function error(msg) {
      if (console && console.error && this.logLevel <= LOG_LEVEL_MAPPINGS.error) {
        console.error(msg);
      }
    }
  }]);

  return Logger;
}();

// $FlowFixMe


exports.default = new Logger(process.env.LOG_LEVEL || 'info');