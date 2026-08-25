const mongoose = require('mongoose');

const catalogItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  nameAr: { type: String },
  key: { type: String, required: true, unique: true },
  price: { type: Number, required: true },
  prices: { type: mongoose.Schema.Types.Mixed, default: {} },
  icon: { type: String },
  category: { type: String },
  color: { type: String },
  image: { type: String },
  hasSizes: { type: Boolean, default: false },
  sizes: { type: mongoose.Schema.Types.Mixed, default: [] }
}, { timestamps: true });

module.exports = mongoose.model('CatalogItem', catalogItemSchema);
