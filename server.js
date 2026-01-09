const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const session = require('express-session');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/portfolio_rashed'; // Default to local if env not set
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin";

// Connect to MongoDB
mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.log('MongoDB Connection Error:', err));

// Define Schema and Model
const portfolioSchema = new mongoose.Schema({
    hero: {
        title: String,
        name: String,
        description: String,
        image: String
    },
    experience: [{
        title: String,
        date: String,
        location: String,
        description: [String]
    }],
    services: [{
        title: String,
        icon: String,
        description: String
    }],
    skills: [String],
    contact: {
        phone: String,
        email: String,
        location: String,
        whatsapp_link: String,
        instagram_link: String
    }
});

const Portfolio = mongoose.model('Portfolio', portfolioSchema);

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

// Helper to get data (find or seed)
async function getPortfolioData() {
    let data = await Portfolio.findOne();
    if (!data) {
        // Seed from data.json if available, or defaults
        try {
            const jsonData = fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8');
            const initialData = JSON.parse(jsonData);
            data = new Portfolio(initialData);
            await data.save();
            console.log("Database seeded from data.json");
        } catch (err) {
            console.log("No data.json found, starting with empty data");
            data = new Portfolio({}); // Create empty
            await data.save();
        }
    }
    return data;
}

// Public Routes
app.get('/', async (req, res) => {
    try {
        const doc = await getPortfolioData();
        const data = doc.toObject(); // Convert to plain object for EJS locals
        res.render('index', data);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error: " + err.message);
    }
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
app.get('/dashboard', requireLogin, async (req, res) => {
    try {
        const doc = await getPortfolioData();
        res.render('dashboard', { data: doc.toObject(), message: null });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error: " + err.message);
    }
});

app.post('/dashboard/update', requireLogin, upload.single('profileImage'), async (req, res) => {
    try {
        let data = await getPortfolioData();
        const body = req.body;

        // Update Hero
        data.hero.title = body.heroTitle;
        data.hero.name = body.heroName;
        data.hero.description = body.heroDescription;
        if (req.file) {
            data.hero.image = '/uploads/' + req.file.filename;
        }

        // Update dynamic fields
        // Mongoose handles updating nested arrays if we pass the full structure
        // However, form submission sends 'experience[0][title]' which might need robust parsing if not using a JSON payload.
        // Thankfully, body-parser 'extended: true' parses this into objects/arrays!

        if (body.experience) data.experience = body.experience;
        if (body.services) data.services = body.services;
        if (body.skills) data.skills = body.skills;

        // Update Contact
        data.contact.phone = body.contactPhone;
        data.contact.email = body.contactEmail;
        data.contact.location = body.contactLocation;
        data.contact.whatsapp_link = body.contactWhatsapp;
        data.contact.instagram_link = body.contactInstagram;

        // Mongoose requires marking mixed/array fields modified sometimes if doing deep partial updates,
        // but here we are replacing the sub-documents.
        await data.save();

        res.render('dashboard', { data: data, message: 'تم تحديث البيانات بنجاح!' });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error updating data");
    }
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
