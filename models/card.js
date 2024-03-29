const mongoose = require('mongoose')
const uniqueValidator = require('mongoose-unique-validator')



const cardSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    uniqueCaseSensitive: true
  }
}, { strict: false })

cardSchema.plugin(uniqueValidator)

const OcgCard = mongoose.model('OcgCard', cardSchema)
const RushCard = mongoose.model('RushCard', cardSchema)
const StrayCard = mongoose.model('StrayCard', cardSchema)
const SnapCard = mongoose.model('SnapCard', cardSchema)
const SnapLocation = mongoose.model('SnapLocation', cardSchema)
const SnapBot = mongoose.model('SnapBot', cardSchema)





module.exports = { OcgCard, RushCard, StrayCard, SnapCard, SnapLocation, SnapBot }