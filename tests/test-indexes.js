import { OracleDatabase, OracleError } from '../src/lib/oracle-engine.js';

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

function expectError(fn, expectedCode, desc) {
  try {
    const res = fn();
    if (res && res.type === 'ERROR' && res.error && res.error.code === expectedCode) {
      passed++;
      console.log(`  ✓ ${desc} (${res.error.code})`);
      return;
    }
    failed++;
    console.error(`  ✗ ${desc} - expected error ${expectedCode} but got ${res?.error?.code || res?.type || 'success'}`);
  } catch (err) {
    if (err instanceof OracleError && err.code === expectedCode) {
      passed++;
      console.log(`  ✓ ${desc} (${err.code})`);
    } else {
      failed++;
      console.error(`  ✗ ${desc} - expected ${expectedCode}, got ${err?.code || err?.message}`);
    }
  }
}

console.log('--- Testing Oracle Index Functionality ---');

const db = new OracleDatabase();

// Setup fresh table
db.executeScript(`
  DROP TABLE Student;
  CREATE TABLE Student (
    id NUMBER NOT NULL,
    name VARCHAR2(15) NOT NULL,
    subject VARCHAR2(10) NOT NULL,
    date_of_join DATE DEFAULT CURRENT_DATE,
    is_transfer BOOLEAN DEFAULT FALSE,
    fee FLOAT,
    gender CHAR,
    marks NUMBER,
    city VARCHAR2(20),
    email VARCHAR2(50)
  );
`);

// 1. User command: CREATE INDEX idx_student_city ON Student(city);
const res1 = db.executeOne('CREATE INDEX idx_student_city ON Student(city);');
assert(res1.type === 'DDL' && res1.message === 'Index created.', 'CREATE INDEX idx_student_city ON Student(city) succeeds');
const indexes = db.getIndexes();
assert(indexes.IDX_STUDENT_CITY !== undefined, 'Index IDX_STUDENT_CITY stored in database');
assert(indexes.IDX_STUDENT_CITY.tableName === 'STUDENT', 'Index has correct tableName');
assert(!indexes.IDX_STUDENT_CITY.isUnique, 'Index is non-unique');
assert(indexes.IDX_STUDENT_CITY.columns[0].name === 'CITY', 'Indexed column is CITY');
assert(indexes.IDX_STUDENT_CITY.columns[0].order === 'ASC', 'Default column sort order is ASC');

// 2. Query USER_INDEXES and USER_IND_COLUMNS
const idxQuery = db.executeOne("SELECT index_name, table_name, uniqueness FROM user_indexes WHERE index_name = 'IDX_STUDENT_CITY';");
assert(idxQuery.rows.length === 1, 'USER_INDEXES returns 1 row for IDX_STUDENT_CITY');
assert(idxQuery.rows[0].UNIQUENESS === 'NONUNIQUE', 'USER_INDEXES uniqueness is NONUNIQUE');

const colQuery = db.executeOne("SELECT index_name, column_name, column_position, descend FROM user_ind_columns WHERE index_name = 'IDX_STUDENT_CITY';");
assert(colQuery.rows.length === 1, 'USER_IND_COLUMNS returns 1 row for IDX_STUDENT_CITY');
assert(colQuery.rows[0].COLUMN_NAME === 'CITY', 'USER_IND_COLUMNS column name is CITY');
assert(colQuery.rows[0].COLUMN_POSITION === 1, 'USER_IND_COLUMNS position is 1');
assert(colQuery.rows[0].DESCEND === 'ASC', 'USER_IND_COLUMNS descend is ASC');

// 3. Composite Index with ASC and DESC
const resComp = db.executeOne('CREATE INDEX idx_stu_sub_marks ON Student(subject DESC, marks ASC);');
assert(resComp.message === 'Index created.', 'Composite index with DESC/ASC created');
const compIdx = db.getIndexes().IDX_STU_SUB_MARKS;
assert(compIdx.columns.length === 2, 'Composite index has 2 columns');
assert(compIdx.columns[0].name === 'SUBJECT' && compIdx.columns[0].order === 'DESC', 'First column is SUBJECT DESC');
assert(compIdx.columns[1].name === 'MARKS' && compIdx.columns[1].order === 'ASC', 'Second column is MARKS ASC');

// 4. Quoted Identifiers
const resQuoted = db.executeOne('CREATE INDEX "idx_quoted" ON "Student"("name");');
assert(resQuoted.message === 'Index created.', 'Quoted identifier index created');
assert(db.getIndexes().IDX_QUOTED !== undefined, 'Quoted index stored in uppercase');

// 5. Error: Table does not exist (ORA-00942)
expectError(() => {
  return db.executeOne('CREATE INDEX idx_err_tbl ON NonExistentTable(id);');
}, 'ORA-00942', 'CREATE INDEX on non-existent table throws ORA-00942');

// 6. Error: Column does not exist (ORA-00904)
expectError(() => {
  return db.executeOne('CREATE INDEX idx_err_col ON Student(nonexistent_col);');
}, 'ORA-00904', 'CREATE INDEX on non-existent column throws ORA-00904');

// 7. Error: Duplicate column name in index (ORA-00957)
expectError(() => {
  return db.executeOne('CREATE INDEX idx_err_dupcol ON Student(fee, fee);');
}, 'ORA-00957', 'CREATE INDEX with duplicate columns throws ORA-00957');

// 8. Error: Index name already used by existing object (ORA-00955)
expectError(() => {
  return db.executeOne('CREATE INDEX idx_student_city ON Student(city);');
}, 'ORA-00955', 'CREATE INDEX with already existing index name throws ORA-00955');

expectError(() => {
  return db.executeOne('CREATE INDEX Student ON Student(city);');
}, 'ORA-00955', 'CREATE INDEX with existing table name throws ORA-00955');

// 9. Error: Invalid CREATE INDEX syntax (ORA-00901)
expectError(() => {
  return db.executeOne('CREATE INDEX ON Student;');
}, 'ORA-00901', 'CREATE INDEX without name throws ORA-00901');

// 10. Unique index on existing duplicate data (ORA-00001)
db.executeOne("INSERT INTO Student (id, name, subject, email) VALUES (1, 'Rohan', 'Sci', 'dup@test.com');");
db.executeOne("INSERT INTO Student (id, name, subject, email) VALUES (2, 'Sara', 'Eng', 'dup@test.com');");

expectError(() => {
  return db.executeOne('CREATE UNIQUE INDEX idx_student_email_uniq ON Student(email);');
}, 'ORA-00001', 'CREATE UNIQUE INDEX with existing duplicate values throws ORA-00001');

// Clean duplicate data
db.executeOne("UPDATE Student SET email = 'sara@test.com' WHERE id = 2;");

// 11. Unique index creation succeeds after resolving duplicates
const resUniq = db.executeOne('CREATE UNIQUE INDEX idx_student_email_uniq ON Student(email);');
assert(resUniq.message === 'Index created.', 'CREATE UNIQUE INDEX succeeds when data is unique');
assert(db.getIndexes().IDX_STUDENT_EMAIL_UNIQ.isUnique === true, 'Index recorded as unique');

// 12. Unique index enforcement on INSERT duplicate (ORA-00001)
expectError(() => {
  return db.executeOne("INSERT INTO Student (id, name, subject, email) VALUES (3, 'Riya', 'Math', 'dup@test.com');");
}, 'ORA-00001', 'INSERT duplicate into table with unique index throws ORA-00001');

// 13. Unique index enforcement on UPDATE duplicate (ORA-00001)
expectError(() => {
  return db.executeOne("UPDATE Student SET email = 'dup@test.com' WHERE id = 2;");
}, 'ORA-00001', 'UPDATE to existing unique index value throws ORA-00001');

// 14. Unique index allows multiple NULL values (Oracle standard)
const resNull1 = db.executeOne("INSERT INTO Student (id, name, subject, email) VALUES (4, 'Aman', 'Math', NULL);");
const resNull2 = db.executeOne("INSERT INTO Student (id, name, subject, email) VALUES (5, 'Kavya', 'Sci', NULL);");
assert(resNull1.rowsAffected === 1 && resNull2.rowsAffected === 1, 'Unique index allows multiple NULL values');

// 15. DROP INDEX succeeds
const resDrop = db.executeOne('DROP INDEX idx_student_city;');
assert(resDrop.type === 'DDL' && resDrop.message === 'Index dropped.', 'DROP INDEX idx_student_city succeeds');
assert(db.getIndexes().IDX_STUDENT_CITY === undefined, 'IDX_STUDENT_CITY removed from db.getIndexes()');

// 16. DROP INDEX on non-existent index throws ORA-01418
expectError(() => {
  return db.executeOne('DROP INDEX idx_student_city;');
}, 'ORA-01418', 'DROP INDEX on non-existent index throws ORA-01418');

// 17. DROP TABLE cascades index removal
db.executeOne('CREATE TABLE TempTable (x NUMBER);');
db.executeOne('CREATE INDEX idx_temp_table_x ON TempTable(x);');
assert(db.getIndexes().IDX_TEMP_TABLE_X !== undefined, 'Index created on TempTable');
db.executeOne('DROP TABLE TempTable;');
assert(db.getIndexes().IDX_TEMP_TABLE_X === undefined, 'Dropping TempTable automatically cleans up associated indexes');

console.log(`\nResults: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
