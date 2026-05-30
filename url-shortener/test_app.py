import os
import unittest
import json
import sqlite3
from app import app, DATABASE_PATH, init_db, get_db_connection

class URLShortenerTestCase(unittest.TestCase):
    def setUp(self):
        # Configure app for testing
        app.config['TESTING'] = True
        self.client = app.test_client()
        
        # Point to a temporary database for testing
        self.db_fd = 'test_database.db'
        # Override the database path globally inside app
        import app as app_module
        app_module.DATABASE_PATH = self.db_fd
        
        # Initialize test database schema
        init_db()

    def tearDown(self):
        # Close connections and remove test database file
        if os.path.exists(self.db_fd):
            os.remove(self.db_fd)

    def test_database_initialization(self):
        """Test if the database tables are created correctly."""
        conn = sqlite3.connect(self.db_fd)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='urls';")
        table = cursor.fetchone()
        conn.close()
        self.assertIsNotNone(table)

    def test_shorten_valid_url(self):
        """Test API successfully shortens a valid URL."""
        response = self.client.post('/api/shorten', 
                                    data=json.dumps({'url': 'https://google.com'}),
                                    content_type='application/json')
        data = json.loads(response.data)
        
        self.assertEqual(response.status_code, 201)
        self.assertTrue(data['success'])
        self.assertEqual(data['original_url'], 'https://google.com')
        self.assertTrue(len(data['short_code']) == 6)
        self.assertIn(data['short_code'], data['short_url'])

    def test_shorten_invalid_url(self):
        """Test API rejects an invalid URL format."""
        response = self.client.post('/api/shorten', 
                                    data=json.dumps({'url': 'not_a_valid_url_at_all'}),
                                    content_type='application/json')
        data = json.loads(response.data)
        
        self.assertEqual(response.status_code, 400)
        self.assertIn('error', data)

    def test_shorten_custom_alias(self):
        """Test API successfully handles custom aliases."""
        response = self.client.post('/api/shorten', 
                                    data=json.dumps({'url': 'https://github.com', 'alias': 'my-git'}),
                                    content_type='application/json')
        data = json.loads(response.data)
        
        self.assertEqual(response.status_code, 201)
        self.assertEqual(data['short_code'], 'my-git')
        
        # Test taking the same alias again (should conflict)
        response_dup = self.client.post('/api/shorten', 
                                        data=json.dumps({'url': 'https://gitlab.com', 'alias': 'my-git'}),
                                        content_type='application/json')
        self.assertEqual(response_dup.status_code, 409)

    def test_redirect_and_click_tracking(self):
        """Test redirection and click counting."""
        # 1. Create a short link
        response = self.client.post('/api/shorten', 
                                    data=json.dumps({'url': 'https://wikipedia.org'}),
                                    content_type='application/json')
        data = json.loads(response.data)
        short_code = data['short_code']
        
        # 2. Redirect check
        redirect_response = self.client.get(f"/{short_code}")
        self.assertEqual(redirect_response.status_code, 302)
        self.assertEqual(redirect_response.headers['Location'], 'https://wikipedia.org')
        
        # 3. Check click count has incremented to 1
        links_response = self.client.get('/api/links')
        links_data = json.loads(links_response.data)
        self.assertEqual(links_data[0]['clicks'], 1)

    def test_delete_link(self):
        """Test removing a link and verifying redirection fails."""
        # 1. Create a link
        response = self.client.post('/api/shorten', 
                                    data=json.dumps({'url': 'https://yahoo.com'}),
                                    content_type='application/json')
        data = json.loads(response.data)
        short_code = data['short_code']

        # 2. Delete the link
        delete_response = self.client.delete(f"/api/links/{short_code}")
        self.assertEqual(delete_response.status_code, 200)

        # 3. Try to access it (should redirect with not_found error to home)
        redirect_response = self.client.get(f"/{short_code}")
        self.assertEqual(redirect_response.status_code, 302)
        self.assertIn('?error=not_found', redirect_response.headers['Location'])

if __name__ == '__main__':
    unittest.main()
