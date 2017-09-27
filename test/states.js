/* @flow */

import sinon from 'sinon';
import { WaitingState } from '../src/states';
import LineageOperation from '../src/lineage_operation';
import Operation from '../src/operation';
import type { Document, OpSender } from '../src/client';

let opIdCounter = 0;

function buildOp({ sourceId, parentId, ops }: { sourceId?: string, parentId?: string, ops: Array<number | string> }): LineageOperation {
  opIdCounter += 1;
  return new LineageOperation(
    `${opIdCounter}`,
    sourceId,
    parentId,
    new Operation(ops),
  );
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

    it('should apply the doc', () => {
      const clientOp = buildOp({ ops: [2, 'i'] });
      let mock = sinon.mock(opSender, 'send');
      mock.expects('send').once();

      state.applyClient(clientOp);

      mock.verify();

      debugger;
      console.log(mock.args[0]);
    });
  });
});
