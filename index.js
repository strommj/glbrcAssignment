const express = require('express');
const session = require('express-session');
const path = require('path');
const PORT = process.env.PORT || 5000;
const { Pool } = require('pg');
const pool = new Pool({
  connectionString:process.env.DATABASE_URL,
  ssl: true
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
  .use(express.urlencoded({
    extended: true
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

      // This query grabs all applications that are currently in the user's home screen
      const usedApps = await client.query(
        "SELECT a.name, a.description, a.color, a.link " +
        "FROM users AS u JOIN home_pages AS h ON u.user_id_pkey = h.user_id_fkey " +
        "JOIN applications AS a ON h.app_id_fkey = a.app_id_pkey " +
        "WHERE u.login = $1", [req.session.user]);
      
      // This query grabs all applications that are NOT currently in the user's home screen
      const unusedApps = await client.query(
        "WITH used_apps AS (" +
          "SELECT a.name " +
          "FROM users AS u JOIN home_pages AS h ON u.user_id_pkey = h.user_id_fkey " +
          "JOIN applications AS a ON h.app_id_fkey = a.app_id_pkey " +
          "WHERE u.login = $1" +
        ") " +
        "SELECT name " +
        "FROM applications " +
        "WHERE name NOT IN (SELECT name FROM used_apps)",
      [req.session.user]);

      const queryResults = {'usedAppList': (usedApps) ? usedApps.rows : null, 'unusedAppList': (unusedApps) ? unusedApps.rows : null };
      res.render('pages/home', queryResults);
      client.release();

    } catch (err) {
      console.error(err);
      res.send("error: " + err);
    }
  })

  // Just in case anyone accidentally tries accessing this route, close off access to everyone
  .get('/updateHomeScreen', authenticate, (req,res) => {
    res.redirect('/');
  })

  .post('/updateHomeScreen', authenticate, async (req, res) => {
    try {

      var removalList = [];
      var addList = [];

      // Gather the list of applications to add and remove
      for (var key in req.body) {

        if (key.substring(0,4) == 'del_') {
          removalList.push(key.substring(4));
        } else if (key.substring(0,4) == 'add_') {
          addList.push(key.substring(4));
        } else {
          console.error("Error: Something went wrong!");
        }
      }

      const client = await pool.connect();

      // Remove applications
      if (removalList !== undefined && removalList.length != 0) {

        var names = "AND a.name IN ('" + removalList[0] + "'";
        for (var i = 1; i < removalList.length; i ++) { names += ", '" + removalList[i] + "'"; }
        names += ")";

        await client.query(
          "DELETE FROM ONLY home_pages AS h USING users AS u, applications AS a " +
          "WHERE u.user_id_pkey = h.user_id_fkey AND a.app_id_pkey = h.app_id_fkey " +
          "AND u.login = $1 " + names, [req.session.user]);
  
      }
  
      // Add applications
      if (addList !== undefined && addList.length != 0) {

        var values = "( (SELECT user_id_pkey FROM users WHERE login = '" + req.session.user + "'), ";
        values += "(SELECT app_id_pkey FROM applications WHERE name = '" + addList[0] + "') )";
        for (var i = 1; i < addList.length; i++) {
          values += ", ( (SELECT user_id_pkey FROM users WHERE login = '" + req.session.user + "'), ";
          values += "(SELECT app_id_pkey FROM applications WHERE name = '" + addList[i] + "') )";
        }

        await client.query("INSERT INTO home_pages VALUES " + values);
      }
  
      // Reload the Home page with updated applications
      res.redirect('/');
      client.release();

    } catch (err) {
      console.error(err);
      res.send("error: " + err);
    }

  })

  .listen(PORT, () => console.log(`Listening on ${ PORT }`));
