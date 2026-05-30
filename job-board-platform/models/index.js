const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// Define User Model
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: [['candidate', 'employer']],
    },
  },
});

// Define Profile Model
const Profile = sequelize.define('Profile', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
  },
  bio: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  skills: {
    type: DataTypes.STRING, // Comma-separated list of skills
    allowNull: true,
  },
  title: {
    type: DataTypes.STRING, // Candidate professional title (e.g. Frontend Engineer)
    allowNull: true,
  },
  companyName: {
    type: DataTypes.STRING, // Employer specific
    allowNull: true,
  },
  companyWebsite: {
    type: DataTypes.STRING, // Employer specific
    allowNull: true,
  },
  companyLogo: {
    type: DataTypes.STRING, // Employer specific Logo file name or initials
    allowNull: true,
  },
  resumePath: {
    type: DataTypes.STRING, // Candidate default resume path
    allowNull: true,
  },
});

// Define JobListing Model
const JobListing = sequelize.define('JobListing', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  employerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  requirements: {
    type: DataTypes.TEXT, // Newline separated or text
    allowNull: true,
  },
  location: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  jobType: {
    type: DataTypes.STRING, // Full-time, Part-time, Contract, Remote
    allowNull: false,
  },
  salaryRange: {
    type: DataTypes.STRING, // e.g. $80,000 - $100,000
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING, // Open, Closed
    defaultValue: 'Open',
  },
});

// Define JobApplication Model
const JobApplication = sequelize.define('JobApplication', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  jobListingId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  candidateId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  resumePath: {
    type: DataTypes.STRING, // Resume path submitted at application time
    allowNull: false,
  },
  coverLetter: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING, // Applied, Reviewing, Accepted, Rejected
    defaultValue: 'Applied',
  },
});

// Define Notification Model
const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
});

// Setup Associations
User.hasOne(Profile, { foreignKey: 'userId', as: 'profile', onDelete: 'CASCADE' });
Profile.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(JobListing, { foreignKey: 'employerId', as: 'listings', onDelete: 'CASCADE' });
JobListing.belongsTo(User, { foreignKey: 'employerId', as: 'employer' });

JobListing.hasMany(JobApplication, { foreignKey: 'jobListingId', as: 'applications', onDelete: 'CASCADE' });
JobApplication.belongsTo(JobListing, { foreignKey: 'jobListingId', as: 'job' });

User.hasMany(JobApplication, { foreignKey: 'candidateId', as: 'applications', onDelete: 'CASCADE' });
JobApplication.belongsTo(User, { foreignKey: 'candidateId', as: 'candidate' });

User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications', onDelete: 'CASCADE' });
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });

module.exports = {
  sequelize,
  User,
  Profile,
  JobListing,
  JobApplication,
  Notification,
};
