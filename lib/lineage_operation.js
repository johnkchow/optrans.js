'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.generateId = generateId;

var _operation = require('./operation');

var _operation2 = _interopRequireDefault(_operation);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var idPrefix = 'somerandomuuid';
var idCounter = 0;

function generateId() {
  idCounter += 1;
  return idPrefix + ':' + idCounter;
}

var LineageOperation = function () {
  _createClass(LineageOperation, null, [{
    key: 'transform',

    // eslint-disable-next-line max-len
    value: function transform(op1, op2) {
      var _Operation$transform = _operation2.default.transform(op1.op, op2.op),
          _Operation$transform2 = _slicedToArray(_Operation$transform, 2),
          op1Prime = _Operation$transform2[0],
          op2Prime = _Operation$transform2[1];

      return [new LineageOperation(generateId(), op1.id, op2.id, op1Prime), new LineageOperation(generateId(), op2.id, op1.id, op2Prime)];
    }
    // @private

  }]);

  function LineageOperation(id, sourceId, parentId, op) {
    _classCallCheck(this, LineageOperation);

    this.id = id;
    this.sourceId = sourceId || id;
    this.parentId = parentId;
    this.op = op;
  }

  _createClass(LineageOperation, [{
    key: 'compose',
    value: function compose(other) {
      var composed = this.op.compose(other.op);

      return new LineageOperation(generateId(), this.id, this.parentId, composed);
    }
  }, {
    key: 'toString',
    value: function toString() {
      return JSON.stringify({
        id: this.id,
        ops: this.op._ops,
        sourceId: this.sourceId,
        parentId: this.parentId
      });
    }
  }]);

  return LineageOperation;
}();

exports.default = LineageOperation;