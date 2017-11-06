'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
/* eslint-disable no-plusplus */

exports.opToString = opToString;
exports.opsToString = opsToString;

var _logger = require('./logger');

var _logger2 = _interopRequireDefault(_logger);

var _edit_distance = require('./edit_distance');

var _edit_distance2 = _interopRequireDefault(_edit_distance);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function opToString(op) {
  if (op) {
    return op.ty + ':' + op.v;
  }

  return '';
}

function opsToString(ops) {
  return '[' + ops.map(function (o) {
    return opToString(o);
  }).join(',') + ']';
}

function isRetain(op) {
  return !!(op && op.ty === 'rt');
}

function isInsert(op) {
  return !!(op && op.ty === 'i');
}

function isRemove(op) {
  return !!(op && op.ty === 'rm');
}

function logDpOp(i, j, msg, op) {
  var newOp = Object.assign({}, op);

  if (op.distance === Infinity) {
    newOp.distance = 'INF';
  }

  var opPrim = op.type === 'char' ? '\'' + op.char + '\'' : '1';
  var opStr = op.source[0] + ':' + op.pos + ':' + opPrim;

  _logger2.default.debug('[' + i + ',' + j + '] ' + msg + ': ' + opStr);
}

function expandOps(ops, source) {
  var results = [];

  var counter = 0;

  ops.forEach(function (op) {
    if (isInsert(op)) {
      // $FlowIgnore
      var str = op.v;
      for (var i = 0; i < str.length; i++) {
        results.push({ type: 'char', char: str[i], pos: counter, sourcePos: i, source: source });
      }
    } else {
      // $FlowIgnore
      var count = op.v;
      var _type = isRetain(op) ? 'ret' : 'rem';

      for (var _i = 0; _i < count; _i++) {
        results.push({ type: _type, pos: counter, sourcePos: _i, source: source });
        counter++;
      }
    }
  });

  return results;
}

var Operation = function () {
  _createClass(Operation, null, [{
    key: 'transform',


    /*
     * First, convert CompressedOperations to SingleOperations
     * Then traverse through both operations op by op
     *
     * if op1 is rem, then op2' should not contain a ret at that pos
     * if op2 is rem, then op1 should not contain a ret at that pos
     *
     * if both op1 and op2 are ret for same pos, then add ret to both op1' and op2'
     *
     * if op1 is an insert but op2 is not an ins, then add op1' should include op1
     * if op2 is an insert and op2 is an insert determine str w/ min edit
     *   distance for both op1 and op2, loop through the new str. if source is
     *   same, op is ins to primeOp; otherwise, op is ret.
     */
    value: function transform(op1, op2) {
      // TODO: rename base/compared to ops1 or 2
      var ops1 = expandOps(op1._ops, 'compared');
      var ops2 = expandOps(op2._ops, 'base');

      _logger2.default.debug('transform ops args: [' + ops1.toString() + '], [' + ops2.toString() + ']');

      var i = 0;
      var j = 0;

      var ops1Prime = new Operation();
      var ops2Prime = new Operation();

      while (i < ops1.length && j < ops2.length) {
        var o1 = ops1[i];
        var o2 = ops2[j];

        if (o1.type === 'rem' && o2.type === 'rem') {
          // do nothing, just advance
          i++;
          j++;
        } else if (o1.type === 'ret' && o1.type === o2.type) {
          ops1Prime.retain(1);
          ops2Prime.retain(1);

          i++;
          j++;
        } else if (o1.type === 'rem' && o2.type === 'ret') {
          ops1Prime.remove(1);

          i++;
          j++;
        } else if (o1.type === 'ret' && o2.type === 'rem') {
          ops2Prime.remove(1);

          i++;
          j++;
        } else if (o1.type === 'char' && o2.type !== 'char') {
          ops1Prime.insert(o1.char);
          ops2Prime.retain(1);

          i++;
        } else if (o1.type !== 'char' && o2.type === 'char') {
          ops1Prime.retain(1);
          ops2Prime.insert(o2.char);

          j++;
        } else if (o1.type === 'char' && o1.type === o2.type) {
          var ki = void 0;

          for (ki = i; ki < ops1.length; ki++) {
            if (ops1[ki].type !== 'char') {
              break;
            }
          }

          // $FlowIgnore
          var subOps1 = ops1.slice(i, ki);

          var kj = void 0;

          for (kj = j; kj < ops2.length; kj++) {
            if (ops2[kj].type !== 'char') {
              break;
            }
          }

          // $FlowIgnore
          var subOps2 = ops2.slice(j, kj);

          var combinedOps = (0, _edit_distance2.default)(subOps1, subOps2, 'base');

          combinedOps.forEach(function (op) {
            if (op.source === 'compared') {
              ops1Prime.insert(op.char);
              ops2Prime.retain(1);
            } else if (op.source === 'base') {
              ops1Prime.retain(1);
              ops2Prime.insert(op.char);
            } else if (op.source === 'both') {
              ops1Prime.retain(1);
              ops2Prime.retain(1);
            } else {
              throw new Error('Unexpected source: ' + op.source);
            }
          });

          i = ki;
          j = kj;
        } else {
          _logger2.default.debug('Error dump');
          logDpOp(i, j, 'o1', o1);
          logDpOp(i, j, 'o2', o2);
          throw new Error('Unknown error');
        }
      }

      while (i < ops1.length) {
        var _o = ops1[i];

        if (_o.type === 'char') {
          ops1Prime.insert(_o.char);
          ops2Prime.retain(1);
        } else {
          throw new Error('Assertion failed: there should be no more retains/removes');
        }

        i++;
      }

      while (j < ops2.length) {
        var _o2 = ops2[j];

        if (_o2.type === 'char') {
          ops1Prime.retain(1);
          ops2Prime.insert(_o2.char);
        } else {
          throw new Error('Assertion failed: there should be no more retains/removes');
        }
        j++;
      }

      return [ops1Prime, ops2Prime];
    }

    /*
     * Returns compared' which will then could be applied to base
     */

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
        // $FlowIgnore
        this._ops[this._ops.length - 1].v = lastOp.v + op;
      } else {
        this._ops.push({ ty: 'rt', v: op });
      }
    }
  }, {
    key: 'remove',
    value: function remove(op) {
      var lastOp = this._ops[this._ops.length - 1];

      var pos = +Math.abs(op);

      if (isRemove(lastOp)) {
        // $FlowIgnore
        this._ops[this._ops.length - 1].v = lastOp.v - pos;
      } else {
        this._ops.push({ ty: 'rm', v: pos });
      }
    }
  }, {
    key: 'insert',
    value: function insert(op) {
      this._ops.push({ ty: 'i', v: op });
    }
  }, {
    key: 'compose',
    value: function compose(op) {
      _logger2.default.debug('compose ops: [' + opsToString(this._ops) + '], [' + opsToString(op._ops) + ']');
      var ops1 = this._ops.slice();
      var ops2 = op._ops.slice();
      var newOp = new Operation();

      var i = 0;
      var j = 0;

      while (i < ops1.length || j < ops2.length) {
        _logger2.default.debug('compose (' + i + ', ' + opToString(ops1[i]) + '), (' + j + ', ' + opToString(ops2[j]) + '), [' + opsToString(newOp._ops) + ']');

        if (isRetain(ops1[i]) && isRetain(ops2[j])) {
          // $FlowIgnore
          var p1 = ops1[i].v;
          // $FlowIgnore
          var p2 = ops2[j].v;

          if (p1 < p2) {
            newOp.retain(p1);
            ops2[j] = { ty: 'rt', v: p2 - p1 };
            i++;
          } else if (p1 > p2) {
            newOp.retain(p2);
            ops1[i] = { ty: 'rt', v: p1 - p2 };
            j++;
          } else {
            newOp.retain(p1);
            i++;
            j++;
          }
        } else if (isRetain(ops1[i]) && isInsert(ops2[j])) {
          // $FlowIgnore
          var _p = ops2[j].v;

          newOp.insert(_p);
          j++;
        } else if (isRetain(ops1[i]) && isRemove(ops2[j])) {
          // $FlowIgnore
          var _p2 = ops1[i].v;
          // $FlowIgnore
          var _p3 = ops2[j].v;

          if (_p2 - _p3 >= 0) {
            newOp.remove(_p3);
            if (_p2 - _p3 === 0) {
              i++;
            } else {
              ops1[i] = { ty: 'rt', v: _p2 - _p3 };
            }
            j++;
          } else {
            newOp.remove(_p2 - _p3);
            ops2[j] = { ty: 'rm', v: Math.abs(_p2 - _p3) };
            i++;
          }
        } else if (isRetain(ops1[i])) {
          // $FlowIgnore
          newOp.retain(ops1[i].v);
          i++;
        } else if (isRemove(ops1[i])) {
          // $FlowIgnore
          newOp.remove(ops1[i].v);
          i++;
        } else if (isInsert(ops2[j])) {
          // $FlowIgnore
          newOp.insert(ops2[j].v);
          j++;
        } else if (isInsert(ops1[i]) && isRetain(ops2[j])) {
          // $FlowIgnore
          var _p4 = ops1[i].v;
          // $FlowIgnore
          var _p5 = ops2[j].v;

          if (_p5 >= _p4.length) {
            newOp.insert(_p4);
            i++;

            if (_p5 === _p4.length) {
              j++;
            } else {
              ops2[j] = { ty: 'rt', v: _p5 - _p4.length };
            }
          } else {
            newOp.insert(_p4.substring(0, _p5 - 1));

            ops1[i] = { ty: 'i', v: _p4.substring(_p5) };
            j++;
          }
        } else if (isInsert(ops1[i]) && isRemove(ops2[j])) {
          // $FlowIgnore
          var _p6 = ops1[i].v;
          // $FlowIgnore
          var _p7 = ops2[j].v;

          if (-_p7 + _p6.length === 0) {
            i++;
            j++;
          } else if (-_p7 + _p6.length < 0) {
            ops2[j] = { ty: 'rm', v: Math.abs(-_p7 + _p6.length) };
            i++;
            j++;
          } else {
            ops1[i] = { ty: 'i', v: _p6.substring(_p7) };
            i++;
            j++;
          }
        } else if (isInsert(ops1[i])) {
          // $FlowIgnore
          newOp.insert(ops1[i].v);
          i++;
        } else if (isRetain(ops2[j])) {
          // $FlowIgnore
          newOp.retain(ops2[j].v);
          j++;
        } else if (isRemove(ops2[j])) {
          // $FlowIgnore
          newOp.remove(ops2[j].v);
          j++;
        } else {
          throw new Error('Unknown operation combinations: ' + opToString(ops1[i]) + ', ' + opToString(ops2[j]));
        }
      }

      _logger2.default.debug('compose newOp: [' + newOp._ops.toString() + ']');

      return newOp;
    }
  }, {
    key: 'toString',
    value: function toString() {
      return opsToString(this._ops);
    }
  }]);

  return Operation;
}();

exports.default = Operation;