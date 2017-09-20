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

    describe('when transforming [Retain(2),Insert(a),Remove(1)] with [Retain(1),Insert(b),Retain(2)]', () => {
      it('should return [Retain(3),Insert(a),Retain(1),Remove(1)], [Retain(1),Insert(b),Retain(2)]', () => {
        console.log('\n\nSTART');
        const op1 = new Operation([2, 'a', 1, -1]);
        const op2 = new Operation([1, 'b', 2]);

        const results = Operation.transform(op1, op2);

        expect(results[0]._ops).to.ordered.members([3, 'a', 1, -1]);
        expect(results[1]._ops).to.ordered.members([1, 'b', 2]);
      });
    });

    describe('when transforming [Insert(a),Remove(1)] with [Retain(1),Insert(b)]', () => {
      it('should return [Insert(a),Remove(1),Retain(1)], [Retain(1),Insert(b)]', () => {
        console.log('\n\nSTART');
        const op1 = new Operation(['a', -1]);
        const op2 = new Operation([1, 'b']);

        const results = Operation.transform(op1, op2);

        expect(results[0]._ops).to.ordered.members(['a', -1, 1]);
        expect(results[1]._ops).to.ordered.members([1, 'b']);
      });
    });
  });
});
