/**
 * SEED SCRIPT - PremadeGG
 * 
 * Usage: node seed.js
 * 
 * Purpose: 
 * 1. Connects to MongoDB.
 * 2. Cleans the DB (Drops existing Users and Reputations).
 * 3. Creates 20 realistic Users with Valorant ranks/roles.
 * 4. Creates 50 Reviews interacting between these users.
 * 5. Calculates initial Karma based on reviews.
 */

const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');
const User = require('./models/User');
const Reputation = require('./models/Reputation');
require('dotenv').config();

// Configuration
// Default to local if no ENV provided
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/premade-gg';
const USER_COUNT = 20; // Requisito Rúbrica: 20 Usuarios
const REVIEW_COUNT = 50; // Requisito Rúbrica: 50 Reviews

const VALORANT_RANKS = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Immortal', 'Radiant'];
const VALORANT_ROLES = ['Duelist', 'Controller', 'Initiator', 'Sentinel', 'Flex'];
const SCHEDULES = ['Weekends', 'Evenings', 'Late Night', 'Mornings', 'Flexible'];

async function seed() {
    try {
        console.log('🌱 Connecting to MongoDB...', MONGO_URI);
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected.');

        // 1. Clean Database
        console.log('🧹 Cleaning database...');
        // We use deleteMany to clear collections without dropping indexes
        await User.deleteMany({});
        await Reputation.deleteMany({});
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
                // Initialize with random karma between 1 and 5
                karma: faker.number.float({ min: 1, max: 5, precision: 0.1 })
            });
        }

        const savedUsers = await User.insertMany(usersData);
        console.log('✅ Users created.');

        // 3. Create Reviews (Reputation)
        console.log(`⭐ Generating ${REVIEW_COUNT} reviews...`);
        const reviewsData = [];
        // We create a Set to track "author-target" pairs to avoid duplicates which would fail the unique index
        const reviewPairs = new Set();

        while (reviewsData.length < REVIEW_COUNT) {
            // Pick random author and target
            const author = faker.helpers.arrayElement(savedUsers);
            const target = faker.helpers.arrayElement(savedUsers);

            // Ensure author doesn't review themselves
            if (author._id.equals(target._id)) continue;

            // Ensure unique pair
            const pairKey = `${author._id}-${target._id}`;
            if (reviewPairs.has(pairKey)) continue;

            reviewPairs.add(pairKey);
            reviewsData.push({
                author: author._id,
                target: target._id,
                rating: faker.number.int({ min: 1, max: 5 }),
                comment: faker.lorem.sentence(),
                createdAt: faker.date.recent() // Recent timestamps for realism
            });
        }

        await Reputation.insertMany(reviewsData);
        console.log('✅ Reviews created.');

        console.log('🌱 Seed completed successfully!');
        process.exit(0);

    } catch (err) {
        console.error('❌ Seed Error:', err);
        process.exit(1);
    }
}

seed();
