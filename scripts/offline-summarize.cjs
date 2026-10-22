// Writes the /api/analyze response without the image data URL, plus the curl wall time (used by offline-run.sh).
const r = require(require('path').resolve(process.argv[2]));
if (r.image) r.image.src = '[omitted: data URL of the normalized photo]';
r.clientWallMs = Number(process.env.WALL);
r.photo = process.env.PHOTO;
console.log(JSON.stringify(r, null, 2));
