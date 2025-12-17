const fs=require('fs');
const data=fs.readFileSync('src/lib/sales/sellerBrain.ts','utf16le').toString();
const idx=data.indexOf('filterProductsForSellerBrain');
console.log(idx);
console.log(data.slice(idx-200, idx+400));
