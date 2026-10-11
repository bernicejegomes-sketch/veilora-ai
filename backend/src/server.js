import app from './app.js';
import { getDatabase, closeDatabase } from './db/database.js';
import { syncRoster } from './services/rosterService.js';
import { initGroup } from './semaphore/groupService.js';

const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = '0.0.0.0';

// Initialize database, sync development roster (if demo mode enabled), and rebuild in-memory Semaphore group
const db = getDatabase();
syncRoster(db);
initGroup(db);

const server = app.listen(PORT, HOST, () => {
  console.log(`Incognito backend server listening on http://${HOST}:${PORT}`);
});

// Graceful shutdown handling for cloud orchestrators (SIGTERM) and local stops (SIGINT)
function handleGracefulShutdown(signal) {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed.');
    try {
      closeDatabase(db);
      console.log('SQLite database connection closed.');
    } catch (err) {
      console.error('Error closing database connection:', err.message);
    }
    process.exit(0);
  });

  // Force shutdown after timeout if pending operations hang
  setTimeout(() => {
    console.error('Forced shutdown due to timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));

export default server;
