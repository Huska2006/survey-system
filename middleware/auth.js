const jwt = require('jsonwebtoken');

module.exports = function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  // 期望的格式是 "Bearer <token>"
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId; // 把解析出的用户ID挂载到 req 上，后续路由可以使用
    next(); // 放行
  } catch (err) {
    return res.status(401).json({ error: '登录已失效，请重新登录' });
  }
};