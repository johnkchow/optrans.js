import Operation from '../src/operation';

describe('Operation', () => {
  describe('prototype.compose', () => {
    describe('when composing [Retain(2)] with [Retain(1),Insert("a"),Retain(1)]', () => {
      it('should return [Retain(1),Insert("a"),Retain(1)]', () => {
        const op1 = new Operation([2]);
        const op2 = new Operation([1, 'a', 1]);

        const composedOp = op1.compose(op2);

        expect(composedOp._ops).to.ordered.members([1, 'a', 1]);
      });
    });

    describe('when composing [Retain(1),Insert("b"),Remove(1)] with [Retain(2),Insert("a")]', () => {
      it('should return [Retain(1),Insert("b"),Insert("a")]', () => {
        const op1 = new Operation([1, 'b', -1]);
        const op2 = new Operation([2, 'a']);

        const composedOp = op1.compose(op2);

        expect(composedOp._ops).to.ordered.members([1, 'b', -1, 'a']);
      });
    });

    describe('when composing [Retain(1),Insert("b"),Retain(1)] with [Retain(2),Insert("a")]', () => {
      it('should return [Retain(1),Insert("b"),Insert("a"]', () => {
      });
    });

    describe('when composing [Retain(1),Insert("b")] with [Retain(1),Remove(1)]', () => {
      it('should return [Retain(1)]', () => {
        const op1 = new Operation([1, 'b']);
        const op2 = new Operation([1, -1]);

        const composedOp = op1.compose(op2);

        expect(composedOp._ops).to.ordered.members([1]);
      });
    });

    describe('when composing [Remove(1),Retain(1),Insert(a)] with [Retain(1),Insert(b),Retain(1)]', () => {
      it('should return [Remove(1),Retain(1),Insert(b),Insert(a),Retain(1)]', () => {
        const op1 = new Operation([-1, 1, 'a']);
        const op2 = new Operation([1, 'b', 1]);

        const composedOp = op1.compose(op2);

        expect(composedOp._ops).to.ordered.members([-1, 1, 'b', 'a']);
      });
    });

    describe('when composing [Retain(2),Insert(j)] with [Remove(2),Retain(1)]', () => {
      it('should return [Remove(2),Insert(j)]', () => {
        const op1 = new Operation([2, 'j']);
        const op2 = new Operation([-2, 1]);

        const composedOp = op1.compose(op2);

        expect(composedOp._ops).to.ordered.members([-2, 'j']);
      });
    });
  });

  describe('.transform', () => {
    describe('when transforming [Retain(1),Insert(b),Retain(1)] with [Retain(1),Remove(1)]', () => {
      it('should return [[Retain(1),Insert(b)], [Retain(2),Remove(1)]', () => {
        const op1 = new Operation([1, 'b', 1]);
        const op2 = new Operation([1, -1]);

        const results = Operation.transform(op1, op2);

        expect(results[0]._ops).to.ordered.members([1, 'b']);
        expect(results[1]._ops).to.ordered.members([2, -1]);
      });
    });

    describe('when transforming [Insert(a)] with [Insert(b)]', () => {
      it('should return [Retain(1),Insert(a)], [Insert(b),Retain(1)]', () => {
        const op1 = new Operation(['a']);
        const op2 = new Operation(['b']);

        const results = Operation.transform(op1, op2);

        expect(results[0]._ops).to.ordered.members([1, 'a']);
        expect(results[1]._ops).to.ordered.members(['b', 1]);
      });
    });

    describe('when transforming [2,a,-1] with [1,b,2]', () => {
      it('should return [Retain(3),Insert(a),Remove(1)], [Retain(1),Insert(b),Retain(2)]', () => {
        const op1 = new Operation([2, 'a', -1]);
        const op2 = new Operation([1, 'b', 2]);

        const results = Operation.transform(op1, op2);

        expect(results[0]._ops).to.ordered.members([3, 'a', -1]);
        expect(results[1]._ops).to.ordered.members([1, 'b', 2]);
      });
    });

    describe('when transforming [Insert(a),Remove(1)] with [Retain(1),Insert(b)]', () => {
      it('should return [Insert(a),Remove(1),Retain(1)], [Retain(1),Insert(b)]', () => {
        const op1 = new Operation(['a', -1]);
        const op2 = new Operation([1, 'b']);

        const results = Operation.transform(op1, op2);

        expect(results[0]._ops).to.ordered.members(['a', -1, 1]);
        expect(results[1]._ops).to.ordered.members([1, 'b']);
      });
    });

    describe('when transforming [Retain(1),Remove(1)] with [Retain(2)]', () => {
      it('should return [Retain(1),Remove(1)], [Retain(1)]', () => {
        const op1 = new Operation([1, -1]);
        const op2 = new Operation([2]);

        const results = Operation.transform(op1, op2);

        expect(results[0]._ops).to.ordered.members([1, -1]);
        expect(results[1]._ops).to.ordered.members([1]);
      });
    });

    describe('when transforming [Retain(2)] with [Retain(1)]', () => {
      it('should throw error', () => {
        const op1 = new Operation([2]);
        const op2 = new Operation([1]);

        const trans = () => Operation.transform(op1, op2);

        expect(trans).to.throw('Unknown operation transform');
      });
    });

    describe('when transforming [Retain(1)] with [Insert(a)]', () => {
      it('should throw error', () => {
        const op1 = new Operation([1]);
        const op2 = new Operation(['a']);

        const trans = () => Operation.transform(op1, op2);

        expect(trans).to.throw('Unknown operation transform');
      });
    });

    describe('when transforming [Retain(1)] with [Retain(1),Insert(a)]', () => {
      it('should return [Retain(2)], [Retain(1),Insert(a)]', () => {
        const op1 = new Operation([1]);
        const op2 = new Operation([1, 'a']);

        const results = Operation.transform(op1, op2);

        expect(results[0]._ops).to.ordered.members([2]);
        expect(results[1]._ops).to.ordered.members([1, 'a']);
      });
    });

    describe('when transforming [Retain(1),Insert(i),Remove(-1)] with [Retain(1),Insert(i),Remove(-1)]', () => {
      it('should return [Retain(2),Insert(i)], [Retain(1),Insert(i),Retain(1)]', () => {
        const op1 = new Operation([1, 'i', -1]);
        const op2 = new Operation([1, 'i', -1]);

        const results = Operation.transform(op1, op2);

        expect(results[0]._ops).to.ordered.members([2]);
        expect(results[1]._ops).to.ordered.members([2]);
      });
    });

    describe('when transforming [Retain(2),Insert(a)] with [Retain(2),Insert(b)]', () => {
      it('should return [Retain(3),Insert(a)], [Retain(2),Insert(b),Retain(1)]', () => {
        const op1 = new Operation([2, 'a']);
        const op2 = new Operation([2, 'b']);

        const results = Operation.transform(op1, op2);

        expect(results[0]._ops).to.ordered.members([3, 'a']);
        expect(results[1]._ops).to.ordered.members([2, 'b', 1]);
      });
    });

    describe('when transforming [-2,a,j] with [-1,1,a]', () => {
      it('should return [-1,1,j], [2]', () => {
        const op1 = new Operation([-2, 'a', 'j']);
        const op2 = new Operation([-1, 1, 'a']);

        const results = Operation.transform(op1, op2);

        expect(results[0]._ops).to.ordered.members([-1, 1, 'j']);
        expect(results[1]._ops).to.ordered.members([2]);
      });
    });

    describe('when transforming [a,j] with [b,a]', () => {
      it('should return [2,j], [b,2]', () => {
        const op1 = new Operation(['a', 'j']);
        const op2 = new Operation(['b', 'a']);

        const results = Operation.transform(op1, op2);

        expect(results[0]._ops).to.ordered.members([2, 'j']);
        expect(results[1]._ops).to.ordered.members(['b', 2]);
      });
    });

    describe('when transforming [-2,a,j] with [-1,1,b,a]', () => {
      it('should return [-1,1,j], [2]', () => {
        const op1 = new Operation([-2, 'a', 'j']);
        const op2 = new Operation([-1, 1, 'b', 'a']);

        const results = Operation.transform(op1, op2);

        expect(results[0]._ops).to.ordered.members([-1, 2, 'j']);
        expect(results[1]._ops).to.ordered.members(['b', 2]);
      });
    });
  });
});
