
module.exports = function paginate(defaultLimit = 10, maxLimit = 50) {
  return (req, res, next) => {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    let limit = Math.max(parseInt(req.query.limit || String(defaultLimit), 10), 1);
    limit = Math.min(limit, maxLimit);
    const offset = (page - 1) * limit;
    res.locals.pagination = { page, limit, offset };
    next();
  };
};
