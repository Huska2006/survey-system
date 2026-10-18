require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
mongoose.set('strictQuery', true);
const methodOverride = require('method-override');

const app = express();

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/', require('./routes/pages'));
app.use(methodOverride('_method'));


app.use('/auth', require('./routes/auth'));
app.use('/surveys', require('./routes/surveys'));
app.use('/fill', require('./routes/fill'));
app.use('/stats', require('./routes/stats'));

async function start() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connected');
  app.listen(process.env.PORT, () => {
    console.log(`Server on http://localhost:${process.env.PORT}`);
  });
}

if (require.main === module) {
  start().catch(err => {
    console.error('启动失败:', err.message);
    process.exit(1);
  });
}

module.exports = app;