const express = require('express');
const { JobListing, JobApplication, sequelize } = require('../models');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/stats/employer
// @desc    Get dashboard metrics & statistics for employer reporting
router.get('/employer', authMiddleware, requireRole('employer'), async (req, res) => {
  try {
    const employerId = req.user.id;

    // 1. Total Job Listings (Open vs Closed)
    const openJobsCount = await JobListing.count({ where: { employerId, status: 'Open' } });
    const closedJobsCount = await JobListing.count({ where: { employerId, status: 'Closed' } });

    // 2. Job Listings with Application Counts
    const listings = await JobListing.findAll({
      where: { employerId },
      attributes: ['id', 'title', 'status'],
      include: [
        {
          model: JobApplication,
          as: 'applications',
          attributes: ['id', 'status'],
        },
      ],
    });

    const jobsData = listings.map((job) => ({
      id: job.id,
      title: job.title,
      status: job.status,
      applicationCount: job.applications.length,
    }));

    // 3. Overall Applications Status Breakdown
    const statusCounts = {
      Applied: 0,
      Reviewing: 0,
      Accepted: 0,
      Rejected: 0,
    };

    let totalApplications = 0;

    listings.forEach((job) => {
      job.applications.forEach((app) => {
        totalApplications++;
        if (statusCounts[app.status] !== undefined) {
          statusCounts[app.status]++;
        }
      });
    });

    // 4. Application Trend Over Time (grouped by application date)
    // For SQLite, we can extract date formatted as YYYY-MM-DD
    const trend = await JobApplication.findAll({
      attributes: [
        [sequelize.fn('date', sequelize.col('JobApplication.createdAt')), 'date'],
        [sequelize.fn('count', sequelize.col('JobApplication.id')), 'count'],
      ],
      include: [
        {
          model: JobListing,
          as: 'job',
          where: { employerId },
          attributes: [],
        },
      ],
      group: [sequelize.fn('date', sequelize.col('JobApplication.createdAt'))],
      order: [[sequelize.fn('date', sequelize.col('JobApplication.createdAt')), 'ASC']],
    });

    const trendData = trend.map((t) => ({
      date: t.dataValues.date,
      count: t.dataValues.count,
    }));

    res.json({
      summary: {
        totalJobs: openJobsCount + closedJobsCount,
        openJobs: openJobsCount,
        closedJobs: closedJobsCount,
        totalApplications,
      },
      statusBreakdown: statusCounts,
      jobsBreakdown: jobsData,
      timelineTrend: trendData,
    });
  } catch (err) {
    console.error('Fetch Stats Error:', err);
    res.status(500).json({ error: 'Server error while calculating statistics.' });
  }
});

module.exports = router;
