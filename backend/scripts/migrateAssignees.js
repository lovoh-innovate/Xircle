// scripts/migrateAssignees.js
import 'dotenv/config';
import mongoose from 'mongoose';
import Task from '../models/taskModel.js';

await mongoose.connect(process.env.MONGO_URL);

// 1. Copy assignee → assignees (only when assignee is set)
const { modifiedCount } = await Task.collection.updateMany(
  { assignee: { $exists: true, $ne: null } },
  [{ $set: { assignees: ['$assignee'] } }]
);
console.log(`✅ Migrated ${modifiedCount} tasks`);

// 2. Ensure unassigned tasks have an empty array (not missing)
await Task.collection.updateMany(
  { assignees: { $exists: false } },
  { $set: { assignees: [] } }
);

// 3. Drop the old field
await Task.collection.updateMany({}, { $unset: { assignee: '' } });

// 4. Drop the old index (name is auto-generated; ignore if missing)
await Task.collection.dropIndex('assignee_1_status_1').catch(() => {});

// 5. Verify
const stillHasOldField = await Task.collection.countDocuments({ assignee: { $exists: true } });
const totalTasks = await Task.collection.countDocuments({});
const withAssignees = await Task.collection.countDocuments({ 'assignees.0': { $exists: true } });
console.log({ totalTasks, withAssignees, stillHasOldField });

await mongoose.disconnect();