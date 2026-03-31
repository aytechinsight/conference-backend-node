const mongoose = require('mongoose');
require('dotenv').config();
const connectDB = require('./config/db');
const Article = require('./models/Article');

(async () => {
    await connectDB();
    const result = await Article.deleteMany({});
    console.log('Deleted articles:', result.deletedCount);
    console.log('All users/reviewers/admins kept intact.');
    process.exit(0);
})();
