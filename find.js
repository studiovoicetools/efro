const fs=require('fs');
const data=fs.readFileSync('src/lib/sales/sellerBrain.ts','utf16le');
const lines=data.split(/\r?\n/);
lines.forEach((line, idx)= if(line.includes('let candidates')) { console.log(idx+1, line); } });
