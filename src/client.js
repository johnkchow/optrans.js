// @flow
import Operation from './operation';

interface State {
  applyClient(op: LineageOperation): State;
  applyServer(op: LineageOperation): State;
}

class Document {
  apply(op: LineageOperation) {
  }

  get length(): number {
    return 0;
  }
}

export interface OpSender {
  send(op: LineageOperation): any;
}

const idPrefix = 'somerandomuuid';
let idCounter = 0;

export function generateId(): string {
  idCounter += 1;
  return `${idPrefix}:${idCounter}`;
}

class LineageOperation {
  /* eslint-disable max-len */
  static transform(op1: LineageOperation, op2: LineageOperation): [LineageOperation, LineageOperation] {
  /* eslint-enable max-len */
    const [op1Prime, op2Prime] = Operation.transform(op1.op, op2.op);

    return [
      new LineageOperation(generateId(), op1.id, op2.id, op1Prime),
      new LineageOperation(generateId(), op2.id, op1.id, op2Prime),
    ];
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
}

class WaitingState implements State {
  // @private
  doc: Document;
  // @private
  opSender: OpSender;
  // @private
  lastServerOp: LineageOperation;

  constructor(doc: Document, opSender: OpSender, lastServerOp: LineageOperation) {
    this.doc = doc;
    this.opSender = opSender;
    this.lastServerOp = lastServerOp;
  }

  applyClient(op: LineageOperation): State {
    this.opSender.send(op);

    /* eslint-disable no-use-before-define */
    return new AwaitingAckState(this.doc, this.opSender, op, this.lastServerOp, op);
    /* eslint-enable no-use-before-define */
  }

  applyServer(op: LineageOperation): State {
    this.doc.apply(op);
    return new WaitingState(this.doc, this.opSender, op);
  }
}

class AwaitingAckState implements State {
  doc: Document;
  opSender: OpSender;
  ackOp: LineageOperation;
  serverBuffer: LineageOperation;
  clientBuffer: LineageOperation;

  constructor(
    doc: Document,
    opSender: OpSender,
    ackOp: LineageOperation,
    serverBuffer: LineageOperation,
    clientBuffer: LineageOperation,
  ) {
    this.doc = doc;
    this.opSender = opSender;
    this.ackOp = ackOp;
    this.serverBuffer = serverBuffer;
    this.clientBuffer = clientBuffer;
  }

  applyClient(op: LineageOperation): State {
    this.clientBuffer = this.clientBuffer.compose(op);
    return this;
  }

  applyServer(op: LineageOperation): State {
    /* eslint-disable max-len */
    /*
     * We check to see if the operation matches the same reference ID of the one we sent to the server. We always assume the server will eventually return
     *
     * IF the ref ID matches,
     *   THEN transform(bridge, serverOp), send bridge' to the server, apply serverOp' to doc, compose(bridge, serverOp'), return WaitingState;
     * ELSE
     *   THEN transform(bridge, serverOp), apply serverOp' to doc, compose(bridge, serverOp'), return this
     */
    /* eslint-enable max-len */
    const [clientPrime, serverPrime] = LineageOperation.transform(this.clientBuffer, op);
    this.doc.apply(serverPrime);

    if (op.sourceId === this.ackOp.sourceId) {
      this.opSender.send(clientPrime);

      return new AwaitingAckState(
        this.doc,
        this.opSender,
        clientPrime,
        op,
        clientPrime,
      );
    }

    return new AwaitingAckState(
      this.doc,
      this.opSender,
      this.ackOp,
      this.serverBuffer.compose(op),
      this.clientBuffer.compose(serverPrime),
    );
  }
}

/*
 * Possible States:
 *  1. Waiting for ack
 */
export default class Client {
  state: State;
  opSender: OpSender;

  constructor(opSender: OpSender, initialState: State) {
    this.opSender = opSender;
    this.state = initialState;
  }

  applyClient(op: LineageOperation) {
    this.state = this.state.applyClient(op);
  }

  applyServer(op: LineageOperation) {
    this.state = this.state.applyClient(op);
  }
}
