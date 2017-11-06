/* @flow */

import sinon from 'sinon';
import { expect } from 'chai';
import { WaitingState, AwaitingAckState } from '../src/states';
import LineageOperation from '../src/lineage_operation';
import { buildOp as bo, expectOps } from './helpers';
import type { Document, OpSender } from '../src/client';

let opIdCounter = 0;

type RawOps = Array<number | string>;

// eslint-disable-next-line max-len
function buildOp(ops: RawOps, parentId: string, { id, sourceId }: { id?: string, sourceId?: string } = {}): LineageOperation {
  let opId = id;

  if (!opId) {
    opIdCounter += 1;
    opId = `${opIdCounter}`;
  }

  return new LineageOperation(
    opId,
    sourceId || opId,
    parentId,
    bo(ops),
  );
}

function expectOp(actual: LineageOperation, ops: Array<number | string>) {
  expectOps(actual.op, ops);
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
      lastServerOp = buildOp([2], '1s');
      state = new WaitingState(doc, opSender, lastServerOp);
    });

    it('should forward the right series of ops to server', () => {
      /* eslint-disable max-len */
      /*
       * Current ID: 1s, 12
       *
       * source opId, parentId, expectedBufferedOps => expectedOutput, expectedServerBuffer, expectedClientBuffer
       *
       * c 2c, 1s [2,'i'] => 12i (sent)
       * c 3c, 2c [2, -1] => 12 clientBuffer: [2]
       * c 4c, 3c [2,'j'] => 12j, clientBuffer: [2, 'j']
       * c 5c, 4c [-2,1] => j, clientBuffer: [-2, 'j']
       *
       * s 2s, 1s [2,'a'] => 12a, serverBuffer: [2, 'a'], clientBuffer: [-2, 1, 'j'] ([-2, 'a', 'j'])
       * s 3s, 2s [-1,2] => 2a, serverBuffer: [-1,1,'a'], clientBuffer: [-1, 1, 'j'] ([-1, 'a', 'j'])
       * s 4s, 3s [1,'b',1] => 2ba, serverBuffer: [-1,1,'b','a'], clientBuffer: [-1,3,'j'] ([-1,1,'b','a','j'])
       * s 5s(2c), 4s, [3,'i'] => 2bai, serverBuffer: [-1,1,'b','a','i'], clientBuffer: [-1,1,-1,2,'j'] ([-1,1,'b','a,'i','j'])
       *
       * c 6c, 5s, [-1,3,'j'] => baij
       * s 6c, 5s, [-1,3,'j'] => baij
       */
      /* eslint-enable max-len */

      const opSenderMock = sinon.mock(opSender, 'send');
      const opSenderSpy = opSenderMock.expects('send').twice();

      let lastState = state.applyClient(buildOp([2, 'i'], '1s', { id: '2c' }))
        .applyClient(buildOp([2, -1], '2c', { id: '3c' }))
        .applyClient(buildOp([2, 'j'], '3c', { id: '4c' }))
        .applyClient(buildOp([-2, 1], '4c', { id: '5c' }))

        .applyServer(buildOp([2, 'a'], '1s', { id: '2s' }))
        .applyServer(buildOp([-1, 2], '2s', { id: '3s' }))
        .applyServer(buildOp([1, 'b', 1], '3s', { id: '4s' }));

      const docMock = sinon.mock(doc, 'apply');
      let docSpy = docMock.expects('apply').once();

      lastState = lastState.applyServer(buildOp([3, 'i'], '4s', { id: '5s', sourceId: '2c' }));

      opSenderMock.verify();
      expectOp(docSpy.args[0][0], [2, 'i', 1]);

      const firstOp: LineageOperation = opSenderSpy.args[0][0];
      const secondOp: LineageOperation = opSenderSpy.args[1][0];

      expectOp(firstOp, [2, 'i']);
      expect(firstOp.id).to.equal('2c');

      expectOp(secondOp, [-1, 3, 'j']);
      expect(secondOp.parentId).to.equal('5s');
      expect(secondOp.sourceId).to.equal(secondOp.id);
      expect(lastState).to.be.an.instanceOf(AwaitingAckState);

      docSpy = docMock.expects('apply').never();

      const waitingState = lastState.applyServer(secondOp);

      docMock.verify();

      expect(waitingState).to.be.an.instanceOf(WaitingState);
    });
  });
});
