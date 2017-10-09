/* @flow */
/* eslint-disable no-plusplus */

import Logger from './logger';

type PrimitiveOperation = number | string;

function isRetain(op: PrimitiveOperation): boolean {
  return typeof op === 'number' && op >= 0;
}

function isInsert(op: PrimitiveOperation): boolean {
  return typeof op === 'string';
}

function isRemove(op: PrimitiveOperation): boolean {
  return typeof op === 'number' && op < 0;
}


type CondensedOperation = { type: 'char', char: string } | { type: 'ret', pos: number };
type CondensedOperations = Array<CondensedOperation>;

function processOps(ops: Array<PrimitiveOperation>): [CondensedOperations, number] {
  const results = [];

  let counter = 0;

  ops.forEach((op) => {
    if (isInsert(op)) {
      // $FlowIgnore
      const str: string = op;
      for (let i = 0; i < str.length; i++) {
        results.push({ type: 'char', char: str[i] });
      }

    } else if (isRemove(op)) {
      // $FlowIgnore
      counter += Math.abs(op);
    } else {
      // $FlowIgnore
      const count: number = Math.abs(op);

      for (let i = 0; i < count; i++) {
        results.push({ type: 'ret', pos: counter });
        counter++;
      }
    }
  });

  return [results, counter];
}

function removeNonOverlapingRetains(ops1: CondensedOperations, ops2: CondensedOperations): [CondensedOperations, CondensedOperations] {
  let i = 0;
  let j = 0;

  let newOps1 = [];
  let newOps2 = [];

  while (i < ops1.length && j < ops2.length) {
    if (ops1[i].type === 'ret' && ops2[j].type === 'ret') {
      if (ops1[i].pos === ops2[j].pos) {
        newOps1.push(ops1[i]);
        i++;

        newOps2.push(ops2[j]);
        j++;
      } else if (ops1[i].pos > ops2[j].pos) {
        j++;
      } else {
        i++;
      }
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

type DPArray = Array<Array<{ distance: number, ops: Array<PrimitiveOperation> }>>;

export default class Operation {
  _ops: Array<PrimitiveOperation>;

  static transform(op1: Operation, op2: Operation): [Operation, Operation] {
    const ops1 = op1._ops;
    const ops2 = op2._ops;

    Logger.debug(`transform ops args: [${ops1.toString()}], [${ops2.toString()}]`);
    return [Operation._newTransformOneWay(op1, op2), Operation._newTransformOneWay(op2, op1)];
  }

  /*
   * Returns compared' which will then could be applied to base
   */
  static _newTransformOneWay(compared: Operation, base: Operation): Operation {
    function deepCopyOp(op) {
      return {
        distance: op.distance,
        ops: op.ops.slice(),
      };
    }

    function isEqual(op1: CondensedOperation, op2: CondensedOperation): boolean {
      if (op1.type === 'char' && op2.type === 'char') {
        return op1.char === op2.char;
      } else if (op1.type === 'ret' && op2.type === 'ret') {
        return op1.pos === op2.pos;
      }

      return false;
    }

    let [comparedOps, retRemCount] = processOps(compared._ops);
    let [baseOps, _] = processOps(base._ops);

    [comparedOps, baseOps] = removeNonOverlapingRetains(comparedOps, baseOps);

    const dp : DPArray = Array(comparedOps.length + 1);

    dp[0] = new Array(baseOps.length + 1);
    dp[0][0] = { distance: 0, ops: [] };

    for (let i = 1; i < comparedOps.length + 1; i++) {
      dp[i] = Array(baseOps.length + 1);

      const ops = dp[i - 1][0].ops.slice();

      const comparedOp = comparedOps[i - 1];

      if (comparedOp.type === 'char') {
        ops.push(comparedOp.char);
      } else {
        ops.push(-1);
      }

      dp[i][0] = { distance: i, ops };

      logDpOp(i, 0, 'init', dp[i][0]);
    }

    for (let j = 1; j < baseOps.length + 1; j++) {
      const ops = dp[0][j - 1].ops.slice();

      const baseOp = baseOps[j - 1];

      if (baseOp.type === 'char') {
        ops.push(1);
      } else {
        ops.push(-1);
      }

      dp[0][j] = { distance: j, ops };

      logDpOp(0, j, 'init', dp[0][j]);
    }

    function logDpOp(i, j, msg, op) {
      const newOp = Object.assign({}, op);

      if (op.distance === Infinity) {
        newOp.distance = 'INF';
      }

      Logger.debug(`[${i},${j}] ${msg}: ${JSON.stringify(newOp)}`);
    }

    for (let ci = 1; ci < comparedOps.length + 1; ci++) {
      for (let bj = 1; bj < baseOps.length + 1; bj++) {
        const baseOp = baseOps[bj - 1];
        const comparedOp = comparedOps[ci - 1];

        // ins - When inserting char baseOps[j] to a str that equals to
        // baseOps[0..j-1] and comparedOps[i] has already factored in from
        // previous calculation
        const ins = deepCopyOp(dp[ci][bj - 1]);
        ins.distance++;
        ins.ops.push(1);


        // rem - When removing char comparedOps[i] to a previously calculated
        // str that already equals to baseOps[0..j]
        const rem = deepCopyOp(dp[ci - 1][bj]);
        rem.distance++;
        let index = 0;
        for (let counter = 0; index < rem.ops.length; index++) {
          if (isInsert(rem.ops[index]) || isRemove(rem.ops[index])) {
            counter++;
          }

          if (counter === (ci - 1)) {
            break;
          }
        }

        if (comparedOp.type === 'char') {
          rem.ops.splice(index + 1, 0, comparedOp.char);
        } else {
          rem.ops.splice(index + 1, 0, -1);
        }

        // sub - When doing a substitute (or retaining) between comaparedOps[i]
        // and baseOps[j] on a str that equals to baseOps[0..j-1] but hasn't
        // factored in comparedOps[i] yet
        const sub = deepCopyOp(dp[ci - 1][bj - 1]);

        if (isEqual(comparedOp, baseOp)) {
          sub.ops.push(1);
        } else {
          sub.ops.push(1);

          if (comparedOp.type === 'char') {
            sub.ops.push(comparedOp.char);
          } else {
            sub.ops.push(1);
          }

          sub.distance += 2;
        }

        const sortedOps = [ins, rem, sub].sort((x, y) => x.distance - y.distance);

        if (sortedOps[0].distance === sub.distance) {
          dp[ci][bj] = sub;
        } else {
          dp[ci][bj] = sortedOps[0];
        }

        logDpOp(ci, bj, 'ins', ins);
        logDpOp(ci, bj, 'rem', rem);
        logDpOp(ci, bj, 'sub', sub);
        logDpOp(ci, bj, 'min', dp[ci][bj]);

        Logger.debug('');
      }
    }

    let optimalOps = dp[comparedOps.length][baseOps.length].ops;

    function compressOps(ops) {
      const compressedOps = [];
      let count = 0;

      ops.forEach((op) => {
        if (isInsert(op)) {
          if (count !== 0) {
            compressedOps.push(count);
          }
          count = 0;

          compressedOps.push(op);
        } else  {
          if ((isRetain(op) && (count === 0 || isRetain(count))) || (isRemove(op) && (count === 0 || isRemove(count)))) {
            count += op;
          } else {
            if (count !== 0) {
              compressedOps.push(count);
            }
            count = op;
          }
        }
      });


      if (count !== 0) {
        compressedOps.push(count);
      }

      return compressedOps;
    }

    function expandOps(baseOps: CondensedOperations, optimalOps: Array<PrimitiveOperation>, retRemCount: number): Array<PrimitiveOperation>{
      const results = [];
      let i = 0;
      let j = 0;

      while (i < baseOps.length && j < optimalOps.length) {
        if (isInsert(optimalOps[j])) {
        }
      }

      // assert that both i and j have reached end of their respective arrays;
      // otherwise it indicates we have a logic error above.

      return compressOps(results);
    }

    optimalOps = expandOps(baseOps, optimalOps, retRemCount);


    return new Operation(optimalOps);
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
