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

export default class Operation {
  _ops: Array<PrimitiveOperation>;

  static transform(op1: Operation, op2: Operation): [Operation, Operation] {
    // return [Operation._transformOneWay(op1, op2), Operation._transformOneWay(op2, op1)];
    return [Operation._transformOneWay(op1, op2), op2];
  }

  /*
   * Returns op1', meaning op2.compose(op1').apply(docStr) equals
   * op1.compose(op2').apply(docStr);
   */
  static _transformOneWay(op1: Operation, op2: Operation): Operation {
    const newOp = new Operation();

    const ops1 = op1._ops.slice();
    const ops2 = op2._ops.slice();

    let i = 0;
    let j = 0;

    while (i < ops1.length || j < ops2.length) {
      Logger.debug(`transform (${i}, ${ops1[i]}), (${j}, ${ops2[j]}), [${newOp._ops.toString()}]`);

      if (isInsert(ops1[i])) {
        // $FlowIgnore
        newOp.insert(ops1[i]);
        i++;
      } else if (isInsert(ops2[j])) {
        // $FlowIgnore
        newOp.retain(ops2[j].length);
        j++;
      } else if (isRetain(ops1[i]) && isRetain(ops2[j])) {
        // $FlowIgnore
        const p1 = (ops1[i]: number);
        // $FlowIgnore
        const p2 = (ops2[j]: number);

        if (p1 === p2) {
          newOp.retain(p1);
          i++;
          j++;
        } else if (p1 > p2) {
          throw new Error('WIP');
        } else if (p1 < p2) {
          throw new Error('WIP');
        }
      } else if (isRetain(ops1[i]) && isRemove(ops2[j])) {
        // $FlowIgnore
        const p1 = (ops1[i]: number);
        // $FlowIgnore
        const p2 = (ops2[j]: number);

        if (p1 + p2 === 0) {
          i++;
          j++;
        } else if (p1 + p2 > 0) {
          ops1[i] = p1 + p2;
          j++;
        } else {
          ops2[j] = p1 + p2;
          i++;
        }
      // isRetain(ops1[i]) and (isInsertOrNothing)
      } else if (isRetain(ops1[i])) {
        // $FlowIgnore
        newOps.retain(ops1[i]);
        i++;
      } else if (isRemove(ops1[i]) && isRetain(ops2[j])) {
        // $FlowIgnore
        const p1 = (ops1[i]: number);
        // $FlowIgnore
        const p2 = (ops2[j]: number);

        if (p1 + p2 === 0) {
          newOp.remove(p1);
          i++;
          j++;
        } else if (p1 + p2 > 0) {
          newOp.remove(p1);
          ops2[j] = p1 + p2;
          j++;
        } else {
          newOp.remove(p2);
          ops1[i] = p1 + p2;
          i++;
        }
      } else if (isRemove(ops1[i]) && isRemove(ops2[j])) {
        // $FlowIgnore
        const p1 = (ops1[i]: number);
        // $FlowIgnore
        const p2 = (ops2[j]: number);

        if (p1 === p2) {
          newOp.remove(p1);
          i++;
          j++;
        } else if (Math.abs(p1) > Math.abs(p2)) {
          newOp.remove(p2);
          ops1[i] = p1 - p2;
          j++;
        } else {
          newOp.remove(p1);
          ops2[j] = p2 - p1;
          j++;
        }
      } else if (typeof ops1[i] === 'undefined' && isRemove(ops2[j])) {
        j++;
      } else {
        throw new Error('Unknown Error');
      }
    }

    return newOp;
  }

  constructor(ops: Array<PrimitiveOperation> = []) {
    this._ops = ops;
  }

  retain(op: number) {
    if (op > 0) {
      this._ops.push(op);
    }
  }

  remove(op: number) {
    this._ops.push(-Math.abs(op));
  }

  insert(op: string) {
    this._ops.push(op);
  }

  compose(op: Operation): Operation {
    const ops1 = this._ops.slice();
    const ops2 = op._ops.slice();
    const newOp = new Operation();

    let i = 0;
    let j = 0;

    while (i < ops1.length || j < ops2.length) {
      Logger.debug(`(${i}, ${ops1[i]}), (${j}, ${ops2[j]}), [${newOp._ops.toString()}]`);

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
          ops1[i] = p1 + p2;
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
      } else if (isInsert(ops1[i]) && isRetain(ops2[j])) {
        // $FlowIgnore
        const p1 = (ops1[i]: string);
        // $FlowIgnore
        const p2 = (ops2[j]: number);

        if (p2 >= p1.length) {
          newOp.insert(p1);
          i++;

          if (p2 - p1.length) {
            ops2[j] = p2 - p1.length;
          } else {
            j++;
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
        throw new Error(`Unknown operation combinations: ${ops1[i]}, ${ops2[j]}`);
      }
    }

    return newOp;
  }
}
