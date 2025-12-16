const fs=require('fs'); 
const text=fs.readFileSync('src/lib/sales/sellerBrain.ts','utf8'); 
const regex=/Brain[A-Za-z]*/g; 
const set=new Set(); 
let m; 
while((m=regex.exec(text))){set.add(m[0]);} 
console.log([...set]); 
