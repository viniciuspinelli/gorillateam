const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

class LocalStorageProvider {
  constructor({ rootPath, publicBasePath }) {
    this.rootPath = rootPath;
    this.publicBasePath = publicBasePath;
  }

  async ensureRootDirectory() {
    await fs.mkdir(this.rootPath, { recursive: true });
  }

  async uploadBuffer({ buffer, mimeType, originalName, folder }) {
    await this.ensureRootDirectory();

    const extension = this.getExtensionFromMime(mimeType, originalName);
    const key = path.posix.join(folder, `${crypto.randomUUID()}.${extension}`);

    const fullPath = path.join(this.rootPath, ...key.split('/'));
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);

    return {
      key,
      publicUrl: this.getPublicUrl(key),
      sizeBytes: buffer.length,
    };
  }

  async deleteObject(key) {
    const filePath = path.join(this.rootPath, ...String(key || '').split('/'));
    try {
      await fs.unlink(filePath);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
  }

  getPublicUrl(key) {
    const normalizedKey = String(key || '').replace(/\\/g, '/');
    return `${this.publicBasePath}/${normalizedKey}`;
  }

  getExtensionFromMime(mimeType, originalName) {
    const map = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'image/avif': 'avif',
    };

    if (map[mimeType]) return map[mimeType];

    const ext = path.extname(originalName || '').replace('.', '').toLowerCase();
    if (ext) return ext;

    return 'bin';
  }
}

module.exports = LocalStorageProvider;
