/* @flow */
import LineageOperation from './lineage_operation';
import type { State } from './states';

export interface Document {
  apply(op: LineageOperation): any;
  +length: number;
}

export class ConcreteDocument implements Document {
  apply(op: LineageOperation) {
  }

  get length(): number {
    return 0;
  }
}

export interface OpSender {
  send(op: LineageOperation): any;
}

/*
 * Possible States:
 *  1. Waiting for ack
 */
export default class Client {
  state: State;

  constructor(initialState: State) {
    this.state = initialState;
  }

  applyClient(op: LineageOperation) {
    this.state = this.state.applyClient(op);
  }

  applyServer(op: LineageOperation) {
    this.state = this.state.applyClient(op);
  }
}
