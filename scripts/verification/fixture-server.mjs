import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
const pdf = readFileSync('dist/sample.pdf');
createServer((request, response) => {
  if (request.url.startsWith('/html.pdf')) {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end('<h1>Not a PDF</h1>');
    return;
  }
  response.writeHead(200, { 'Content-Type': 'application/pdf', ...(request.url.startsWith('/attachment') ? { 'Content-Disposition': 'attachment; filename="guide.pdf"' } : {}) });
  response.end(pdf);
}).listen(4180, '127.0.0.1', () => console.log('PDF navigation fixtures: http://127.0.0.1:4180'));
