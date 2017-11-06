// @flow

import { expect, assert } from 'chai';
import Operation from '../src/operation';

export function buildOp(ops: Array<number | string>): Operation {
  const compressedOps = ops.map((o) => {
    if (typeof o === 'number' && o > 0) {
      return { ty: 'rt', v: o };
    } else if (typeof o === 'number' && o < 0) {
      return { ty: 'rm', v: Math.abs(o) };
    } else if (typeof o === 'string' && (/^<[a-z]*>$/).test(o)) {
      return { ty: 'o', v: o };
    } else if (typeof o === 'string' && (/^<\/[a-z]*>$/).test(o)) {
      return { ty: 'c', v: o };
    } else if (typeof o === 'string') {
      return { ty: 'i', v: o };
    }

    throw new Error(`Unknown operation: ${o}`);
  });

  return new Operation(compressedOps);
}

export function expectOps(actual: Operation, expected: Array<number | string>) {
  const expectedOp = buildOp(expected);

  const msg = `(actual: ${actual.toString()}, expected: ${expectedOp.toString()})`;

  // $FlowIgnore
  expect(actual._ops.length).to.equal(expectedOp._ops.length, `Ops length do not match ${msg}`);

  for (let i = 0; i < actual._ops.length; i += 1) {
    const opA = actual._ops[i];
    const opE = expectedOp._ops[i];

    assert(
      opA.ty === opE.ty && opA.v === opE.v,
      `Unequal ops at index ${i} ${msg}`,
    );
  }
}
