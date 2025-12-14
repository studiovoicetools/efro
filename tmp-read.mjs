import fs from 'node:fs';
const lines=fs.readFileSync('sellerbrain-run.log','utf8').split(/\r?\n/);
lines.forEach((l,i)= console.log(i+1,l);});
