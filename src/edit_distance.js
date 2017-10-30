// @flow
/* eslint-disable no-plusplus */

import type { CharOperation } from './operation';
import Logger from './logger';

type DPArray = Array<Array<{ distance: number, ops: Array<CharOperation> }>>;

function deepCopyOp(op) {
  return {
    distance: op.distance,
    ops: op.ops.slice(),
  };
}

function logDpOpOp(i, j, msg, op: { distance: number, ops: Array<CharOperation> }) {
  const newOp = Object.assign({}, op);

  if (op.distance === Infinity) {
    newOp.distance = 'INF';
  }

  newOp.ops = op.ops.map((o) => {
    const opStr = o.type === 'char' ? `'${o.char}'` : '1';
    return `${o.source[0]}:${o.pos}:${opStr}`;
  });

  Logger.debug(`[${i},${j}] ${msg}: dis:${newOp.distance}, ops: [${newOp.ops.join(' ')}]`);
}

function logDpOp(i, j, msg, op: CharOperation) {
  const newOp = Object.assign({}, op);

  if (op.distance === Infinity) {
    newOp.distance = 'INF';
  }

  const opPrim = op.type === 'char' ? `'${op.char}'` : '1';
  const opStr = `${op.source[0]}:${op.pos}:${opPrim}`;

  Logger.debug(`[${i},${j}] ${msg}: ${opStr}`);
}

function isEqual(op1: CharOperation, op2: CharOperation): boolean {
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
export default function minimimEditDistance(
  comparedOps: Array<CharOperation>,
  baseOps: Array<CharOperation>,
  insertPriority: 'base' | 'compared',
): Array<CharOperation> {
  const dp : DPArray = Array(comparedOps.length + 1);
  dp[0] = new Array(baseOps.length + 1);
  dp[0][0] = { distance: 0, ops: [] };

  for (let i = 1; i < comparedOps.length + 1; i++) {
    dp[i] = Array(baseOps.length + 1);

    const ops = dp[i - 1][0].ops.slice();

    const comparedOp = comparedOps[i - 1];

    ops.push(comparedOp);

    dp[i][0] = { distance: i, ops };

    logDpOpOp(i, 0, 'init', dp[i][0]);
  }

  for (let j = 1; j < baseOps.length + 1; j++) {
    const ops = dp[0][j - 1].ops.slice();

    const baseOp = baseOps[j - 1];

    ops.push(baseOp);

    dp[0][j] = { distance: j, ops };

    logDpOpOp(0, j, 'init', dp[0][j]);
  }

  for (let ci = 1; ci < comparedOps.length + 1; ci++) {
    for (let bj = 1; bj < baseOps.length + 1; bj++) {
      const baseOp = baseOps[bj - 1];
      const comparedOp = comparedOps[ci - 1];


      // ins - When inserting char baseOps[j] to a str that equals to
      // baseOps[0..j-1] and comparedOps[i] has already factored in from
      // previous calculation
      const ins = deepCopyOp(dp[ci][bj - 1]);
      ins.ops.push(baseOp);
      ins.distance++;

      // rem - When inserting char comparedOps[i] to a previously calculated
      // str that already equals to baseOps[0..j]
      const rem = deepCopyOp(dp[ci - 1][bj]);
      rem.ops.push(comparedOp);
      rem.distance++;

      // sub - When doing a substitute (or retaining) between comaparedOps[i]
      // and baseOps[j] on a str that equals to baseOps[0..j-1] but hasn't
      // factored in comparedOps[i] yet
      const sub = deepCopyOp(dp[ci - 1][bj - 1]);

      if (isEqual(comparedOp, baseOp)) {
        // $FlowIgnore
        const bothOp = (Object.assign({}, baseOp): CharOperation);
        bothOp.source = 'both';
        sub.ops.push(bothOp);
      } else {
        if (insertPriority === 'base') {
          sub.ops.push(baseOp);
          sub.ops.push(comparedOp);
        } else {
          sub.ops.push(comparedOp);
          sub.ops.push(baseOp);
        }
        sub.distance += 2;
      }

      const sortedOps = [ins, rem, sub].sort((x, y) => x.distance - y.distance);

      if (sortedOps[0].distance === sub.distance) {
        dp[ci][bj] = sub;
      } else {
        dp[ci][bj] = sortedOps[0];
      }

      logDpOp(ci, bj, 'baseOp', baseOp);
      logDpOp(ci, bj, 'comparedOp', comparedOp);
      logDpOpOp(ci, bj - 1, 'previns', dp[ci][bj - 1]);
      logDpOpOp(ci, bj, 'ins    ', ins);
      logDpOpOp(ci - 1, bj, 'prevrem', dp[ci - 1][bj]);
      logDpOpOp(ci, bj, 'rem    ', rem);
      logDpOpOp(ci - 1, bj - 1, 'prevsub', dp[ci - 1][bj - 1]);
      logDpOpOp(ci, bj, 'sub    ', sub);
      logDpOpOp(ci, bj, 'min    ', dp[ci][bj]);
      Logger.debug('');
    }
  }

  return dp[comparedOps.length][baseOps.length].ops;
}
