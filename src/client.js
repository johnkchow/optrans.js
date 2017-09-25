// @flow
import Operation from './operation';

interface State {
  applyClient(op: Operation): State;
  applyServer(op: Operation): State;
}

class Document {
  apply(op: Operation) {
  }

  get length(): number {
    return 0;
  }
}

export interface OpSender {
  sendOp(op: Operation): any;
}

export class WaitingState implements State {
  // @private
  doc: Document;
  // @private
  opSender: OpSender;

  constructor(doc: Document, opSender: OpSender) {
    this.doc = doc;
    this.opSender = opSender;
  }

  applyClient(op: Operation): State {
    /*
     * We send the operation to the server and return AwaitingAck state
     */
    this.doc.apply(op);
    this.opSender.sendOp(op);
    /* eslint-disable no-use-before-define */
    return new AwaitingAckState(this.doc, this.opSender, op);
    /* eslint-enable no-use-before-define */
  }

  applyServer(op: Operation): State {
    /*
     * We simply apply the operation to the doc and return WaitingState
     */
    this.doc.apply(op);
    return this;
  }
}

class AwaitingAckState implements State {
  doc: Document;
  opSender: OpSender;
  buffer: Operation;
  ackOp: Operation;

  constructor(doc: Document, opSender: OpSender, ackOp: Operation) {
    this.doc = doc;
    this.buffer = new Operation([doc.length]);
    this.opSender = opSender;
    this.ackOp = ackOp;
  }

  applyClient(op: Operation): State {
    this.buffer = this.buffer.compose(op);
    return this;
  }

  applyServer(op: Operation): State {
    /*
     * We check to see if the operation matches the same reference ID of the one we sent to the server.
     *
     * IF the ref ID matches,
     *   THEN transform(bridge, serverOp), send bridge' to the server, apply serverOp' to doc, compose(bridge, serverOp'), return WaitingState;
     * ELSE
     *   THEN transform(bridge, serverOp), apply serverOp' to doc, compose(bridge, serverOp'), return this
     */
    return this;
  }
}

/*
 * Possible States:
 *  1. Waiting for ack
 */
export default class Client {
  state: State;
  opSender: OpSender;

  constructor(doc: Document, opSender: OpSender) {
    this.state = new WaitingState(doc, opSender);
    this.opSender = opSender;
  }

  applyClient(op: Operation) {
    this.state = this.state.applyClient(op);
  }

  applyServer(op: Operation) {
    this.state = this.state.applyClient(op);
  }
}
