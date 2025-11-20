const mongoose = require('mongoose');

async function cleanup() {
  try {
    await mongoose.connect('mongodb+srv://admin_db_user:rCeekL8z3gybzD9K@voxi.nblzcdt.mongodb.net/voxi?appName=voxi');
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // Delete company
    const companyResult = await db.collection('companies').deleteMany({ email: 'batrbekk@gmail.com' });
    console.log('Deleted companies:', companyResult.deletedCount);

    // Delete user
    const userResult = await db.collection('users').deleteMany({ email: 'batrbekk@gmail.com' });
    console.log('Deleted users:', userResult.deletedCount);

    console.log('Cleanup complete!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

cleanup();
