'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.AwaitingAckState = exports.WaitingState = undefined;

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _lineage_operation = require('./lineage_operation');

var _lineage_operation2 = _interopRequireDefault(_lineage_operation);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var WaitingState = exports.WaitingState = function () {
  // @private
  function WaitingState(doc, opSender, lastServerOp) {
    _classCallCheck(this, WaitingState);

    this.doc = doc;
    this.opSender = opSender;
    this.lastServerOp = lastServerOp;
  }
  // @private

  // @private


  _createClass(WaitingState, [{
    key: 'applyClient',
    value: function applyClient(op) {
      this.opSender.send(op);

      /* eslint-disable no-use-before-define */
      return new AwaitingAckState(this.doc, this.opSender, op, this.lastServerOp, op);
      /* eslint-enable no-use-before-define */
    }
  }, {
    key: 'applyServer',
    value: function applyServer(op) {
      this.doc.apply(op);
      return new WaitingState(this.doc, this.opSender, op);
    }
  }]);

  return WaitingState;
}();

var AwaitingAckState = exports.AwaitingAckState = function () {
  function AwaitingAckState(doc, opSender, ackOp, serverBuffer, clientBuffer) {
    _classCallCheck(this, AwaitingAckState);

    this.doc = doc;
    this.opSender = opSender;
    this.ackOp = ackOp;
    this.serverBuffer = serverBuffer;
    this.clientBuffer = clientBuffer;
  }

  _createClass(AwaitingAckState, [{
    key: 'applyClient',
    value: function applyClient(op) {
      this.clientBuffer = this.clientBuffer.compose(op);
      return this;
    }
  }, {
    key: 'applyServer',
    value: function applyServer(op) {
      var _LineageOperation$tra = _lineage_operation2.default.transform(this.clientBuffer, op),
          _LineageOperation$tra2 = _slicedToArray(_LineageOperation$tra, 2),
          clientPrime = _LineageOperation$tra2[0],
          serverPrime = _LineageOperation$tra2[1];

      this.doc.apply(serverPrime);

      if (op.sourceId === this.ackOp.sourceId) {
        this.opSender.send(clientPrime);

        return new AwaitingAckState(this.doc, this.opSender, clientPrime, op, clientPrime);
      }

      return new AwaitingAckState(this.doc, this.opSender, this.ackOp, this.serverBuffer.compose(op), this.clientBuffer.compose(serverPrime));
    }
  }]);

  return AwaitingAckState;
}();