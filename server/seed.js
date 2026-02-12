/**
 * SEED SCRIPT - PremadeGG
 *
 * Usage: node seed.js
 *
 * Purpose:
 * 1. Connects to MongoDB.
 * 2. Cleans the DB (Drops existing Users, Reputations and LFGPosts).
 * 3. Creates 20 realistic Users with Valorant ranks/roles.
 * 4. Creates 50 Reviews interacting between these users.
 * 5. Creates 10 LFG Posts from users with good karma.
 * 6. Calculates initial Karma based on reviews.
 */

const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');
const User = require('./models/User');
const Reputation = require('./models/Reputation');
const LFGPost = require('./models/LFGPost');
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
    console.log('✨ Database clean.');

    // 2. Create Users
    console.log(`👤 Generating ${USER_COUNT} users...`);
    const usersData = [];

    for (let i = 0; i < USER_COUNT; i++) {
      usersData.push({
        riotId: faker.internet.userName() + '#' + faker.string.alphanumeric(4).toUpperCase(),
        rank: faker.helpers.arrayElement(VALORANT_RANKS),
        role: faker.helpers.arrayElement(VALORANT_ROLES),
        schedule: faker.helpers.arrayElement(SCHEDULES),
        karma: faker.number.float({ min: 1, max: 5, multipleOf: 0.1 }),
      });
    }

    const savedUsers = await User.insertMany(usersData);
    console.log('✅ Users created.');

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
    const lfgData = [];

    for (let i = 0; i < LFG_POST_COUNT && i < goodUsers.length; i++) {
      const roles = faker.helpers.arrayElements(VALORANT_ROLES, { min: 1, max: 3 });
      lfgData.push({
        author: goodUsers[i]._id,
        title: `Looking for ${roles.join('/')} - ${faker.helpers.arrayElement(VALORANT_RANKS)}+`,
        description: faker.lorem.sentences(2),
        requiredRoles: roles,
        minRank: faker.helpers.arrayElement(VALORANT_RANKS),
        minKarma: faker.helpers.arrayElement([2.5, 3, 3.5, 4]),
        schedule: faker.helpers.arrayElement(SCHEDULES),
        maxPlayers: faker.number.int({ min: 2, max: 5 }),
        status: 'open',
      });
    }

    await LFGPost.insertMany(lfgData);
    console.log('✅ LFG Posts created.');

    console.log('🌱 Seed completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed Error:', err);
    process.exit(1);
  }
}

seed();
