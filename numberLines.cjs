const fs=require('fs');
const lines=fs.readFileSync('sellerBrain_head.ts','utf8').split('\\n');
const numbered=lines.map((line,i)= '+line)).join('\\n');
fs.writeFileSync('sellerBrain_numbered.txt',numbered);
