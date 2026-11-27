import { OracleDatabase } from '../src/lib/oracle-engine.js';

let passed = 0;
let failed = 0;

function assert(cond, desc) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${desc}`);
  } else {
    failed++;
    console.error(`  ✗ ${desc}`);
  }
}

console.log('--- Testing Per-Connection Scripts & History Logic ---');

const db = new OracleDatabase();

// 1. Initial active connection is SQL_CLASS
assert(db.getActiveDatabase() === 'SQL_CLASS', 'Default active database is SQL_CLASS');

// 2. Multi-database script execution and isolation
const res1 = db.executeScript('SELECT name FROM students;');
assert(res1[0].type === 'SELECT', 'SQL_CLASS executes students query');

// Switch to ORACLE26
db.connectDatabase('ORACLE26');
assert(db.getActiveDatabase() === 'ORACLE26', 'Switched active database to ORACLE26');

const res2 = db.executeScript('SELECT dummy FROM dual;');
assert(res2[0].type === 'SELECT' && res2[0].rows[0].DUMMY === 'X', 'ORACLE26 executes dual query');

// Switch back to SQL_CLASS
db.connectDatabase('SQL_CLASS');
assert(db.getActiveDatabase() === 'SQL_CLASS', 'Switched back to SQL_CLASS');

// 3. User creates a 3rd connection
db.createDatabase('DEV_TEAM', 'DEVELOPER', 'devpass');
db.connectDatabase('DEV_TEAM');
assert(db.getActiveDatabase() === 'DEV_TEAM', 'Switched to new connection DEV_TEAM');

db.executeScript('CREATE TABLE dev_logs (id NUMBER, note VARCHAR2(50));');
db.executeScript("INSERT INTO dev_logs VALUES (1, 'Initial migration');");

const resDev = db.executeScript('SELECT * FROM dev_logs;');
assert(resDev[0].rows.length === 1, 'DEV_TEAM table created and queried');

// Verify isolation: SQL_CLASS does not have dev_logs
db.connectDatabase('SQL_CLASS');
const resCheck = db.executeScript('SELECT * FROM dev_logs;');
assert(resCheck[0].type === 'ERROR' && resCheck[0].error.code === 'ORA-00942', 'Table dev_logs does not leak into SQL_CLASS');

console.log(`\nResults: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
