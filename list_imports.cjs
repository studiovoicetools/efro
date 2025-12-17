const fs=require('fs'); 
const text=fs.readFileSync('src/lib/sales/brain/orchestrator.ts','utf8'); 
const lines=text.split(/\r?\n/).filter(l= 
