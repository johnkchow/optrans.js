/* @flow */
import LineageOperation from './lineage_operation';
import Logger from './logger';
import type { Document, OpSender } from './client';

function logOp(msg: string, op: LineageOperation) {
  Logger.debug(`${msg} - ${op.toString()}`);
  // Logger.debug(`${msg} - op.id ${op.id}`);
  // Logger.debug(`${msg} - op.sourceId ${op.sourceId || 'none'}`);
  // Logger.debug(`${msg} - op.parentId ${op.parentId || 'none'}`);
  // Logger.debug(`${msg} - op._ops [${op.op._ops.toString()}]`);
}

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
    logOp('WaitingState.applyClient', op);
    this.opSender.send(op);

    // eslint-disable-next-line no-use-before-define
    return new AwaitingAckState(this.doc, this.opSender, op, this.lastServerOp, op);
  }

  applyServer(op: LineageOperation): State {
    logOp('WaitingState.applyServer', op);

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
    logOp('AwaitingAckState.applyClient', op);
    this.clientBuffer = this.clientBuffer.compose(op);
    logOp('AwaitingAckState.serverBuffer', this.serverBuffer);
    logOp('AwaitingAckState.clientBuffer', this.clientBuffer);
    return this;
  }

  applyServer(op: LineageOperation): State {
    Logger.debug('\n');
    logOp('AwaitingAckState.applyServer', op);
    logOp('AwaitingAckState.ackOp', this.ackOp);
    logOp('AwaitingAckState.serverBuffer', this.serverBuffer);
    logOp('AwaitingAckState.clientBuffer', this.clientBuffer);

    Logger.debug('AwaitingAckState - composing op to serverBuffer');
    const newServerBuffer = this.serverBuffer.compose(op);

    // eslint-disable-next-line max-len
    const [clientPrime, serverPrime] = LineageOperation.transform(this.clientBuffer, newServerBuffer);
    Logger.debug(`serverPrime: ${serverPrime.op._ops.toString()}`);
    Logger.debug(`clientPrime: ${clientPrime.op._ops.toString()}`);

    this.doc.apply(serverPrime);

    if (op.id === this.ackOp.id) {
      return new WaitingState(
        this.doc,
        this.opSender,
        op,
      );
    } else if (op.sourceId === this.ackOp.sourceId) {

      const compressedClientPrime = LineageOperation.transformOneWay(clientPrime, this.serverBuffer);
      this.opSender.send(compressedClientPrime);

      return new AwaitingAckState(
        this.doc,
        this.opSender,
        clientPrime,
        op,
        clientPrime,
      );
    }

    Logger.debug('AwaitingAckState - composing serverPrime to clientBuffer');
    return new AwaitingAckState(
      this.doc,
      this.opSender,
      this.ackOp,
      newServerBuffer,
      this.clientBuffer.compose(serverPrime),
    );
  }
}
