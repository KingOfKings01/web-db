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

// 16. SQL Developer Export & Import Tests
// 16a. Table Export to SQL
const coursesExportSql = db.exportTableToSql('COURSES');
assertTest('exportTableToSql generates valid CREATE TABLE DDL', coursesExportSql.includes('CREATE TABLE "COURSES"'));
assertTest('exportTableToSql generates valid INSERT statements', coursesExportSql.includes('Insert into "COURSES"') && coursesExportSql.includes('Science'));
assertTest('exportTableToSql ends with COMMIT', coursesExportSql.includes('COMMIT;'));

// 16b. Database Export to SQL
const dbExportSql = db.exportDatabaseToSql();
assertTest('exportDatabaseToSql includes CONNECT statement', dbExportSql.includes('CONNECT STUDENT/password@sql_class;'));
assertTest('exportDatabaseToSql includes multiple tables', dbExportSql.includes('"COURSES"') && dbExportSql.includes('"STUDENTS"'));

// 16c. Table Export to CSV
const coursesCsv = db.exportTableToCsv('COURSES');
assertTest('exportTableToCsv produces CSV header and rows', coursesCsv.includes('"COURSE_ID","COURSE_NAME","FEE"') && coursesCsv.includes('101,Science,500'));

// 16d. Roundtrip SQL Import Test: Export, Drop, Import, Verify
const studentsExportSql = db.exportTableToSql('STUDENTS', { includeDrop: true });
db.executeScript(studentsExportSql);
const restoredStudents = db.getTable('STUDENTS');
assertTest('Roundtrip SQL import restores table schema and rows', !!restoredStudents && restoredStudents.rows.length === 5);

// 16e. CSV Import into Table
db.executeScript("CREATE TABLE inventory (item_id NUMBER, item_name VARCHAR2(50), qty NUMBER);");
const sampleCsv = `ITEM_ID,ITEM_NAME,QTY
1,Keyboard,15
2,Mouse,25
3,Monitor,8`;
const csvRes = db.importCsvToTable('INVENTORY', sampleCsv);
assertTest('importCsvToTable imports CSV rows', csvRes.inserted === 3 && db.getTable('INVENTORY').rows.length === 3);

// 17. Column Alias & Expression Syntax Tests (Oracle standard)
const singleQuoteAliasRes1 = db.executeScript("SELECT (1+1 AS 'Result') FROM dual;");
assertTest("SELECT (1+1 AS 'Result') throws ORA-00923", singleQuoteAliasRes1[0].type === 'ERROR' && singleQuoteAliasRes1[0].error.code === 'ORA-00923');

const singleQuoteAliasRes2 = db.executeScript("SELECT 1+1 AS 'Result' FROM dual;");
assertTest("SELECT 1+1 AS 'Result' throws ORA-00923", singleQuoteAliasRes2[0].type === 'ERROR' && singleQuoteAliasRes2[0].error.code === 'ORA-00923');

const singleQuoteAliasRes3 = db.executeScript("SELECT 1+1 'Result' FROM dual;");
assertTest("SELECT 1+1 'Result' without AS throws ORA-00923", singleQuoteAliasRes3[0].type === 'ERROR' && singleQuoteAliasRes3[0].error.code === 'ORA-00923');

const invalidParenAsRes = db.executeScript('SELECT (1+1 AS "Result") FROM dual;');
assertTest('SELECT (1+1 AS "Result") throws ORA-00907', invalidParenAsRes[0].type === 'ERROR' && invalidParenAsRes[0].error.code === 'ORA-00907');

const doubleQuoteRes = db.executeScript('SELECT (1+1) AS "Result" FROM dual;');
assertTest('SELECT (1+1) AS "Result" preserves case-sensitive alias and calculates 2', doubleQuoteRes[0].columns[0] === 'Result' && doubleQuoteRes[0].rows[0]['Result'] === 2);

const unquotedAliasRes = db.executeScript('SELECT 1+1 AS Result FROM dual;');
assertTest('SELECT 1+1 AS Result converts alias to uppercase RESULT', unquotedAliasRes[0].columns[0] === 'RESULT' && unquotedAliasRes[0].rows[0]['RESULT'] === 2);

// 18. Trailing comma syntax validation, String Arithmetic, and Floating-Point Decimal Precision
const trailingCommaRes = db.executeScript("SELECT 1+1 AS Add,\nFROM dual;");
assertTest('Trailing comma before FROM throws ORA-00936', trailingCommaRes[0].type === 'ERROR' && trailingCommaRes[0].error.code === 'ORA-00936');

const stringArithmeticRes = db.executeScript("SELECT '1'+'1' AS total_sum FROM dual;");
assertTest("SELECT '1'+'1' performs arithmetic addition and evaluates to 2", stringArithmeticRes[0].rows[0]['TOTAL_SUM'] === 2);

const invalidStringArithmeticRes = db.executeScript("SELECT 'abc' + 1 FROM dual;");
assertTest("SELECT 'abc' + 1 throws ORA-01722 (invalid number)", invalidStringArithmeticRes[0].type === 'ERROR' && invalidStringArithmeticRes[0].error.code === 'ORA-01722');

const reservedAliasRes1 = db.executeScript("SELECT '1' + '1' AS values FROM dual;");
assertTest("SELECT with reserved word alias AS values throws ORA-00923", reservedAliasRes1[0].type === 'ERROR' && reservedAliasRes1[0].error.code === 'ORA-00923');

const reservedAliasRes2 = db.executeScript("SELECT '1' + '1' values FROM dual;");
assertTest("SELECT with reserved word alias without AS (values) throws ORA-00923", reservedAliasRes2[0].type === 'ERROR' && reservedAliasRes2[0].error.code === 'ORA-00923');

const quotedReservedAliasRes = db.executeScript('SELECT \'1\' + \'1\' AS "values" FROM dual;');
assertTest('SELECT with double-quoted reserved word AS "values" succeeds', quotedReservedAliasRes[0].columns[0] === 'values' && quotedReservedAliasRes[0].rows[0]['values'] === 2);

const decimalCalcRes = db.executeScript(`SELECT 
  276 AS real_price, 
  -(276 - 276 * 0.90) AS descount, 
  276 * 0.90 AS descount_price, 
  276 * 1.08 - 276 AS GST,
  276 * 0.90 + (276 * 1.08 - 276) AS total
FROM dual;`);
assertTest('Decimal calculation normalizes floating-point artifacts (-27.6, 22.08, 270.48)', 
  decimalCalcRes[0].rows[0]['DESCOUNT'] === -27.6 && 
  decimalCalcRes[0].rows[0]['GST'] === 22.08 && 
  decimalCalcRes[0].rows[0]['TOTAL'] === 270.48 &&
  decimalCalcRes[0].rows[0]['DESCOUNT_PRICE'] === 248.4);

// 19. Unary operators on functions and embedded functions in arithmetic
const negAbsRes = db.executeScript("SELECT -ABS(fee) AS neg_fee FROM courses;");
assertTest("SELECT -ABS(fee) evaluates to negative numbers (-500, -600, -400)", 
  negAbsRes[0].rows[0]['NEG_FEE'] === -500 && 
  negAbsRes[0].rows[1]['NEG_FEE'] === -600 && 
  negAbsRes[0].rows[2]['NEG_FEE'] === -400);

const arithFuncRes = db.executeScript("SELECT 1000 - ABS(fee) AS diff FROM courses;");
assertTest("SELECT 1000 - ABS(fee) evaluates nested arithmetic with function", arithFuncRes[0].rows[0]['DIFF'] === 500);

// 20. Oracle SQL standard function rules (NULL handling, MOD(n, 0), math functions)
const modZeroRes = db.executeScript("SELECT MOD(11, 0) AS m FROM dual;");
assertTest("MOD(11, 0) returns 11 per Oracle specification", modZeroRes[0].rows[0]['M'] === 11);

const nullArithRes = db.executeScript("SELECT 10 + NULL AS s1, ABS(NULL) AS s2 FROM dual;");
assertTest("Arithmetic and math functions with NULL evaluate to NULL", nullArithRes[0].rows[0]['S1'] === null && nullArithRes[0].rows[0]['S2'] === null);

const mathSuiteRes = db.executeScript("SELECT SIGN(-15) AS sn, CEIL(15.2) AS cl, FLOOR(15.8) AS fl, SQRT(25) AS sq, POWER(2, 3) AS pw FROM dual;");
assertTest("SIGN, CEIL, FLOOR, SQRT, POWER functions execute accurately", 
  mathSuiteRes[0].rows[0]['SN'] === -1 && 
  mathSuiteRes[0].rows[0]['CL'] === 16 && 
  mathSuiteRes[0].rows[0]['FL'] === 15 && 
  mathSuiteRes[0].rows[0]['SQ'] === 5 && 
  mathSuiteRes[0].rows[0]['PW'] === 8);


// 21. Adjacent terms syntax validation (ORA-00923: FROM keyword not found where expected)
const adjRes1 = db.executeScript("SELECT 11 ABS(-10) FROM dual;");
assertTest("SELECT 11 ABS(-10) throws ORA-00923", adjRes1[0].type === 'ERROR' && adjRes1[0].error.code === 'ORA-00923');

const adjRes2 = db.executeScript("SELECT 11 22 FROM dual;");
assertTest("SELECT 11 22 throws ORA-00923", adjRes2[0].type === 'ERROR' && adjRes2[0].error.code === 'ORA-00923');

const adjRes3 = db.executeScript("SELECT 11 AS 22 FROM dual;");
assertTest("SELECT 11 AS 22 throws ORA-00923 (unquoted alias starting with digit)", adjRes3[0].type === 'ERROR' && adjRes3[0].error.code === 'ORA-00923');

const adjRes4 = db.executeScript("SELECT 11 AS ABS(-10) FROM dual;");
assertTest("SELECT 11 AS ABS(-10) throws ORA-00923 (invalid alias after AS)", adjRes4[0].type === 'ERROR' && adjRes4[0].error.code === 'ORA-00923');

const adjRes5 = db.executeScript("SELECT 11 + ABS(-10) AS res FROM dual;");
assertTest("SELECT 11 + ABS(-10) evaluates to 21", adjRes5[0].rows[0]['RES'] === 21);

const adjRes6 = db.executeScript("SELECT 11 total FROM dual;");
assertTest("SELECT 11 total evaluates implicit alias TOTAL", adjRes6[0].columns[0] === 'TOTAL' && adjRes6[0].rows[0]['TOTAL'] === 11);

const adjRes7 = db.executeScript("SELECT 11 AS total FROM dual;");
assertTest("SELECT 11 AS total evaluates explicit alias TOTAL", adjRes7[0].columns[0] === 'TOTAL' && adjRes7[0].rows[0]['TOTAL'] === 11);

// 22. Unresolved identifiers and invalid number conversion in arithmetic expressions
const invalidColArith = db.executeScript("SELECT 11 + AB FROM dual;");
assertTest("SELECT 11 + AB FROM dual throws ORA-00904 (invalid identifier)", invalidColArith[0].type === 'ERROR' && invalidColArith[0].error.code === 'ORA-00904');

const invalidNumArith = db.executeScript("SELECT 11 + dummy FROM dual;");
assertTest("SELECT 11 + dummy FROM dual throws ORA-01722 (invalid number due to 'X')", invalidNumArith[0].type === 'ERROR' && invalidNumArith[0].error.code === 'ORA-01722');

// 23. DEFAULT keyword, case-insensitive literals, and ORA-00984 in INSERT VALUES
const insEmp1 = db.executeScript("INSERT INTO EMPLOYEE VALUES (1, 'Clark', 'Sales', DEFAULT, true, 47000.98, 'M');");
assertTest("INSERT with DEFAULT and true creates row", insEmp1[0].type === 'DML' && insEmp1[0].rowsAffected === 1);

const selEmp1 = db.executeScript("SELECT * FROM EMPLOYEE WHERE EMP_ID = 1;");
assertTest("DEFAULT inserted schema default value 'ACTIVE'", selEmp1[0].rows[0]['STATUS'] === 'ACTIVE');
assertTest("Boolean true stored/displayed as 1", selEmp1[0].rows[0]['IS_ACTIVE'] === 1);

const insEmp2 = db.executeScript("INSERT INTO EMPLOYEE VALUES (2, 'Bruce', 'IT', default, TRUE, 55000, 'M');");
assertTest("INSERT with lowercase default and uppercase TRUE succeeds", insEmp2[0].type === 'DML' && insEmp2[0].rowsAffected === 1);
const selEmp2 = db.executeScript("SELECT STATUS, IS_ACTIVE FROM EMPLOYEE WHERE EMP_ID = 2;");
assertTest("default and TRUE values correctly populated", selEmp2[0].rows[0]['STATUS'] === 'ACTIVE' && selEmp2[0].rows[0]['IS_ACTIVE'] === 1);

const insEmp3 = db.executeScript("INSERT INTO EMPLOYEE VALUES (3, Clark, 'Sales', DEFAULT, true, 47000.98, 'M');");
assertTest("Unquoted Clark in VALUES throws ORA-00984 (column not allowed here)", insEmp3[0].type === 'ERROR' && insEmp3[0].error.code === 'ORA-00984');

const insEmp4 = db.executeScript("INSERT INTO EMPLOYEE VALUES (4, 'Clark', Sales, DEFAULT, true, 47000.98, 'M');");
assertTest("Unquoted Sales in VALUES throws ORA-00984 (column not allowed here)", insEmp4[0].type === 'ERROR' && insEmp4[0].error.code === 'ORA-00984');

const insEmp5 = db.executeScript("INSERT INTO EMPLOYEE VALUES (5, 'Clark', 'Sales', DEFAULT, true, 47000.98, M);");
assertTest("Unquoted M in VALUES throws ORA-00984 (column not allowed here)", insEmp5[0].type === 'ERROR' && insEmp5[0].error.code === 'ORA-00984');

const insEmp6 = db.executeScript("INSERT INTO EMPLOYEE VALUES (6, 'Barry', 'Finance', null, false, 40000, 'M');");
assertTest("Lowercase null and false succeed", insEmp6[0].type === 'DML' && insEmp6[0].rowsAffected === 1);
const selEmp6 = db.executeScript("SELECT STATUS, IS_ACTIVE FROM EMPLOYEE WHERE EMP_ID = 6;");
assertTest("null and false populated correctly (0 for false)", selEmp6[0].rows[0]['STATUS'] === null && selEmp6[0].rows[0]['IS_ACTIVE'] === 0);

const updEmp1 = db.executeScript("UPDATE EMPLOYEE SET STATUS = DEFAULT WHERE EMP_ID = 6;");
assertTest("UPDATE SET col = DEFAULT succeeds", updEmp1[0].type === 'DML' && updEmp1[0].rowsAffected === 1);
const selUpd1 = db.executeScript("SELECT STATUS FROM EMPLOYEE WHERE EMP_ID = 6;");
assertTest("UPDATE SET col = DEFAULT restores default value", selUpd1[0].rows[0]['STATUS'] === 'ACTIVE');

// 24. DATETIME Keywords and Functions (CURRENT_DATE, CURRENT_TIMESTAMP, TIME, DATETIME, TRUNC, etc.)
db.executeScript(`
  CREATE TABLE EMP_DATES (
    empid NUMBER PRIMARY KEY,
    name VARCHAR2(50),
    dept VARCHAR2(50),
    date_of_join DATE,
    probation_period BOOLEAN,
    salary NUMBER(10,2),
    gender CHAR(1)
  );
`);

const insDate1 = db.executeScript("INSERT INTO EMP_DATES VALUES (1, 'Clark', 'Sales', CURRENT_DATE, true, 47000.98, 'M');");
assertTest("INSERT with CURRENT_DATE and true succeeds", insDate1[0].type === 'DML' && insDate1[0].rowsAffected === 1);

const insDate2 = db.executeScript("INSERT INTO EMP_DATES VALUES (2, 'Dave', 'Accounting', '12-NOV-26', false, 48000.83, 'M');");
assertTest("INSERT with date string and false succeeds", insDate2[0].type === 'DML' && insDate2[0].rowsAffected === 1);

const insDate3 = db.executeScript("INSERT INTO EMP_DATES VALUES (3, 'Ava', 'Sales', CURRENT_DATE, true, 42000.81, 'F');");
assertTest("INSERT row 3 with CURRENT_DATE and true succeeds", insDate3[0].type === 'DML' && insDate3[0].rowsAffected === 1);

const selDates = db.executeScript("SELECT * FROM EMP_DATES;");
const r1 = selDates[0].rows[0];
const r2 = selDates[0].rows[1];
assertTest("CURRENT_DATE evaluates to formatted date (not literal string 'CURRENT_DATE')", r1.DATE_OF_JOIN !== 'CURRENT_DATE' && /^\d{2}-[A-Z]{3}-\d{2}$/.test(r1.DATE_OF_JOIN));
assertTest("probation_period shows boolean as 1 and 0", r1.PROBATION_PERIOD === 1 && r2.PROBATION_PERIOD === 0);

// Datetime keywords in SELECT from DUAL
const selDualDates = db.executeScript("SELECT CURRENT_DATE, SYSDATE, CURRENT_TIME, LOCALTIME, CURRENT_TIMESTAMP, SYSTIMESTAMP, LOCALTIMESTAMP, SESSIONTIMEZONE, DBTIMEZONE FROM dual;");
const dualRow = selDualDates[0].rows[0];
assertTest("SELECT CURRENT_DATE returns date", /^\d{2}-[A-Z]{3}-\d{2}$/.test(dualRow['CURRENT_DATE']));
assertTest("SELECT CURRENT_TIME returns time", /^\d{2}:\d{2}:\d{2}$/.test(dualRow['CURRENT_TIME']));
assertTest("SELECT CURRENT_TIMESTAMP returns timestamp with timezone", dualRow['CURRENT_TIMESTAMP'].includes(':') && dualRow['CURRENT_TIMESTAMP'].includes('+'));
assertTest("SELECT DBTIMEZONE returns +00:00", dualRow['DBTIMEZONE'] === '+00:00');

// Date arithmetic & functions
const selDateArith = db.executeScript("SELECT SYSDATE + 1 AS NEXT_DAY, TRUNC(CURRENT_DATE) AS TRUNC_DATE, ADD_MONTHS(CURRENT_DATE, 1) AS NEXT_MONTH, LAST_DAY(CURRENT_DATE) AS END_MONTH FROM dual;");
const arithRow = selDateArith[0].rows[0];
assertTest("SYSDATE + 1 calculates next day", /^\d{2}-[A-Z]{3}-\d{2}$/.test(arithRow['NEXT_DAY']));
assertTest("TRUNC(CURRENT_DATE) returns date", /^\d{2}-[A-Z]{3}-\d{2}$/.test(arithRow['TRUNC_DATE']));
assertTest("ADD_MONTHS(CURRENT_DATE, 1) returns next month date", /^\d{2}-[A-Z]{3}-\d{2}$/.test(arithRow['NEXT_MONTH']));
assertTest("LAST_DAY(CURRENT_DATE) returns end of month", /^\d{2}-[A-Z]{3}-\d{2}$/.test(arithRow['END_MONTH']));

// 25. CREATE TABLE with DEFAULT CURRENT_DATE and DEFAULT TRUE
const userCreateTable = db.executeScript(`
  CREATE TABLE EMPLOYEE_USER_DEF (
    empId NUMBER NOT NULL,
    name VARCHAR2(15) NOT NULL,
    dept VARCHAR2(10) NOT NULL,
    date_of_join DATE DEFAULT CURRENT_DATE,
    probation_period BOOLEAN DEFAULT TRUE,
    salary FLOAT,
    gender CHAR(1)
  );
`);
assertTest("CREATE TABLE with DEFAULT CURRENT_DATE and DEFAULT TRUE succeeds", userCreateTable[0].type === 'DDL' && userCreateTable[0].message === 'Table created.');

const userInsRes = db.executeScript("INSERT INTO EMPLOYEE_USER_DEF VALUES (101, 'Alice', 'Tech', DEFAULT, DEFAULT, 65000, 'F');");
assertTest("INSERT into EMPLOYEE_USER_DEF using DEFAULT values succeeds", userInsRes[0].type === 'DML' && userInsRes[0].rowsAffected === 1);
const userRow = db.executeScript("SELECT * FROM EMPLOYEE_USER_DEF WHERE EMPID = 101;")[0].rows[0];
assertTest("Default date_of_join is system date", /^\d{2}-[A-Z]{3}-\d{2}$/.test(userRow['DATE_OF_JOIN']));
assertTest("Default probation_period is 1 (boolean TRUE)", userRow['PROBATION_PERIOD'] === 1);

// 26. ORDER BY unprojected columns, positional indexes, and DISTINCT constraint (ORA-01791)
db.executeScript(`
  DROP TABLE STUDENT_ORDER_TEST;
  CREATE TABLE STUDENT_ORDER_TEST (
    id NUMBER NOT NULL,
    name VARCHAR2(15) NOT NULL,
    subject VARCHAR2(10) NOT NULL,
    date_of_join DATE DEFAULT CURRENT_DATE,
    is_transfer BOOLEAN DEFAULT FALSE,
    fee FLOAT,
    gender CHAR,
    marks NUMBER
  );
  INSERT INTO STUDENT_ORDER_TEST VALUES (1, 'Rohan', 'Sci', DEFAULT, true, 4700.98, 'M', 90);
  INSERT INTO STUDENT_ORDER_TEST VALUES (2, 'Sara', 'Eng', '12-NOV-26', false, 4800.83, 'F', 80);
  INSERT INTO STUDENT_ORDER_TEST VALUES (3, 'Riya', 'Sci', '12-NOV-26', DEFAULT, 4200.81, 'F', 68);
  INSERT INTO STUDENT_ORDER_TEST VALUES (4, 'Aman', 'Math', '12-NOV-26', DEFAULT, 4200.81, 'M', 92);
`);

const qUnselected = db.executeScript("SELECT id, name FROM STUDENT_ORDER_TEST WHERE date_of_join = '12-NOV-26' ORDER BY subject DESC;");
assertTest("ORDER BY unprojected column 'subject' succeeds", qUnselected[0].type === 'SELECT' && qUnselected[0].rows.length === 3);
assertTest("Rows correctly sorted by unprojected column DESC (Sci, Math, Eng)", 
  qUnselected[0].rows[0]['NAME'] === 'Riya' && 
  qUnselected[0].rows[1]['NAME'] === 'Aman' && 
  qUnselected[0].rows[2]['NAME'] === 'Sara'
);

const qPositional = db.executeScript("SELECT id, name FROM STUDENT_ORDER_TEST ORDER BY 2 ASC;");
assertTest("ORDER BY positional index 2 ASC works", qPositional[0].rows[0]['NAME'] === 'Aman' && qPositional[0].rows[3]['NAME'] === 'Sara');

const qDistinctErr = db.executeScript("SELECT DISTINCT id, name FROM STUDENT_ORDER_TEST ORDER BY subject DESC;");
assertTest("SELECT DISTINCT with unprojected ORDER BY throws ORA-01791", qDistinctErr[0].type === 'ERROR' && qDistinctErr[0].error.code === 'ORA-01791');

// 27. CONCAT function support (Oracle 2-argument concat)
const concatCol = db.executeScript("SELECT CONCAT('STUDENT', name) AS res FROM students;");
assertTest("SELECT CONCAT('STUDENT', name) evaluates successfully", concatCol[0].type === 'SELECT' && concatCol[0].rows[0]['RES'].startsWith('STUDENT'));

const concatDual = db.executeScript("SELECT CONCAT('Hello', 'World') AS res FROM dual;");
assertTest("SELECT CONCAT('Hello', 'World') returns 'HelloWorld'", concatDual[0].rows[0]['RES'] === 'HelloWorld');

const concatNull = db.executeScript("SELECT CONCAT('Hello', NULL) AS r1, CONCAT(NULL, 'World') AS r2, CONCAT(NULL, NULL) AS r3 FROM dual;");
assertTest("CONCAT with NULL handles partial and full nulls correctly", 
  concatNull[0].rows[0]['R1'] === 'Hello' && 
  concatNull[0].rows[0]['R2'] === 'World' && 
  concatNull[0].rows[0]['R3'] === null
);

const concatNested = db.executeScript("SELECT CONCAT(CONCAT('a', 'b'), 'c') AS res FROM dual;");
assertTest("Nested CONCAT evaluates to 'abc'", concatNested[0].rows[0]['RES'] === 'abc');

const concatTooFew = db.executeScript("SELECT CONCAT('a') FROM dual;");
assertTest("CONCAT with < 2 args throws ORA-00938", concatTooFew[0].type === 'ERROR' && concatTooFew[0].error.code === 'ORA-00938');

const concatTooMany = db.executeScript("SELECT CONCAT('a', 'b', 'c') FROM dual;");
assertTest("CONCAT with > 2 args throws ORA-00939", concatTooMany[0].type === 'ERROR' && concatTooMany[0].error.code === 'ORA-00939');

const concatWhere = db.executeScript("SELECT name FROM students WHERE CONCAT('STUDENT', name) = 'STUDENTAman';");
assertTest("CONCAT in WHERE clause filters correctly", concatWhere[0].rows.length === 1 && concatWhere[0].rows[0]['NAME'] === 'Aman');

// 28. String & Math functions (INITCAP, INTICAP, ROUND, TRUNC, CEIL, FLOOR, MOD, ABS) & Aggregates
db.executeScript(`
  CREATE TABLE FUNCS_TEST (
    id NUMBER NOT NULL,
    name VARCHAR2(15) NOT NULL,
    subject VARCHAR2(10) NOT NULL,
    marks NUMBER,
    fee FLOAT
  );
  INSERT INTO FUNCS_TEST VALUES (1, 'Rohan', 'Sci', 90, 4700.98);
  INSERT INTO FUNCS_TEST VALUES (2, 'Sara', 'Eng', 80, 4800.83);
  INSERT INTO FUNCS_TEST VALUES (3, 'Riya', 'Sci', 68, 4200.81);
  INSERT INTO FUNCS_TEST VALUES (4, 'Aman', 'Math', 92, 4200.81);
`);

const initcapRes = db.executeScript("SELECT inticap(subject) AS s1, initcap(name) AS s2 FROM FUNCS_TEST WHERE id = 1;");
assertTest("inticap and initcap capitalize column values", initcapRes[0].rows[0]['S1'] === 'Sci' && initcapRes[0].rows[0]['S2'] === 'Rohan');

const mathDualRes = db.executeScript(`
  SELECT 
    ROUND(4700.98) AS r1, ROUND(4700.98, 1) AS r2, ROUND(125.45, -1) AS r3,
    TRUNC(4700.98) AS t1, TRUNC(4700.98, 1) AS t2, TRUNC(125.45, -1) AS t3,
    CEIL(4700.12) AS c1, CEIL(-4700.98) AS c2,
    FLOOR(4700.98) AS f1, FLOOR(-4700.12) AS f2,
    MOD(11, 4) AS m1, MOD(11, 0) AS m2, MOD(-11, 4) AS m3,
    ABS(-4700.98) AS a1, ABS(4700.98) AS a2
  FROM dual;
`);
const md = mathDualRes[0].rows[0];
assertTest("ROUND with positive, zero, and negative decimal places", md['R1'] === 4701 && md['R2'] === 4701 && md['R3'] === 130);
assertTest("TRUNC with positive, zero, and negative decimal places", md['T1'] === 4700 && md['T2'] === 4700.9 && md['T3'] === 120);
assertTest("CEIL handles positive and negative numbers", md['C1'] === 4701 && md['C2'] === -4700);
assertTest("FLOOR handles positive and negative numbers", md['F1'] === 4700 && md['F2'] === -4701);
assertTest("MOD handles standard, zero divisor, and negative numbers", md['M1'] === 3 && md['M2'] === 11 && md['M3'] === -3);
assertTest("ABS handles negative and positive numbers", md['A1'] === 4700.98 && md['A2'] === 4700.98);

const aggResAll = db.executeScript(`
  SELECT 
    COUNT(*) AS total_count,
    COUNT(subject) AS subject_count,
    COUNT(DISTINCT subject) AS unique_dist,
    COUNT(DESTINCT subject) AS unique_dest,
    SUM(marks) AS sum_marks,
    AVG(marks) AS avg_marks,
    MAX(marks) AS max_marks,
    MIN(marks) AS min_marks
  FROM FUNCS_TEST;
`);
const ag = aggResAll[0].rows[0];
assertTest("Aggregate COUNT(*), COUNT(col), COUNT(DISTINCT col), COUNT(DESTINCT col)", 
  ag['TOTAL_COUNT'] === 4 && ag['SUBJECT_COUNT'] === 4 && ag['UNIQUE_DIST'] === 3 && ag['UNIQUE_DEST'] === 3
);
assertTest("Aggregate SUM, AVG, MAX, MIN calculated correctly", 
  ag['SUM_MARKS'] === 330 && ag['AVG_MARKS'] === 82.5 && ag['MAX_MARKS'] === 92 && ag['MIN_MARKS'] === 68
);

const destinctQuery = db.executeScript("SELECT DESTINCT subject FROM FUNCS_TEST ORDER BY subject ASC;");
assertTest("SELECT DESTINCT returns unique rows", destinctQuery[0].rows.length === 3 && destinctQuery[0].rows[0]['SUBJECT'] === 'Eng');

const aggExprRes = db.executeScript(`
  SELECT 
    MAX(marks) - MIN(marks) AS mark_range,
    COUNT(*) + 10 AS count_plus_10,
    ROUND(AVG(fee), 2) AS avg_fee_rnd
  FROM FUNCS_TEST;
`);
const ae = aggExprRes[0].rows[0];
assertTest("Aggregate expressions with arithmetic and functions (MAX - MIN, COUNT + 10, ROUND(AVG))", 
  ae['MARK_RANGE'] === 24 && ae['COUNT_PLUS_10'] === 14 && ae['AVG_FEE_RND'] > 4000
);

const aggGroupByRes = db.executeScript(`
  SELECT subject, COUNT(*) AS cnt, MAX(marks) - MIN(marks) AS diff
  FROM FUNCS_TEST GROUP BY subject ORDER BY subject ASC;
`);
assertTest("GROUP BY with aggregate expression", 
  aggGroupByRes[0].rows.length === 3 && aggGroupByRes[0].rows.find(r => r['SUBJECT'] === 'Sci')['DIFF'] === 22
);

const invalidFuncRes = db.executeScript("SELECT invalid_func(name) FROM FUNCS_TEST;");
assertTest("Unrecognized function call throws ORA-00904", invalidFuncRes[0].type === 'ERROR' && invalidFuncRes[0].error.code === 'ORA-00904');

const groupInWhereRes = db.executeScript("SELECT id FROM FUNCS_TEST WHERE COUNT(*) > 1;");
assertTest("Group function in WHERE clause throws ORA-00934", groupInWhereRes[0].type === 'ERROR' && groupInWhereRes[0].error.code === 'ORA-00934');

// 29. Unary minus and expressions on negative column values
db.executeScript(`
  CREATE TABLE NEG_MARKS_TEST (
    id NUMBER NOT NULL,
    marks NUMBER
  );
  INSERT INTO NEG_MARKS_TEST VALUES (1, -10);
  INSERT INTO NEG_MARKS_TEST VALUES (2, 20);
  INSERT INTO NEG_MARKS_TEST VALUES (3, 0);
  INSERT INTO NEG_MARKS_TEST VALUES (4, NULL);
`);

const negRes = db.executeScript("SELECT id, marks, -marks AS neg_marks, +marks AS pos_marks FROM NEG_MARKS_TEST ORDER BY id ASC;");
assertTest("SELECT -marks negates negative value -10 to 10", negRes[0].rows[0]['NEG_MARKS'] === 10);
assertTest("SELECT -marks negates positive value 20 to -20", negRes[0].rows[1]['NEG_MARKS'] === -20);
assertTest("SELECT -marks handles zero and NULL", negRes[0].rows[2]['NEG_MARKS'] === 0 && negRes[0].rows[3]['NEG_MARKS'] === null);
assertTest("SELECT +marks preserves negative and positive signs", negRes[0].rows[0]['POS_MARKS'] === -10 && negRes[0].rows[1]['POS_MARKS'] === 20);

const negArithRes = db.executeScript("SELECT -marks + 5 AS c1, 10 - marks AS c2 FROM NEG_MARKS_TEST WHERE id = 1;");
assertTest("Arithmetic with negative column value (-marks + 5 = 15, 10 - marks = 20)", 
  negArithRes[0].rows[0]['C1'] === 15 && negArithRes[0].rows[0]['C2'] === 20
);

const negWhereRes = db.executeScript("SELECT id FROM NEG_MARKS_TEST WHERE -marks = 10;");
assertTest("WHERE clause with -marks filters correctly", negWhereRes[0].rows.length === 1 && negWhereRes[0].rows[0]['ID'] === 1);


console.log('==============================================');
console.log(`  Tests Passed: ${passedCount} / ${totalCount}`);
console.log('==============================================');

if (passedCount === totalCount) {
  console.log('>>> ALL VERIFICATION TESTS PASSED SUCCESSFULLY! <<<');
} else {
  console.error('>>> SOME TESTS FAILED! <<<');
  process.exit(1);
}

