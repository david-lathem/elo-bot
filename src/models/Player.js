const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
  },
  username: String,
  elo: {
    type: Number,
    default: 0,
  },
  wins: {
    type: Number,
    default: 0,
  },
  losses: {
    type: Number,
    default: 0,
  }
});

module.exports = mongoose.model('Player', playerSchema);
