/**
 * SEED SCRIPT - PremadeGG
 *
 * Usage: node seed.js
 *
 * Purpose:
 * 1. Connects to MongoDB.
 * 2. Cleans the DB (Drops existing Users, Reputations, LFGPosts and Teams).
 * 3. Creates 20 realistic Users with Valorant ranks/roles.
 * 4. Creates 50 Reviews interacting between these users.
 * 5. Creates 10 LFG Posts from users with good karma.
 * 6. Creates 5 Teams with rosters, coaches, and achievements.
 * 7. Calculates initial Karma based on reviews.
 */

const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');
const bcrypt = require('bcrypt');
const User = require('./models/User');
const Reputation = require('./models/Reputation');
const LFGPost = require('./models/LFGPost');
const Team = require('./models/Team');
require('dotenv').config();

// Configuration
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/premade-gg';
const USER_COUNT = 20;
const REVIEW_COUNT = 50;
const LFG_POST_COUNT = 10;

const VALORANT_RANKS = [
  'Iron',
  'Bronze',
  'Silver',
  'Gold',
  'Platinum',
  'Diamond',
  'Ascendant',
  'Immortal',
  'Radiant',
];
const VALORANT_ROLES = ['Duelist', 'Controller', 'Initiator', 'Sentinel', 'Flex'];
const SCHEDULES = ['Weekends', 'Evenings', 'Late Night', 'Mornings', 'Flexible'];
const REGIONS = ['eu', 'na', 'ap', 'kr'];

const VALORANT_AGENTS = [
  'Brimstone',
  'Phoenix',
  'Sage',
  'Sova',
  'Viper',
  'Cypher',
  'Reyna',
  'Killjoy',
  'Breach',
  'Omen',
  'Jett',
  'Raze',
  'Skye',
  'Yoru',
  'Astra',
  'KAY/O',
  'Chamber',
  'Neon',
  'Fade',
  'Harbor',
  'Gekko',
  'Deadlock',
  'Iso',
  'Clove',
  'Vyse',
  'Tejo',
  'Waylay',
  'Veto',
];

const BIOS = [
  'Jugador competitivo buscando equipo serio para ranked.',
  'Casual player, me gusta divertirme y mejorar.',
  'Main Duelist buscando team para torneos.',
  'Support main, buena comunicación y callouts.',
  'Ex-CS player, adaptándome a Valorant.',
  'Streamer buscando compañeros de juego.',
  'Disponible para scrims y ranked.',
  'Jugador flexible, puedo adaptarme a cualquier rol.',
  '',
  '',
];

const LFT_DETAILS = [
  'Busco equipo serio para torneos amateur, puedo entrenar 4 días/semana.',
  'Tengo experiencia en scrims y competitivo, busco team estable.',
  'IGL con experiencia, busco equipo para VCT Challengers.',
  'Main smokes buscando equipo organizado con horarios fijos.',
  'Busco team para competir en ligas online, horario flexible por las tardes.',
  'Llevo 2 años jugando competitivo, busco proyecto serio.',
  '',
];

async function seed() {
  try {
    console.log('🌱 Connecting to MongoDB...', MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected.');

    // 1. Clean Database
    console.log('🧹 Cleaning database...');
    await User.deleteMany({});
    await Reputation.deleteMany({});
    await LFGPost.deleteMany({});
    await Team.deleteMany({});
    console.log('✨ Database clean.');

    // 2. Create Users
    console.log(`👤 Generating ${USER_COUNT} users...`);
    const usersData = [];
    const defaultPassword = await bcrypt.hash('password123', 12);

    for (let i = 0; i < USER_COUNT; i++) {
      const role = faker.helpers.arrayElement(VALORANT_ROLES);
      const favoriteAgents = faker.helpers.arrayElements(VALORANT_AGENTS, { min: 0, max: 3 });
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const availability = {};
      for (const day of days) {
        const available = faker.datatype.boolean(0.5);
        availability[day] = {
          from: available
            ? faker.helpers.arrayElement(['16:00', '17:00', '18:00', '19:00', '20:00'])
            : '',
          to: available ? faker.helpers.arrayElement(['22:00', '23:00', '00:00', '01:00']) : '',
          available,
        };
      }

      usersData.push({
        email: faker.internet.email().toLowerCase(),
        password: defaultPassword,
        riotId: faker.internet.userName() + '#' + faker.string.alphanumeric(4).toUpperCase(),
        puuid: faker.string.uuid().replace(/-/g, '') + faker.string.alphanumeric(10),
        region: faker.helpers.arrayElement(REGIONS),
        rank: faker.helpers.arrayElement(VALORANT_RANKS),
        role,
        schedule: faker.helpers.arrayElement(SCHEDULES),
        karma: faker.number.float({ min: 1, max: 5, multipleOf: 0.1 }),
        accountLevel: faker.number.int({ min: 1, max: 500 }),
        cardImage: null,
        lastRankUpdate: faker.date.recent(),
        bio: faker.helpers.arrayElement(BIOS),
        profileImageType: 'riot_card',
        favoriteAgents,
        favoriteRole: faker.helpers.arrayElement([...VALORANT_ROLES, null]),
        socialLinks: {
          discord: faker.datatype.boolean(0.6) ? faker.internet.userName() : '',
          twitter: faker.datatype.boolean(0.3) ? faker.internet.userName() : '',
          twitch: faker.datatype.boolean(0.2) ? faker.internet.userName() : '',
        },
        availability,
        lookingForTeam: faker.datatype.boolean(0.3),
        lftDetails: faker.datatype.boolean(0.3) ? faker.helpers.arrayElement(LFT_DETAILS) : '',
      });
    }

    const savedUsers = await User.insertMany(usersData);
    console.log('✅ Users created.');
    console.log(`   📧 All seed users have password: "password123"`);

    // 3. Create Reviews (Reputation)
    console.log(`⭐ Generating ${REVIEW_COUNT} reviews...`);
    const reviewsData = [];
    const reviewPairs = new Set();

    while (reviewsData.length < REVIEW_COUNT) {
      const author = faker.helpers.arrayElement(savedUsers);
      const target = faker.helpers.arrayElement(savedUsers);

      if (author._id.equals(target._id)) continue;

      const pairKey = `${author._id}-${target._id}`;
      if (reviewPairs.has(pairKey)) continue;

      reviewPairs.add(pairKey);
      reviewsData.push({
        author: author._id,
        target: target._id,
        rating: faker.number.int({ min: 1, max: 5 }),
        comment: faker.lorem.sentence(),
        createdAt: faker.date.recent(),
      });
    }

    await Reputation.insertMany(reviewsData);
    console.log('✅ Reviews created.');

    // 4. Recalculate Karma for each user based on reviews received
    console.log('📊 Recalculating karma...');
    for (const user of savedUsers) {
      const reviews = await Reputation.find({ target: user._id });
      if (reviews.length > 0) {
        const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
        const karma = Math.round((totalRating / reviews.length) * 10) / 10;
        await User.findByIdAndUpdate(user._id, { karma });
      }
    }
    console.log('✅ Karma recalculated.');

    // 5. Create LFG Posts (only from users with karma >= 3)
    console.log(`📋 Generating ${LFG_POST_COUNT} LFG posts...`);
    const goodUsers = await User.find({ karma: { $gte: 3 } });
    const allUsersRefreshed = await User.find({});
    const TEAM_SIZES = [2, 3, 5];
    const LFG_TITLES = [
      'Buscando compañeros para ranked',
      'Team serio para competitivo',
      'Chill games, no tóxicos',
      'Subir de rango juntos',
      'Buscando support main',
      'Team nocturno casual',
      'Ranked tryhard only',
      'Necesito equipo para torneo',
      'Premade relajado con comms',
      'Duo/Trio para grindear',
    ];

    const lfgData = [];

    for (let i = 0; i < LFG_POST_COUNT && i < goodUsers.length; i++) {
      const teamSize = faker.helpers.arrayElement(TEAM_SIZES);
      const author = goodUsers[i];

      // Generar miembros: el autor siempre es miembro aceptado
      const members = [{ user: author._id, status: 'accepted', joinedAt: faker.date.recent() }];

      // Agregar algunos miembros aceptados y pendientes aleatorios
      const otherUsers = allUsersRefreshed.filter((u) => !u._id.equals(author._id));
      const shuffled = faker.helpers.shuffle(otherUsers);

      // Algunos aceptados (sin llenar el team completo)
      const acceptedCount = faker.number.int({
        min: 0,
        max: Math.min(teamSize - 2, shuffled.length),
      });
      for (let j = 0; j < acceptedCount && j < shuffled.length; j++) {
        members.push({ user: shuffled[j]._id, status: 'accepted', joinedAt: faker.date.recent() });
      }

      // Algunas solicitudes pendientes
      const pendingCount = faker.number.int({
        min: 0,
        max: Math.min(2, shuffled.length - acceptedCount),
      });
      for (let j = acceptedCount; j < acceptedCount + pendingCount && j < shuffled.length; j++) {
        members.push({ user: shuffled[j]._id, status: 'pending', joinedAt: faker.date.recent() });
      }

      lfgData.push({
        author: author._id,
        title: faker.helpers.arrayElement(LFG_TITLES),
        description: faker.lorem.sentences(2),
        teamSize,
        minRank: faker.helpers.arrayElement(VALORANT_RANKS),
        minKarma: faker.helpers.arrayElement([2.5, 3, 3.5, 4]),
        schedule: faker.helpers.arrayElement(SCHEDULES),
        members,
        status: 'open',
      });
    }

    await LFGPost.insertMany(lfgData);
    console.log('✅ LFG Posts created.');

    // 6. Create Teams
    const TEAM_COUNT = 5;
    console.log(`🏰 Generating ${TEAM_COUNT} teams...`);
    const TEAM_NAMES = [
      'Valorant Reapers',
      'Shadow Strikers',
      'Neon Wolves',
      'Phantom Squad',
      'Iron Clad Gaming',
    ];
    const TEAM_TAGS = ['REAP', 'SHDS', 'NWLF', 'PHNT', 'IRON'];
    const TEAM_DESCRIPTIONS = [
      'Equipo competitivo buscando mejorar en ranked y torneos amateur.',
      'Grupo de amigos que buscan ser competitivos y pasarlo bien.',
      'Team enfocado en scrims y mejora constante.',
      'Equipo casual con ganas de competir en ligas online.',
      'Roster estable buscando coach y analista para siguiente temporada.',
    ];
    const ACHIEVEMENTS = [
      {
        title: 'Campeón Liga Amateur S1',
        description: 'Primer puesto en la liga amateur de Valorant.',
      },
      {
        title: 'Semifinalista Torneo Community',
        description: 'Top 4 en torneo comunitario de 32 equipos.',
      },
      { title: 'MVP Regional', description: 'Mejor equipo de la región en el mes.' },
    ];
    const RECRUITING_ROLES = [
      'Duelist',
      'Controller',
      'Initiator',
      'Sentinel',
      'Flex',
      'Coach',
      'Analyst',
    ];

    const teamData = [];
    const usedOwners = new Set();

    for (let i = 0; i < TEAM_COUNT; i++) {
      // Pick a unique owner
      let owner;
      do {
        owner = faker.helpers.arrayElement(allUsersRefreshed);
      } while (usedOwners.has(owner._id.toString()));
      usedOwners.add(owner._id.toString());

      // Pick 2-4 players (owner is always first player)
      const otherPlayers = allUsersRefreshed.filter(
        (u) => !u._id.equals(owner._id) && !usedOwners.has(u._id.toString()),
      );
      const shuffledPlayers = faker.helpers.shuffle(otherPlayers);
      const playerCount = faker.number.int({ min: 2, max: Math.min(4, shuffledPlayers.length) });

      const players = [
        { user: owner._id, role: owner.role || 'Flex', joinedAt: faker.date.recent() },
      ];
      for (let j = 0; j < playerCount; j++) {
        players.push({
          user: shuffledPlayers[j]._id,
          role: shuffledPlayers[j].role || faker.helpers.arrayElement(VALORANT_ROLES),
          joinedAt: faker.date.recent(),
        });
      }

      // Optional coach
      const hasCoach = faker.datatype.boolean(0.4);
      const coachUser = hasCoach
        ? faker.helpers.arrayElement(allUsersRefreshed.filter((u) => !u._id.equals(owner._id)))
        : null;

      // Optional achievements
      const achievements = faker.datatype.boolean(0.5)
        ? faker.helpers.arrayElements(ACHIEVEMENTS, { min: 1, max: 2 }).map((a) => ({
            ...a,
            date: faker.date.recent(),
          }))
        : [];

      const recruiting = faker.datatype.boolean(0.5);

      teamData.push({
        name: TEAM_NAMES[i],
        tag: TEAM_TAGS[i],
        description: TEAM_DESCRIPTIONS[i],
        owner: owner._id,
        coach: coachUser ? coachUser._id : null,
        staff: [],
        players,
        region: faker.helpers.arrayElement(REGIONS),
        targetRank: faker.helpers.arrayElement(VALORANT_RANKS),
        socialLinks: {
          discord: faker.datatype.boolean(0.7) ? faker.internet.userName() : '',
          twitter: faker.datatype.boolean(0.3) ? faker.internet.userName() : '',
          twitch: faker.datatype.boolean(0.2) ? faker.internet.userName() : '',
          youtube: faker.datatype.boolean(0.1) ? faker.internet.userName() : '',
        },
        achievements,
        recruiting,
        recruitingRoles: recruiting
          ? faker.helpers.arrayElements(RECRUITING_ROLES, { min: 1, max: 3 })
          : [],
        recruitingDetails: recruiting
          ? 'Buscamos jugadores activos con buena actitud y ganas de mejorar.'
          : '',
      });
    }

    await Team.insertMany(teamData);
    console.log('✅ Teams created.');

    console.log('🌱 Seed completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed Error:', err);
    process.exit(1);
  }
}

seed();
