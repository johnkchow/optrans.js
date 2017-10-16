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


type CondensedOperation = { type: 'char', char: string, pos: number } | { type: 'rem' | 'ret', pos: number };
type CondensedOperations = Array<CondensedOperation>;

function processOps(ops: Array<PrimitiveOperation>): CondensedOperations {
  const results = [];

  let counter = 0;

  ops.forEach((op) => {
    if (isInsert(op)) {
      // $FlowIgnore
      const str: string = op;
      for (let i = 0; i < str.length; i++) {
        results.push({ type: 'char', char: str[i], pos: counter});
      }

    } else {
      // $FlowIgnore
      const count: number = Math.abs(op);
      const type = isRetain(op) ? 'ret' : 'rem';

      for (let i = 0; i < count; i++) {
        results.push({ type: type, pos: counter });
        counter++;
      }
    }
  });

  return results;
}

function removeNonOverlapingRetains(ops1: CondensedOperations, ops2: CondensedOperations): [CondensedOperations, CondensedOperations] {
  let i = 0;
  let j = 0;

  let newOps1 = [];
  let newOps2 = [];

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
    return [Operation._transformOneWay(op1, op2, 2), Operation._transformOneWay(op2, op1, 1)];
  }

  /*
   * Returns compared' which will then could be applied to base
   */
  static _transformOneWay(compared: Operation, base: Operation, insertPriority: 1 | 2): Operation {
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

    // First, include all the removes in processOps
    // Then strip out retains from each other where there are already removes; also strip out removes
    // Then continue DP like we normally do
    // Then in expand, we take in the the original processedOps, optimalOps
    let comparedOpsWithPos = processOps(compared._ops);
    let baseOpsWithPos = processOps(base._ops);

    const [comparedOps, baseOps] = removeNonOverlapingRetains(comparedOpsWithPos, baseOpsWithPos);

    const retRemCount = baseOpsWithPos.filter(op => op.type === 'ret' || op.type === 'rem').length

    const dp : DPArray = Array(comparedOps.length + 1);

    dp[0] = new Array(baseOps.length + 1);
    dp[0][0] = { distance: 0, ops: [] };

    let counter = 0;

    for (let i = 1; i < comparedOps.length + 1; i++) {
      dp[i] = Array(baseOps.length + 1);

      const ops = dp[i - 1][0].ops.slice();

      const comparedOp = comparedOps[i - 1];

      const pos = comparedOp.pos;

      for (; counter < pos; counter++) {
        ops.push(-1);
      }

      counter = pos;

      if (comparedOp.type === 'char') {
        ops.push(comparedOp.char);
      } else {
        ops.push(-1);
      }

      if (i === comparedOps.length) {
        for (; counter < retRemCount; counter++) {
          ops.push(-1);
        }
      }

      dp[i][0] = { distance: i, ops };

      logDpOp(i, 0, 'init', dp[i][0]);
    }

    counter = 0;

    for (let j = 1; j < baseOps.length + 1; j++) {
      const ops = dp[0][j - 1].ops.slice();

      const baseOp = baseOps[j - 1];

      const pos = baseOp.pos;

      for (; counter < pos; counter++) {
        ops.push(-1);
      }

      counter = pos;

      if (baseOp.type === 'char') {
        ops.push(1);
      } else {
        ops.push(-1);
      }

      if (j === baseOps.length) {
        for (; counter < retRemCount; counter++) {
          ops.push(-1);
        }
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
        const lastBaseOp: ?CondensedOperation = baseOps[bj - 2];
        const lastComparedOp: ?CondensedOperation = comparedOps[ci - 2];

        let counter = 0;

        // ins - When inserting char baseOps[j] to a str that equals to
        // baseOps[0..j-1] and comparedOps[i] has already factored in from
        // previous calculation
        const ins = deepCopyOp(dp[ci][bj - 1]);
        ins.distance++;

        if (bj - 2 < 0) {
          counter = 0;
        } else {
          counter = baseOps[bj - 2].pos;
        }

        while (counter < baseOp.pos) {
          ins.ops.push(-1);
          counter++;
        }

        ins.ops.push(1);

        if (bj === baseOps.length) {
          while (counter < retRemCount) {
            ins.ops.push(-1);
            counter++;
          }
        }

        // rem - When removing char comparedOps[i] to a previously calculated
        // str that already equals to baseOps[0..j]
        const rem = deepCopyOp(dp[ci - 1][bj]);
        rem.distance++;

        if (ci - 2 < 0) {
          counter = 0;
        } else {
          counter = comparedOps[ci - 2].pos;
        }

        while (counter < comparedOp.pos) {
          ins.ops.push(-1);
          counter++;
        }

        // TODO: we must insert in order...
        if (comparedOp.type === 'char') {
          rem.ops.push(comparedOp.char);
        } else {
          rem.distance = Infinity;
          rem.ops.push(-1);
        }

        // sub - When doing a substitute (or retaining) between comparedOps[i]
        // and baseOps[j] on a str that equals to baseOps[0..j-1] but hasn't
        // factored in comparedOps[i] yet
        const sub = deepCopyOp(dp[ci - 1][bj - 1]);
        let firstOp;
        let secondOp;
        function sortByPos(op1: CondensedOperation, op2: CondensedOperation): [CondensedOperation, CondensedOperation] {
          if (op1.pos < op2.pos) {
            return [op1, op2];
          } else {
            return [op2, op1];
          }
        }

        if (baseOp.type === 'ins' && comparedOp.type === 'ins') {
          if (baseOp.pos === comparedOp.pos) {
            if (insertPriority === 2) {
              firstOp = baseOp;
              secondOp = comparedOp;
            } else {
              firstOp = comparedOp;
              secondOp = baseOp;
            }
          } else {
            [firstOp, secondOp] = sortByPos(comparedOp, baseOp);
          }
        } else if (baseOp.type === 'ins' || comparedOp.type === 'ins') {
          const insOp = baseOp.type === 'ins' ? baseOp : comparedOp;
          const retOp = baseOp.type === 'ins' ? comparedOp : baseOp;

          if (insOp.pos === retOp.pos) {
            firstOp = insOp;
            secondOp = retOp;
          } else {
            [firstOp, secondOp] = sortByPos(insOp, retOp);
          }
        } else {
          [firstOp, secondOp] = sortByPos(comparedOp, baseOp);
        }


        if (isEqual(comparedOp, baseOp)) {
          sub.ops.push(1);
        } else {
          sub.distance += 2;

          // first, check to see if they're both inserts.
          // if so, then if their insert pos is the same, then apply the insert priority rule
          //        else if their insert pos is diff, then insert whichever pos came first
          //
          // else if they're both retains (but implicitly they're diff pos) then just push(1) twice
          //
          // else if one's an insert and one's a retain
          //  then if the pos is the same, then insert first and retain last
          //  else do the insert/retain in order of pos
          //
          // regardless of choices above, we first must push removes up til both ops


          let firstPos;
          let secondPos;

          if (lastBaseOp && lastComparedOp) {
            if (lastBaseOp.pos < lastComparedOp.pos) {
              firstPos = lastBaseOp.pos;
              secondPos = lastComparedOp.pos;
            } else {
              firstPos = lastComparedOp.pos;
              secondPos = lastBaseOp.pos;
            }
          } else if (lastBaseOp) {
            firstPos = 0;
            secondPos = lastBaseOp.pos;
          } else if (lastComparedOp) {
            firstPos = 0;
            secondPos = lastComparedOp.pos;
          } else {
            firstPos = 0;
            secondPos = 0;
          }

          for (let i = firstPos; i < firstOp.pos; i++) {
            sub.ops.push(-1);
          }

          if (firstOp.type === 'char') {
            sub.ops.push(firstOp.char);
          } else {
            sub.ops.push(1);
          }

          for (let i = secondPos; i < secondOp.pos; i++) {
            sub.ops.push(-1);
          }

          if (secondOp.type === 'char') {
            sub.ops.push(secondOp.char);
          } else {
            sub.ops.push(1);
          }
        }

        if (bj === baseOps.length) {
          for (let i = secondOp.type === 'ins' ? secondOp.pos : secondOp.pos + 1; i < retRemCount; i++) {
            sub.ops.push(-1);
          }
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

    function expandOps(comparedOps: CondensedOperations, baseOps: CondensedOperations, optimalOps: Array<PrimitiveOperation>): Array<PrimitiveOperation> {
      const results = [];

      let b = 0;
      let c = 0;
      let o = 0;

      debugger

      while (c < comparedOps.length || b < baseOps.length) {
        const bop : ?CondensedOperation = baseOps[b];
        const cop : ?CondensedOperation = comparedOps[c];
        const oo : ?PrimitiveOperation = optimalOps[o];

        if (bop) {
          if (cop) {
            if (bop.type === 'rem' && cop.type === 'rem') {
              b++;
              c++;
            } else if (bop.type === 'ret' && cop.type === 'rem') {
              results.push(-1);
              b++;
              c++;
            } else if (isRetain(oo) &&
              ((bop.type === 'ret' && cop.type === 'ret') ||
               (bop.type === 'ins' && cop.type === 'ins'))) {
              results.push(1);
              b++;
              c++;
              o++;
            } else if (oo && isInsert(oo) && cop.type === 'ins') {
              // $FlowIgnore
              results.push(oo);
              c++;
              o++;
            } else if (isRemove(oo) && bop.type === 'ret' && cop.type === 'ret') {
              results.push(-1);
              b++;
              c++;
              o++;
            } else if (isRemove(oo) && bop.type === 'ins') {
              results.push(-1);
              b++;
              o++;
            }
          } else if (bop.type === 'rem') {
            results.push(-1);
            b++;
          } else if (isRetain(oo)) {
            results.push(1);
            b++;
            o++;
          } else {
            throw new Error('Assertion error: there\'s an unknown set of operations');
          }
        } else if (cop) {
        }

        if (bop && cop && bop.type === 'rem' && cop.type === 'rem') {
          b++;
          c++;
        } else if (bop && cop && bop.type === 'rem' && cop.type === 'ret') {
          b++;
          c++;
        } else if (bop && cop && bop.type === 'ret' && cop.type === 'rem') {
          results.push(-1);
          b++;
          c++;
        } else if (oo && isInsert(oo)) {
          if (!cop || cop.type !== 'char') {
            throw new Error('Assertion error: expected cop to be insert as well');
          }
          results.push(oo);
          o++;
          c++;
        } else if (isRemove(oo)) {
          if (!bop || bop.type !== 'rem') {
            throw new Error('Assertion error: expected bop to be remove as well');
          }
          results.push(-1);
          o++;
          b++;
          c++;
        } else if (bop && bop.type === 'char') {
          if (!isRetain(oo)) {
            throw new Error('Assertion error: expected oo to be retain as well');
          }
          results.push(1);
          o++;
          b++;
        } else {
          results.push(1);
          o++;
          b++;
          c++;
        }
      }

      while (o < optimalOps.length) {
        if (isInsert(optimalOps[o])) {
          results.push(optimalOps[o]);
        } else {
          debugger
          throw new Error('Assertion error: ops cannot contain anymore retains/removes');
        }
        o++;
      }

      return compressOps(results);
    }

    optimalOps = compressOps(optimalOps);

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
