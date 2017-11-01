/* @flow */
/* eslint-disable no-plusplus */

import Logger from './logger';

import EditDistance from './edit_distance';

type CompressedOperation = number | string;

function isRetain(op: ?CompressedOperation): boolean {
  return typeof op === 'number' && op >= 0;
}

function isInsert(op: ?CompressedOperation): boolean {
  return typeof op === 'string';
}

function isRemove(op: ?CompressedOperation): boolean {
  return typeof op === 'number' && op < 0;
}

export type CharOperation = { type: 'char', char: string, pos: number, sourcePos: number, source: 'base' | 'compared' | 'both' };

type RetRemOperation = { type: 'ret' | 'rem', pos: number, sourcePos: number, source: 'base' | 'compared' };
type SingleOperation = CharOperation | RetRemOperation;
type SingleOperations = Array<SingleOperation>;


function logDpOp(i, j, msg, op) {
  const newOp = Object.assign({}, op);

  if (op.distance === Infinity) {
    newOp.distance = 'INF';
  }

  const opPrim = op.type === 'char' ? `'${op.char}'` : '1';
  const opStr = `${op.source[0]}:${op.pos}:${opPrim}`;

  Logger.debug(`[${i},${j}] ${msg}: ${opStr}`);
}

function expandOps(ops: Array<CompressedOperation>, source: 'base' | 'compared'): SingleOperations {
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

export default class Operation {
  _ops: Array<CompressedOperation>;

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
  static transform(op1: Operation, op2: Operation): [Operation, Operation] {
    // TODO: rename base/compared to ops1 or 2
    const ops1 = expandOps(op1._ops, 'compared');
    const ops2 = expandOps(op2._ops, 'base');

    Logger.debug(`transform ops args: [${ops1.toString()}], [${ops2.toString()}]`);

    let i = 0;
    let j = 0;

    const ops1Prime = new Operation();
    const ops2Prime = new Operation();

    while (i < ops1.length && j < ops2.length) {
      const o1 = ops1[i];
      const o2 = ops2[j];

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
        let ki;

        for (ki = i; ki < ops1.length; ki++) {
          if (ops1[ki].type !== 'char') { break; }
        }

        // $FlowIgnore
        const subOps1: Array<CharOperation> = ops1.slice(i, ki);

        let kj;

        for (kj = j; kj < ops2.length; kj++) {
          if (ops2[kj].type !== 'char') { break; }
        }

        // $FlowIgnore
        const subOps2: Array<CharOperation> = ops2.slice(j, kj);

        const combinedOps = EditDistance(subOps1, subOps2, 'base');

        combinedOps.forEach((op) => {
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
            throw new Error(`Unexpected source: ${op.source}`);
          }
        });

        i = ki;
        j = kj;
      } else {
        Logger.debug('Error dump');
        logDpOp(i, j, 'o1', o1);
        logDpOp(i, j, 'o2', o2);
        throw new Error('Unknown error');
      }
    }

    while (i < ops1.length) {
      const o1 = ops1[i];

      if (o1.type === 'char') {
        ops1Prime.insert(o1.char);
        ops2Prime.retain(1);
      } else {
        throw new Error('Assertion failed: there should be no more retains/removes');
      }

      i++;
    }

    while (j < ops2.length) {
      const o2 = ops2[j];

      if (o2.type === 'char') {
        ops1Prime.retain(1);
        ops2Prime.insert(o2.char);
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

  constructor(ops: Array<CompressedOperation> = []) {
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
