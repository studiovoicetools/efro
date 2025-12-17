const fs=require('fs'); 
const lines=fs.readFileSync('src/lib/sales/brain/orchestrator.ts','utf8').split(/\r?\n/); 
const start=216,end=260; 
lines.slice(start-1,end).forEach((l,i)=>{console.log(String(start+i).padStart(5,' ')+':'+l);}); 
