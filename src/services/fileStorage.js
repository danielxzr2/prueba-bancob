const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

/**
 * Stores CVs in a private server folder (RNF-03). Files get a generated name, so
 * the original filename sent by the client never touches the filesystem.
 */
function createFileStorage(uploadsDir) {
  return {
    async savePdf(buffer) {
      const fileName = `${randomUUID()}.pdf`;
      // 'wx' fails if the file already exists: never overwrite an existing CV.
      await fs.writeFile(path.join(uploadsDir, fileName), buffer, { flag: 'wx' });
      return fileName;
    },

    async remove(fileName) {
      await fs.rm(path.join(uploadsDir, fileName), { force: true });
    },
  };
}

module.exports = { createFileStorage };
