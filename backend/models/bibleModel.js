// models/bibleModel.js
//
// Local cache of the Bible, one document per chapter.
// Populated once by services/scriptureSeeder.js, then reused forever.
// Reusable by any other app in this DB — it's a standalone collection.

import mongoose from 'mongoose';

const verseSchema = new mongoose.Schema(
  {
    verse: { type: Number, required: true },
    text: { type: String, required: true },
  },
  { _id: false }
);

const bibleChapterSchema = new mongoose.Schema(
  {
    translation: { type: String, required: true, index: true }, // 'kjv', 'web', ...
    translationName: { type: String, default: '' },             // 'King James Version'
    book: { type: String, required: true, index: true },        // 'John'
    bookId: { type: String, required: true, index: true },      // 'john'
    testament: { type: String, enum: ['OT', 'NT'], required: true },
    chapter: { type: Number, required: true },
    verseCount: { type: Number, default: 0 },
    verses: { type: [verseSchema], default: [] },
    fetchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

bibleChapterSchema.index(
  { translation: 1, book: 1, chapter: 1 },
  { unique: true }
);

const BibleChapter =
  mongoose.models.BibleChapter ||
  mongoose.model('BibleChapter', bibleChapterSchema);

export default BibleChapter;