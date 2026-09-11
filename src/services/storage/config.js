const path = require('path');

const provider = (process.env.STORAGE_PROVIDER || 'local').toLowerCase();

const localRootPath = process.env.LOCAL_STORAGE_PATH
  ? path.resolve(process.env.LOCAL_STORAGE_PATH)
  : 'D:\\gymdietimages';

const localPublicBasePath = process.env.LOCAL_STORAGE_PUBLIC_BASE_PATH || '/media';

module.exports = {
  provider,
  localRootPath,
  localPublicBasePath,
};
