// @flow
import Operation from './operation';

const idPrefix = 'somerandomuuid';
let idCounter = 0;

export function generateId(): string {
  idCounter += 1;
  return `${idPrefix}:${idCounter}`;
}

export default class LineageOperation {
  // eslint-disable-next-line max-len
  static transform(op1: LineageOperation, op2: LineageOperation): [LineageOperation, LineageOperation] {
    const [op1Prime, op2Prime] = Operation.transform(op1.op, op2.op);

    return [
      new LineageOperation(generateId(), op1.id, op2.id, op1Prime),
      new LineageOperation(generateId(), op2.id, op1.id, op2Prime),
    ];
  }

  static transformOneWay(op1: LineageOperation, op2: LineageOperation): LineageOperation {
    const op1Prime = Operation._transformOneWay(op1.op, op2.op, 2);

    return new LineageOperation(generateId(), op1.id, op2.id, op1Prime);
  }

  id: string;
  sourceId: ?string;
  parentId: ?string;
  // @private
  op: Operation

  constructor(id: string, sourceId: ?string, parentId: ?string, op: Operation) {
    this.id = id;
    this.sourceId = sourceId || id;
    this.parentId = parentId;
    this.op = op;
  }

  compose(other: LineageOperation): LineageOperation {
    const composed = this.op.compose(other.op);

    return new LineageOperation(generateId(), this.id, this.parentId, composed);
  }

  toString(): string {
    return JSON.stringify({
      id: this.id,
      ops: this.op._ops,
      sourceId: this.sourceId,
      parentId: this.parentId,
    });
  }
}
