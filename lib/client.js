'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.WaitingState = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _operation = require('./operation');

var _operation2 = _interopRequireDefault(_operation);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Document = function () {
  function Document() {
    _classCallCheck(this, Document);
  }

  _createClass(Document, [{
    key: 'apply',
    value: function apply(op) {}
  }, {
    key: 'length',
    get: function get() {
      return 0;
    }
  }]);

  return Document;
}();

var WaitingState = exports.WaitingState = function () {
  // @private
  function WaitingState(doc, opSender) {
    _classCallCheck(this, WaitingState);

    this.doc = doc;
    this.opSender = opSender;
  }
  // @private


  _createClass(WaitingState, [{
    key: 'applyClient',
    value: function applyClient(op) {
      /*
       * We send the operation to the server and return AwaitingAck state
       */
      this.doc.apply(op);
      this.opSender.sendOp(op);
      /* eslint-disable no-use-before-define */
      return new AwaitingAckState(this.doc, this.opSender, op);
      /* eslint-enable no-use-before-define */
    }
  }, {
    key: 'applyServer',
    value: function applyServer(op) {
      /*
       * We simply apply the operation to the doc and return WaitingState
       */
      this.doc.apply(op);
      return this;
    }
  }]);

  return WaitingState;
}();

var AwaitingAckState = function () {
  function AwaitingAckState(doc, opSender, ackOp) {
    _classCallCheck(this, AwaitingAckState);

    this.doc = doc;
    this.buffer = new _operation2.default([doc.length]);
    this.opSender = opSender;
    this.ackOp = ackOp;
  }

  _createClass(AwaitingAckState, [{
    key: 'applyClient',
    value: function applyClient(op) {
      this.buffer = this.buffer.compose(op);
      return this;
    }
  }, {
    key: 'applyServer',
    value: function applyServer(op) {
      /*
       * We check to see if the operation matches the same reference ID of the one we sent to the server.
       *
       * IF the ref ID matches,
       *   THEN transform(bridge, serverOp), send bridge' to the server, apply serverOp' to doc, compose(bridge, serverOp'), return WaitingState;
       * ELSE
       *   THEN transform(bridge, serverOp), apply serverOp' to doc, compose(bridge, serverOp'), return this
       */
      return this;
    }
  }]);

  return AwaitingAckState;
}();

/*
 * Possible States:
 *  1. Waiting for ack
 */


var Client = function () {
  function Client(doc, opSender) {
    _classCallCheck(this, Client);

    this.state = new WaitingState(doc, opSender);
    this.opSender = opSender;
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