import { execSync } from 'child_process';

console.log('🔄 Versioning packages...');
execSync('npx changeset version', { stdio: 'inherit' });

console.log('📦 Updating lockfile...');
execSync('pnpm install --no-frozen-lockfile', { stdio: 'inherit' });

console.log('✅ Versioning complete');
