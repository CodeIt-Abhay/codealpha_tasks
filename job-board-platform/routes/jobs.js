const express = require('express');
const { Op } = require('sequelize');
const { JobListing, User, Profile } = require('../models');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// Helper to construct search filters
const getSearchFilters = (query) => {
  const { q, location, jobType } = query;
  const where = { status: 'Open' }; // Only show open jobs by default

  if (q) {
    where[Op.or] = [
      { title: { [Op.like]: `%${q}%` } },
      { description: { [Op.like]: `%${q}%` } },
      { requirements: { [Op.like]: `%${q}%` } },
    ];
  }

  if (location && location !== 'All') {
    where[Op.and] = where[Op.and] || [];
    where[Op.and].push({ location: { [Op.like]: `%${location}%` } });
  }

  if (jobType && jobType !== 'All') {
    where[Op.and] = where[Op.and] || [];
    where[Op.and].push({ jobType });
  }

  return where;
};

// @route   GET /api/jobs
// @desc    Get all active job listings with search/filter parameters
router.get('/', async (req, res) => {
  try {
    const where = getSearchFilters(req.query);

    const jobs = await JobListing.findAll({
      where,
      include: [
        {
          model: User,
          as: 'employer',
          attributes: ['id', 'name', 'email'],
          include: [
            {
              model: Profile,
              as: 'profile',
              attributes: ['companyName', 'companyWebsite', 'companyLogo'],
            },
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    res.json(jobs);
  } catch (err) {
    console.error('Fetch Jobs Error:', err);
    res.status(500).json({ error: 'Server error while fetching job listings.' });
  }
});

// @route   GET /api/jobs/my-listings
// @desc    Get current employer's job listings
router.get('/my-listings', authMiddleware, requireRole('employer'), async (req, res) => {
  try {
    const jobs = await JobListing.findAll({
      where: { employerId: req.user.id },
      order: [['createdAt', 'DESC']],
    });
    res.json(jobs);
  } catch (err) {
    console.error('Fetch Employer Listings Error:', err);
    res.status(500).json({ error: 'Server error while fetching employer listings.' });
  }
});

// @route   GET /api/jobs/:id
// @desc    Get job listing details by ID
router.get('/:id', async (req, res) => {
  try {
    const job = await JobListing.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'employer',
          attributes: ['id', 'name', 'email'],
          include: [
            {
              model: Profile,
              as: 'profile',
              attributes: ['companyName', 'companyWebsite', 'companyLogo', 'bio'],
            },
          ],
        },
      ],
    });

    if (!job) {
      return res.status(404).json({ error: 'Job listing not found.' });
    }

    res.json(job);
  } catch (err) {
    console.error('Fetch Job Detail Error:', err);
    res.status(500).json({ error: 'Server error while fetching job details.' });
  }
});

// @route   POST /api/jobs
// @desc    Create a job listing (Employer only)
router.post('/', authMiddleware, requireRole('employer'), async (req, res) => {
  const { title, description, requirements, location, jobType, salaryRange } = req.body;

  if (!title || !description || !location || !jobType) {
    return res.status(400).json({ error: 'Please enter all required fields (title, description, location, jobType).' });
  }

  try {
    const job = await JobListing.create({
      employerId: req.user.id,
      title,
      description,
      requirements,
      location,
      jobType,
      salaryRange,
      status: 'Open',
    });

    res.status(201).json(job);
  } catch (err) {
    console.error('Create Job Listing Error:', err);
    res.status(500).json({ error: 'Server error while creating job listing.' });
  }
});

// @route   PUT /api/jobs/:id
// @desc    Update a job listing (Employer owner only)
router.put('/:id', authMiddleware, requireRole('employer'), async (req, res) => {
  const { title, description, requirements, location, jobType, salaryRange, status } = req.body;

  try {
    const job = await JobListing.findByPk(req.params.id);

    if (!job) {
      return res.status(404).json({ error: 'Job listing not found.' });
    }

    // Check ownership
    if (job.employerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. You can only update your own job listings.' });
    }

    await job.update({
      title: title || job.title,
      description: description || job.description,
      requirements: requirements !== undefined ? requirements : job.requirements,
      location: location || job.location,
      jobType: jobType || job.jobType,
      salaryRange: salaryRange !== undefined ? salaryRange : job.salaryRange,
      status: status || job.status,
    });

    res.json(job);
  } catch (err) {
    console.error('Update Job Error:', err);
    res.status(500).json({ error: 'Server error while updating job listing.' });
  }
});

// @route   DELETE /api/jobs/:id
// @desc    Delete a job listing (Employer owner only)
router.delete('/:id', authMiddleware, requireRole('employer'), async (req, res) => {
  try {
    const job = await JobListing.findByPk(req.params.id);

    if (!job) {
      return res.status(404).json({ error: 'Job listing not found.' });
    }

    // Check ownership
    if (job.employerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. You can only delete your own job listings.' });
    }

    await job.destroy();
    res.json({ message: 'Job listing deleted successfully.' });
  } catch (err) {
    console.error('Delete Job Error:', err);
    res.status(500).json({ error: 'Server error while deleting job listing.' });
  }
});

module.exports = router;
