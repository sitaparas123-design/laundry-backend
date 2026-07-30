const mongoose = require('mongoose');

const catalogItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  nameAr: { type: String },
  key: { type: String, required: true, unique: true },
  price: { type: Number, required: true },
  prices: {
    expressIroning: { type: Number, default: 0 },
    expressWashIron: { type: Number, default: 0 },
    normalIroning: { type: Number, default: 0 },
    normalWashIron: { type: Number, default: 0 }
  },
  icon: { type: String },
  category: { type: String },
  color: { type: String },
  image: { type: String },
  hasSizes: { type: Boolean, default: false },
  sizes: { type: mongoose.Schema.Types.Mixed, default: [] }
}, { timestamps: true });

module.exports = mongoose.model('CatalogItem', catalogItemSchema);
