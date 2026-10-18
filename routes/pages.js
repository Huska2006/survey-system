const router = require('express').Router();

router.get('/login', (req, res) => res.render('login'));
router.get('/register', (req, res) => res.render('register'));
router.get('/dashboard', (req, res) => res.render('dashboard'));
router.get('/create', (req, res) => res.render('survey-edit'));

// 注意这里：把页面路径改成了 /view/xxx
router.get('/view/fill/:slug', (req, res) => res.render('survey-fill', { slug: req.params.slug }));
router.get('/view/stats/:id', (req, res) => res.render('stats', { surveyId: req.params.id }));

module.exports = router;