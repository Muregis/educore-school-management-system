import './src/config/env.js';
import { testDbConnection } from './src/config/db.js';

testDbConnection().then(result => {
  console.log('Connection test result:', result);
  process.exit(0);
}).catch(error => {
  console.error('Connection test failed:', error.message);
  process.exit(1);
});
