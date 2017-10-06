/* @flow */

import sinon from 'sinon';
import { expect } from 'chai';
import { WaitingState } from '../src/states';
import LineageOperation from '../src/lineage_operation';
import Operation from '../src/operation';
import type { Document, OpSender } from '../src/client';

let opIdCounter = 0;

type RawOps = Array<number | string>;

/* eslint-disable max-len */
function buildOp(ops: RawOps, parentId: string, { id, sourceId }: { id?: string, sourceId?: string } = {}): LineageOperation {
/* eslint-enable max-len */
  let opId = id;

  if (!opId) {
    opIdCounter += 1;
    opId = `${opIdCounter}`;
  }

  return new LineageOperation(
    opId,
    sourceId || opId,
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
      lastServerOp = buildOp([2], '1');
      state = new WaitingState(doc, opSender, lastServerOp);
    });

    it('should forward the client operation to the server', () => {
      const clientOp = buildOp([2, 'i'], '1');
      const mock = sinon.mock(opSender, 'send');
      const spy = mock.expects('send').once();

      state.applyClient(clientOp);

      mock.verify();

      const serverOp: LineageOperation = spy.args[0][0];

      expectOp(serverOp, [2, 'i']);
    });
  });

  describe('when complex set of operations occur', () => {
    let doc: Document;
    let opSender: OpSender;
    let lastServerOp;
    let state: WaitingState;

    beforeEach(() => {
      opSender = { send: () => {} };
      doc = { apply: () => {}, length: 2 };
      lastServerOp = buildOp([2], '1');
      state = new WaitingState(doc, opSender, lastServerOp);
    });

    it('should forward the right series of ops to server', () => {
      /*
       * Current ID: 1s, 12
       *
       *
       * c 2c, 1s [2,'i'] => 12i (sent)
       * c 3c, 2c [2, -1] => 12 clientBuffer: [2]
       * c 4c, 3c [2,'j'] => 12j, clientBuffer: [2, 'j']
       * c 5c, 4c [-2,1] => j, clientBuffer: [-2, 'j']
       *
       * s 2s, 1s [2,'a'] => 12a, serverBuffer: [2, 'a'], clientBuffer: [-2, 1, 'j'], [-2, 'a', 'j']
       * s 3s, 2s [-1,2] => 2a, serverBuffer: [-1,1,'a'], clientBuffer: [-1, 1, 'j'], [-1, 'a', 'j']
       * s 4s, 3s [1,'b',1] => 2ba, serverBuffer: [-1,1,'b','a'], clientBuffer: [-1,3,'j'], [-1,1,'b','a','j']
       * s 5s(2c), 4s, [3,'i'] => 2bai, serverBuffer: [-1,1,'b','a','i'], clientBuffer: [-1,1,-1,2,'j'], [-1,1,'b','a,'i','j']
       *
       * c 6c, 5s, [-1,3,'j'] => baij
       * s 6c, 5s, [-1,3,'j'] => baij
       */

      console.log("HEEEY");
      const mock = sinon.mock(opSender, 'send');
      const spy = mock.expects('send').twice();

      state.applyClient(buildOp([2, 'i'], '1s', { id: '2c' }))
        .applyClient(buildOp([2, -1], '2c', { id: '3c' }))
        .applyClient(buildOp([2, 'j'], '3c', { id: '4c' }))
        .applyClient(buildOp([-2, 1], '4c', { id: '5c' }))

        .applyServer(buildOp([2, 'a'], '1s', { id: '2s' }))
        .applyServer(buildOp([-1, 2], '2s', { id: '3s' }))
        .applyServer(buildOp([1, 'b', 1], '3s', { id: '4s' }))
        .applyServer(buildOp([3, 'i'], '4s', { id: '5s', sourceId: '2c' }));

      mock.verify();

      const firstOp: LineageOperation = spy.args[0][0];
      const secondOp: LineageOperation = spy.args[1][0];

      expectOp(firstOp, [2, 'i']);
      expect(firstOp.id).to.equal('2c');

      expectOp(secondOp, [3, 'j']);
      expect(secondOp.parentId).to.equal('5s');
    });
  });
});
