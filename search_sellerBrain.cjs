const fs=require('fs'); 
const path=require('path'); 
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory()){if(entry.name==='node_modules')continue;walk(full);}else{searchFile(full);}}} 
function searchFile(file){const text=fs.readFileSync(file,'utf8');if(text.includes('sellerBrain')){const lines=text.split(/\r?\n/);lines.forEach(function(l,i){if(l.includes('sellerBrain')){console.log(file+':'+(i+1)+':'+l.trim());}});}} 
walk('src'); 
