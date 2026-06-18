const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const colors = {
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  reset: '\x1b[0m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

try {
  log('yellow', 'Stopping all containers and removing volumes...');

  const infrastructurePath = path.join(__dirname, '../infrastructure');

  // Docker compose down -v
  execSync('docker-compose down -v', {
    stdio: 'inherit',
    cwd: infrastructurePath,
  });

  log('green', 'Containers stopped and volumes removed');
  console.log('');

  log('blue', 'Generating new JWT_SECRET for next start...');

  // Generate new JWT secret
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  const newJwtSecret = `jwt-secret-${timestamp}-${random}`;

  // Write down to .env
  const envPath = path.join(infrastructurePath, '.env');
  const envContent = `# Auto-generated JWT secret - ${new Date().toISOString()}\nJWT_SECRET=${newJwtSecret}\n`;

  fs.writeFileSync(envPath, envContent);

  log('green', 'New JWT_SECRET saved to infrastructure/.env');
  log('yellow', `   ${newJwtSecret}`);
  console.log('');

  log('green', ' System reset complete!');
  log('red', '️  Next start will use new JWT_SECRET');
  log('blue', '   Run: npm run docker:start');
  console.log('');

} catch (error) {
  log('red', ` Error: ${error.message}`);
  process.exit(1);
}
