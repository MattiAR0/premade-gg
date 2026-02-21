const bcrypt = require('bcrypt');
const User = require('../models/User');
const Team = require('../models/Team');
const LFGPost = require('../models/LFGPost');

const TEST_USERS = [
  {
    email: 'test1@premade.gg',
    riotId: 'TestUser1#EUW',
    puuid: 'test-puuid-1',
    region: 'eu',
    rank: 'Diamond',
    role: 'Duelist',
    schedule: 'Evenings',
    karma: 4.5,
    accountLevel: 100,
    bio: 'Usuario de prueba 1 - Main Duelist',
    profileImageType: 'riot_card',
    favoriteAgents: ['Jett', 'Reyna'],
    favoriteRole: 'Duelist',
    socialLinks: { discord: 'testuser1', twitter: '', twitch: '' },
    availability: {},
    lookingForTeam: true,
    lftDetails: 'Buscando equipo de prueba',
  },
  {
    email: 'test2@premade.gg',
    riotId: 'TestUser2#EUW',
    puuid: 'test-puuid-2',
    region: 'eu',
    rank: 'Ascendant',
    role: 'Controller',
    schedule: 'Weekends',
    karma: 4.8,
    accountLevel: 150,
    bio: 'Usuario de prueba 2 - Main Controller',
    profileImageType: 'riot_card',
    favoriteAgents: ['Omen', 'Brimstone'],
    favoriteRole: 'Controller',
    socialLinks: { discord: 'testuser2', twitter: '', twitch: '' },
    availability: {},
    lookingForTeam: false,
    lftDetails: '',
  },
  {
    email: 'test3@premade.gg',
    riotId: 'TestUser3#EUW',
    puuid: 'test-puuid-3',
    region: 'eu',
    rank: 'Platinum',
    role: 'Initiator',
    schedule: 'Flexible',
    karma: 3.5,
    accountLevel: 80,
    bio: 'Usuario de prueba 3 - Main Initiator',
    profileImageType: 'riot_card',
    favoriteAgents: ['Sova', 'Fade'],
    favoriteRole: 'Initiator',
    socialLinks: { discord: 'testuser3', twitter: '', twitch: '' },
    availability: {},
    lookingForTeam: true,
    lftDetails: 'Solo queue de prueba',
  },
];

const seedDefaults = async () => {
  try {
    console.log('🌱 Checking default test entities...');
    const defaultPassword = await bcrypt.hash('password123', 12);

    const savedUsers = [];

    // 1. Create or Find Users
    for (const userData of TEST_USERS) {
      let user = await User.findOne({ email: userData.email });
      if (!user) {
        user = new User({ ...userData, password: defaultPassword });
        await user.save();
        console.log(`👤 Created test user: ${userData.email}`);
      }
      savedUsers.push(user);
    }

    const test1 = savedUsers[0];
    const test2 = savedUsers[1];
    const test3 = savedUsers[2];

    // 2. Create or Find Teams
    const TEST_TEAMS = [
      {
        name: 'Test Team Alpha',
        tag: 'TTA',
        description: 'Equipo de prueba Alpha.',
        owner: test1._id,
        players: [
          { user: test1._id, role: test1.role, joinedAt: new Date() },
          { user: test2._id, role: test2.role, joinedAt: new Date() },
        ],
        region: 'eu',
        targetRank: 'Diamond',
        recruiting: true,
        recruitingRoles: ['Initiator', 'Sentinel'],
        recruitingDetails: 'Buscamos gente para el equipo de prueba Alpha.',
      },
      {
        name: 'Test Team Beta',
        tag: 'TTB',
        description: 'Equipo de prueba Beta.',
        owner: test2._id,
        players: [
          { user: test2._id, role: test2.role, joinedAt: new Date() },
          { user: test3._id, role: test3.role, joinedAt: new Date() },
        ],
        region: 'eu',
        targetRank: 'Ascendant',
        recruiting: false,
        recruitingRoles: [],
        recruitingDetails: '',
      },
    ];

    for (const teamData of TEST_TEAMS) {
      const existingTeam = await Team.findOne({ name: teamData.name });
      if (!existingTeam) {
        const team = new Team(teamData);
        await team.save();
        console.log(`🏰 Created test team: ${teamData.name}`);
      }
    }

    // 3. Create or Find LFG Posts
    const TEST_LFG = [
      {
        author: test3._id,
        title: 'Buscando duo de prueba',
        description: 'Soy un usuario de prueba buscando a otro para duo queue.',
        teamSize: 2,
        minRank: 'Gold',
        minKarma: 3,
        schedule: 'Flexible',
        members: [{ user: test3._id, status: 'accepted', joinedAt: new Date() }],
        status: 'open',
      },
      {
        author: test1._id,
        title: 'Reclutando para Test Team Alpha',
        description: 'Buscamos gente para probar las features de premade.gg.',
        teamSize: 5,
        minRank: 'Platinum',
        minKarma: 4,
        schedule: 'Evenings',
        members: [{ user: test1._id, status: 'accepted', joinedAt: new Date() }],
        status: 'open',
      },
    ];

    for (const lfgData of TEST_LFG) {
      const existingLFG = await LFGPost.findOne({ title: lfgData.title });
      if (!existingLFG) {
        const lfgPost = new LFGPost(lfgData);
        await lfgPost.save();
        console.log(`📋 Created test LFG post: "${lfgData.title}"`);
      }
    }

    console.log('✅ Default test entities verification complete.');
  } catch (err) {
    console.error('❌ Error seeding default test entities:', err);
  }
};

module.exports = seedDefaults;
