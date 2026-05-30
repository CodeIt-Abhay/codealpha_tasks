const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Profile, User } = require('../models');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Define uploads directory for profiles
const uploadDir = path.join(__dirname, '../uploads/profiles');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const userId = req.user.id;
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `profile-file-${userId}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

// Multer file filter to validate uploads
const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.gif', '.svg'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
});

// @route   PUT /api/profiles
// @desc    Update user profile data
router.put('/', authMiddleware, upload.fields([{ name: 'resume', maxCount: 1 }, { name: 'logo', maxCount: 1 }]), async (req, res) => {
  const { name, bio, skills, title, companyName, companyWebsite, companyLogoText } = req.body;

  try {
    const profile = await Profile.findOne({ where: { userId: req.user.id } });
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found.' });
    }

    const user = await User.findByPk(req.user.id);

    // Update User parameters if provided
    if (name) {
      await user.update({ name });
    }

    // Update Profile parameters
    const updateData = {};
    if (bio !== undefined) updateData.bio = bio;

    if (user.role === 'candidate') {
      if (skills !== undefined) updateData.skills = skills;
      if (title !== undefined) updateData.title = title;

      if (req.files && req.files['resume']) {
        updateData.resumePath = `/uploads/profiles/${req.files['resume'][0].filename}`;
      }
    } else if (user.role === 'employer') {
      if (companyName !== undefined) updateData.companyName = companyName;
      if (companyWebsite !== undefined) updateData.companyWebsite = companyWebsite;

      if (req.files && req.files['logo']) {
        updateData.companyLogo = `/uploads/profiles/${req.files['logo'][0].filename}`;
      } else if (companyLogoText !== undefined) {
        updateData.companyLogo = companyLogoText; // Custom URL or text initials
      }
    }

    await profile.update(updateData);

    const updatedUser = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
      include: [{ model: Profile, as: 'profile' }],
    });

    res.json(updatedUser);
  } catch (err) {
    console.error('Update Profile Error:', err);
    res.status(500).json({ error: 'Server error while updating profile.' });
  }
});

// Serve profile uploads statically if needed (for downloading resumes or showing logos)
// Note: We can mount express.static in main server.js as well

module.exports = router;
