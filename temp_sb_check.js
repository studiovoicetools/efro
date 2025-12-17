const fs=require('fs'); 
const text=fs.readFileSync('src/lib/sales/sellerBrain.ts','utf8'); 
const res=[]; 
text.split(/\r?\n/).forEach((l,i)=>{if(l.includes('runSellerBrain'))res.push([i+1,l.slice(0,200)]);}); 
console.log(res.slice(0,40)); 
