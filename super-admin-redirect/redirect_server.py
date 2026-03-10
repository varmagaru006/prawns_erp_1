"""
Simple redirect server for port 3001.
Redirects all requests from the old super-admin URL to the new integrated panel.
"""
from http.server import HTTPServer, BaseHTTPRequestHandler

class RedirectHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(302)
        self.send_header('Location', '/login')
        self.send_header('Cache-Control', 'no-cache')
        self.end_headers()

    def do_POST(self):
        # Return 410 Gone for old API calls - they should use new endpoints
        self.send_response(410)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(b'{"error": "This endpoint has been deprecated. Please use /login to access the Super Admin panel."}')

    def log_message(self, format, *args):
        pass  # Suppress logs

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 3001), RedirectHandler)
    print('Redirect server running on port 3001')
    server.serve_forever()
