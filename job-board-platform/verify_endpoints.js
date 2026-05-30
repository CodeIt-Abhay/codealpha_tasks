const http = require('http');

const PORT = 3000;
const HOST = 'localhost';

function request(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HOST,
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            body: data ? JSON.parse(data) : null,
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            body: data,
          });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING API ENDPOINT TESTS ---');

  try {
    // 1. Fetch public jobs
    console.log('\nTesting GET /api/jobs (Public Job Search)...');
    const jobsRes = await request('GET', '/api/jobs');
    if (jobsRes.statusCode === 200 && Array.isArray(jobsRes.body)) {
      console.log(`[PASS] Found ${jobsRes.body.length} open job listings.`);
      jobsRes.body.forEach((job) => {
        console.log(`      - "${job.title}" at ${job.employer?.profile?.companyName || 'Unknown'}`);
      });
    } else {
      console.error(`[FAIL] GET /api/jobs returned status ${jobsRes.statusCode}`, jobsRes.body);
    }

    // 2. Candidate login
    console.log('\nTesting POST /api/auth/login (Candidate Login)...');
    const candLoginRes = await request('POST', '/api/auth/login', {}, {
      email: 'candidate@janedoe.com',
      password: 'password123',
    });

    let candToken = '';
    if (candLoginRes.statusCode === 200 && candLoginRes.body.token) {
      candToken = candLoginRes.body.token;
      console.log(`[PASS] Login successful. Welcome Candidate: ${candLoginRes.body.user.name}`);
    } else {
      console.error(`[FAIL] Candidate login failed with status ${candLoginRes.statusCode}`, candLoginRes.body);
    }

    // 3. Employer login
    console.log('\nTesting POST /api/auth/login (Employer Login)...');
    const empLoginRes = await request('POST', '/api/auth/login', {}, {
      email: 'employer@techcorp.com',
      password: 'password123',
    });

    let empToken = '';
    if (empLoginRes.statusCode === 200 && empLoginRes.body.token) {
      empToken = empLoginRes.body.token;
      console.log(`[PASS] Login successful. Welcome Employer: ${empLoginRes.body.user.name}`);
    } else {
      console.error(`[FAIL] Employer login failed with status ${empLoginRes.statusCode}`, empLoginRes.body);
    }

    // 4. Fetch employer statistics
    if (empToken) {
      console.log('\nTesting GET /api/stats/employer (Employer Dashboard stats)...');
      const statsRes = await request('GET', '/api/stats/employer', {
        Authorization: `Bearer ${empToken}`,
      });
      if (statsRes.statusCode === 200) {
        console.log('[PASS] Statistics retrieved successfully.');
        console.log('      - Summary:', statsRes.body.summary);
        console.log('      - Status Breakdown:', statsRes.body.statusBreakdown);
        console.log('      - Job Count:', statsRes.body.jobsBreakdown.length);
      } else {
        console.error(`[FAIL] Stats failed with status ${statsRes.statusCode}`, statsRes.body);
      }
    }

    // 5. Fetch employer notifications
    if (empToken) {
      console.log('\nTesting GET /api/notifications (Employer Notifications)...');
      const notifsRes = await request('GET', '/api/notifications', {
        Authorization: `Bearer ${empToken}`,
      });
      if (notifsRes.statusCode === 200 && Array.isArray(notifsRes.body)) {
        console.log(`[PASS] Retrieved ${notifsRes.body.length} notifications.`);
        notifsRes.body.forEach((n) => {
          console.log(`      - [${n.isRead ? 'READ' : 'UNREAD'}] ${n.message}`);
        });
      } else {
        console.error(`[FAIL] Notifications failed with status ${notifsRes.statusCode}`, notifsRes.body);
      }
    }

    console.log('\n--- TESTS COMPLETED ---');
  } catch (err) {
    console.error('Testing encountered error:', err);
  }
}

runTests();
