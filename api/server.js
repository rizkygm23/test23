const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const mysql = require('mysql2/promise'); // Menggunakan mysql2 untuk dukungan Promise
const SearchValidator = require('./scrape.js');
require('dotenv').config();

const app = express();

// Konfigurasi EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views')); // Pastikan path ini benar sesuai dengan struktur proyek

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Pastikan secure: false jika tidak menggunakan HTTPS dalam pengembangan
}));

// Buat pool koneksi ke MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10, // Jumlah maksimum koneksi yang dapat dibuat oleh pool
  queueLimit: 3 // Jumlah maksimum permintaan yang menunggu koneksi
});

// Endpoint POST untuk pencarian
app.post('/search', async (req, res) => {
  try {
    const { pubkey } = req.body;
    console.log('Received pubkey:', pubkey);
    await SearchValidator(pubkey);
    res.redirect(`/?pubkey=${encodeURIComponent(pubkey)}`); // Redirect ke / dengan pubkey sebagai query parameter
  } catch (error) {
    console.error('Error searching validator:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Endpoint GET untuk halaman utama
app.get('/', async (req, res) => {
  const pubkey = req.query.pubkey; // Ambil pubkey dari query parameter
  console.log('Pubkey from query in /:', pubkey);

  try {
    const [rows] = await pool.query('SELECT * FROM validator WHERE pubkey = ?', [pubkey]);
    const users = JSON.parse(JSON.stringify(rows));

    if (users.length === 0) {
      console.log('No records found for pubkey:', pubkey);
    } else {
      console.log('Users found:', users);
    }

    // Check balance changes
    let status;
    const balance = users[0]?.balance;
    const lastBalance = users[0]?.last_balance;
    if (balance > lastBalance) {
      status = 'Increased';
    } else {
      status = 'Decreased';
    }

    res.render('index', { validators: users, status: status });
  } catch (error) {
    console.error('Error fetching validators:', error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = app;
