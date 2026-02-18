
const { body } = require('express-validator');

exports.commentRules = [
  body('author').trim().isLength({ min: 2, max: 100 }),
  body('body').trim().isLength({ min: 2, max: 2000 })
];

exports.feedbackRules = [
  body('author').optional({ checkFalsy: true }).isLength({ max: 100 }),
  body('type').optional().isIn(['comment','suggestion']),
  body('message').trim().isLength({ min: 2, max: 2000 })
];
