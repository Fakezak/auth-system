const fs = require('fs-extra');
const path = require('path');

async function setupGameFiles() {
  console.log('🎮 Setting up FreeFire authentication system...');
  
  // Create directories
  const gameDir = path.join(process.cwd(), 'com.dts.freefireth', 'files');
  await fs.ensureDir(gameDir);
  console.log(`✅ Created game directory: ${gameDir}`);
  
  // Create localconfig in game files
  const config = {
    game: {
      name: 'FreeFire',
      version: '1.0.0',
      serverUrl: 'http://localhost:3000',
      redirectUri: 'com.dts.freefireth:/auth/callback'
    },
    auth: {
      methods: {
        discord: true,
        facebook: true,
        google: true,
        normal: true
      },
      requireDiscordJoin: true,
      discordServerId: 'k6R6CKw7Q',
      autoRedirect: true,
      redirectDelay: 2000
    },
    gameFiles: {
      path: 'com.dts.freefireth/files/',
      configFile: 'game_config.json',
      userDataFile: 'user_data.json'
    }
  };
  
  await fs.writeJson(
    path.join(gameDir, 'localconfig.json'),
    config,
    { spaces: 2 }
  );
  console.log('✅ Created localconfig.json');
  
  // Create sample user data
  const sampleUser = {
    userId: 'sample_user',
    gameId: 'FFSAMPLE001',
    username: 'SamplePlayer',
    level: 1,
    stats: {
      kills: 0,
      deaths: 0,
      headshots: 0,
      matchesPlayed: 0
    },
    authType: 'normal',
    joinedDiscord: false,
    role: 'user'
  };
  
  await fs.writeJson(
    path.join(gameDir, 'sample_user_data.json'),
    sampleUser,
    { spaces: 2 }
  );
  console.log('✅ Created sample user data');
  
  console.log('\n✨ Setup complete!');
  console.log('📋 Next steps:');
  console.log('1. Create a .env file with your credentials');
  console.log('2. Set up MongoDB');
  console.log('3. Run npm start');
  console.log('\n🔗 Discord Server: https://discord.gg/k6R6CKw7Q');
}

setupGameFiles().catch(console.error);
