'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

exports.transform = transform;
var posOnlyOpTypes = {
  remove: 'remove',
  retain: 'retain'
};

var insertOpType = {
  insert: 'insert'
};

var opTypes = exports.opTypes = _extends({}, posOnlyOpTypes, insertOpType);

function transform(op1, op2) {
  if (op1.type === opTypes.insert && op2.type === opTypes.insert) {
    return [_extends({}, op1, { pos: op1.pos - op2.chars.length }), _extends({}, op2, { pos: op2.pos + op1.chars.length })];
  } else if (op1.type === opTypes.insert && op2.type === opTypes.remove) {
    if (op1.pos <= op2.pos) {
      var shiftPos = op1.chars.length;

      return [_extends({}, op1), _extends({}, op2, { pos: op2.pos + shiftPos })];
    }

    return [_extends({}, op1, { pos: op1.pos - op2.num }), _extends({}, op2, { pos: op2.pos + op1.chars.length })];
  } else if (op1.type === opTypes.remove && op2.type === opTypes.insert) {
    // $FlowFixMe: Errors out due to flow thinking tuples don't have access to reverse()
    return transform(op2, op1).reverse();
  } else if (op1.type === opTypes.remove && op2.type === opTypes.remove) {
    if (op1.pos < op2.pos) {
      return [_extends({}, op1), _extends({}, op2, { pos: op2.pos - op1.num })];
    } else if (op1.pos > op2.pos) {
      return [_extends({}, op1, { pos: op1.pos - op2.num }), _extends({}, op2)];
    }

    return [op1, op2];
  }

  return [op1, op2];
}