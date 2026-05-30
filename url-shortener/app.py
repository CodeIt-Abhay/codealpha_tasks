import os
import sqlite3
import string
import random
from urllib.parse import urlparse
from flask import Flask, request, jsonify, redirect, send_from_directory
from flask_cors import CORS

app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app)  # Enable Cross-Origin Resource Sharing

DATABASE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'database.db')

def get_db_connection():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS urls (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            short_code TEXT NOT NULL UNIQUE,
            original_url TEXT NOT NULL,
            clicks INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

# Generate a random 6-character code (Base62: letters and digits)
def generate_random_code(length=6):
    characters = string.ascii_letters + string.digits
    while True:
        code = ''.join(random.choice(characters) for _ in range(length))
        # Ensure uniqueness
        conn = get_db_connection()
        row = conn.execute('SELECT 1 FROM urls WHERE short_code = ?', (code,)).fetchone()
        conn.close()
        if not row:
            return code

import re

# Validate URL structure using regex
def is_valid_url(url):
    pattern = re.compile(
        r'^https?://'
        r'(?:(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}|'  # domain name (e.g. google.com)
        r'localhost|'                            # localhost
        r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # IPv4
        r'(?::\d+)?'                             # optional port
        r'(?:[/?#]\S*)?$',                       # path/queries/fragments
        re.IGNORECASE
    )
    return bool(pattern.match(url))

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/api/shorten', methods=['POST'])
def shorten_url():
    data = request.get_json() or {}
    original_url = data.get('url', '').strip()
    custom_alias = data.get('alias', '').strip()

    if not original_url:
        return jsonify({'error': 'URL is required.'}), 400

    # Automatically prepend http:// if no protocol is provided
    if not original_url.startswith(('http://', 'https://')):
        original_url = 'http://' + original_url

    if not is_valid_url(original_url):
        return jsonify({'error': 'Invalid URL format.'}), 400

    # Determine short code
    if custom_alias:
        # Validate alias (alphanumeric and underscores/hyphens only)
        if not all(c.isalnum() or c in '-_' for c in custom_alias):
            return jsonify({'error': 'Alias can only contain letters, numbers, hyphens, and underscores.'}), 400
        
        # Check if alias is already taken
        conn = get_db_connection()
        row = conn.execute('SELECT 1 FROM urls WHERE short_code = ?', (custom_alias,)).fetchone()
        conn.close()
        if row:
            return jsonify({'error': 'This custom alias is already taken.'}), 409
        
        short_code = custom_alias
    else:
        short_code = generate_random_code()

    # Insert into DB
    try:
        conn = get_db_connection()
        conn.execute(
            'INSERT INTO urls (short_code, original_url) VALUES (?, ?)',
            (short_code, original_url)
        )
        conn.commit()
        conn.close()
    except sqlite3.IntegrityError:
        return jsonify({'error': 'An error occurred. Please try again.'}), 500

    # Return details
    base_url = request.host_url
    short_url = f"{base_url}{short_code}"
    
    return jsonify({
        'success': True,
        'short_code': short_code,
        'short_url': short_url,
        'original_url': original_url
    }), 201

@app.route('/api/links', methods=['GET'])
def get_links():
    conn = get_db_connection()
    rows = conn.execute('SELECT * FROM urls ORDER BY created_at DESC').fetchall()
    conn.close()

    links = []
    base_url = request.host_url
    for row in rows:
        links.append({
            'id': row['id'],
            'short_code': row['short_code'],
            'short_url': f"{base_url}{row['short_code']}",
            'original_url': row['original_url'],
            'clicks': row['clicks'],
            'created_at': row['created_at']
        })
    return jsonify(links), 200

@app.route('/api/links/<short_code>', methods=['DELETE'])
def delete_link(short_code):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM urls WHERE short_code = ?', (short_code,))
    conn.commit()
    deleted = cursor.rowcount > 0
    conn.close()

    if deleted:
        return jsonify({'success': True, 'message': 'Link deleted.'}), 200
    else:
        return jsonify({'error': 'Link not found.'}), 404

@app.route('/<short_code>')
def redirect_to_url(short_code):
    conn = get_db_connection()
    row = conn.execute('SELECT original_url FROM urls WHERE short_code = ?', (short_code,)).fetchone()
    if row:
        # Increment click count
        conn.execute('UPDATE urls SET clicks = clicks + 1 WHERE short_code = ?', (short_code,))
        conn.commit()
        conn.close()
        return redirect(row['original_url'])
    
    conn.close()
    # Redirect to frontend dashboard with an error flag
    return redirect('/?error=not_found')

if __name__ == '__main__':
    init_db()
    print("Database initialized successfully.")
    app.run(host='0.0.0.0', port=5000, debug=True)
