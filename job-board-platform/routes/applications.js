const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { JobApplication, JobListing, User, Profile, Notification } = require('../models');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// Define resume upload directory
const uploadDir = path.join(__dirname, '../uploads/resumes');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const candidateId = req.user.id;
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `resume-candidate-${candidateId}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

// Multer file filter to validate uploads (PDF, DOC, DOCX)
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.pdf', '.doc', '.docx'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF and Word documents are allowed.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
});

// @route   POST /api/applications
// @desc    Apply for a job (Candidate only; handles resume upload)
router.post('/', authMiddleware, requireRole('candidate'), (req, res) => {
  upload.single('resume')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    const { jobListingId, coverLetter } = req.body;

    if (!jobListingId) {
      return res.status(400).json({ error: 'Job listing ID is required.' });
    }

    try {
      // Check if job exists and is open
      const job = await JobListing.findByPk(jobListingId);
      if (!job) {
        return res.status(404).json({ error: 'Job listing not found.' });
      }

      if (job.status !== 'Open') {
        return res.status(400).json({ error: 'This job listing is no longer open for applications.' });
      }

      // Check if already applied
      const existingApplication = await JobApplication.findOne({
        where: {
          jobListingId,
          candidateId: req.user.id,
        },
      });

      if (existingApplication) {
        return res.status(400).json({ error: 'You have already applied for this job listing.' });
      }

      // Determine resume path
      let resumePath = '';
      if (req.file) {
        resumePath = `/uploads/resumes/${req.file.filename}`;
      } else {
        // Fallback to user profile default resume
        const profile = await Profile.findOne({ where: { userId: req.user.id } });
        if (profile && profile.resumePath) {
          resumePath = profile.resumePath;
        } else {
          return res.status(400).json({ error: 'Please upload a resume or add one to your profile first.' });
        }
      }

      // Create application
      const application = await JobApplication.create({
        jobListingId,
        candidateId: req.user.id,
        resumePath,
        coverLetter,
        status: 'Applied',
      });

      // Create notification for employer
      const candidateUser = await User.findByPk(req.user.id);
      await Notification.create({
        userId: job.employerId,
        message: `New application received for your job listing "${job.title}" from candidate ${candidateUser.name}.`,
      });

      res.status(201).json(application);
    } catch (dbErr) {
      console.error('Apply Job Error:', dbErr);
      res.status(500).json({ error: 'Server error while submitting application.' });
    }
  });
});

// @route   GET /api/applications
// @desc    Get all applications (Candidate's own or Employer's jobs applicant list)
router.get('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.role === 'candidate') {
      // Get all applications candidate has submitted
      const applications = await JobApplication.findAll({
        where: { candidateId: req.user.id },
        include: [
          {
            model: JobListing,
            as: 'job',
            include: [
              {
                model: User,
                as: 'employer',
                attributes: ['id', 'name', 'email'],
                include: [{ model: Profile, as: 'profile', attributes: ['companyName', 'companyLogo'] }],
              },
            ],
          },
        ],
        order: [['createdAt', 'DESC']],
      });
      return res.json(applications);
    } else if (req.user.role === 'employer') {
      // Get all applications for jobs posted by this employer
      const applications = await JobApplication.findAll({
        include: [
          {
            model: JobListing,
            as: 'job',
            where: { employerId: req.user.id },
          },
          {
            model: User,
            as: 'candidate',
            attributes: ['id', 'name', 'email'],
            include: [{ model: Profile, as: 'profile', attributes: ['skills', 'bio', 'title'] }],
          },
        ],
        order: [['createdAt', 'DESC']],
      });
      return res.json(applications);
    }

    res.status(400).json({ error: 'Invalid role.' });
  } catch (err) {
    console.error('Fetch Applications Error:', err);
    res.status(500).json({ error: 'Server error while retrieving applications.' });
  }
});

// @route   PUT /api/applications/:id/status
// @desc    Update application status (Employer only)
router.put('/:id/status', authMiddleware, requireRole('employer'), async (req, res) => {
  const { status } = req.body;

  if (!status || !['Applied', 'Reviewing', 'Accepted', 'Rejected'].includes(status)) {
    return res.status(400).json({ error: 'Please provide a valid status (Applied, Reviewing, Accepted, Rejected).' });
  }

  try {
    const application = await JobApplication.findByPk(req.params.id, {
      include: [{ model: JobListing, as: 'job' }],
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    // Verify ownership of the job
    if (application.job.employerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. You can only update applications for your own listings.' });
    }

    await application.update({ status });

    // Notify candidate
    await Notification.create({
      userId: application.candidateId,
      message: `Your application for the position "${application.job.title}" has been updated to "${status}".`,
    });

    res.json(application);
  } catch (err) {
    console.error('Update Status Error:', err);
    res.status(500).json({ error: 'Server error while updating application status.' });
  }
});

module.exports = router;
