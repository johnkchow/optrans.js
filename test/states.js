/* @flow */

import sinon from 'sinon';
import { expect } from 'chai';
import { WaitingState } from '../src/states';
import LineageOperation from '../src/lineage_operation';
import Operation from '../src/operation';
import type { Document, OpSender } from '../src/client';

let opIdCounter = 0;

/* eslint-disable max-len */
function buildOp({ sourceId, parentId, ops }: { sourceId?: string, parentId?: string, ops: Array<number | string> }): LineageOperation {
/* eslint-enable max-len */
  opIdCounter += 1;
  return new LineageOperation(
    `${opIdCounter}`,
    sourceId,
    parentId,
    new Operation(ops),
  );
}

function expectOp(actual: LineageOperation, ops: Array<number | string>) {
  // $FlowIgnore
  expect(actual.op._ops).to.ordered.members(ops);
}

describe('WaitingState', () => {
  describe('when client makes local change', () => {
    let doc: Document;
    let opSender: OpSender;
    let lastServerOp;
    let state: WaitingState;

    beforeEach(() => {
      opSender = { send: () => {} };
      doc = { apply: () => {}, length: 2 };
      lastServerOp = buildOp({ ops: [2] });
      state = new WaitingState(doc, opSender, lastServerOp);
    });

    it('should forward the client operation to the server', () => {
      const clientOp = buildOp({ ops: [2, 'i'] });
      const mock = sinon.mock(opSender, 'send');
      const spy = mock.expects('send').once();

      state.applyClient(clientOp);

      mock.verify();

      const serverOp: LineageOperation = spy.args[0][0];

      expectOp(serverOp, [2, 'i']);
    });
  });
});
