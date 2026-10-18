# Nodevision/scripts/test-template-populator-browser.py
# Serve the production template modules and real ODP fixture, then optionally reopen the generated document in LibreOffice.
import http.server
import pathlib
import subprocess
import threading
import tempfile
import shutil
import sys
root = pathlib.Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='nodevision-odp-') as directory:
    output = pathlib.Path(directory) / 'populated.odp'
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(root / 'ApplicationSystem/public'), **kwargs)
        def log_message(self, *args):
            pass
        def do_GET(self):
            if self.path == '/':
                data = b'<div id="nv-session-root"></div><pre id="result">RUNNING</pre><script type="module" src="/tests.mjs"></script>'
                mime = 'text/html'
            elif self.path == '/tests.mjs':
                data = (root / 'scripts/template-populator-browser.mjs').read_bytes()
                mime = 'text/javascript'
            elif self.path == '/text-tests.mjs':
                data = (root / 'scripts/template-populator-text-browser.mjs').read_bytes()
                mime = 'text/javascript'
            elif self.path == '/fixture.odp':
                data = (root / 'scripts/fixtures/template-populator/libreoffice-tdf129430.odp').read_bytes()
                mime = 'application/vnd.oasis.opendocument.presentation'
            else:
                return super().do_GET()
            self.send_response(200)
            self.send_header('Content-Type', mime)
            self.end_headers()
            self.wfile.write(data)
        def do_POST(self):
            if self.path != '/generated.odp':
                self.send_error(404)
                return
            output.write_bytes(self.rfile.read(int(self.headers['Content-Length'])))
            self.send_response(200)
            self.end_headers()
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        code = subprocess.run(['node', str(root / 'scripts/run-browser-regression.mjs'), f'http://127.0.0.1:{server.server_port}/', 'chromium', '60000'], timeout=70).returncode
        office = shutil.which('libreoffice') or shutil.which('soffice')
        if code == 0 and office:
            subprocess.run([office, '-env:UserInstallation=' + (pathlib.Path(directory) / 'profile').as_uri(), '--headless', '--convert-to', 'pdf', '--outdir', directory, str(output)], check=True, timeout=60)
            if not output.with_suffix('.pdf').exists():
                raise RuntimeError('LibreOffice failed to reopen generated presentation')
            print('PASS: LibreOffice reopened and rendered generated ODP to PDF')
            subprocess.run([office, '-env:UserInstallation=' + (pathlib.Path(directory) / 'profile').as_uri(), '--headless', '--convert-to', 'pptx:Impress MS PowerPoint 2007 XML', '--outdir', directory, str(output)], check=True, timeout=60)
            import zipfile
            with zipfile.ZipFile(output.with_suffix('.pptx')) as archive:
                slides = [archive.read(name).decode() for name in archive.namelist() if name.startswith('ppt/slides/slide') and name.endswith('.xml')]
                assert any('U1' in slide for slide in slides) and any('L74' in slide for slide in slides)
                assert any(name.startswith('ppt/media/') for name in archive.namelist())
                import xml.etree.ElementTree as ET
                ns = {'a':'http://schemas.openxmlformats.org/drawingml/2006/main','p':'http://schemas.openxmlformats.org/presentationml/2006/main'}
                parsed = [ET.fromstring(slide) for slide in slides]
                assert len(parsed) == 2
                assert sum(node.text == 'U1' for slide in parsed for node in slide.findall('.//a:t', ns)) == 2
                assert any(slide.findall('.//p:pic', ns) for slide in parsed)
                assert any(slide.findall('.//a:xfrm', ns) for slide in parsed)
            converted = pathlib.Path(directory) / 'pptx-render'
            converted.mkdir()
            subprocess.run([office, '-env:UserInstallation=' + (pathlib.Path(directory) / 'profile').as_uri(), '--headless', '--convert-to', 'pdf', '--outdir', str(converted), str(output.with_suffix('.pptx'))], check=True, timeout=60)
            assert (converted / 'populated.pdf').exists()
            print('PASS: LibreOffice PPTX conversion retains inserted text and media')
        elif not office:
            print('SKIP: LibreOffice integration (libreoffice/soffice not installed)')
        sys.exit(code)
    finally:
        server.shutdown()
