// models/quranModel.js
//
// Local cache of the Quran, one document per surah (114 total).
// Populated once by services/scriptureSeeder.js.

import mongoose from 'mongoose';

const ayahSchema = new mongoose.Schema(
  {
    ayah: { type: Number, required: true }, // numberInSurah
    text: { type: String, required: true },
  },
  { _id: false }
);

const quranSurahSchema = new mongoose.Schema(
  {
    edition: { type: String, required: true, index: true }, // 'en.asad', 'ar.alafasy', ...
    editionName: { type: String, default: '' },
    surahNumber: { type: Number, required: true },          // 1..114
    name: { type: String, default: '' },                    // Arabic name
    englishName: { type: String, default: '' },
    englishNameTranslation: { type: String, default: '' },
    revelationType: { type: String, default: '' },
    ayahCount: { type: Number, default: 0 },
    ayahs: { type: [ayahSchema], default: [] },
    fetchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

quranSurahSchema.index(
  { edition: 1, surahNumber: 1 },
  { unique: true }
);

const QuranSurah =
  mongoose.models.QuranSurah ||
  mongoose.model('QuranSurah', quranSurahSchema);

export default QuranSurah;