'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = minimimEditDistance;

var _logger = require('./logger');

var _logger2 = _interopRequireDefault(_logger);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* eslint-disable no-plusplus */

function deepCopyOp(op) {
  return {
    distance: op.distance,
    ops: op.ops.slice()
  };
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

function logDpOp(i, j, msg, op) {
  var newOp = Object.assign({}, op);

  if (op.distance === Infinity) {
    newOp.distance = 'INF';
  }

  var opPrim = op.type === 'char' ? '\'' + op.char + '\'' : '1';
  var opStr = op.source[0] + ':' + op.pos + ':' + opPrim;

  _logger2.default.debug('[' + i + ',' + j + '] ' + msg + ': ' + opStr);
}

function isEqual(op1, op2) {
  if (op1.type === 'char' && op2.type === 'char') {
    return op1.char === op2.char && op1.pos === op2.pos;
  } else if (op1.type === 'ret' && op2.type === 'ret') {
    return op1.pos === op2.pos;
  }

  return false;
}

/* This function is a straightforward implementation of the minimum edit distance.
 *
 * @param {Array<CharOperation>} baseOps The "string" labeled as base
 * @param {Array<CharOperation>} comparedOps The "string" labeled as compared
 * @param {'base' | 'compared'} insertPriority Determines which char is
 *   inserted first during the substition phase of the dynamic programming
 * @returns {Array<CharOperation>} Returns the "string" with
 *   the minimum edit distances applied to both baseOps and comparedOps
 */
function minimimEditDistance(comparedOps, baseOps, insertPriority) {
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

  for (var ci = 1; ci < comparedOps.length + 1; ci++) {
    for (var bj = 1; bj < baseOps.length + 1; bj++) {
      var _baseOp = baseOps[bj - 1];
      var _comparedOp = comparedOps[ci - 1];

      // ins - When inserting char baseOps[j] to a str that equals to
      // baseOps[0..j-1] and comparedOps[i] has already factored in from
      // previous calculation
      var ins = deepCopyOp(dp[ci][bj - 1]);
      ins.ops.push(_baseOp);
      ins.distance++;

      // rem - When inserting char comparedOps[i] to a previously calculated
      // str that already equals to baseOps[0..j]
      var rem = deepCopyOp(dp[ci - 1][bj]);
      rem.ops.push(_comparedOp);
      rem.distance++;

      // sub - When doing a substitute (or retaining) between comaparedOps[i]
      // and baseOps[j] on a str that equals to baseOps[0..j-1] but hasn't
      // factored in comparedOps[i] yet
      var sub = deepCopyOp(dp[ci - 1][bj - 1]);

      if (isEqual(_comparedOp, _baseOp)) {
        // $FlowIgnore
        var bothOp = Object.assign({}, _baseOp);
        bothOp.source = 'both';
        sub.ops.push(bothOp);
      } else {
        if (insertPriority === 'base') {
          sub.ops.push(_baseOp);
          sub.ops.push(_comparedOp);
        } else {
          sub.ops.push(_comparedOp);
          sub.ops.push(_baseOp);
        }
        sub.distance += 2;
      }

      var sortedOps = [ins, rem, sub].sort(function (x, y) {
        return x.distance - y.distance;
      });

      if (sortedOps[0].distance === sub.distance) {
        dp[ci][bj] = sub;
      } else {
        dp[ci][bj] = sortedOps[0];
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

  return dp[comparedOps.length][baseOps.length].ops;
}