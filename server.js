const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const session = require('express-session');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// CHANGE THIS PASSWORD
const ADMIN_PASSWORD = "admin";

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Session Middleware
app.use(session({
    secret: 'my-secret-key-123',
    resave: false,
    saveUninitialized: true
}));

// Authentication Middleware
function requireLogin(req, res, next) {
    if (req.session.loggedIn) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Multer setup for image uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)) // Append extension
    }
});
const upload = multer({ storage: storage });

// Helper to read data
function readData() {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error("Error reading data.json:", err);
        return {};
    }
}

// Helper to write data
function writeData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Error writing data.json:", err);
    }
}

// Public Routes
app.get('/', (req, res) => {
    const data = readData();
    res.render('index', data);
});

// Login Routes
app.get('/login', (req, res) => {
    if (req.session.loggedIn) return res.redirect('/dashboard');
    res.render('login', { error: null });
});

app.post('/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        req.session.loggedIn = true;
        res.redirect('/dashboard');
    } else {
        res.render('login', { error: 'كلمة المرور غير صحيحة' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Protected Dashboard Routes
app.get('/dashboard', requireLogin, (req, res) => {
    const data = readData();
    res.render('dashboard', { data: data, message: null });
});

app.post('/dashboard/update', requireLogin, upload.single('profileImage'), (req, res) => {
    let data = readData();
    const body = req.body;

    // Update Hero
    data.hero.title = body.heroTitle;
    data.hero.name = body.heroName;
    data.hero.description = body.heroDescription;
    if (req.file) {
        data.hero.image = '/uploads/' + req.file.filename;
    }

    // Update dynamic fields
    if (body.experience) data.experience = body.experience;
    if (body.services) data.services = body.services;
    if (body.skills) data.skills = body.skills;

    // Update Contact
    data.contact.phone = body.contactPhone;
    data.contact.email = body.contactEmail;
    data.contact.location = body.contactLocation;
    data.contact.whatsapp_link = body.contactWhatsapp;
    data.contact.instagram_link = body.contactInstagram;

    writeData(data);
    res.render('dashboard', { data: data, message: 'تم تحديث البيانات بنجاح!' });
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
