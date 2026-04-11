const mongoose = require('mongoose');

const paymentPlanSchema = new mongoose.Schema({
    key: { type: String, required: true },          // "Scopus Student - Indian" — used as Razorpay plan key
    label: { type: String, required: true },         // "Scopus Indexed Conference"
    sub: { type: String, default: '' },              // "Author's (Student) Registration"
    group: { type: String, enum: ['Indian', 'International'], required: true },
    amount: { type: Number, required: true },         // numeric, e.g. 8000
    currency: { type: String, enum: ['INR', 'USD'], required: true },
    highlight: { type: Boolean, default: false },
}, { _id: false });

const importantDateSchema = new mongoose.Schema({
    label: { type: String, required: true },         // "Last Date of Paper Submission"
    date: { type: String, required: true },          // "March 30, 2026"
    icon: { type: String, default: 'CalendarDays' }, // Lucide icon name
}, { _id: false });

const siteConfigSchema = new mongoose.Schema({
    // Singleton sentinel — only one config document ever exists
    _singleton: { type: String, default: 'config', unique: true },

    paymentPlans: { type: [paymentPlanSchema], default: [] },

    importantDates: { type: [importantDateSchema], default: [] },

    homepageCard: {
        conferenceTitle: { type: String, default: 'iCreate-2026' },
        indexingBadge: { type: String, default: 'Scopus Indexed' },
        conferenceThemePrefix: { type: String, default: 'International Conference on' },
        conferenceTheme: { type: String, default: 'Research, Enhancement & Advancements in Technology and Engineering' },
        monthYear: { type: String, default: 'APRIL 2026' },
        organizedBy: { type: String, default: 'AY TECHINSIGHT PRIVATE LIMITED' },
        sponsoredBy: { type: String, default: 'International Journal for Research in Engineering Application and Management (IJREAM)' },
        conferenceDate: { type: String, default: 'APRIL 19, 2026' },
    },
}, { timestamps: true });

// Default seed data applied on first-ever fetch
siteConfigSchema.statics.getOrCreate = async function () {
    let config = await this.findOne({ _singleton: 'config' });
    if (!config) {
        config = await this.create({
            paymentPlans: [
                { key: 'Peer Reviewed Journal - Indian',           label: 'Peer Reviewed Journal',      sub: "Author's Registration",                      group: 'Indian',        amount: 2800,  currency: 'INR', highlight: false },
                { key: 'Scopus Student - Indian',                  label: 'Scopus Indexed Conference',  sub: "Author's (Student) Registration",            group: 'Indian',        amount: 8000,  currency: 'INR', highlight: true  },
                { key: 'Scopus Faculty - Indian',                  label: 'Scopus Indexed Conference',  sub: "Author's (Faculty/Industry) Registration",   group: 'Indian',        amount: 9500,  currency: 'INR', highlight: true  },
                { key: 'Peer Reviewed Journal - International',    label: 'Peer Reviewed Journal',      sub: "Author's Registration",                      group: 'International', amount: 70,    currency: 'USD', highlight: false },
                { key: 'Scopus Student - International',           label: 'Scopus Indexed Conference',  sub: "Author's (Student) Registration",            group: 'International', amount: 120,   currency: 'USD', highlight: true  },
                { key: 'Scopus Faculty - International',           label: 'Scopus Indexed Conference',  sub: "Author's (Faculty/Industry) Registration",   group: 'International', amount: 150,   currency: 'USD', highlight: true  },
            ],
            importantDates: [
                { label: 'Last Date of Paper Submission',  date: 'March 30, 2026', icon: 'Users' },
                { label: 'Paper Acceptance Notification', date: 'Apr 05, 2026',   icon: 'CheckCircle' },
                { label: 'Camera Ready Paper',            date: 'Apr 08, 2026',   icon: 'Award' },
                { label: 'Paper Registration',            date: 'Apr 08, 2026',   icon: 'UserPlus' },
                { label: 'Conference Date',               date: 'Apr 19, 2026',   icon: 'CalendarDays' },
            ],
        });
    }
    return config;
};

module.exports = mongoose.model('SiteConfig', siteConfigSchema);
