const express = require('express');
const path = require('path');
const { provider, localRootPath, localPublicBasePath } = require('./config');
const LocalStorageProvider = require('./providers/localStorageProvider');
const S3StorageProvider = require('./providers/s3StorageProvider');

let storageProvider;

function createProvider() {
  if (provider === 's3' || provider === 'r2') {
    return new S3StorageProvider();
  }

  return new LocalStorageProvider({
    rootPath: localRootPath,
    publicBasePath: localPublicBasePath,
  });
}

function getStorageProvider() {
  if (!storageProvider) {
    storageProvider = createProvider();
  }
  return storageProvider;
}

function mountStorageStatic(app) {
  if (provider !== 'local') {
    return;
  }

  const normalized = localPublicBasePath.startsWith('/')
    ? localPublicBasePath
    : `/${localPublicBasePath}`;

  app.use(normalized, express.static(path.resolve(localRootPath)));
}

module.exports = {
  getStorageProvider,
  mountStorageStatic,
};
