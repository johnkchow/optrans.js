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


type CondensedOperation = { type: 'char', char: string, pos: number, sourcePos: number, source: 'base' | 'compared' } | { type: 'ret' | 'rem', pos: number, sourcePos: number, source: 'base' | 'compared' };
type CondensedOperations = Array<CondensedOperation>;

function processOps(ops: Array<PrimitiveOperation>, source: 'base' | 'compared' ): CondensedOperations {
  const results = [];

  let counter = 0;

  ops.forEach((op, i) => {
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
        results.push({ type: type, pos: counter, sourcePos: i, source });
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

type DPArray = Array<Array<{ distance: number, ops: Array<CondensedOperation> }>>;

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
    let comparedOpsWithPos = processOps(compared._ops, 'compared');
    let baseOpsWithPos = processOps(base._ops, 'base');

    const [comparedOps, baseOps] = removeNonOverlapingRetains(comparedOpsWithPos, baseOpsWithPos);

    const retRemCount = baseOpsWithPos.filter(op => op.type === 'ret' || op.type === 'rem').length

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
      const opStr = `${op.source[0]}:${op.pos}:${opPrim}`

      Logger.debug(`[${i},${j}] ${msg}: ${opStr}`);
    }

    function logDpOpOp(i, j, msg, op: { distance: number, ops: CondensedOperations }) {
      const newOp = Object.assign({}, op);

      if (op.distance === Infinity) {
        newOp.distance = 'INF';
      }

      newOp.ops = op.ops.map((o) => {
        const opStr = o.type === 'char' ? `'${o.char}'` : '1';
        return `${o.source[0]}:${o.pos}:${opStr}`
      });

      Logger.debug(`[${i},${j}] ${msg}: dis:${newOp.distance}, ops: [${newOp.ops.join(' ')}]`);
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
    for (let ci = 1; ci < comparedOps.length + 1; ci++) {
      for (let bj = 1; bj < baseOps.length + 1; bj++) {
        const baseOp = baseOps[bj - 1];
        const comparedOp = comparedOps[ci - 1];

        // TODO: optimize this N lookup. otherwise, our algorithm will run O(max(n*m^2, n^2*m))
        function insertOp(ops: Array<CondensedOperation>, newOp: CondensedOperation, insertPriority: 'base' | 'compared'): [Array<CondensedOperation>, boolean] {
          let i = 0;
          let found = false;
          const otherSource = newOp.source === 'base' ? 'compared' : 'base';

          for (; i < ops.length; i++) {
            const curOp = ops[i];
            if (newOp.type === 'char') {
              if (curOp.pos === newOp.pos && curOp.type === 'char') {
                let insIdx;

                for (; i < ops.length; i++) {
                  const jOp = ops[i];

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
        }

        // ins - When inserting char baseOps[j] to a str that equals to
        // baseOps[0..j-1] and comparedOps[i] has already factored in from
        // previous calculation
        const ins = deepCopyOp(dp[ci][bj - 1]);
        const [ insOps, insFound ] = insertOp(ins.ops, baseOp, insertPriority === 2 ? 'base' : 'compared');

        if (!insFound) {
          ins.distance++;
          ins.ops = insOps;
        }

        if (ci === 4 && bj === 3) {
          debugger;
        }

        // rem - When removing char comparedOps[i] to a previously calculated
        // str that already equals to baseOps[0..j]
        const rem = deepCopyOp(dp[ci - 1][bj]);
        const [ remOps, remFound ] = insertOp(rem.ops, comparedOp, insertPriority === 2 ? 'base' : 'compared');

        if (!remFound) {
          rem.distance++;
          rem.ops = remOps;
        }

        // sub - When doing a substitute (or retaining) between comaparedOps[i]
        // and baseOps[j] on a str that equals to baseOps[0..j-1] but hasn't
        // factored in comparedOps[i] yet
        const sub = deepCopyOp(dp[ci - 1][bj - 1]);

        if (isEqual(comparedOp, baseOp)) {
          const [ subOps, subFound ] = insertOp(sub.ops, baseOp, insertPriority === 2 ? 'base' : 'compared');
          sub.ops = subOps;
          if (!subFound) {
            sub.distance++;
          }
        } else {
          const baseResults = insertOp(sub.ops, baseOp, insertPriority === 2 ? 'base' : 'compared');
          const comparedResults = insertOp(baseResults[0], comparedOp, insertPriority === 2 ? 'base' : 'compared');

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

        if (dp[ci][bj].distance === 0) {
          //debugger;
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

    let optimalOps = dp[comparedOps.length][baseOps.length].ops;

    function newExpandOps(ops: CondensedOperations, allBaseOps: CondensedOperations, retRemCount: number): Array<PrimitiveOperation> {
      const compressedOps = [];
      let count = 0;

      ops.forEach((op) => {
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
        } else if (count < op.pos)  {
          let remCount = 0;
          // TODO: avoid the N lookup here
          for (let i = count; i < op.pos; i++) {
            if (!allBaseOps.find(o => o.type === 'rem' && o.pos === i)) {
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
            const ret = (compressedOps[compressedOps.length - 1] : number);

            compressedOps[compressedOps.length - 1] = ret + 1;
          } else {
            compressedOps.push(1);
          }
        } else if (op.type === 'char' && op.source === 'compared')  {
          compressedOps.push(op.char);
        }
      });


      let lastOp = ops[ops.length - 1];
      let lastPos = lastOp.type === 'char' ? lastOp.pos - 1 : lastOp.pos;

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
