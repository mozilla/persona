module.exports = function boolean_query(req, res, next) {
  Object.keys(req.query).forEach(function(key) {
    if (req.query[key] === "true") req.query[key] = true;
    else if (req.query[key] === "false") req.query[key] = false;
  });
  
  next();
};
