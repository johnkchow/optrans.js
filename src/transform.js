// @flow

const posOnlyOpTypes = {
  remove: 'remove',
  retain: 'retain',
};

const insertOpType = {
  insert: 'insert',
};


type PosOnlyOperationType = $Keys<typeof posOnlyOpTypes>;
type PosOnlyOperation = { type: PosOnlyOperationType, pos: number, num: number };

type InsertOperationType = $Keys<typeof insertOpType>;
type InsertOperation = { type: InsertOperationType, pos: number, chars: string };

export type SingleOperation = PosOnlyOperation | InsertOperation;
export type TransformTuple = [SingleOperation, SingleOperation];

export const opTypes = { ...posOnlyOpTypes, ...insertOpType };

export function transform(op1: SingleOperation, op2: SingleOperation): TransformTuple {
  if (op1.type === opTypes.insert && op2.type === opTypes.insert) {
    return [
      { ...op1, pos: op1.pos - op2.chars.length },
      { ...op2, pos: op2.pos + op1.chars.length },
    ];
  } else if (op1.type === opTypes.insert && op2.type === opTypes.remove) {
    if (op1.pos <= op2.pos) {
      const shiftPos = op1.chars.length;

      return [
        { ...op1 },
        { ...op2, pos: op2.pos + shiftPos },
      ];
    }

    return [
      { ...op1, pos: op1.pos - op2.num },
      { ...op2, pos: op2.pos + op1.chars.length },
    ];
  } else if (op1.type === opTypes.remove && op2.type === opTypes.insert) {
    // $FlowFixMe: Errors out due to flow thinking tuples don't have access to reverse()
    return transform(op2, op1).reverse();
  } else if (op1.type === opTypes.remove && op2.type === opTypes.remove) {
    if (op1.pos < op2.pos) {
      return [
        { ...op1 },
        { ...op2, pos: op2.pos - op1.num },
      ];
    } else if (op1.pos > op2.pos) {
      return [
        { ...op1, pos: op1.pos - op2.num },
        { ...op2 },
      ];
    }

    return [op1, op2];
  }

  return [op1, op2];
}
