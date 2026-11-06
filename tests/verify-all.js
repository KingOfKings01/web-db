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

console.log('==============================================');
console.log(`  Tests Passed: ${passedCount} / ${totalCount}`);
console.log('==============================================');

if (passedCount === totalCount) {
  console.log('>>> ALL VERIFICATION TESTS PASSED SUCCESSFULLY! <<<');
} else {
  console.error('>>> SOME TESTS FAILED! <<<');
  process.exit(1);
}

