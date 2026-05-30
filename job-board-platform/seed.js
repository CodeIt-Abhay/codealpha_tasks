const bcrypt = require('bcryptjs');
const { sequelize, User, Profile, JobListing, JobApplication, Notification } = require('./models');

async function seed() {
  try {
    console.log('Starting database seeding...');
    
    // Sync database (recreate tables)
    await sequelize.sync({ force: true });
    console.log('Database synced (force re-created).');

    // Create passwords
    const salt = await bcrypt.genSalt(10);
    const defaultPassword = await bcrypt.hash('password123', salt);

    // 1. Create Employer User
    const employerUser = await User.create({
      name: 'Sarah Jenkins',
      email: 'employer@techcorp.com',
      password: defaultPassword,
      role: 'employer',
    });

    const employerProfile = await Profile.create({
      userId: employerUser.id,
      bio: 'TechCorp is a leading innovator in cloud services and collaborative software systems. We aim to design premium, user-focused digital solutions that empower engineering teams globally.',
      companyName: 'TechCorp Solutions',
      companyWebsite: 'https://techcorp.example.com',
      companyLogo: 'TC', // Initials logo
    });

    // 2. Create Candidate User
    const candidateUser = await User.create({
      name: 'Jane Doe',
      email: 'candidate@janedoe.com',
      password: defaultPassword,
      role: 'candidate',
    });

    const candidateProfile = await Profile.create({
      userId: candidateUser.id,
      title: 'Senior Frontend Architect',
      skills: 'JavaScript, React, Node.js, CSS3, HTML5, Webpack, Git',
      bio: 'Passionate and detail-oriented frontend engineer with 5+ years of experience designing high-performance single page applications. Expert in clean CSS architectures and responsive layouts.',
      resumePath: '/uploads/resumes/mock-resume-jane.pdf', // Seed resume path
    });

    console.log('Users and profiles seeded.');

    // 3. Create Job Listings
    const jobs = await JobListing.bulkCreate([
      {
        employerId: employerUser.id,
        title: 'Senior React Engineer',
        description: 'We are looking for a Senior React Engineer to join our frontend core team. You will drive architecture decisions for our core dashboard, improve page load times, and implement glassmorphic UI systems.',
        requirements: '5+ years of professional React experience\nSolid understanding of React hooks and performance rendering\nExpertise with modern CSS systems (vanilla, custom variables)\nExperience with Webpack/Vite build optimizations',
        location: 'Remote',
        jobType: 'Remote',
        salaryRange: '$120,000 - $140,000 / year',
        status: 'Open',
      },
      {
        employerId: employerUser.id,
        title: 'Full Stack Node.js Developer',
        description: 'Join us as a Full Stack Developer handling our core express APIs, SQLite/PostgreSQL databases, and real-time event queues. You will collaborate on end-to-end features and improve backend performance.',
        requirements: '3+ years experience with Node.js and Express.js\nStrong database design skills using Sequelize or raw SQL\nFamiliarity with JWT auth and session handling\nKnowledge of Docker and deployment pipelines',
        location: 'San Francisco, CA',
        jobType: 'Full-time',
        salaryRange: '$130,000 - $165,000 / year',
        status: 'Open',
      },
      {
        employerId: employerUser.id,
        title: 'Product UI/UX Designer',
        description: 'TechCorp is seeking a Product Designer who loves rich animations, harmonic HSL palettes, and fluid user experiences. You will translate wireframes into high-fidelity mockups and build core CSS design system tokens.',
        requirements: 'Proficient in Figma, Photoshop, or Sketch\nDeep understanding of responsive grid frameworks and micro-interactions\nStrong portfolio showcasing SaaS or dashboard designs\nKnowledge of basic CSS/HTML is a big plus',
        location: 'London, UK',
        jobType: 'Contract',
        salaryRange: '$80 - $100 / hour',
        status: 'Open',
      },
      {
        employerId: employerUser.id,
        title: 'Growth Marketing Manager',
        description: 'We are hiring a Growth Marketing Manager to oversee our social outreach, SEO keyword optimization, and clinical campaign stats. You will design conversion-focused landing page funnels.',
        requirements: 'Experience running paid marketing campaigns (Google, Meta)\nProficiency in Google Analytics and SEO reporting platforms\nExcellent copywriting and communication skills',
        location: 'Remote',
        jobType: 'Part-time',
        salaryRange: '$50,000 - $65,000 / year',
        status: 'Closed', // Closed to show status difference
      },
    ]);

    console.log('Job listings seeded.');

    // 4. Create Job Application from Jane Doe
    const app = await JobApplication.create({
      jobListingId: jobs[0].id, // Senior React Engineer
      candidateId: candidateUser.id,
      resumePath: '/uploads/resumes/mock-resume-jane.pdf',
      coverLetter: "Dear Hiring Team,\n\nI am thrilled to apply for the Senior React Engineer position at TechCorp. With my extensive background in frontend architectures, modern layout designs, and building modular glassmorphic design systems, I believe I can make an immediate contribution to your dashboard's visual style and performance.\n\nThank you for considering my application.\n\nBest regards,\nJane Doe",
      status: 'Applied',
    });

    // Create notification for employer about application
    await Notification.create({
      userId: employerUser.id,
      message: `New application received for your job listing "Senior React Engineer" from candidate Jane Doe.`,
    });

    console.log('Job applications seeded.');
    console.log('Seeding completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
}

seed();
