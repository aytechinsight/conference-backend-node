const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const users = [
    { name: 'Super Admin', email: 'superadmin@icreate.com', password: 'superadmin123', role: 'superadmin', isEmailVerified: true, profileComplete: true, fullName: 'Super Admin' },
    { name: 'Admin Lead', email: 'admin@icreate.com', password: 'password123', role: 'admin', isEmailVerified: true, profileComplete: true, fullName: 'Admin Lead' },
    { name: 'Participant User', email: 'user@icreate.com', password: 'password123', role: 'user', isEmailVerified: true },
    { name: 'Internal Reviewer 1', email: 'reviewer1@icreate.com', password: 'password123', role: 'reviewer 1', isEmailVerified: true, profileComplete: true, fullName: 'Internal Reviewer 1' },
    { name: 'External Reviewer 2', email: 'reviewer2@icreate.com', password: 'password123', role: 'reviewer 2', isEmailVerified: true, profileComplete: true, fullName: 'External Reviewer 2' },
    { name: 'Tech Lead', email: 'tech@icreate.com', password: 'password123', role: 'technical reviewer', isEmailVerified: true, profileComplete: true, fullName: 'Tech Lead' },
];

const seedDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected for Seeding');
        
        await User.deleteMany();
        console.log('🧹 Existing users cleared');
        
        await User.create(users);
        console.log('✅ Database successfully seeded with test accounts:');
        users.forEach(u => console.log(`- User: ${u.email} | Pass: ${u.password} | Role: ${u.role}`));
        
        process.exit();
    } catch (error) {
        console.error('❌ Error seeding data:', error);
        process.exit(1);
    }
};

seedDB();
