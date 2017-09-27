'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ConcreteDocument = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _lineage_operation = require('./lineage_operation');

var _lineage_operation2 = _interopRequireDefault(_lineage_operation);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ConcreteDocument = exports.ConcreteDocument = function () {
  function ConcreteDocument() {
    _classCallCheck(this, ConcreteDocument);
  }

  _createClass(ConcreteDocument, [{
    key: 'apply',
    value: function apply(op) {}
  }, {
    key: 'length',
    get: function get() {
      return 0;
    }
  }]);

  return ConcreteDocument;
}();

/*
 * Possible States:
 *  1. Waiting for ack
 */
var Client = function () {
  function Client(initialState) {
    _classCallCheck(this, Client);

    this.state = initialState;
  }

  _createClass(Client, [{
    key: 'applyClient',
    value: function applyClient(op) {
      this.state = this.state.applyClient(op);
    }
  }, {
    key: 'applyServer',
    value: function applyServer(op) {
      this.state = this.state.applyClient(op);
    }
  }]);

  return Client;
}();

exports.default = Client;