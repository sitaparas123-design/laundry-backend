const Area = require('../models/Area');

const DEFAULT_AREAS = [
  "Abdali",
  "Abu Fatira",
  "Abu Halifa",
  "Adailiya",
  "Adan",
  "Andalus",
  "Anjafa",
  "Bayan",
  "Bneid Al Gar",
  "Dasma",
  "Egaila",
  "Fahaheel",
  "Farwaniya",
  "Firdous",
  "Fintas",
  "Hassawi",
  "Hateen",
  "Hawalli",
  "Ishbiliya",
  "Jabriya",
  "Jahra",
  "Jahra Gate",
  "Jleeb Al Shuyoukh",
  "Keifan",
  "Khaitan",
  "Khiran",
  "Kuwait City",
  "Mahboula",
  "Mangaf",
  "Mansouriya",
  "Messila",
  "Mishref",
  "Mubarak Al Abdallah",
  "Mubarak Al Kabeer",
  "Nuzha",
  "Nuwaisib",
  "Omariya",
  "Oyoun",
  "Qadsiya",
  "Qurain",
  "Qurtoba",
  "Qusour",
  "Qasr",
  "Rabiya",
  "Rumaithiya",
  "Saad Al Abdullah",
  "Sabah Al Ahmad",
  "Sabah Al Salem",
  "Salam",
  "Salmiya",
  "Salmiya South",
  "Salwa",
  "Shaab",
  "Shamiya",
  "Sharq",
  "Shuwaikh",
  "Siddeeq",
  "Subiya",
  "Sulaibikhat",
  "Sulaibiya",
  "Sulaibiya Industrial",
  "Taima",
  "Wafra",
  "Waha",
  "Zahra",
  "Zoor"
];

const seedAreas = async () => {
  try {
    const count = await Area.countDocuments();
    if (count === 0) {
      console.log('Seeding default areas...');
      const areaDocs = DEFAULT_AREAS.map(name => ({ name }));
      await Area.insertMany(areaDocs);
      console.log(`Successfully seeded ${DEFAULT_AREAS.length} default areas.`);
    }

    // Ensure Home Service branch exists
    const Branch = require('../models/Branch');
    const homeBranch = await Branch.findOne({ name: /^Home Service$/i });
    if (!homeBranch) {
      await Branch.create({
        name: 'Home Service',
        address: 'Home Service Central Hub',
        phone: '99999994',
        manager: 'Logistics Manager',
        status: 'Active'
      });
      console.log("Successfully ensured 'Home Service' branch exists.");
    }
  } catch (error) {
    console.error('Error seeding default areas:', error);
  }
};

module.exports = seedAreas;
