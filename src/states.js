/* @flow */
import LineageOperation from './lineage_operation';
import type { Document, OpSender } from './client';

export interface State {
  applyClient(op: LineageOperation): State;
  applyServer(op: LineageOperation): State;
}

export class WaitingState implements State {
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

export class AwaitingAckState implements State {
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

