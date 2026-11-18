const fs = require('fs');
const content = fs.readFileSync('node_modules/@nexconn/chat/index.cjs', 'utf8');
const searchStr = '"join",';
const idx = content.indexOf(searchStr);
console.log('Index:', idx);
if (idx !== -1) {
  console.log(content.substring(idx - 20, idx + 400));
}

