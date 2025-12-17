const fs=require('fs'); 
const lines=fs.readFileSync('src/lib/sales/sellerBrain.ts','utf8').split(/\r?\n/); 
const start=1,end=200; 
lines.slice(start-1,end).forEach((l,i)=>{console.log(String(start+i).padStart(5,' ')+':'+l);}); 
