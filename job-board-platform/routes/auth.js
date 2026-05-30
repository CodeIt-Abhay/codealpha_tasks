const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Profile } = require('../models');
const { JWT_SECRET, authMiddleware } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register a new Candidate or Employer
router.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Please provide all required fields (name, email, password, role).' });
  }

  if (role !== 'candidate' && role !== 'employer') {
    return res.status(400).json({ error: "Role must be either 'candidate' or 'employer'." });
  }

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'A user with this email already exists.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      name,
      email,
      password: passwordHash,
      role,
    });

    // Create profile
    let profileData = { userId: user.id };
    if (role === 'employer') {
      profileData.companyName = `${name}'s Company`;
    }
    const profile = await Profile.create(profileData);

    // Generate JWT
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        profile,
      },
    });
  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate User & get token
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Please enter all fields (email, password).' });
  }

  try {
    // Check for user
    const user = await User.findOne({
      where: { email },
      include: [{ model: Profile, as: 'profile' }],
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    // Generate JWT
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        profile: user.profile,
      },
    });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user details & profile
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
      include: [{ model: Profile, as: 'profile' }],
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json(user);
  } catch (err) {
    console.error('Fetch Current User Error:', err);
    res.status(500).json({ error: 'Server error while fetching user.' });
  }
});

module.exports = router;
