const express = require('express');
const router = express.Router();
const CatalogItem = require('../models/CatalogItem');
const { authenticate } = require('../middleware/auth');

// Default initial items
// Default initial items
const defaultCatalog = [
  { name: 'Dishdasha', key: 'dishdasha', nameAr: 'دشداشة', price: 1.5, icon: '🥋', category: 'traditional', color: '#8b5cf6' },
  { name: 'Dishdasha (Premium)', key: 'dishdashaPremium', nameAr: 'دشداشة (ممتاز)', price: 2.5, icon: '🥋', category: 'traditional', color: '#8b5cf6' },
  { name: 'Small Dishdasha', key: 'smallDishdasha', nameAr: 'دشداشة صغير', price: 1.0, icon: '🥋', category: 'traditional', color: '#8b5cf6' },
  { name: 'Small Dishdasha (Premium)', key: 'smallDishdashaPremium', nameAr: 'دشداشة صغير (ممتاز)', price: 1.75, icon: '🥋', category: 'traditional', color: '#8b5cf6' },
  { name: 'Ghotraa', key: 'ghotraa', nameAr: 'غترة', price: 0.5, icon: '👳', category: 'traditional', color: '#8b5cf6' },
  { name: 'Shmage', key: 'shmage', nameAr: 'شماغ', price: 0.75, icon: '🧣', category: 'traditional', color: '#8b5cf6' },
  { name: 'Shmage (Special)', key: 'shmageSpecial', nameAr: 'شماغ (خاص)', price: 1.25, icon: '🧣', category: 'traditional', color: '#8b5cf6' },
  { name: 'Gahfiya', key: 'gahfiya', nameAr: 'قحفية', price: 0.25, icon: '🧢', category: 'traditional', color: '#8b5cf6' },
  { name: 'Shirt', key: 'shirt', nameAr: 'قميص', price: 0.75, icon: '👔', category: 'casual', color: '#3b82f6' },
  { name: 'Bisht', key: 'bisht', nameAr: 'بشت', price: 3.5, icon: '🧥', category: 'traditional', color: '#8b5cf6' },
  { name: 'Trousers', key: 'trousers', nameAr: 'بنطلون', price: 0.75, icon: '👖', category: 'casual', color: '#3b82f6' },
  { name: 'Jacket', key: 'jacket', nameAr: 'جاكيت', price: 1.5, icon: '🧥', category: 'outerwear', color: '#f59e0b' },
  { name: 'BIG Jacket', key: 'bigJacket', nameAr: 'جاكيت كبير', price: 2.5, icon: '🧥', category: 'outerwear', color: '#f59e0b' },
  { name: 'Carpet', key: 'carpet', nameAr: 'سجاد', price: 5.0, icon: '🧹', category: 'household', color: '#10b981' },
  { name: 'Military Suit', key: 'militarySuit', nameAr: 'بدلة عسكرية', price: 3.0, icon: '🎖️', category: 'casual', color: '#3b82f6' },
  { name: 'Cap', key: 'cap', nameAr: 'كاب', price: 0.5, icon: '🧢', category: 'casual', color: '#3b82f6' },
  { name: 'Coat', key: 'coat', nameAr: 'معطف', price: 2.0, icon: '🧥', category: 'outerwear', color: '#f59e0b' },
  { name: 'Suit', key: 'suit', nameAr: 'بدلة', price: 2.5, icon: '🤵', category: 'casual', color: '#3b82f6' },
  { name: 'Small Trousers', key: 'smallTrousers', nameAr: 'بنطلون صغير', price: 0.5, icon: '👖', category: 'casual', color: '#3b82f6' },
  { name: 'Dress', key: 'dress', nameAr: 'فستان', price: 1.5, icon: '👗', category: 'casual', color: '#3b82f6' },
  { name: 'School Dress', key: 'schoolDress', nameAr: 'فستان مدرسة', price: 1.0, icon: '👗', category: 'casual', color: '#3b82f6' },
  { name: 'Dressing Gown', key: 'dressingGown', nameAr: 'روب منزلي', price: 2.0, icon: '👘', category: 'casual', color: '#3b82f6' },
  { name: 'Evening Dress', key: 'eveningDress', nameAr: 'فستان سهرة', price: 3.0, icon: '👗', category: 'casual', color: '#3b82f6' },
  { name: 'Wedding Dress', key: 'weddingDress', nameAr: 'فستان زفاف', price: 15.0, icon: '👰', category: 'special', color: '#ec4899' },
  { name: 'Large Blouse', key: 'largeBlouse', nameAr: 'بلوزة كبيرة', price: 1.25, icon: '👚', category: 'casual', color: '#3b82f6' },
  { name: 'Skirt', key: 'skirt', nameAr: 'تنورة', price: 1.0, icon: '👗', category: 'casual', color: '#3b82f6' },
  { name: 'Small Skirt', key: 'smallSkirt', nameAr: 'تنورة صغيرة', price: 0.75, icon: '👗', category: 'casual', color: '#3b82f6' },
  { name: 'Abaya', key: 'abaya', nameAr: 'عباية', price: 2.0, icon: '🧕', category: 'traditional', color: '#8b5cf6' },
  { name: 'Hegab', key: 'hegab', nameAr: 'حجاب', price: 0.5, icon: '🧕', category: 'traditional', color: '#8b5cf6' },
  { name: 'Bluse', key: 'bluse', nameAr: 'بلوزة', price: 1.0, icon: '👚', category: 'casual', color: '#3b82f6' },
  { name: 'OVERALL', key: 'overall', nameAr: 'أوفرول', price: 2.0, icon: '🥋', category: 'casual', color: '#3b82f6' },
  { name: 'Curtain', key: 'curtain', nameAr: 'ستارة', price: 3.0, icon: '🪟', category: 'household', color: '#10b981' },
  { name: 'Sheet', key: 'sheet', nameAr: 'شرشف', price: 1.5, icon: '🛏️', category: 'household', color: '#10b981' },
  { name: 'Plaid', key: 'plaid', nameAr: 'بطانية خفيفة', price: 2.5, icon: '🛏️', category: 'household', color: '#10b981' },
  { name: 'Single quilt', key: 'singleQuilt', nameAr: 'لحاف مفرد', price: 3.0, icon: '🛏️', category: 'household', color: '#10b981' },
  { name: 'Double quilt', key: 'doubleQuilt', nameAr: 'لحاف مزدوج', price: 4.5, icon: '🛏️', category: 'household', color: '#10b981' },
];

// GET /api/catalog
router.get('/', authenticate, async (req, res) => {
  try {
    let items = await CatalogItem.find();
    if (items.length === 0) {
      await CatalogItem.insertMany(defaultCatalog);
      items = await CatalogItem.find();
    } else {
      // One-time database migration: update existing catalog items to include nameAr
      let updatedAny = false;
      for (const item of items) {
        if (!item.nameAr) {
          const match = defaultCatalog.find(d => d.key === item.key);
          if (match && match.nameAr) {
            item.nameAr = match.nameAr;
            await item.save();
            updatedAny = true;
          }
        }
      }
      if (updatedAny) {
        items = await CatalogItem.find();
      }
    }
    res.json(items);
  } catch (error) {
    console.error('Get catalog items error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/catalog
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, nameAr, key, price, prices, icon, category, color, image, hasSizes, sizes } = req.body;
    if (!name || !key || price === undefined) {
      return res.status(400).json({ message: 'Name, key, and price are required.' });
    }
    const item = new CatalogItem({
      name, nameAr, key, price, prices, icon, category, color, image, hasSizes, sizes
    });
    await item.save();
    res.status(201).json(item);
  } catch (error) {
    console.error('Create catalog item error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/catalog/:key
router.put('/:key', authenticate, async (req, res) => {
  try {
    const { name, nameAr, price, prices, icon, category, color, image, hasSizes, sizes } = req.body;
    const item = await CatalogItem.findOne({ key: req.params.key });
    if (!item) {
      return res.status(404).json({ message: 'Catalog item not found' });
    }
    if (name !== undefined) item.name = name;
    if (nameAr !== undefined) item.nameAr = nameAr;
    if (price !== undefined) item.price = price;
    if (prices !== undefined) item.prices = prices;
    if (icon !== undefined) item.icon = icon;
    if (category !== undefined) item.category = category;
    if (color !== undefined) item.color = color;
    if (image !== undefined) item.image = image;
    if (hasSizes !== undefined) item.hasSizes = hasSizes;
    if (sizes !== undefined) item.sizes = sizes;

    await item.save();
    res.json(item);
  } catch (error) {
    console.error('Update catalog item error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/catalog/:key
router.delete('/:key', authenticate, async (req, res) => {
  try {
    const result = await CatalogItem.deleteOne({ key: req.params.key });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Catalog item not found' });
    }
    res.json({ message: 'Catalog item deleted successfully' });
  } catch (error) {
    console.error('Delete catalog item error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
