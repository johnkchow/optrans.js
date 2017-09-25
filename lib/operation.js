'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
/* eslint-disable no-plusplus */

var _logger = require('./logger');

var _logger2 = _interopRequireDefault(_logger);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function isRetain(op) {
  return typeof op === 'number' && op >= 0;
}

function isInsert(op) {
  return typeof op === 'string';
}

function isRemove(op) {
  return typeof op === 'number' && op < 0;
}

var Operation = function () {
  _createClass(Operation, null, [{
    key: 'transform',
    value: function transform(op1, op2) {
      return [Operation._transformOneWay(op1, op2, 2), Operation._transformOneWay(op2, op1, 1)];
    }

    /*
     * Returns op1', meaning op2.compose(op1').apply(docStr) equals
     * op1.compose(op2').apply(docStr);
     */

  }, {
    key: '_transformOneWay',
    value: function _transformOneWay(op1, op2, insertPriority) {
      var newOp = new Operation();

      var ops1 = op1._ops.slice();
      var ops2 = op2._ops.slice();

      var i = 0;
      var j = 0;

      while (i < ops1.length || j < ops2.length) {
        _logger2.default.debug('transform (' + i + ', ' + ops1[i] + '), (' + j + ', ' + ops2[j] + '), [' + newOp._ops.toString() + ']');

        if (isInsert(ops1[i]) && isInsert(ops2[j])) {
          if (insertPriority === 1) {
            // $FlowIgnore
            newOp.insert(ops1[i]);
            // $FlowIgnore
            newOp.retain(ops2[j].length);
            i++;
            j++;
          } else {
            // $FlowIgnore
            newOp.retain(ops2[j].length);
            // $FlowIgnore
            newOp.insert(ops1[i]);
            i++;
            j++;
          }
        } else if (isInsert(ops1[i])) {
          // $FlowIgnore
          newOp.insert(ops1[i]);
          i++;
        } else if (isInsert(ops2[j])) {
          // $FlowIgnore
          newOp.retain(ops2[j].length);
          j++;
        } else if (isRetain(ops1[i]) && isRetain(ops2[j])) {
          // $FlowIgnore
          var p1 = ops1[i];
          // $FlowIgnore
          var p2 = ops2[j];

          if (p1 === p2) {
            newOp.retain(p1);
            i++;
            j++;
          } else if (p1 > p2) {
            ops1[i] = p1 - p2;
            newOp.retain(p2);
            j++;
          } else if (p1 < p2) {
            ops2[j] = p2 - p1;
            newOp.retain(p1);
            i++;
          }
        } else if (isRetain(ops1[i]) && isRemove(ops2[j])) {
          // $FlowIgnore
          var _p = ops1[i];
          // $FlowIgnore
          var _p2 = ops2[j];

          if (_p + _p2 === 0) {
            i++;
            j++;
          } else if (_p + _p2 > 0) {
            ops1[i] = _p + _p2;
            j++;
          } else {
            ops2[j] = _p + _p2;
            i++;
          }
        } else if (isRetain(ops1[i])) {
          // isRetain(ops1[i]) and (isInsertOrNothing)
          // $FlowIgnore
          newOp.retain(ops1[i]);
          i++;
        } else if (isRemove(ops1[i]) && isRetain(ops2[j])) {
          // $FlowIgnore
          var _p3 = ops1[i];
          // $FlowIgnore
          var _p4 = ops2[j];

          if (_p3 + _p4 === 0) {
            newOp.remove(_p3);
            i++;
            j++;
          } else if (_p3 + _p4 > 0) {
            newOp.remove(_p3);
            ops2[j] = _p3 + _p4;
            j++;
          } else {
            newOp.remove(_p4);
            ops1[i] = _p3 + _p4;
            i++;
          }
        } else if (isRemove(ops1[i]) && isRemove(ops2[j])) {
          // $FlowIgnore
          var _p5 = ops1[i];
          // $FlowIgnore
          var _p6 = ops2[j];

          if (_p5 === _p6) {
            newOp.remove(_p5);
            i++;
            j++;
          } else if (Math.abs(_p5) > Math.abs(_p6)) {
            newOp.remove(_p6);
            ops1[i] = _p5 - _p6;
            j++;
          } else {
            newOp.remove(_p5);
            ops2[j] = _p6 - _p5;
            j++;
          }
        } else {
          throw new Error('Unknown operation transform');
        }
      }

      return newOp;
    }
  }]);

  function Operation() {
    var ops = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];

    _classCallCheck(this, Operation);

    this._ops = ops;
  }

  _createClass(Operation, [{
    key: 'retain',
    value: function retain(op) {
      var lastOp = this._ops[this._ops.length - 1];

      if (isRetain(lastOp)) {
        this._ops[this._ops.length - 1] = lastOp + op;
      } else {
        this._ops.push(op);
      }
    }
  }, {
    key: 'remove',
    value: function remove(op) {
      var lastOp = this._ops[this._ops.length - 1];

      var neg = -Math.abs(op);

      if (isRemove(lastOp)) {
        this._ops[this._ops.length - 1] = lastOp + neg;
      } else {
        this._ops.push(neg);
      }
    }
  }, {
    key: 'insert',
    value: function insert(op) {
      this._ops.push(op);
    }
  }, {
    key: 'compose',
    value: function compose(op) {
      var ops1 = this._ops.slice();
      var ops2 = op._ops.slice();
      var newOp = new Operation();

      var i = 0;
      var j = 0;

      while (i < ops1.length || j < ops2.length) {
        _logger2.default.debug('(' + i + ', ' + ops1[i] + '), (' + j + ', ' + ops2[j] + '), [' + newOp._ops.toString() + ']');

        if (isRetain(ops1[i]) && isRetain(ops2[j])) {
          // $FlowIgnore
          var p1 = ops1[i];
          // $FlowIgnore
          var p2 = ops2[j];

          if (p1 < p2) {
            newOp.retain(p1);
            ops2[j] = p2 - p1;
            i++;
          } else if (p1 > p2) {
            newOp.retain(p2);
            ops1[i] = p1 - p2;
            j++;
          } else {
            newOp.retain(p1);
            i++;
            j++;
          }
        } else if (isRetain(ops1[i]) && isInsert(ops2[j])) {
          // $FlowIgnore
          var _p7 = ops2[j];

          newOp.insert(_p7);
          j++;
        } else if (isRetain(ops1[i]) && isRemove(ops2[j])) {
          // $FlowIgnore
          var _p8 = ops1[i];
          // $FlowIgnore
          var _p9 = ops2[j];

          if (_p8 + _p9 >= 0) {
            newOp.remove(_p9);
            ops1[i] = _p8 + _p9;
            j++;
          } else {
            newOp.remove(_p8 + _p9);
            ops2[j] = _p8 + _p9;
            i++;
          }
        } else if (isRetain(ops1[i])) {
          // $FlowIgnore
          newOp.retain(ops1[i]);
          i++;
        } else if (isInsert(ops1[i]) && isRetain(ops2[j])) {
          // $FlowIgnore
          var _p10 = ops1[i];
          // $FlowIgnore
          var _p11 = ops2[j];

          if (_p11 >= _p10.length) {
            newOp.insert(_p10);
            i++;

            if (_p11 - _p10.length) {
              ops2[j] = _p11 - _p10.length;
            } else {
              j++;
            }
          } else {
            newOp.insert(_p10.substring(0, _p11 - 1));

            ops1[i] = _p10.substring(_p11);
            j++;
          }
        } else if (isInsert(ops1[i]) && isRemove(ops2[j])) {
          // $FlowIgnore
          var _p12 = ops1[i];
          // $FlowIgnore
          var _p13 = ops2[j];

          if (_p13 + _p12.length === 0) {
            i++;
            j++;
          } else if (_p13 + _p12.length < 0) {
            ops2[j] = _p13 + _p12.length;
            i++;
            j++;
          } else {
            ops1[i] = _p12.substring(Math.abs(_p13));
            i++;
            j++;
          }
        } else if (isInsert(ops1[i])) {
          // $FlowIgnore
          newOp.insert(ops1[i]);
          i++;
        } else if (isRemove(ops1[i])) {
          // $FlowIgnore
          newOp.remove(ops1[i]);
          i++;
        } else if (isInsert(ops2[j])) {
          // $FlowIgnore
          newOp.insert(ops2[j]);
          j++;
        } else if (isRetain(ops2[j])) {
          // $FlowIgnore
          newOp.retain(ops2[j]);
          j++;
        } else if (isRemove(ops2[j])) {
          // $FlowIgnore
          newOp.remove(ops2[j]);
          j++;
        } else {
          throw new Error('Unknown operation combinations: ' + ops1[i] + ', ' + ops2[j]);
        }
      }

      return newOp;
    }
  }]);

  return Operation;
}();

exports.default = Operation;