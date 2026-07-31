module.exports = {
  mongodb: {
    url:
      process.env.MONGODB_URI ??
      'mongodb://root:rootpass@localhost:27017/history_db?authSource=admin',
    databaseName: process.env.DB_NAME ?? 'history_db',
    options: {},
  },
  migrationsDir: 'src/migrations',
  changelogCollectionName: 'migrations',
  migrationFileExtension: '.js',
};
