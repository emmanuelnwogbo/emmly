module.exports = {

  database: process.env.DATABASE || 'mongodb://heroku_pnhdn64m:62pocm1jd01onqtrecao8osheh@ds151222.mlab.com:51222/heroku_pnhdn64m',
  port: process.env.PORT || 3000,
  secret: process.env.SECRET || 'yabadabadoo',

};
