const fs=require('fs'); 
const path=require('path'); 
const target='runSellerBrainV2'; 
const results=[]; 
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory()){if(entry.name==='node_modules')continue;walk(full);}else{const content=fs.readFileSync(full,'utf8');if(content.includes(target))results.push(full);}}} 
walk('src'); 
console.log(results); 
