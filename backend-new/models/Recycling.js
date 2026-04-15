const mongoose = require('mongoose');

const recyclingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    item: { type: String, required: true, trim: true },
    points: { type: Number, required: true, min: 0 },
    date: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Recycling', recyclingSchema);
