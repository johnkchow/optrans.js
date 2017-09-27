/* @flow */

import { expect } from 'chai';
import type { TransformTuple } from '../src/transform';
import { transform } from '../src/transform';

describe('transform', () => {
  describe('given when op1 is Insert(0, "x") and op2 is Insert(0, "y")', () => {
    it('should return Insert(0, "x"), Insert(1, "y")', () => {
      const op1 = { type: 'insert', pos: 0, chars: 'x' };
      const op2 = { type: 'insert', pos: 0, chars: 'y' };

      const result = transform(op1, op2);

      const expected: TransformTuple = [{ type: 'insert', pos: -1, chars: 'x' }, { type: 'insert', pos: 1, chars: 'y' }];

      expect(result[0]).to.deep.equal(expected[0]);
      expect(result[1]).to.deep.equal(expected[1]);
    });
  });

  describe('given when op1 is Insert(0, "x") and op2 is Remove(0, "y")', () => {
    it('should return Insert(0, "x"), Remove(1, "y")', () => {
      const op1 = { type: 'insert', pos: 0, chars: 'x' };
      const op2 = { type: 'remove', pos: 0, num: 1 };

      const result = transform(op1, op2);

      const expected: TransformTuple = [
        { type: 'insert', pos: 0, chars: 'x' },
        { ...op2, pos: 1 },
      ];

      expect(result[0]).to.deep.equal(expected[0]);
      expect(result[1]).to.deep.equal(expected[1]);
    });
  });

  describe('given when op1 is Insert(1, "x") and op2 is Remove(0, "y")', () => {
    it('should return Insert(0, "x"), Remove(1, "y")', () => {
      const op1 = { type: 'insert', pos: 1, chars: 'x' };
      const op2 = { type: 'remove', pos: 0, num: 1 };

      const result = transform(op1, op2);

      const expected: TransformTuple = [
        { type: 'insert', pos: 0, chars: 'x' },
        { type: 'remove', pos: 1, num: 1 },
      ];

      expect(result[0]).to.deep.equal(expected[0]);
      expect(result[1]).to.deep.equal(expected[1]);
    });
  });

  describe('given when op1 is Remove(0, "x") and op2 is Remove(1, "y")', () => {
    it('should return Remove(0, "x"), Remove(0, "y")', () => {
      const op1 = { type: 'remove', pos: 0, num: 1 };
      const op2 = { type: 'remove', pos: 1, num: 1 };

      const result = transform(op1, op2);

      const expected: TransformTuple = [
        { type: 'remove', pos: 0, num: 1 },
        { type: 'remove', pos: 0, num: 1 },
      ];

      expect(result[0]).to.deep.equal(expected[0]);
      expect(result[1]).to.deep.equal(expected[1]);
    });
  });

  describe('given when op1 is Remove(1, "x") and op2 is Remove(0, "y")', () => {
    it('should return Remove(0, "x"), Remove(0, "y")', () => {
      const op1 = { type: 'remove', pos: 1, num: 1 };
      const op2 = { type: 'remove', pos: 0, num: 1 };

      const result = transform(op1, op2);

      const expected: TransformTuple = [{ type: 'remove', pos: 0, num: 1 }, { type: 'remove', pos: 0, num: 1 }];

      expect(result[0]).to.deep.equal(expected[0]);
      expect(result[1]).to.deep.equal(expected[1]);
    });
  });
});
