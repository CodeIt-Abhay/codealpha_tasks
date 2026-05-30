const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { sequelize } = require('./models');

// Import routes
const authRoutes = require('./routes/auth');
const jobRoutes = require('./routes/jobs');
const applicationRoutes = require('./routes/applications');
const profileRoutes = require('./routes/profiles');
const notificationRoutes = require('./routes/notifications');
const statsRoutes = require('./routes/stats');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Body Parser Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create necessary upload directories if they don't exist
const resumesDir = path.join(__dirname, 'uploads/resumes');
const profilesDir = path.join(__dirname, 'uploads/profiles');
if (!fs.existsSync(resumesDir)) fs.mkdirSync(resumesDir, { recursive: true });
if (!fs.existsSync(profilesDir)) fs.mkdirSync(profilesDir, { recursive: true });

// Serve Static Frontend Files
app.use(express.static(path.join(__dirname, 'public')));

// Serve Statically Uploaded Resumes/Logos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/stats', statsRoutes);

// Fallback to index.html for Single Page Application routing (if user refreshes)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Sync Database and Start Server
sequelize
  .sync({ alter: true }) // Adjust database schema safely if models change
  .then(() => {
    console.log('SQLite Database synchronized successfully.');
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Database synchronization failed:', err);
  });
