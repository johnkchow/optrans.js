'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

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

function processOps(ops, source) {
  var results = [];

  var counter = 0;

  ops.forEach(function (op, i) {
    if (isInsert(op)) {
      // $FlowIgnore
      var str = op;
      for (var _i = 0; _i < str.length; _i++) {
        results.push({ type: 'char', char: str[_i], pos: counter, sourcePos: _i, source: source });
      }
    } else {
      // $FlowIgnore
      var count = Math.abs(op);
      var _type = isRetain(op) ? 'ret' : 'rem';

      for (var _i2 = 0; _i2 < count; _i2++) {
        results.push({ type: _type, pos: counter, sourcePos: _i2, source: source });
        counter++;
      }
    }
  });

  return results;
}

function removeNonOverlapingRetains(ops1, ops2) {
  var i = 0;
  var j = 0;

  var newOps1 = [];
  var newOps2 = [];

  while (i < ops1.length && j < ops2.length) {
    if (ops1[i].type === 'ret' && ops2[j].type === 'ret') {
      newOps1.push(ops1[i]);
      newOps2.push(ops2[j]);

      i++;
      j++;
    } else if (ops1[i].type === 'ret' && ops2[j].type === 'rem' || ops1[i].type === 'rem' && ops2[j].type === 'ret' || ops1[i].type === 'rem' && ops2[j].type === 'rem') {
      i++;
      j++;
    } else if (ops1[i].type === 'char') {
      newOps1.push(ops1[i]);
      i++;
    } else if (ops2[j].type === 'char') {
      newOps2.push(ops2[j]);
      j++;
    }
  }

  while (i < ops1.length) {
    if (ops1[i].type === 'char') {
      newOps1.push(ops1[i]);
    }
    i++;
  }

  while (j < ops2.length) {
    if (ops2[j].type === 'char') {
      newOps2.push(ops2[j]);
    }

    j++;
  }

  return [newOps1, newOps2];
}

// first, remove all retains that were removed from the other op
// then remove all the removes from both ops. this is the working ops set.
// calculate set of ops from the sparse ops set to produce minimal edit distance
// then "expand" the condensed set by re-including removes

var Operation = function () {
  _createClass(Operation, null, [{
    key: 'transform',
    value: function transform(op1, op2) {
      var ops1 = op1._ops;
      var ops2 = op2._ops;

      _logger2.default.debug('transform ops args: [' + ops1.toString() + '], [' + ops2.toString() + ']');
      return [Operation._transformOneWay(op1, op2, 2), Operation._transformOneWay(op2, op1, 1)];
    }

    /*
     * Returns compared' which will then could be applied to base
     */

  }, {
    key: '_transformOneWay',
    value: function _transformOneWay(compared, base, insertPriority) {
      function deepCopyOp(op) {
        return {
          distance: op.distance,
          ops: op.ops.slice()
        };
      }

      function isEqual(op1, op2) {
        if (op1.type === 'char' && op2.type === 'char') {
          return op1.char === op2.char && op1.pos === op2.pos;
        } else if (op1.type === 'ret' && op2.type === 'ret') {
          return op1.pos === op2.pos;
        }

        return false;
      }

      // First, include all the removes in processOps
      // Then strip out retains from each other where there are already removes; also strip out removes
      // Then continue DP like we normally do
      // Then in expand, we take in the the original processedOps, optimalOps
      var comparedOpsWithPos = processOps(compared._ops, 'compared');
      var baseOpsWithPos = processOps(base._ops, 'base');

      var _removeNonOverlapingR = removeNonOverlapingRetains(comparedOpsWithPos, baseOpsWithPos),
          _removeNonOverlapingR2 = _slicedToArray(_removeNonOverlapingR, 2),
          comparedOps = _removeNonOverlapingR2[0],
          baseOps = _removeNonOverlapingR2[1];

      var retRemCount = baseOpsWithPos.filter(function (op) {
        return op.type === 'ret' || op.type === 'rem';
      }).length;

      var dp = Array(comparedOps.length + 1);

      dp[0] = new Array(baseOps.length + 1);
      dp[0][0] = { distance: 0, ops: [] };

      for (var i = 1; i < comparedOps.length + 1; i++) {
        dp[i] = Array(baseOps.length + 1);

        var _ops = dp[i - 1][0].ops.slice();

        var comparedOp = comparedOps[i - 1];

        _ops.push(comparedOp);

        dp[i][0] = { distance: i, ops: _ops };

        logDpOpOp(i, 0, 'init', dp[i][0]);
      }

      for (var j = 1; j < baseOps.length + 1; j++) {
        var _ops2 = dp[0][j - 1].ops.slice();

        var baseOp = baseOps[j - 1];

        _ops2.push(baseOp);

        dp[0][j] = { distance: j, ops: _ops2 };

        logDpOpOp(0, j, 'init', dp[0][j]);
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

      function logDpOpOp(i, j, msg, op) {
        var newOp = Object.assign({}, op);

        if (op.distance === Infinity) {
          newOp.distance = 'INF';
        }

        newOp.ops = op.ops.map(function (o) {
          var opStr = o.type === 'char' ? '\'' + o.char + '\'' : '1';
          return o.source[0] + ':' + o.pos + ':' + opStr;
        });

        _logger2.default.debug('[' + i + ',' + j + '] ' + msg + ': dis:' + newOp.distance + ', ops: [' + newOp.ops.join(' ') + ']');
      }

      // if (baseOp.type === 'char') {
      // find the first ins.pos where ins.pos === baseOp.pos
      // if found, if the insertPriority is 2 then find the last ins where ins.source === 'base'
      // OR
      // find the first ret.pos where ret.pos <= baseOp.pos
      // if found, then insert before ret
      // if not found (meaning you reached the end), just add it to the end
      // } else {
      // find the first ret.pos where ret.pos === baseOp.pos
      // if found, then this is a no-op, and distance should not be incremented
      // otherwise,
      // find the first op where op.pos > baseOp.pos
      // if found, insert right before here 
      // else, just add to the end
      // either case, incr distance by 1
      //
      // }
      for (var ci = 1; ci < comparedOps.length + 1; ci++) {
        for (var bj = 1; bj < baseOps.length + 1; bj++) {

          // TODO: optimize this N lookup. otherwise, our algorithm will run O(max(n*m^2, n^2*m))
          var insertOp = function insertOp(ops, newOp, insertPriority) {
            var i = 0;
            var found = false;
            var otherSource = newOp.source === 'base' ? 'compared' : 'base';

            for (; i < ops.length; i++) {
              var curOp = ops[i];
              if (newOp.type === 'char') {
                if (curOp.pos === newOp.pos && curOp.type === 'char') {
                  var insIdx = void 0;

                  for (; i < ops.length; i++) {
                    var jOp = ops[i];

                    if (newOp.source === insertPriority) {
                      if (jOp.type === 'char' && jOp.source === otherSource && jOp.pos === newOp.pos) {
                        break;
                      } else if (jOp.type !== 'char' || jOp.pos !== newOp.pos) {
                        break;
                      }
                    } else {
                      if (jOp.type !== 'char' && jOp.pos !== newOp.pos) {
                        break;
                      }
                    }
                  }

                  break;
                } else if (newOp.pos <= curOp.pos) {
                  break;
                }
              } else if (isEqual(curOp, newOp)) {
                found = true;
                break;
              } else if (curOp.pos === newOp.pos && curOp.type === 'ins') {
                // do nothing
              } else if (newOp.pos < curOp.pos) {
                break;
              }
            }

            if (!found) {
              ops.splice(i, 0, newOp);
            }
            return [ops, found];
          };

          // ins - When inserting char baseOps[j] to a str that equals to
          // baseOps[0..j-1] and comparedOps[i] has already factored in from
          // previous calculation


          var _baseOp = baseOps[bj - 1];
          var _comparedOp = comparedOps[ci - 1];var ins = deepCopyOp(dp[ci][bj - 1]);

          var _insertOp = insertOp(ins.ops, _baseOp, insertPriority === 2 ? 'base' : 'compared'),
              _insertOp2 = _slicedToArray(_insertOp, 2),
              insOps = _insertOp2[0],
              insFound = _insertOp2[1];

          if (!insFound) {
            ins.distance++;
            ins.ops = insOps;
          }

          if (ci === 4 && bj === 3) {
            debugger;
          }

          // rem - When removing char comparedOps[i] to a previously calculated
          // str that already equals to baseOps[0..j]
          var rem = deepCopyOp(dp[ci - 1][bj]);

          var _insertOp3 = insertOp(rem.ops, _comparedOp, insertPriority === 2 ? 'base' : 'compared'),
              _insertOp4 = _slicedToArray(_insertOp3, 2),
              remOps = _insertOp4[0],
              remFound = _insertOp4[1];

          if (!remFound) {
            rem.distance++;
            rem.ops = remOps;
          }

          // sub - When doing a substitute (or retaining) between comaparedOps[i]
          // and baseOps[j] on a str that equals to baseOps[0..j-1] but hasn't
          // factored in comparedOps[i] yet
          var sub = deepCopyOp(dp[ci - 1][bj - 1]);

          if (isEqual(_comparedOp, _baseOp)) {
            var _insertOp5 = insertOp(sub.ops, _baseOp, insertPriority === 2 ? 'base' : 'compared'),
                _insertOp6 = _slicedToArray(_insertOp5, 2),
                subOps = _insertOp6[0],
                subFound = _insertOp6[1];

            sub.ops = subOps;
            if (!subFound) {
              sub.distance++;
            }
          } else {
            var baseResults = insertOp(sub.ops, _baseOp, insertPriority === 2 ? 'base' : 'compared');
            var comparedResults = insertOp(baseResults[0], _comparedOp, insertPriority === 2 ? 'base' : 'compared');

            if (!baseResults[1]) {
              sub.distance++;
            }

            if (!comparedResults[1]) {
              sub.distance++;
            }

            sub.ops = comparedResults[0];
          }

          var sortedOps = [ins, rem, sub].sort(function (x, y) {
            return x.distance - y.distance;
          });

          if (sortedOps[0].distance === sub.distance) {
            dp[ci][bj] = sub;
          } else {
            dp[ci][bj] = sortedOps[0];
          }

          if (dp[ci][bj].distance === 0) {
            //debugger;
          }

          logDpOp(ci, bj, 'baseOp', _baseOp);
          logDpOp(ci, bj, 'comparedOp', _comparedOp);
          logDpOpOp(ci, bj - 1, 'previns', dp[ci][bj - 1]);
          logDpOpOp(ci, bj, 'ins    ', ins);
          logDpOpOp(ci - 1, bj, 'prevrem', dp[ci - 1][bj]);
          logDpOpOp(ci, bj, 'rem    ', rem);
          logDpOpOp(ci - 1, bj - 1, 'prevsub', dp[ci - 1][bj - 1]);
          logDpOpOp(ci, bj, 'sub    ', sub);
          logDpOpOp(ci, bj, 'min    ', dp[ci][bj]);

          _logger2.default.debug('');
        }
      }

      var optimalOps = dp[comparedOps.length][baseOps.length].ops;

      function newExpandOps(ops, allBaseOps, retRemCount) {
        var compressedOps = [];
        var count = 0;

        ops.forEach(function (op) {
          // if count = 0, type == 'char', op.pos == 0; do nothing
          // if count = 0, type == 'ret, op.pos == 0, do nothing
          // if count = 0, type = char, op.pos = 1, remCount: 1
          // if count = 0, type = ret, op.pos = 1, remCount: 1,
          //
          // if count = 0, type = char, op.pos = 2, remCount: 2
          // if count = 0, type = ret, op.pos = 2, remCount: 2
          if (count === op.pos && op.type === 'ret') {
            count += 1;
          } else if (count === op.pos && op.type === 'char') {
            // do nothing
          } else if (count < op.pos) {
            var remCount = 0;
            // TODO: avoid the N lookup here

            var _loop = function _loop(_i3) {
              if (!allBaseOps.find(function (o) {
                return o.type === 'rem' && o.pos === _i3;
              })) {
                remCount++;
              }
            };

            for (var _i3 = count; _i3 < op.pos; _i3++) {
              _loop(_i3);
            }
            if (remCount) {
              compressedOps.push(-remCount);
            }
            count = op.pos + 1;
          }

          if (op.type === 'char' && op.source === 'base' || op.type === 'ret') {
            if (isRetain(compressedOps[compressedOps.length - 1])) {
              // $FlowIgnore
              var ret = compressedOps[compressedOps.length - 1];

              compressedOps[compressedOps.length - 1] = ret + 1;
            } else {
              compressedOps.push(1);
            }
          } else if (op.type === 'char' && op.source === 'compared') {
            compressedOps.push(op.char);
          }
        });

        var lastOp = ops[ops.length - 1];
        var lastPos = lastOp.type === 'char' ? lastOp.pos - 1 : lastOp.pos;

        if (lastPos < retRemCount - 1) {
          var remCount = 0;
          // TODO: avoid the N lookup here

          var _loop2 = function _loop2(_i4) {
            if (!allBaseOps.find(function (o) {
              return o.type === 'rem' && o.pos === _i4;
            })) {
              remCount++;
            }
          };

          for (var _i4 = lastPos + 1; _i4 < retRemCount; _i4++) {
            _loop2(_i4);
          }
          if (remCount) {
            compressedOps.push(-remCount);
          }
        }

        // if baseOps has rem and we're missing an op, then we don't need to apply the rem
        // if comparedOps has rem and we're missing an op, then we should apply the rem

        return compressedOps;
      }

      //function expandOps(comparedOps: CondensedOperations, baseOps: CondensedOperations, optimalOps: Array<PrimitiveOperation>): Array<PrimitiveOperation> {
      //const results: Array<PrimitiveOperation> = [];

      //let b = 0;
      //let c = 0;
      //let o = 0;

      //while (c < comparedOps.length || b < baseOps.length) {
      //const bop : ?CondensedOperation = baseOps[b];
      //const cop : ?CondensedOperation = comparedOps[c];
      //const oo : PrimitiveOperation = optimalOps[o];

      //if (bop && cop) {
      //if (bop.type === 'rem' && cop.type === 'rem') {
      //b++;
      //c++;
      //} else if (bop.type === 'ret' && cop.type === 'rem') {
      //results.push(-1);
      //b++;
      //c++;
      //} else if (isRetain(oo) &&
      //((bop.type === 'ret' && cop.type === 'ret') ||
      //(bop.type === 'char' && cop.type === 'char' && bop.char === cop.char))) {
      //results.push(1);
      //b++;
      //c++;
      //o++;
      //} else if (isRetain(oo) && bop.type === 'char') {
      //results.push(1);
      //b++;
      //o++;
      //} else if (isInsert(oo) && cop.type === 'char') {
      //results.push(oo);
      //c++;
      //o++;
      //} else if (isRemove(oo) && bop.type === 'ret' && cop.type === 'ret') {
      //results.push(-1);
      //b++;
      //c++;
      //o++;
      //} else if (isRemove(oo) && bop.type === 'char') {
      //results.push(-1);
      //b++;
      //o++;
      //} else {
      //throw new Error('Assertion error: there\'s an unknown set of operations');
      //}
      //} else if (bop) {
      //if (bop.type === 'rem') {
      //results.push(-1);
      //b++;
      //} else if (isRetain(oo)) {
      //results.push(1);
      //b++;
      //o++;
      //} else {
      //throw new Error('Assertion error: there\'s an unknown set of operations');
      //}
      //} else if (cop) {
      //if (cop.type === 'char' && isInsert(oo)) {
      //results.push(oo);
      //c++;
      //o++;
      //} else {
      //throw new Error('Assertion error: there\'s an unknown set of operations');
      //}
      //}
      //}

      //return compressOps(results);
      //}

      //optimalOps = expandOps(comparedOpsWithPos, baseOpsWithPos, optimalOps);


      return new Operation(newExpandOps(optimalOps, baseOpsWithPos, retRemCount));
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
      _logger2.default.debug('compose ops: [' + this._ops.toString() + '], [' + op._ops.toString() + ']');
      var ops1 = this._ops.slice();
      var ops2 = op._ops.slice();
      var newOp = new Operation();

      var i = 0;
      var j = 0;

      while (i < ops1.length || j < ops2.length) {
        _logger2.default.debug('compose (' + i + ', ' + ops1[i] + '), (' + j + ', ' + ops2[j] + '), [' + newOp._ops.toString() + ']');

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
          var _p = ops2[j];

          newOp.insert(_p);
          j++;
        } else if (isRetain(ops1[i]) && isRemove(ops2[j])) {
          // $FlowIgnore
          var _p2 = ops1[i];
          // $FlowIgnore
          var _p3 = ops2[j];

          if (_p2 + _p3 >= 0) {
            newOp.remove(_p3);
            if (_p2 + _p3 === 0) {
              i++;
            } else {
              ops1[i] = _p2 + _p3;
            }
            j++;
          } else {
            newOp.remove(_p2 + _p3);
            ops2[j] = _p2 + _p3;
            i++;
          }
        } else if (isRetain(ops1[i])) {
          // $FlowIgnore
          newOp.retain(ops1[i]);
          i++;
        } else if (isRemove(ops1[i])) {
          // $FlowIgnore
          newOp.remove(ops1[i]);
          i++;
        } else if (isInsert(ops2[j])) {
          // $FlowIgnore
          newOp.insert(ops2[j]);
          j++;
        } else if (isInsert(ops1[i]) && isRetain(ops2[j])) {
          // $FlowIgnore
          var _p4 = ops1[i];
          // $FlowIgnore
          var _p5 = ops2[j];

          if (_p5 >= _p4.length) {
            newOp.insert(_p4);
            i++;

            if (_p5 === _p4.length) {
              j++;
            } else {
              ops2[j] = _p5 - _p4.length;
            }
          } else {
            newOp.insert(_p4.substring(0, _p5 - 1));

            ops1[i] = _p4.substring(_p5);
            j++;
          }
        } else if (isInsert(ops1[i]) && isRemove(ops2[j])) {
          // $FlowIgnore
          var _p6 = ops1[i];
          // $FlowIgnore
          var _p7 = ops2[j];

          if (_p7 + _p6.length === 0) {
            i++;
            j++;
          } else if (_p7 + _p6.length < 0) {
            ops2[j] = _p7 + _p6.length;
            i++;
            j++;
          } else {
            ops1[i] = _p6.substring(Math.abs(_p7));
            i++;
            j++;
          }
        } else if (isInsert(ops1[i])) {
          // $FlowIgnore
          newOp.insert(ops1[i]);
          i++;
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

      _logger2.default.debug('compose newOp: [' + newOp._ops.toString() + ']');

      return newOp;
    }
  }]);

  return Operation;
}();

exports.default = Operation;