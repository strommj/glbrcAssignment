const express = require('express');
const session = require('express-session');
const path = require('path');
const PORT = process.env.PORT || 5000;
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: "postgres://postgres:wars923star@localhost:5432/mylocaldb",
  ssl: false
  //connectionString:process.env.DATABASE_URL,
  //ssl: true
});

// Unauthorized users are redirected to the login screen
var authenticate = function(req, res, next) {
  if (req.session && req.session.loggedIn)
    return next();
  else
    return res.redirect('/login');
};

express()
  .use(express.static(path.join(__dirname, 'public')))
  .use(session({
    secret: 'May the force be with you.',
    resave: true,
    saveUninitialized: false
  }))
  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs')

  // Login and Authentication
  .get('/login', (req, res) => res.render('pages/login'))
  .get('/login/authentication', async (req, res) => {
    req.session.user = req.query.username;

    try {
      const client = await pool.connect();
      const result = await client.query("SELECT password FROM users WHERE login = $1", [req.session.user]);
      client.release();

      if (result.rows[0].password == req.query.password) {
        console.log("Login successful!")
        req.session.loggedIn = true;
        res.redirect('/');

      } else {
        console.log("Sorry, incorrect password");
      }
    } catch (err) {
      console.error(err);
      res.send("error: " + err);
    }
  })

  // Home page
  .get('/', authenticate, async (req, res) => {
    try {
      const client = await pool.connect();
      const result = await client.query("SELECT a.name " +
                                        "FROM users AS u JOIN home_pages AS h " +
                                        "ON u.user_id_pkey = h.user_id_fkey " +
                                        "JOIN applications AS a " +
                                        "ON h.app_id_fkey = a.app_id_pkey " +
                                        "WHERE u.login = $1", [req.session.user]);
      
      console.log("name1: " + result.rows[0].name + " name2: " + result.rows[1].name);
      const results = { 'results': (result) ? result.rows : null };
      res.render('pages/home', results);
      client.release();

    } catch (err) {
      console.error(err);
      res.send("error: " + err);
    }
  })

  // Test database request
  .get('/db', authenticate, async (req, res) => {
    try {
      const client = await pool.connect()
      const result = await client.query('SELECT * FROM applications');
      const results = { 'results': (result) ? result.rows : null };
      res.render('pages/db', results );
      client.release();
    } catch (err) {
      console.error(err);
      res.send("Error " + err);
    }
  })
  .listen(PORT, () => console.log(`Listening on ${ PORT }`));
