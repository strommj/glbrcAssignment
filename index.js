const express = require('express')
const path = require('path')
const PORT = process.env.PORT || 5000
const { Pool } = require('pg');
const pool = new Pool({
  connectionString:process.env.DATABASE_URL,
  ssl: true
});

express()
  .use(express.static(path.join(__dirname, 'public')))
  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs')
  .get('/', (req, res) => res.render('pages/index'))
  .get('/login', (req, res) => res.render('pages/login'))
  .get('/login/authentication', async (req, res) => {
    var username = req.query.username;
    var password = req.query.password;

    try {
      const client = await pool.connect();
      const result = await client.query("SELECT password FROM users");
      const results = { 'results': (result) ? result.rows : null};
      res.render('pages/db', results );
      client.release();

        console.log("res: " + result.rows[0].password);
        
      /*  if (err) throw err;

        if (res != null) {
          return res;
        }
      });*/

      if (result.rows[0].password == password) {
        res.render('pages/index');
      } else {
        console.log("Sorry, incorrect password");
      }
    } catch (err) {
      console.error(err);
      res.send("error " + err);
    }
  })
  .get('/db', async (req, res) => {
    try {
      const client = await pool.connect()
      const result = await client.query('SELECT * FROM applications');
      const results = { 'results': (result) ? result.rows : null};
      res.render('pages/db', results );
      client.release();
    } catch (err) {
      console.error(err);
      res.send("Error " + err);
    }
  })
  .listen(PORT, () => console.log(`Listening on ${ PORT }`))
