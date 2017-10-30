/* @flow */
/* eslint-disable no-plusplus */

import Logger from './logger';

type PrimitiveOperation = number | string;

function isRetain(op: ?PrimitiveOperation): boolean {
  return typeof op === 'number' && op >= 0;
}

function isInsert(op: ?PrimitiveOperation): boolean {
  return typeof op === 'string';
}

function isRemove(op: ?PrimitiveOperation): boolean {
  return typeof op === 'number' && op < 0;
}

export type CharOperation = { type: 'char', char: string, pos: number, sourcePos: number, source: 'base' | 'compared' | 'both' };

type RetRemOperation = { type: 'ret' | 'rem', pos: number, sourcePos: number, source: 'base' | 'compared' | 'both' };
type SingleOperation = CharOperation | RetRemOperation;
type SingleOperations = Array<SingleOperation>;

type DPArray = Array<Array<{ distance: number, ops: Array<SingleOperation> }>>;

export default class Operation {
  _ops: Array<PrimitiveOperation>;

  static transform(op1: Operation, op2: Operation): [Operation, Operation] {
    const ops1 = op1._ops;
    const ops2 = op2._ops;

    Logger.debug(`transform ops args: [${ops1.toString()}], [${ops2.toString()}]`);
    return [Operation._transformOneWay(op1, op2, 'base'), Operation._transformOneWay(op2, op1, 'compared')];
  }

  /*
   * Returns compared' which will then could be applied to base
   */
  static _transformOneWay(compared: Operation, base: Operation, insertPriority: 'compared' | 'base'): Operation {
    function deepCopyOp(op) {
      return {
        distance: op.distance,
        ops: op.ops.slice(),
      };
    }

    function logDpOpOp(i, j, msg, op: { distance: number, ops: SingleOperations }) {
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


    function processOps(ops: Array<PrimitiveOperation>, source: 'base' | 'compared'): SingleOperations {
      const results = [];

      let counter = 0;

      ops.forEach((op) => {
        if (isInsert(op)) {
          // $FlowIgnore
          const str: string = op;
          for (let i = 0; i < str.length; i++) {
            results.push({ type: 'char', char: str[i], pos: counter, sourcePos: i, source });
          }
        } else {
          // $FlowIgnore
          const count: number = Math.abs(op);
          const type = isRetain(op) ? 'ret' : 'rem';

          for (let i = 0; i < count; i++) {
            results.push({ type, pos: counter, sourcePos: i, source });
            counter++;
          }
        }
      });

      return results;
    }

    // eslint-disable-next-line max-len
    function removeNonOverlapingRetains(ops1: SingleOperations, ops2: SingleOperations): [SingleOperations, SingleOperations] {
      let i = 0;
      let j = 0;

      const newOps1 = [];
      const newOps2 = [];

      while (i < ops1.length && j < ops2.length) {
        if (ops1[i].type === 'ret' && ops2[j].type === 'ret') {
          newOps1.push(ops1[i]);
          newOps2.push(ops2[j]);

          i++;
          j++;
        } else if ((ops1[i].type === 'ret' && ops2[j].type === 'rem') ||
          (ops1[i].type === 'rem' && ops2[j].type === 'ret') ||
          (ops1[i].type === 'rem' && ops2[j].type === 'rem')) {
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

    function isEqual(op1: SingleOperation, op2: SingleOperation): boolean {
      if (op1.type === 'char' && op2.type === 'char') {
        return op1.char === op2.char && op1.pos === op2.pos;
      } else if (op1.type === 'ret' && op2.type === 'ret') {
        return op1.pos === op2.pos;
      }

      return false;
    }

    // eslint-disable-next-line max-len
    function insertOp(ops: Array<SingleOperation>, newOp: SingleOperation): [Array<SingleOperation>, boolean] {
      let i = 0;
      let found = false;
      const otherSource = newOp.source === 'base' ? 'compared' : 'base';

      for (; i < ops.length; i++) {
        const curOp = ops[i];
        if (newOp.type === 'char') {
          if (curOp.pos === newOp.pos && curOp.type === 'char') {
            for (; i < ops.length; i++) {
              const jOp = ops[i];

              if (newOp.source === insertPriority) {
                if (jOp.type === 'char' && jOp.source === otherSource && jOp.pos === newOp.pos) {
                  break;
                } else if (jOp.type !== 'char' || jOp.pos !== newOp.pos) {
                  break;
                }
              } else if (jOp.type !== 'char' && jOp.pos !== newOp.pos) {
                break;
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
    }

    // eslint-disable-next-line max-len
    function expandOps(ops: SingleOperations, allBaseOps: SingleOperations, retRemCount: number): Array<PrimitiveOperation> {
      const compressedOps = [];
      let count = 0;
      const remLookup = {};
      allBaseOps.forEach((op) => {
        if (op.type === 'rem') {
          remLookup[op.pos] = op;
        }
      });

      ops.forEach((op) => {
        if (count === op.pos && op.type === 'ret') {
          count += 1;
        } else if (count === op.pos && op.type === 'char') {
          // do nothing
        } else if (count < op.pos) {
          let remCount = 0;
          for (let i = count; i < op.pos; i++) {
            if (!remLookup[i]) {
              remCount++;
            }
          }
          if (remCount) {
            compressedOps.push(-remCount);
          }
          count = op.pos + 1;
        }

        if ((op.type === 'char' && op.source === 'base') || op.type === 'ret') {
          if (isRetain(compressedOps[compressedOps.length - 1])) {
            // $FlowIgnore
            const ret = (compressedOps[compressedOps.length - 1]: number);

            compressedOps[compressedOps.length - 1] = ret + 1;
          } else {
            compressedOps.push(1);
          }
        } else if (op.type === 'char' && op.source === 'compared') {
          compressedOps.push(op.char);
        }
      });


      const lastOp = ops[ops.length - 1];
      const lastPos = lastOp.type === 'char' ? lastOp.pos - 1 : lastOp.pos;

      if (lastPos < retRemCount - 1) {
        let remCount = 0;
        // TODO: avoid the N lookup here
        for (let i = lastPos + 1; i < retRemCount; i++) {
          if (!allBaseOps.find(o => o.type === 'rem' && o.pos === i)) {
            remCount++;
          }
        }
        if (remCount) {
          compressedOps.push(-remCount);
        }
      }

      return compressedOps;
    }

    const comparedOpsWithPos = processOps(compared._ops, 'compared');
    const baseOpsWithPos = processOps(base._ops, 'base');

    const retRemFilter = op => op.type === 'ret' || op.type === 'rem';
    const retRemCount = baseOpsWithPos.filter(op => op.type === 'ret' || op.type === 'rem').length;

    if (retRemCount !== comparedOpsWithPos.filter(retRemFilter).length) {
      throw new Error('Unknown operation transform');
    }

    const [comparedOps, baseOps] = removeNonOverlapingRetains(comparedOpsWithPos, baseOpsWithPos);

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

    function logDpOp(i, j, msg, op) {
      const newOp = Object.assign({}, op);

      if (op.distance === Infinity) {
        newOp.distance = 'INF';
      }

      const opPrim = op.type === 'char' ? `'${op.char}'` : '1';
      const opStr = `${op.source[0]}:${op.pos}:${opPrim}`;

      Logger.debug(`[${i},${j}] ${msg}: ${opStr}`);
    }

    for (let ci = 1; ci < comparedOps.length + 1; ci++) {
      for (let bj = 1; bj < baseOps.length + 1; bj++) {
        const baseOp = baseOps[bj - 1];
        const comparedOp = comparedOps[ci - 1];


        // ins - When inserting char baseOps[j] to a str that equals to
        // baseOps[0..j-1] and comparedOps[i] has already factored in from
        // previous calculation
        const ins = deepCopyOp(dp[ci][bj - 1]);
        const [insOps, insFound] = insertOp(ins.ops, baseOp);

        if (!insFound) {
          ins.distance++;
          ins.ops = insOps;
        }

        // rem - When inserting char comparedOps[i] to a previously calculated
        // str that already equals to baseOps[0..j]
        const rem = deepCopyOp(dp[ci - 1][bj]);
        const [remOps, remFound] = insertOp(rem.ops, comparedOp);

        if (!remFound) {
          rem.distance++;
          rem.ops = remOps;
        }

        // sub - When doing a substitute (or retaining) between comaparedOps[i]
        // and baseOps[j] on a str that equals to baseOps[0..j-1] but hasn't
        // factored in comparedOps[i] yet
        const sub = deepCopyOp(dp[ci - 1][bj - 1]);

        if (isEqual(comparedOp, baseOp)) {
          const [subOps, subFound] = insertOp(sub.ops, baseOp);
          sub.ops = subOps;
          if (!subFound) {
            sub.distance++;
          }
        } else {
          const baseResults = insertOp(sub.ops, baseOp);
          const comparedResults = insertOp(baseResults[0], comparedOp);

          if (!baseResults[1]) {
            sub.distance++;
          }

          if (!comparedResults[1]) {
            sub.distance++;
          }

          sub.ops = comparedResults[0];
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

    const optimalOps = dp[comparedOps.length][baseOps.length].ops;


    return new Operation(expandOps(optimalOps, baseOpsWithPos, retRemCount));
  }

  constructor(ops: Array<PrimitiveOperation> = []) {
    this._ops = ops;
  }

  retain(op: number) {
    const lastOp = this._ops[this._ops.length - 1];

    if (isRetain(lastOp)) {
      this._ops[this._ops.length - 1] = lastOp + op;
    } else {
      this._ops.push(op);
    }
  }

  remove(op: number) {
    const lastOp = this._ops[this._ops.length - 1];

    const neg = -Math.abs(op);

    if (isRemove(lastOp)) {
      this._ops[this._ops.length - 1] = lastOp + neg;
    } else {
      this._ops.push(neg);
    }
  }

  insert(op: string) {
    this._ops.push(op);
  }

  compose(op: Operation): Operation {
    Logger.debug(`compose ops: [${this._ops.toString()}], [${op._ops.toString()}]`);
    const ops1 = this._ops.slice();
    const ops2 = op._ops.slice();
    const newOp = new Operation();

    let i = 0;
    let j = 0;

    while (i < ops1.length || j < ops2.length) {
      Logger.debug(`compose (${i}, ${ops1[i]}), (${j}, ${ops2[j]}), [${newOp._ops.toString()}]`);

      if (isRetain(ops1[i]) && isRetain(ops2[j])) {
        // $FlowIgnore
        const p1 = (ops1[i]: number);
        // $FlowIgnore
        const p2 = (ops2[j]: number);

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
        const p2 = (ops2[j]: string);

        newOp.insert(p2);
        j++;
      } else if (isRetain(ops1[i]) && isRemove(ops2[j])) {
        // $FlowIgnore
        const p1 = (ops1[i]: number);
        // $FlowIgnore
        const p2 = (ops2[j]: number);

        if (p1 + p2 >= 0) {
          newOp.remove(p2);
          if (p1 + p2 === 0) {
            i++;
          } else {
            ops1[i] = p1 + p2;
          }
          j++;
        } else {
          newOp.remove(p1 + p2);
          ops2[j] = p1 + p2;
          i++;
        }
      } else if (isRetain(ops1[i])) {
        // $FlowIgnore
        newOp.retain((ops1[i]: number));
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
        const p1 = (ops1[i]: string);
        // $FlowIgnore
        const p2 = (ops2[j]: number);

        if (p2 >= p1.length) {
          newOp.insert(p1);
          i++;

          if (p2 === p1.length) {
            j++;
          } else {
            ops2[j] = p2 - p1.length;
          }
        } else {
          newOp.insert(p1.substring(0, p2 - 1));

          ops1[i] = p1.substring(p2);
          j++;
        }
      } else if (isInsert(ops1[i]) && isRemove(ops2[j])) {
        // $FlowIgnore
        const p1 = (ops1[i]: string);
        // $FlowIgnore
        const p2 = (ops2[j]: number);

        if (p2 + p1.length === 0) {
          i++;
          j++;
        } else if (p2 + p1.length < 0) {
          ops2[j] = p2 + p1.length;
          i++;
          j++;
        } else {
          ops1[i] = p1.substring(Math.abs(p2));
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
        throw new Error(`Unknown operation combinations: ${ops1[i]}, ${ops2[j]}`);
      }
    }

    Logger.debug(`compose newOp: [${newOp._ops.toString()}]`);

    return newOp;
  }
}
