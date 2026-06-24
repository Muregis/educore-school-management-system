/**
 * Graceful Shutdown Handler
 * Ensures clean shutdown of server and connections
 */

export function setupGracefulShutdown(server) {
  const shutdown = async (signal) => {
    console.log(`\n${signal} received. Starting graceful shutdown...`);
    
    // Stop accepting new connections
    server.close(async (err) => {
      if (err) {
        console.error('Error closing server:', err);
        process.exit(1);
      }
      
      console.log('Server closed successfully');
      
      // Close database connections
      // Close cache connections
      // Close any other resources
      
      console.log('Graceful shutdown completed');
      process.exit(0);
    });
    
    // Force shutdown after 30 seconds
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };
  
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
