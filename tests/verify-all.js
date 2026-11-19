import { OracleDatabase, OracleError } from '../src/lib/oracle-engine.js';

console.log('==============================================');
console.log('       ORACLE SQL ENGINE COMPREHENSIVE TESTS  ');
console.log('==============================================');

let passedCount = 0;
let totalCount = 0;

function assertTest(name, condition) {
  totalCount++;
  if (condition) {
    console.log(`  ✓ [PASS] ${name}`);
    passedCount++;
  } else {
    console.error(`  ✗ [FAIL] ${name}`);
    process.exitCode = 1;
  }
}

const db = new OracleDatabase();

// 1. Initial Tables
const tables = db.getTables();
assertTest('COURSES table initialized', !!tables.COURSES);
assertTest('STUDENTS table initialized', !!tables.STUDENTS);
assertTest('DUAL table initialized', !!tables.DUAL);

// 2. Basic SELECT
const sel1 = db.executeScript('SELECT name, marks FROM students;');
assertTest('SELECT basic projection returned 5 rows', sel1[0].rows.length === 5);
assertTest('SELECT columns are NAME, MARKS', sel1[0].columns.includes('NAME') && sel1[0].columns.includes('MARKS'));

// 3. SELECT WHERE & ORDER BY
const sel2 = db.executeScript('SELECT name, marks FROM students WHERE marks >= 80 ORDER BY marks DESC;');
assertTest('WHERE marks >= 80 returns correct count (3)', sel2[0].rows.length === 3);
assertTest('ORDER BY DESC sorts correctly', sel2[0].rows[0].MARKS === 95);

// 4. JOIN operations
const joinRes = db.executeScript(`
  SELECT s.name, c.course_name, c.fee
  FROM students s
  INNER JOIN courses c ON s.course_id = c.course_id;
`);
assertTest('INNER JOIN returns matched rows', joinRes[0].rows.length === 5);
assertTest('INNER JOIN contains course_name', joinRes[0].rows[0].COURSE_NAME !== undefined);

// 5. Comma join
const commaJoin = db.executeScript(`
  SELECT s.name, c.course_name
  FROM students s, courses c
  WHERE s.course_id = c.course_id;
`);
assertTest('Comma Join returns matched rows', commaJoin[0].rows.length === 5);

// 6. GROUP BY & Aggregates
const aggRes = db.executeScript(`
  SELECT course_id, COUNT(*) AS student_count, AVG(marks) AS avg_marks
  FROM students
  GROUP BY course_id;
`);
assertTest('GROUP BY groups properly', aggRes[0].rows.length === 3);
assertTest('Aggregate COUNT(*) calculated', aggRes[0].rows[0].STUDENT_COUNT > 0);

// 7. Oracle Built-in Functions: NVL, DECODE, SYSDATE, UPPER
const fnRes = db.executeScript(`
  SELECT UPPER(name) AS upper_name,
         DECODE(course_id, 101, 'Science Dept', 102, 'Maths Dept', 'Other') AS dept,
         SYSDATE AS today
  FROM students;
`);
assertTest('UPPER function converts string', fnRes[0].rows[0].UPPER_NAME === 'SARA');
assertTest('DECODE function evaluates conditions', fnRes[0].rows[0].DEPT === 'Maths Dept');
assertTest('SYSDATE returns formatted Oracle date', typeof fnRes[0].rows[0].TODAY === 'string');

// 8. DML: INSERT, UPDATE, DELETE
const insRes = db.executeScript("INSERT INTO students VALUES (10, 'Aarav', 14, 'Bangalore', 88, 101);");
assertTest('INSERT returns 1 row created', insRes[0].type === 'DML' && insRes[0].message === '1 row created.');

const updRes = db.executeScript("UPDATE students SET marks = 92 WHERE id = 10;");
assertTest('UPDATE returns row updated', updRes[0].type === 'DML' && updRes[0].rowsAffected === 1);

const delRes = db.executeScript("DELETE FROM students WHERE id = 10;");
assertTest('DELETE returns row deleted', delRes[0].type === 'DML' && delRes[0].rowsAffected === 1);

// 9. DDL: CREATE TABLE, ALTER TABLE, DROP TABLE
const createRes = db.executeScript(`
  CREATE TABLE lab_sessions (
    session_id NUMBER PRIMARY KEY,
    lab_name VARCHAR2(50) NOT NULL,
    capacity NUMBER
  );
`);
assertTest('CREATE TABLE succeeds', createRes[0].type === 'DDL' && createRes[0].message === 'Table created.');

const alterRes = db.executeScript("ALTER TABLE lab_sessions ADD instructor VARCHAR2(40);");
assertTest('ALTER TABLE ADD COLUMN succeeds', alterRes[0].type === 'DDL');

const dropRes = db.executeScript("DROP TABLE lab_sessions;");
assertTest('DROP TABLE succeeds', dropRes[0].type === 'DDL' && dropRes[0].message === 'Table dropped.');

// 10. DDL: CREATE VIEW & DROP VIEW
const viewRes = db.executeScript(`
  CREATE OR REPLACE VIEW top_students AS
  SELECT name, marks FROM students WHERE marks >= 85;
`);
assertTest('CREATE VIEW succeeds', viewRes[0].type === 'DDL' && viewRes[0].message === 'View created.');

const queryView = db.executeScript("SELECT * FROM top_students;");
assertTest('Querying VIEW returns rows', queryView[0].rows.length > 0);

const dropView = db.executeScript("DROP VIEW top_students;");
assertTest('DROP VIEW succeeds', dropView[0].type === 'DDL');

// 11. DESCRIBE command
const descRes = db.executeScript("DESC students;");
assertTest('DESCRIBE command works', descRes[0].type === 'DESCRIBE' && descRes[0].rows.length > 0);

// 12. Oracle ORA- Error Simulation
const err1 = db.executeScript("SELECT * FROM table_that_does_not_exist;");
assertTest('Throws ORA-00942 (table does not exist)', err1[0].type === 'ERROR' && err1[0].message.includes('ORA-00942'));

const err2 = db.executeScript("SELECT fake_col FROM students;");
assertTest('Throws ORA-00904 (invalid identifier)', err2[0].type === 'ERROR' && err2[0].message.includes('ORA-00904'));

const err3 = db.executeScript("INSERT INTO courses VALUES (101, 'Duplicate Science', 500);");
assertTest('Throws ORA-00001 (unique constraint violated)', err3[0].type === 'ERROR' && err3[0].message.includes('ORA-00001'));

// 13. Syntax Enhancements & Bug Fixes
// 13a. DROP without TABLE keyword
const dropNoTableRes = db.executeScript("DROP COLLEGE;");
assertTest('DROP COLLEGE throws ORA-00950 (invalid DROP option / TABLE keyword must be used)', 
  dropNoTableRes[0].type === 'ERROR' && dropNoTableRes[0].message.includes('ORA-00950'));

// 13b. CREATE TABLE missing comma between column definitions
const createMissingCommaRes = db.executeScript(`
  CREATE TABLE test_missing_comma (
    student_id NUMBER NOT NULL,
    student_name VARCHAR2(20) NOT NULL
    city VARCHAR2(20)
  );
`);
assertTest('CREATE TABLE with missing comma throws ORA-00907 (missing right parenthesis)', 
  createMissingCommaRes[0].type === 'ERROR' && createMissingCommaRes[0].message.includes('ORA-00907'));

// 13b2. Exact user script snippet for CREATE TABLE with inline comments
const userCreateSnippetRes = db.executeScript(`
  CREATE TABLE College (
    student_id NUMBER NOT NULL,
    student_name VARCHAR2(20) NOT NULL   -- forgot , should show error
    city VARCHAR2(20),
    contact_no VARCHAR2(10),
    marks NUMBER, -- adding , in last should show error
  );
`);
assertTest('User CREATE TABLE snippet catches syntax error', 
  userCreateSnippetRes[0].type === 'ERROR' && (userCreateSnippetRes[0].message.includes('ORA-00907') || userCreateSnippetRes[0].message.includes('ORA-00904')));

// 13c. CREATE TABLE with trailing comma before closing parenthesis
const createTrailingCommaRes = db.executeScript(`
  CREATE TABLE test_trailing_comma (
    student_id NUMBER NOT NULL,
    marks NUMBER,
  );
`);
assertTest('CREATE TABLE with trailing comma throws ORA-00904 (invalid identifier)', 
  createTrailingCommaRes[0].type === 'ERROR' && createTrailingCommaRes[0].message.includes('ORA-00904'));

// 13d. Valid CREATE TABLE College
const createCollegeRes = db.executeScript(`
  CREATE TABLE College (
    student_id NUMBER NOT NULL,
    student_name VARCHAR2(20) NOT NULL,
    city VARCHAR2(20),
    contact_no VARCHAR2(10),
    marks NUMBER
  );
`);
assertTest('Valid CREATE TABLE College succeeds', 
  createCollegeRes[0].type === 'DDL' && createCollegeRes[0].message === 'Table created.');

// 13e. INSERT INTO ... VALUES with missing comma between adjacent values
const insertMissingCommaRes = db.executeScript("INSERT INTO COLLEGE VALUES (3, 'Aman', 'Delhi', '910936780' 72);");
assertTest('INSERT with missing comma throws ORA-00917 (missing comma)', 
  insertMissingCommaRes[0].type === 'ERROR' && insertMissingCommaRes[0].message.includes('ORA-00917'));

// Insert valid records into College
db.executeScript("INSERT INTO COLLEGE VALUES (1, 'Aman', 'Delhi', '9109367801', 72);");
db.executeScript("INSERT INTO COLLEGE VALUES (2, 'Rohan', 'Mumbai', '9109367802', 85);");
db.executeScript("INSERT INTO COLLEGE VALUES (3, 'Ananya', 'Delhi', '9109367803', 90);");

// 13f. SELECT WHERE student_name LIKE'A%' without space between LIKE and pattern
const likeNoSpaceRes = db.executeScript("SELECT student_name, contact_no FROM college WHERE student_name LIKE'A%';");
assertTest('LIKE without space (LIKE\'A%\') filters correctly (returns Aman and Ananya)', 
  likeNoSpaceRes[0].rows && likeNoSpaceRes[0].rows.length === 2 && 
  likeNoSpaceRes[0].rows.some(r => r.STUDENT_NAME === 'Aman') &&
  likeNoSpaceRes[0].rows.some(r => r.STUDENT_NAME === 'Ananya') &&
  !likeNoSpaceRes[0].rows.some(r => r.STUDENT_NAME === 'Rohan'));

// 13g. SELECT WHERE student_name NOT LIKE'A%' without space
const notLikeNoSpaceRes = db.executeScript("SELECT student_name, contact_no FROM college WHERE student_name NOT LIKE'A%';");
assertTest('NOT LIKE without space (NOT LIKE\'A%\') filters correctly (returns only Rohan)', 
  notLikeNoSpaceRes[0].rows && notLikeNoSpaceRes[0].rows.length === 1 && 
  notLikeNoSpaceRes[0].rows[0].STUDENT_NAME === 'Rohan');

// Clean up created College table
db.executeScript("DROP TABLE College;");

// 14. Multi-Database & Connection Management Tests
// 14a. CREATE DATABASE via SQL query
const createDbRes = db.executeScript("CREATE DATABASE dev_db USER dev_admin IDENTIFIED BY dev_pass;");
assertTest('CREATE DATABASE via SQL succeeds', 
  createDbRes[0].type === 'DDL' && createDbRes[0].message.includes('created'));

// 14b. CONNECT via SQL query with username/password@dbname
const connDbRes = db.executeScript("CONNECT dev_admin/dev_pass@dev_db;");
assertTest('CONNECT username/password@dbname succeeds', 
  connDbRes[0].type === 'DDL' && db.getActiveDatabase() === 'DEV_DB');

// 14c. Creating table in dev_db isolates table to dev_db
db.executeScript("CREATE TABLE dev_tasks (task_id NUMBER, title VARCHAR2(50));");
const devTables = db.getTables();
assertTest('dev_tasks table created inside dev_db', !!devTables.DEV_TASKS);

// 14d. Connecting back to sql_class via query
const connSqlClassRes = db.executeScript("CONNECT sql_class;");
assertTest('CONNECT sql_class succeeds and switches active database', 
  connSqlClassRes[0].type === 'DDL' && db.getActiveDatabase() === 'SQL_CLASS');

const sqlClassTables = db.getTables();
assertTest('sql_class has COURSES table', !!sqlClassTables.COURSES);
assertTest('sql_class does NOT have dev_tasks (tables are isolated)', !sqlClassTables.DEV_TASKS);

// 14e. Engine API createDatabase & connectDatabase
db.createDatabase('analytics_db', 'analyst', 'secret');
const connectApiRes = db.connectDatabase('analytics_db');
assertTest('Engine connectDatabase API switches active database', 
  db.getActiveDatabase() === 'ANALYTICS_DB');

// Connect back to SQL_CLASS
db.connectDatabase('sql_class');
assertTest('Returned to SQL_CLASS database', db.getActiveDatabase() === 'SQL_CLASS');

// 15. Right-Click Actions (Rename, Drop, Truncate, Disconnect)
// 15a. Table Rename
db.executeScript("CREATE TABLE temp_rename (id NUMBER);");
db.renameTable('temp_rename', 'renamed_table');
assertTest('renameTable successfully renames table', !!db.getTable('renamed_table') && !db.getTable('temp_rename'));

// 15b. Table Truncate
db.executeScript("INSERT INTO renamed_table VALUES (100);");
db.truncateTable('renamed_table');
assertTest('truncateTable clears all rows', db.getTable('renamed_table').rows.length === 0);

// 15c. Table Drop
db.dropTable('renamed_table');
assertTest('dropTable removes table from active database', !db.getTable('renamed_table'));

// 15d. Database Rename
db.renameDatabase('analytics_db', 'bi_reports');
assertTest('renameDatabase renames database key and name', !!db.getDatabases()['BI_REPORTS'] && !db.getDatabases()['ANALYTICS_DB']);

// 15e. Database Disconnect
db.disconnectDatabase('sql_class');
assertTest('disconnectDatabase marks connection disconnected', !db.getDatabases()['SQL_CLASS'].connected);

// Reconnect for consistency
db.connectDatabase('sql_class');

console.log('==============================================');
console.log(`  Tests Passed: ${passedCount} / ${totalCount}`);
console.log('==============================================');

if (passedCount === totalCount) {
  console.log('>>> ALL VERIFICATION TESTS PASSED SUCCESSFULLY! <<<');
} else {
  console.error('>>> SOME TESTS FAILED! <<<');
  process.exit(1);
}

