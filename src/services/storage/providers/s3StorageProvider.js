class S3StorageProvider {
  constructor() {
    this.name = 's3';
  }

  async uploadBuffer() {
    throw new Error('S3StorageProvider não implementado. Configure o provider e credenciais para ativar.');
  }

  async deleteObject() {
    throw new Error('S3StorageProvider não implementado. Configure o provider e credenciais para ativar.');
  }

  getPublicUrl() {
    throw new Error('S3StorageProvider não implementado. Configure o provider e credenciais para ativar.');
  }
}

module.exports = S3StorageProvider;
