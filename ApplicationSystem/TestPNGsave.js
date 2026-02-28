import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';

const form = new FormData();
form.append('file', fs.createReadStream('myImage.png'));

const response = await fetch('http://localhost:3000/api/file/upload-binary', {
  method: 'POST',
  body: form
});

const result = await response.json();
console.log(result);
