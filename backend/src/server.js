import app from './app.js';
import { getDatabase } from './db/database.js';
import { syncRoster } from './services/rosterService.js';
import { initGroup } from './semaphore/groupService.js';

const PORT = process.env.PORT || 3000;

// Initialize database, sync development roster, and rebuild in-memory Semaphore group
const db = getDatabase();
syncRoster(db);
initGroup(db);

const server = app.listen(PORT, () => {
  console.log(`Incognito backend server listening on port ${PORT}`);
});

export default server;
