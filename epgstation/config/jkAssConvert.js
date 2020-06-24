const fs = require('fs');
const path = require('path');

const startat = process.env.STARTAT;
const endat = process.env.ENDAT;
const recpath = process.env.RECPATH;
const dirname = path.dirname(recpath);
const basename = path.basename(recpath, path.extname(recpath));

const assfilename = dirname + '/' + basename + 'ass'
const str = startat + '\n' + endat + '\n' + recpath

fs.writeFile(assfilename, str, () => {});


