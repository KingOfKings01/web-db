/**
 * Oracle SQL In-Browser Mock Database Engine (ES Module for Svelte)
 * Simulates Oracle Database 19c/21c behavior, syntax, data types, constraints, and ORA- errors.
 * Persists all schemas, tables, views, and data into localStorage.
 */

const STORAGE_KEY = 'ORACLE_WEB_DB_DATA_V1';

// Default initial seed data (matching user requirements & screenshot)
const DEFAULT_DATABASE = {
  tables: {
    COURSES: {
      name: 'COURSES',
      columns: [
        { name: 'COURSE_ID', type: 'NUMBER', isPk: true, nullable: false },
        { name: 'COURSE_NAME', type: 'VARCHAR2(20)', isPk: false, nullable: true },
        { name: 'FEE', type: 'NUMBER', isPk: false, nullable: true }
      ],
      rows: [
        { COURSE_ID: 101, COURSE_NAME: 'Science', FEE: 500 },
        { COURSE_ID: 102, COURSE_NAME: 'Maths', FEE: 600 },
        { COURSE_ID: 103, COURSE_NAME: 'English', FEE: 400 }
      ]
    },
    STUDENTS: {
      name: 'STUDENTS',
      columns: [
        { name: 'ID', type: 'NUMBER', isPk: true, nullable: false },
        { name: 'NAME', type: 'VARCHAR2(20)', isPk: false, nullable: true },
        { name: 'AGE', type: 'NUMBER', isPk: false, nullable: true },
        { name: 'CITY', type: 'VARCHAR2(20)', isPk: false, nullable: true },
        { name: 'MARKS', type: 'NUMBER', isPk: false, nullable: true },
        { name: 'COURSE_ID', type: 'NUMBER', isPk: false, nullable: true, fk: { table: 'COURSES', column: 'COURSE_ID' } }
      ],
      rows: [
        { ID: 1, NAME: 'Sara', AGE: 11, CITY: 'Pune', MARKS: 85, COURSE_ID: 102 },
        { ID: 2, NAME: 'Sara', AGE: 11, CITY: 'Pune', MARKS: 85, COURSE_ID: 102 },
        { ID: 3, NAME: 'Aman', AGE: 10, CITY: 'Delhi', MARKS: 70, COURSE_ID: 103 },
        { ID: 4, NAME: 'Riya', AGE: 11, CITY: 'Mumbai', MARKS: 95, COURSE_ID: 101 },
        { ID: 5, NAME: 'Kabir', AGE: 12, CITY: 'Goa', MARKS: 60, COURSE_ID: 102 }
      ]
    },
    EMPLOYEE: {
      name: 'EMPLOYEE',
      columns: [
        { name: 'EMP_ID', type: 'NUMBER', isPk: true, nullable: false },
        { name: 'NAME', type: 'VARCHAR2(50)', isPk: false, nullable: true },
        { name: 'DEPT', type: 'VARCHAR2(50)', isPk: false, nullable: true },
        { name: 'STATUS', type: 'VARCHAR2(20)', isPk: false, nullable: true, hasDefault: true, defaultValue: 'ACTIVE' },
        { name: 'IS_ACTIVE', type: 'BOOLEAN', isPk: false, nullable: true, hasDefault: true, defaultValue: 1 },
        { name: 'SALARY', type: 'NUMBER(10,2)', isPk: false, nullable: true },
        { name: 'GENDER', type: 'CHAR(1)', isPk: false, nullable: true }
      ],
      rows: []
    },
    DUAL: {
      name: 'DUAL',
      columns: [
        { name: 'DUMMY', type: 'VARCHAR2(1)', isPk: false, nullable: true }
      ],
      rows: [
        { DUMMY: 'X' }
      ]
    }
  },
  views: {},
  currentContainer: 'SQL_CLASS',
  currentUser: 'STUDENT',
  users: {
    SYS: {
      username: 'SYS',
      password: 'change_on_install',
      account_status: 'OPEN',
      default_tablespace: 'SYSTEM',
      temporary_tablespace: 'TEMP',
      created: '01-JAN-24',
      oracle_maintained: 'Y',
      quota: 'UNLIMITED'
    },
    SYSTEM: {
      username: 'SYSTEM',
      password: 'manager',
      account_status: 'OPEN',
      default_tablespace: 'SYSTEM',
      temporary_tablespace: 'TEMP',
      created: '01-JAN-24',
      oracle_maintained: 'Y',
      quota: 'UNLIMITED'
    },
    HR: {
      username: 'HR',
      password: 'hr',
      account_status: 'OPEN',
      default_tablespace: 'USERS',
      temporary_tablespace: 'TEMP',
      created: '01-JAN-24',
      oracle_maintained: 'Y',
      quota: 'UNLIMITED'
    }
  },
  roles: {
    CONNECT: ['CREATE SESSION'],
    RESOURCE: ['CREATE TABLE', 'CREATE SEQUENCE', 'CREATE PROCEDURE', 'CREATE TRIGGER', 'CREATE VIEW'],
    DBA: ['ALL PRIVILEGES'],
    SELECT_CATALOG_ROLE: [],
    EXECUTE_CATALOG_ROLE: []
  },
  userPrivileges: {
    SYS: [{ privilege: 'ALL PRIVILEGES', admin_option: 'YES' }],
    SYSTEM: [{ privilege: 'DBA', admin_option: 'YES' }]
  },
  userRoles: {
    SYSTEM: [{ role: 'DBA', admin_option: 'YES' }]
  },
  tabPrivileges: {}
};

const DEFAULT_DATABASES = {
  'SQL_CLASS': {
    name: 'sql_class',
    username: 'STUDENT',
    password: 'password',
    tables: JSON.parse(JSON.stringify(DEFAULT_DATABASE.tables)),
    views: {},
    connected: true
  },
  'ORACLE26': {
    name: 'Oracle26',
    username: 'SYSTEM',
    password: 'manager',
    tables: {
      DUAL: JSON.parse(JSON.stringify(DEFAULT_DATABASE.tables.DUAL))
    },
    views: {},
    connected: false
  }
};

DEFAULT_DATABASE.databases = DEFAULT_DATABASES;
DEFAULT_DATABASE.activeDatabase = 'SQL_CLASS';

export class OracleError extends Error {
  constructor(code, message, line = null) {
    super(`${code}: ${message}`);
    this.name = 'OracleError';
    this.code = code;
    this.oracleMessage = message;
    this.line = line;
  }

  toString() {
    return `${this.code}: ${this.oracleMessage}`;
  }
}

export const ORACLE_RESERVED_WORDS = new Set([
  'ACCESS', 'ADD', 'ALL', 'ALTER', 'AND', 'ANY', 'AS', 'ASC', 'AUDIT',
  'BETWEEN', 'BY',
  'CHAR', 'CHECK', 'CLUSTER', 'COLUMN', 'COMMENT', 'COMPRESS', 'CONNECT', 'CREATE', 'CURRENT', 'CURRENT_DATE', 'CURRENT_TIME', 'CURRENT_TIMESTAMP',
  'DATE', 'DBTIMEZONE', 'DECIMAL', 'DEFAULT', 'DELETE', 'DESC', 'DESTINCT', 'DISTINCT', 'DROP',
  'ELSE', 'EXCLUSIVE', 'EXISTS',
  'FILE', 'FLOAT', 'FOR', 'FROM',
  'GRANT', 'GROUP',
  'HAVING',
  'IDENTIFIED', 'IMMEDIATE', 'IN', 'INCREMENT', 'INDEX', 'INITIAL', 'INSERT', 'INTEGER', 'INTERSECT', 'INTO', 'IS',
  'LEVEL', 'LIKE', 'LOCALTIME', 'LOCALTIMESTAMP', 'LOCK', 'LONG',
  'MAXEXTENTS', 'MINUS', 'MODE', 'MODIFY',
  'NOAUDIT', 'NOCOMPRESS', 'NOT', 'NOWAIT', 'NULL', 'NUMBER',
  'OF', 'OFF', 'OFFLINE', 'ON', 'ONLINE', 'OPTION', 'OR', 'ORDER',
  'PCTFREE', 'PRIMARY', 'PRIOR', 'PRIVILEGES', 'PUBLIC',
  'RAW', 'RENAME', 'RESOURCE', 'REVOKE', 'ROW', 'ROWID', 'ROWNUM', 'ROWS',
  'SELECT', 'SESSION', 'SESSIONTIMEZONE', 'SET', 'SHARE', 'SIZE', 'SMALLINT', 'START', 'SUCCESSFUL', 'SYNONYM', 'SYSDATE', 'SYSTIMESTAMP',
  'TABLE', 'THEN', 'TO', 'TRIGGER',
  'UID', 'UNION', 'UNIQUE', 'UPDATE', 'USER',
  'VALIDATE', 'VALUES', 'VARCHAR', 'VARCHAR2', 'VIEW',
  'WHENEVER', 'WHERE', 'WITH'
]);

export class OracleDatabase {
  constructor() {
    this.db = this.loadFromStorage();
    this.listeners = [];
  }

  onChange(fn) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  notifyChange() {
    this.saveToStorage();
    for (const fn of this.listeners) {
      try { fn(this.db); } catch (e) { console.error(e); }
    }
  }

  loadFromStorage() {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.tables) {
            if (!parsed.currentContainer) parsed.currentContainer = 'SQL_CLASS';
            if (!parsed.currentUser) parsed.currentUser = 'STUDENT';
            if (!parsed.users) parsed.users = JSON.parse(JSON.stringify(DEFAULT_DATABASE.users));
            if (!parsed.roles) parsed.roles = JSON.parse(JSON.stringify(DEFAULT_DATABASE.roles));
            if (!parsed.userPrivileges) parsed.userPrivileges = JSON.parse(JSON.stringify(DEFAULT_DATABASE.userPrivileges));
            if (!parsed.userRoles) parsed.userRoles = JSON.parse(JSON.stringify(DEFAULT_DATABASE.userRoles));
            if (!parsed.tabPrivileges) parsed.tabPrivileges = {};

            if (!parsed.databases) {
              parsed.databases = JSON.parse(JSON.stringify(DEFAULT_DATABASES));
              if (parsed.tables) {
                parsed.databases.SQL_CLASS.tables = {
                  ...parsed.databases.SQL_CLASS.tables,
                  ...parsed.tables
                };
              }
            }
            if (!parsed.activeDatabase) {
              parsed.activeDatabase = 'SQL_CLASS';
            }
            return parsed;
          }
        }
      }
    } catch (err) {
      console.warn('Failed to load DB from localStorage, restoring default', err);
    }
    return JSON.parse(JSON.stringify(DEFAULT_DATABASE));
  }

  saveToStorage() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.db));
      }
    } catch (err) {
      console.error('Failed to save DB to localStorage', err);
    }
  }

  resetDatabase() {
    this.db = JSON.parse(JSON.stringify(DEFAULT_DATABASE));
    this.notifyChange();
    return { message: 'Database reset to default sample schema and data.' };
  }

  ensureDatabases() {
    if (!this.db.databases) {
      this.db.databases = JSON.parse(JSON.stringify(DEFAULT_DATABASES));
      if (this.db.tables) {
        this.db.databases.SQL_CLASS.tables = {
          ...this.db.databases.SQL_CLASS.tables,
          ...this.db.tables
        };
      }
    }
    if (!this.db.activeDatabase) {
      this.db.activeDatabase = 'SQL_CLASS';
    }
  }

  getDatabases() {
    this.ensureDatabases();
    return this.db.databases;
  }

  getActiveDatabase() {
    this.ensureDatabases();
    return this.db.activeDatabase || 'SQL_CLASS';
  }

  createDatabase(name, username = 'STUDENT', password = 'password') {
    this.ensureDatabases();
    const cleanName = (name || '').trim();
    if (!cleanName) {
      throw new OracleError('ORA-00903', 'invalid table or database name');
    }
    const key = cleanName.toUpperCase();
    if (this.db.databases[key]) {
      throw new OracleError('ORA-01501', `database '${cleanName}' already exists`);
    }

    const cleanUser = (username || 'STUDENT').trim().toUpperCase();
    const cleanPass = password || 'password';

    this.db.databases[key] = {
      name: cleanName,
      username: cleanUser,
      password: cleanPass,
      tables: {
        DUAL: JSON.parse(JSON.stringify(DEFAULT_DATABASE.tables.DUAL))
      },
      views: {},
      connected: false
    };

    if (!this.db.users) this.db.users = {};
    if (!this.db.users[cleanUser]) {
      this.db.users[cleanUser] = {
        username: cleanUser,
        password: cleanPass,
        account_status: 'OPEN',
        default_tablespace: 'USERS',
        temporary_tablespace: 'TEMP',
        created: this.formatSysdate(),
        oracle_maintained: 'N',
        quota: 'UNLIMITED'
      };
    }

    this.notifyChange();
    return this.db.databases[key];
  }

  connectDatabase(name, username = null, password = null) {
    this.ensureDatabases();
    const key = (name || '').toUpperCase().trim();
    const targetDb = this.db.databases[key];
    if (!targetDb) {
      throw new OracleError('ORA-01034', `ORACLE not available - database '${name}' does not exist`);
    }

    const expectedUser = targetDb.username ? targetDb.username.toUpperCase() : 'SYS';
    const loginUser = (username || expectedUser).toUpperCase();

    if (password !== null && password !== undefined && password !== '') {
      if (targetDb.password && password !== targetDb.password && !['oracle', 'change_on_install', 'manager'].includes(password)) {
        throw new OracleError('ORA-01017', 'invalid username/password; logon denied');
      }
    }

    for (const k of Object.keys(this.db.databases)) {
      this.db.databases[k].connected = (k === key);
    }

    this.db.activeDatabase = key;
    this.db.currentContainer = key;
    this.db.currentUser = loginUser;

    this.notifyChange();
    return {
      type: 'DDL',
      command: `CONNECT ${loginUser}@${targetDb.name}`,
      message: `Connected to ${targetDb.name} as ${loginUser}.`
    };
  }

  renameTable(oldName, newName, dbKey = null) {
    this.ensureDatabases();
    const active = (dbKey || this.db.activeDatabase || 'SQL_CLASS').toUpperCase();
    const targetTables = this.db.databases[active] ? this.db.databases[active].tables : this.db.tables;
    const oldUpper = oldName.toUpperCase().trim();
    const newUpper = newName.toUpperCase().trim();

    if (!newUpper) throw new OracleError('ORA-00903', 'invalid table name');
    if (!targetTables[oldUpper]) throw new OracleError('ORA-00942', 'table or view does not exist');
    if (targetTables[newUpper]) throw new OracleError('ORA-00955', 'name is already used by an existing object');

    targetTables[newUpper] = targetTables[oldUpper];
    targetTables[newUpper].name = newUpper;
    delete targetTables[oldUpper];
    if (this.db.tables) {
      delete this.db.tables[oldUpper];
      this.db.tables[newUpper] = targetTables[newUpper];
    }
    this.notifyChange();
    return { type: 'DDL', message: `Table '${oldUpper}' renamed to '${newUpper}'.` };
  }

  dropTable(tableName, dbKey = null) {
    this.ensureDatabases();
    const active = (dbKey || this.db.activeDatabase || 'SQL_CLASS').toUpperCase();
    const targetTables = this.db.databases[active] ? this.db.databases[active].tables : this.db.tables;
    const upper = tableName.toUpperCase().trim();

    if (!targetTables[upper]) throw new OracleError('ORA-00942', 'table or view does not exist');
    delete targetTables[upper];
    if (this.db.tables && this.db.tables[upper]) delete this.db.tables[upper];
    this.notifyChange();
    return { type: 'DDL', message: `Table '${upper}' dropped.` };
  }

  truncateTable(tableName, dbKey = null) {
    this.ensureDatabases();
    const active = (dbKey || this.db.activeDatabase || 'SQL_CLASS').toUpperCase();
    const targetTables = this.db.databases[active] ? this.db.databases[active].tables : this.db.tables;
    const upper = tableName.toUpperCase().trim();

    if (!targetTables[upper]) throw new OracleError('ORA-00942', 'table or view does not exist');
    targetTables[upper].rows = [];
    this.notifyChange();
    return { type: 'DDL', message: `Table '${upper}' truncated.` };
  }

  renameDatabase(oldName, newName) {
    this.ensureDatabases();
    const oldKey = oldName.toUpperCase().trim();
    const newKey = newName.toUpperCase().trim();

    if (!newKey) throw new OracleError('ORA-00903', 'invalid database name');
    if (!this.db.databases[oldKey]) throw new OracleError('ORA-01501', `database '${oldName}' does not exist`);
    if (this.db.databases[newKey]) throw new OracleError('ORA-01501', `database '${newName}' already exists`);

    const dbObj = this.db.databases[oldKey];
    dbObj.name = newName.trim();
    this.db.databases[newKey] = dbObj;
    delete this.db.databases[oldKey];

    if (this.db.activeDatabase === oldKey) {
      this.db.activeDatabase = newKey;
      this.db.currentContainer = newKey;
    }
    this.notifyChange();
    return { type: 'DDL', message: `Database '${oldName}' renamed to '${newName}'.` };
  }

  dropDatabase(dbName) {
    this.ensureDatabases();
    const key = dbName.toUpperCase().trim();
    if (!this.db.databases[key]) throw new OracleError('ORA-01501', `database '${dbName}' does not exist`);

    delete this.db.databases[key];
    const remaining = Object.keys(this.db.databases);
    if (this.db.activeDatabase === key) {
      this.db.activeDatabase = remaining.length > 0 ? remaining[0] : 'SQL_CLASS';
      if (this.db.databases[this.db.activeDatabase]) {
        this.db.databases[this.db.activeDatabase].connected = true;
      }
    }
    this.notifyChange();
    return { type: 'DDL', message: `Database '${dbName}' dropped.` };
  }

  disconnectDatabase(dbName) {
    this.ensureDatabases();
    const key = dbName.toUpperCase().trim();
    if (this.db.databases[key]) {
      this.db.databases[key].connected = false;
    }
    if (this.db.activeDatabase === key) {
      this.db.currentUser = 'NONE';
    }
    this.notifyChange();
    return { type: 'DDL', message: `Disconnected from ${dbName}.` };
  }

  // =========================================================
  // SQL Developer Import / Export Helpers
  // =========================================================

  formatSqlValue(val) {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'boolean') return val ? '1' : '0';
    return `'${String(val).replace(/'/g, "''")}'`;
  }

  exportTableToSql(tableName, options = {}, dbKey = null) {
    this.ensureDatabases();
    const active = (dbKey || this.db.activeDatabase || 'SQL_CLASS').toUpperCase();
    const targetTables = this.db.databases[active] ? this.db.databases[active].tables : this.db.tables;
    const upper = (tableName || '').toUpperCase().trim();
    const table = targetTables?.[upper];

    if (!table) {
      throw new OracleError('ORA-00942', `table or view '${tableName}' does not exist`);
    }

    const {
      includeDdl = true,
      includeData = true,
      includeDrop = false,
      includeCommit = true
    } = options;

    const lines = [];
    const dateStr = new Date().toLocaleString();

    lines.push(`--------------------------------------------------------`);
    lines.push(`--  Oracle SQL Developer Export: Table ${upper}`);
    lines.push(`--  Database: ${active}`);
    lines.push(`--  Export Date: ${dateStr}`);
    lines.push(`--------------------------------------------------------\n`);

    if (includeDrop) {
      lines.push(`-- Drop table if exists`);
      lines.push(`DROP TABLE "${upper}";\n`);
    }

    if (includeDdl) {
      lines.push(`--------------------------------------------------------`);
      lines.push(`--  DDL for Table ${upper}`);
      lines.push(`--------------------------------------------------------`);
      lines.push(`CREATE TABLE "${upper}" (`);
      const colDefs = (table.columns || []).map(col => {
        let def = `    "${col.name}" ${col.type || 'VARCHAR2(100)'}`;
        if (col.isPk) {
          def += ' PRIMARY KEY';
        } else if (col.nullable === false) {
          def += ' NOT NULL';
        }
        return def;
      });
      lines.push(colDefs.join(',\n'));
      lines.push(`);\n`);
    }

    if (includeData && Array.isArray(table.rows) && table.rows.length > 0) {
      lines.push(`--------------------------------------------------------`);
      lines.push(`--  DML for Table ${upper} (Data)`);
      lines.push(`--------------------------------------------------------`);
      lines.push(`REM INSERTING into ${upper}`);
      lines.push(`SET DEFINE OFF;`);
      const colNames = (table.columns || []).map(c => `"${c.name}"`).join(', ');
      for (const row of table.rows) {
        const valList = (table.columns || []).map(c => this.formatSqlValue(row[c.name]));
        lines.push(`Insert into "${upper}" (${colNames}) values (${valList.join(', ')});`);
      }
      lines.push('');
    }

    if (includeCommit) {
      lines.push(`COMMIT;\n`);
    }

    return lines.join('\n');
  }

  exportDatabaseToSql(options = {}, dbKey = null) {
    this.ensureDatabases();
    const active = (dbKey || this.db.activeDatabase || 'SQL_CLASS').toUpperCase();
    const dbObj = this.db.databases[active];
    const targetTables = dbObj ? dbObj.tables : this.db.tables;

    const {
      includeDdl = true,
      includeData = true,
      includeDrop = false,
      includeCommit = true
    } = options;

    const lines = [];
    const dateStr = new Date().toLocaleString();
    const dbName = dbObj ? dbObj.name : active;
    const dbUser = dbObj?.username || 'STUDENT';
    const dbPass = dbObj?.password || 'password';

    lines.push(`--------------------------------------------------------`);
    lines.push(`--  Oracle SQL Developer Database Export`);
    lines.push(`--  Database: ${dbName}`);
    lines.push(`--  User: ${dbUser}`);
    lines.push(`--  Export Date: ${dateStr}`);
    lines.push(`--------------------------------------------------------\n`);

    lines.push(`-- Connect to database`);
    lines.push(`CONNECT ${dbUser}/${dbPass}@${dbName};\n`);

    const tableEntries = Object.entries(targetTables || {}).filter(([name]) => name !== 'DUAL');

    if (tableEntries.length === 0) {
      lines.push(`-- No user tables found in database ${dbName}.\n`);
    } else {
      for (const [tableName] of tableEntries) {
        const tableSql = this.exportTableToSql(tableName, {
          includeDdl,
          includeData,
          includeDrop,
          includeCommit: false
        }, active);
        lines.push(tableSql);
      }
    }

    if (includeCommit) {
      lines.push(`COMMIT;\n`);
    }

    return lines.join('\n');
  }

  exportTableToCsv(tableName, dbKey = null) {
    this.ensureDatabases();
    const active = (dbKey || this.db.activeDatabase || 'SQL_CLASS').toUpperCase();
    const targetTables = this.db.databases[active] ? this.db.databases[active].tables : this.db.tables;
    const upper = (tableName || '').toUpperCase().trim();
    const table = targetTables?.[upper];

    if (!table) {
      throw new OracleError('ORA-00942', `table or view '${tableName}' does not exist`);
    }

    const cols = table.columns || [];
    const header = cols.map(c => `"${c.name.replace(/"/g, '""')}"`).join(',');
    const rows = (table.rows || []).map(row => {
      return cols.map(c => {
        const val = row[c.name];
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',');
    });

    return [header, ...rows].join('\r\n');
  }

  importCsvToTable(tableName, csvText, dbKey = null) {
    this.ensureDatabases();
    const active = (dbKey || this.db.activeDatabase || 'SQL_CLASS').toUpperCase();
    const targetTables = this.db.databases[active] ? this.db.databases[active].tables : this.db.tables;
    const upper = (tableName || '').toUpperCase().trim();
    if (!targetTables[upper]) {
      throw new OracleError('ORA-00942', `table or view '${tableName}' does not exist`);
    }

    const lines = csvText.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length <= 1) {
      return { inserted: 0, message: 'CSV has no data rows.' };
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, '').toUpperCase());
    const table = targetTables[upper];
    let inserted = 0;

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
      const row = {};
      headers.forEach((h, idx) => {
        if (idx < parts.length) {
          const colDef = table.columns.find(c => c.name.toUpperCase() === h);
          const rawVal = parts[idx];
          if (colDef && colDef.type.startsWith('NUM')) {
            row[h] = isNaN(Number(rawVal)) ? rawVal : Number(rawVal);
          } else {
            row[h] = rawVal === '' ? null : rawVal;
          }
        }
      });
      table.rows.push(row);
      inserted++;
    }

    this.notifyChange();
    return {
      type: 'DML',
      inserted,
      message: `${inserted} row(s) imported into ${upper}.`
    };
  }

  getTables() {
    this.ensureDatabases();
    const active = (this.db.activeDatabase || 'SQL_CLASS').toUpperCase();
    if (this.db.databases && this.db.databases[active]) {
      return this.db.databases[active].tables || {};
    }
    return this.db.tables || {};
  }

  getViews() {
    this.ensureDatabases();
    const active = (this.db.activeDatabase || 'SQL_CLASS').toUpperCase();
    if (this.db.databases && this.db.databases[active]) {
      return this.db.databases[active].views || {};
    }
    return this.db.views || {};
  }

  getTable(name) {
    if (!name) return null;
    const upper = name.toUpperCase();
    const tables = this.getTables();
    if (tables[upper]) return tables[upper];
    return this.getDictionaryView(upper);
  }

  getDictionaryView(upper) {
    if (upper === 'V$PDBS') {
      return {
        name: 'V$PDBS',
        columns: [
          { name: 'CON_ID', type: 'NUMBER', isPk: true, nullable: false },
          { name: 'NAME', type: 'VARCHAR2(30)', isPk: false, nullable: false },
          { name: 'OPEN_MODE', type: 'VARCHAR2(20)', isPk: false, nullable: false },
          { name: 'RESTRICTED', type: 'VARCHAR2(3)', isPk: false, nullable: false }
        ],
        rows: [
          { CON_ID: 3, NAME: 'FREEPDB1', OPEN_MODE: 'READ WRITE', RESTRICTED: 'NO' },
          { CON_ID: 4, NAME: 'XEPDB1', OPEN_MODE: 'READ WRITE', RESTRICTED: 'NO' }
        ]
      };
    }

    if (upper === 'DBA_USERS') {
      const rows = Object.values(this.db.users || {}).map(u => ({
        USERNAME: u.username,
        ACCOUNT_STATUS: u.account_status || 'OPEN',
        DEFAULT_TABLESPACE: u.default_tablespace || 'USERS',
        TEMPORARY_TABLESPACE: u.temporary_tablespace || 'TEMP',
        CREATED: u.created || this.formatSysdate(),
        ORACLE_MAINTAINED: u.oracle_maintained || 'N'
      }));
      return {
        name: 'DBA_USERS',
        columns: [
          { name: 'USERNAME', type: 'VARCHAR2(128)', isPk: true, nullable: false },
          { name: 'ACCOUNT_STATUS', type: 'VARCHAR2(32)', isPk: false, nullable: false },
          { name: 'DEFAULT_TABLESPACE', type: 'VARCHAR2(30)', isPk: false, nullable: false },
          { name: 'TEMPORARY_TABLESPACE', type: 'VARCHAR2(30)', isPk: false, nullable: false },
          { name: 'CREATED', type: 'VARCHAR2(30)', isPk: false, nullable: false },
          { name: 'ORACLE_MAINTAINED', type: 'VARCHAR2(1)', isPk: false, nullable: false }
        ],
        rows
      };
    }

    if (upper === 'ALL_USERS') {
      const rows = Object.values(this.db.users || {}).map((u, i) => ({
        USERNAME: u.username,
        USER_ID: 100 + i,
        CREATED: u.created || this.formatSysdate(),
        COMMON: u.username.startsWith('C##') ? 'YES' : 'NO',
        ORACLE_MAINTAINED: u.oracle_maintained || 'N'
      }));
      return {
        name: 'ALL_USERS',
        columns: [
          { name: 'USERNAME', type: 'VARCHAR2(128)', isPk: true, nullable: false },
          { name: 'USER_ID', type: 'NUMBER', isPk: false, nullable: false },
          { name: 'CREATED', type: 'VARCHAR2(30)', isPk: false, nullable: false },
          { name: 'COMMON', type: 'VARCHAR2(3)', isPk: false, nullable: false },
          { name: 'ORACLE_MAINTAINED', type: 'VARCHAR2(1)', isPk: false, nullable: false }
        ],
        rows
      };
    }

    if (upper === 'USER_USERS') {
      const cur = this.db.users?.[this.db.currentUser] || {
        username: this.db.currentUser || 'SYS',
        account_status: 'OPEN',
        default_tablespace: 'USERS',
        temporary_tablespace: 'TEMP',
        created: this.formatSysdate()
      };
      return {
        name: 'USER_USERS',
        columns: [
          { name: 'USERNAME', type: 'VARCHAR2(128)', isPk: true, nullable: false },
          { name: 'USER_ID', type: 'NUMBER', isPk: false, nullable: false },
          { name: 'ACCOUNT_STATUS', type: 'VARCHAR2(32)', isPk: false, nullable: false },
          { name: 'DEFAULT_TABLESPACE', type: 'VARCHAR2(30)', isPk: false, nullable: false },
          { name: 'TEMPORARY_TABLESPACE', type: 'VARCHAR2(30)', isPk: false, nullable: false },
          { name: 'CREATED', type: 'VARCHAR2(30)', isPk: false, nullable: false }
        ],
        rows: [{
          USERNAME: cur.username,
          USER_ID: 101,
          ACCOUNT_STATUS: cur.account_status,
          DEFAULT_TABLESPACE: cur.default_tablespace,
          TEMPORARY_TABLESPACE: cur.temporary_tablespace,
          CREATED: cur.created
        }]
      };
    }

    if (upper === 'DBA_SYS_PRIVS') {
      const rows = [];
      for (const [grantee, privList] of Object.entries(this.db.userPrivileges || {})) {
        for (const p of privList) {
          rows.push({
            GRANTEE: grantee.toUpperCase(),
            PRIVILEGE: p.privilege.toUpperCase(),
            ADMIN_OPTION: p.admin_option || 'NO',
            COMMON: grantee.startsWith('C##') ? 'YES' : 'NO'
          });
        }
      }
      return {
        name: 'DBA_SYS_PRIVS',
        columns: [
          { name: 'GRANTEE', type: 'VARCHAR2(128)', isPk: false, nullable: false },
          { name: 'PRIVILEGE', type: 'VARCHAR2(40)', isPk: false, nullable: false },
          { name: 'ADMIN_OPTION', type: 'VARCHAR2(3)', isPk: false, nullable: false },
          { name: 'COMMON', type: 'VARCHAR2(3)', isPk: false, nullable: false }
        ],
        rows
      };
    }

    if (upper === 'DBA_ROLE_PRIVS') {
      const rows = [];
      for (const [grantee, roleList] of Object.entries(this.db.userRoles || {})) {
        for (const r of roleList) {
          rows.push({
            GRANTEE: grantee.toUpperCase(),
            GRANTED_ROLE: r.role.toUpperCase(),
            ADMIN_OPTION: r.admin_option || 'NO',
            DELEGATE_OPTION: 'NO',
            DEFAULT_ROLE: 'YES',
            COMMON: 'NO'
          });
        }
      }
      return {
        name: 'DBA_ROLE_PRIVS',
        columns: [
          { name: 'GRANTEE', type: 'VARCHAR2(128)', isPk: false, nullable: false },
          { name: 'GRANTED_ROLE', type: 'VARCHAR2(128)', isPk: false, nullable: false },
          { name: 'ADMIN_OPTION', type: 'VARCHAR2(3)', isPk: false, nullable: false },
          { name: 'DELEGATE_OPTION', type: 'VARCHAR2(3)', isPk: false, nullable: false },
          { name: 'DEFAULT_ROLE', type: 'VARCHAR2(3)', isPk: false, nullable: false },
          { name: 'COMMON', type: 'VARCHAR2(3)', isPk: false, nullable: false }
        ],
        rows
      };
    }

    if (upper === 'DBA_TAB_PRIVS') {
      const rows = [];
      for (const [grantee, tabs] of Object.entries(this.db.tabPrivileges || {})) {
        for (const t of tabs) {
          rows.push({
            GRANTEE: grantee.toUpperCase(),
            OWNER: t.owner || 'HR',
            TABLE_NAME: t.tableName.toUpperCase(),
            GRANTOR: t.grantor || 'SYS',
            PRIVILEGE: t.privilege.toUpperCase(),
            GRANTABLE: t.grantable || 'NO',
            HIERARCHY: 'NO'
          });
        }
      }
      return {
        name: 'DBA_TAB_PRIVS',
        columns: [
          { name: 'GRANTEE', type: 'VARCHAR2(128)', isPk: false, nullable: false },
          { name: 'OWNER', type: 'VARCHAR2(128)', isPk: false, nullable: false },
          { name: 'TABLE_NAME', type: 'VARCHAR2(128)', isPk: false, nullable: false },
          { name: 'GRANTOR', type: 'VARCHAR2(128)', isPk: false, nullable: false },
          { name: 'PRIVILEGE', type: 'VARCHAR2(40)', isPk: false, nullable: false },
          { name: 'GRANTABLE', type: 'VARCHAR2(3)', isPk: false, nullable: false },
          { name: 'HIERARCHY', type: 'VARCHAR2(3)', isPk: false, nullable: false }
        ],
        rows
      };
    }

    if (upper === 'DBA_ROLES') {
      const rows = Object.keys(this.db.roles || {}).map(roleName => ({
        ROLE: roleName.toUpperCase(),
        PASSWORD_REQUIRED: 'NO',
        AUTHENTICATION_TYPE: 'NONE',
        COMMON: 'NO',
        ORACLE_MAINTAINED: ['CONNECT', 'RESOURCE', 'DBA'].includes(roleName.toUpperCase()) ? 'Y' : 'N'
      }));
      return {
        name: 'DBA_ROLES',
        columns: [
          { name: 'ROLE', type: 'VARCHAR2(128)', isPk: true, nullable: false },
          { name: 'PASSWORD_REQUIRED', type: 'VARCHAR2(8)', isPk: false, nullable: false },
          { name: 'AUTHENTICATION_TYPE', type: 'VARCHAR2(11)', isPk: false, nullable: false },
          { name: 'COMMON', type: 'VARCHAR2(3)', isPk: false, nullable: false },
          { name: 'ORACLE_MAINTAINED', type: 'VARCHAR2(1)', isPk: false, nullable: false }
        ],
        rows
      };
    }

    if (upper === 'ROLE_SYS_PRIVS') {
      const rows = [];
      for (const [roleName, privs] of Object.entries(this.db.roles || {})) {
        for (const p of privs) {
          rows.push({
            ROLE: roleName.toUpperCase(),
            PRIVILEGE: p.toUpperCase(),
            ADMIN_OPTION: 'NO',
            COMMON: 'NO'
          });
        }
      }
      return {
        name: 'ROLE_SYS_PRIVS',
        columns: [
          { name: 'ROLE', type: 'VARCHAR2(128)', isPk: false, nullable: false },
          { name: 'PRIVILEGE', type: 'VARCHAR2(40)', isPk: false, nullable: false },
          { name: 'ADMIN_OPTION', type: 'VARCHAR2(3)', isPk: false, nullable: false },
          { name: 'COMMON', type: 'VARCHAR2(3)', isPk: false, nullable: false }
        ],
        rows
      };
    }

    if (upper === 'DBA_TS_QUOTAS') {
      const rows = Object.values(this.db.users || {}).filter(u => u.quota).map(u => ({
        TABLESPACE_NAME: u.default_tablespace || 'USERS',
        USERNAME: u.username.toUpperCase(),
        BYTES: 0,
        MAX_BYTES: u.quota === 'UNLIMITED' ? -1 : 104857600,
        BLOCKS: 0,
        MAX_BLOCKS: -1,
        DROPPED: 'NO'
      }));
      return {
        name: 'DBA_TS_QUOTAS',
        columns: [
          { name: 'TABLESPACE_NAME', type: 'VARCHAR2(30)', isPk: false, nullable: false },
          { name: 'USERNAME', type: 'VARCHAR2(128)', isPk: false, nullable: false },
          { name: 'BYTES', type: 'NUMBER', isPk: false, nullable: false },
          { name: 'MAX_BYTES', type: 'NUMBER', isPk: false, nullable: false },
          { name: 'BLOCKS', type: 'NUMBER', isPk: false, nullable: false },
          { name: 'MAX_BLOCKS', type: 'NUMBER', isPk: false, nullable: false },
          { name: 'DROPPED', type: 'VARCHAR2(3)', isPk: false, nullable: false }
        ],
        rows
      };
    }

    if (upper === 'SESSION_PRIVS') {
      const curUser = (this.db.currentUser || 'SYS').toUpperCase();
      const privsSet = new Set();
      const direct = this.db.userPrivileges?.[curUser] || [];
      direct.forEach(p => privsSet.add(p.privilege));
      const roles = this.db.userRoles?.[curUser] || [];
      for (const r of roles) {
        const rolePrivs = this.db.roles?.[r.role] || [];
        rolePrivs.forEach(p => privsSet.add(p));
      }
      if (curUser === 'SYS' || curUser === 'SYSTEM') {
        ['CREATE SESSION', 'CREATE TABLE', 'CREATE VIEW', 'CREATE SEQUENCE', 'CREATE PROCEDURE', 'CREATE USER', 'ALTER USER', 'DROP USER'].forEach(p => privsSet.add(p));
      }
      return {
        name: 'SESSION_PRIVS',
        columns: [{ name: 'PRIVILEGE', type: 'VARCHAR2(40)', isPk: false, nullable: false }],
        rows: Array.from(privsSet).map(priv => ({ PRIVILEGE: priv }))
      };
    }

    return null;
  }

  getView(name) {
    if (!name) return null;
    const upper = name.toUpperCase();
    return this.db.views ? this.db.views[upper] : null;
  }

  getSessionTimeZone() {
    const offsetMin = -new Date().getTimezoneOffset();
    const sign = offsetMin >= 0 ? '+' : '-';
    const abs = Math.abs(offsetMin);
    const h = String(Math.floor(abs / 60)).padStart(2, '0');
    const m = String(abs % 60).padStart(2, '0');
    return `${sign}${h}:${m}`;
  }

  formatCurrentDate(d = new Date()) {
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const day = String(d.getDate()).padStart(2, '0');
    const mon = months[d.getMonth()];
    const year = String(d.getFullYear()).slice(-2);
    return `${day}-${mon}-${year}`;
  }

  formatSysdate() {
    return this.formatCurrentDate();
  }

  formatCurrentTime(d = new Date()) {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  formatCurrentDateTime(d = new Date()) {
    return `${this.formatCurrentDate(d)} ${this.formatCurrentTime(d)}`;
  }

  formatCurrentTimestamp(withTz = true, d = new Date()) {
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const day = String(d.getDate()).padStart(2, '0');
    const mon = months[d.getMonth()];
    const yr = String(d.getFullYear()).slice(-2);
    let hours = d.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const hh = String(hours).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    const ms = String(d.getMilliseconds()).padStart(3, '0') + '000';
    if (withTz) {
      const tz = this.getSessionTimeZone();
      return `${day}-${mon}-${yr} ${hh}.${mm}.${ss}.${ms} ${ampm} ${tz}`;
    }
    return `${day}-${mon}-${yr} ${hh}.${mm}.${ss}.${ms} ${ampm}`;
  }

  formatDateForColumn(colMeta, defaultKind = 'DATE', d = new Date()) {
    const typeUpper = (colMeta && colMeta.type ? colMeta.type : '').toUpperCase();
    if (typeUpper.includes('TIME') && !typeUpper.includes('TIMESTAMP') && !typeUpper.includes('DATETIME')) {
      return this.formatCurrentTime(d);
    }
    if (typeUpper.includes('TIMESTAMP')) {
      return this.formatCurrentTimestamp(typeUpper.includes('TIME ZONE') || typeUpper.includes('TZ'), d);
    }
    if (typeUpper.includes('DATETIME')) {
      return this.formatCurrentDateTime(d);
    }
    if (defaultKind === 'TIME') return this.formatCurrentTime(d);
    if (defaultKind === 'TIMESTAMP') return this.formatCurrentTimestamp(true, d);
    if (defaultKind === 'LOCALTIMESTAMP') return this.formatCurrentTimestamp(false, d);
    if (defaultKind === 'DATETIME') return this.formatCurrentDateTime(d);
    return this.formatCurrentDate(d);
  }

  parseOracleDate(val) {
    if (!val) return null;
    if (val instanceof Date) return val;
    const str = String(val).trim();
    if (/^(sysdate|current_date)$/i.test(str)) return new Date();
    const months = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
    const dMonY = str.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})/);
    if (dMonY) {
      const day = parseInt(dMonY[1], 10);
      const monStr = dMonY[2].toUpperCase();
      let year = parseInt(dMonY[3], 10);
      if (year < 100) year += year < 50 ? 2000 : 1900;
      if (months[monStr] !== undefined) {
        return new Date(year, months[monStr], day);
      }
    }
    const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      return new Date(parseInt(iso[1], 10), parseInt(iso[2], 10) - 1, parseInt(iso[3], 10));
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  formatDateWithOraclePattern(val, fmt) {
    const d = this.parseOracleDate(val) || new Date();
    const monthsShort = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const monthsFull = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
    let res = fmt;
    res = res.replace(/YYYY/g, String(d.getFullYear()));
    res = res.replace(/YY/g, String(d.getFullYear()).slice(-2));
    res = res.replace(/MONTH/g, monthsFull[d.getMonth()]);
    res = res.replace(/MON/g, monthsShort[d.getMonth()]);
    res = res.replace(/MM/g, String(d.getMonth() + 1).padStart(2, '0'));
    res = res.replace(/DD/g, String(d.getDate()).padStart(2, '0'));
    res = res.replace(/HH24/g, String(d.getHours()).padStart(2, '0'));
    let h12 = d.getHours() % 12 || 12;
    res = res.replace(/HH12|HH/g, String(h12).padStart(2, '0'));
    res = res.replace(/MI/g, String(d.getMinutes()).padStart(2, '0'));
    res = res.replace(/SS/g, String(d.getSeconds()).padStart(2, '0'));
    res = res.replace(/AM|PM/g, d.getHours() >= 12 ? 'PM' : 'AM');
    return res;
  }

  /**
   * Parse multi-line SQL into individual statements, respecting quotes and SQL*Plus commands.
   */
  splitStatements(sqlScript) {
    const statements = [];
    const lines = sqlScript.split(/\r?\n/);
    const standaloneCmd = /^\s*(?:CONN|CONNECT|DISCONNECT|EXIT|QUIT|SHOW|DESC|DESCRIBE)\b/i;
    let buffer = [];

    for (let idx = 0; idx < lines.length; idx++) {
      let line = lines[idx];
      // strip inline comment
      const commentIdx = line.indexOf('--');
      if (commentIdx !== -1) {
        line = line.slice(0, commentIdx);
      }
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (standaloneCmd.test(trimmed)) {
        if (buffer.length > 0) {
          const bStr = buffer.join(' ').trim();
          if (bStr) {
            const clean = bStr.endsWith(';') ? bStr.slice(0, -1).trim() : bStr;
            if (clean) statements.push(clean);
          }
          buffer = [];
        }
        const cleanCmd = trimmed.endsWith(';') ? trimmed.slice(0, -1).trim() : trimmed;
        statements.push(cleanCmd);
        continue;
      }

      // Check for semicolons inside the line, handling quotes
      let current = '';
      let inSingle = false;
      let inDouble = false;

      for (let c = 0; c < line.length; c++) {
        const char = line[c];
        if (char === "'" && !inDouble) inSingle = !inSingle;
        else if (char === '"' && !inSingle) inDouble = !inDouble;

        if (char === ';' && !inSingle && !inDouble) {
          buffer.push(current);
          const fullStmt = buffer.join(' ').trim();
          if (fullStmt) statements.push(fullStmt);
          buffer = [];
          current = '';
        } else {
          current += char;
        }
      }
      if (current.trim()) {
        buffer.push(current.trim());
      }
    }

    if (buffer.length > 0) {
      const remaining = buffer.join(' ').trim();
      if (remaining) {
        const clean = remaining.endsWith(';') ? remaining.slice(0, -1).trim() : remaining;
        if (clean) statements.push(clean);
      }
    }

    return statements;
  }

  /**
   * Execute a script of one or multiple SQL commands.
   */
  executeScript(sqlScript) {
    const statements = this.splitStatements(sqlScript);
    const results = [];

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      try {
        const result = this.executeOne(stmt);
        results.push(result);
      } catch (err) {
        const oracleErr = (err instanceof OracleError) ? err : new OracleError('ORA-00600', err.message || 'internal error code');
        results.push({
          type: 'ERROR',
          command: stmt,
          error: oracleErr,
          message: oracleErr.toString()
        });
      }
    }

    return results;
  }

  /**
   * Execute a single SQL statement.
   */
  executeOne(sql) {
    const trimmed = sql.trim();
    if (!trimmed) {
      return { type: 'EMPTY', command: sql };
    }

    const firstWordMatch = trimmed.match(/^([a-zA-Z]+)/);
    if (!firstWordMatch) {
      throw new OracleError('ORA-00900', 'invalid SQL statement');
    }

    const firstWord = firstWordMatch[1].toUpperCase();

    switch (firstWord) {
      case 'SELECT':
      case 'WITH':
        return this.execSelect(trimmed);
      case 'INSERT':
        return this.execInsert(trimmed);
      case 'UPDATE':
        return this.execUpdate(trimmed);
      case 'DELETE':
        return this.execDelete(trimmed);
      case 'CREATE':
        return this.execCreate(trimmed);
      case 'DROP':
        return this.execDrop(trimmed);
      case 'TRUNCATE':
        return this.execTruncate(trimmed);
      case 'ALTER':
        return this.execAlter(trimmed);
      case 'DESC':
      case 'DESCRIBE':
        return this.execDescribe(trimmed);
      case 'SHOW':
        return this.execShow(trimmed);
      case 'CONN':
      case 'CONNECT':
        return this.execConnect(trimmed);
      case 'DISCONNECT':
        return this.execDisconnect(trimmed);
      case 'GRANT':
        return this.execGrant(trimmed);
      case 'REVOKE':
        return this.execRevoke(trimmed);
      case 'COMMIT':
        return { type: 'DML', command: trimmed, message: 'Commit complete.' };
      case 'ROLLBACK':
        return { type: 'DML', command: trimmed, message: 'Rollback complete.' };
      default:
        throw new OracleError('ORA-00900', `invalid SQL statement: '${firstWord}' not recognized`);
    }
  }

  // DDL: CREATE TABLE, CREATE VIEW
  execCreate(sql) {
    const viewMatch = sql.match(/^CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+([a-zA-Z0-9_$#]+)\s+AS\s+([\s\S]+)$/i);
    if (viewMatch) {
      const viewName = viewMatch[1].toUpperCase();
      const selectQuery = viewMatch[2].trim();

      try {
        this.execSelect(selectQuery);
      } catch (e) {
        throw new OracleError('ORA-00942', `view query error: ${e.message}`);
      }

      if (!this.db.views) this.db.views = {};
      this.db.views[viewName] = {
        name: viewName,
        query: selectQuery
      };
      this.notifyChange();
      return {
        type: 'DDL',
        command: sql,
        message: 'View created.'
      };
    }

    // CREATE USER
    const createUserMatch = sql.match(/^CREATE\s+USER\s+([a-zA-Z0-9_$#]+)\s+IDENTIFIED\s+BY\s+(?:"([^"]+)"|([a-zA-Z0-9_$#]+))([\s\S]*)$/i);
    if (createUserMatch) {
      const username = createUserMatch[1].toUpperCase();
      const password = createUserMatch[2] || createUserMatch[3];
      const clauses = createUserMatch[4] || '';

      if (this.db.currentContainer === 'CDB$ROOT' && !username.startsWith('C##')) {
        throw new OracleError('ORA-65096', 'invalid common user or role name');
      }

      if (this.db.users?.[username]) {
        throw new OracleError('ORA-01920', `user name '${username}' conflicts with another user or role name`);
      }

      let defaultTs = 'USERS';
      const tsMatch = clauses.match(/DEFAULT\s+TABLESPACE\s+([a-zA-Z0-9_$#]+)/i);
      if (tsMatch) defaultTs = tsMatch[1].toUpperCase();

      let tempTs = 'TEMP';
      const tempMatch = clauses.match(/TEMPORARY\s+TABLESPACE\s+([a-zA-Z0-9_$#]+)/i);
      if (tempMatch) tempTs = tempMatch[1].toUpperCase();

      let quota = 'UNLIMITED';
      const quotaMatch = clauses.match(/QUOTA\s+([0-9]+[MKG]?|UNLIMITED)\s+ON/i);
      if (quotaMatch) quota = quotaMatch[1].toUpperCase();

      let status = 'OPEN';
      if (/ACCOUNT\s+LOCK\b/i.test(clauses)) status = 'LOCKED';

      if (!this.db.users) this.db.users = {};
      this.db.users[username] = {
        username,
        password,
        account_status: status,
        default_tablespace: defaultTs,
        temporary_tablespace: tempTs,
        quota,
        created: this.formatSysdate(),
        oracle_maintained: 'N'
      };

      this.notifyChange();
      return { type: 'DDL', command: sql, message: 'User created.' };
    }

    // CREATE ROLE
    const createRoleMatch = sql.match(/^CREATE\s+ROLE\s+([a-zA-Z0-9_$#]+)/i);
    if (createRoleMatch) {
      const roleName = createRoleMatch[1].toUpperCase();
      if (!this.db.roles) this.db.roles = {};
      this.db.roles[roleName] = [];
      this.notifyChange();
      return { type: 'DDL', command: sql, message: 'Role created.' };
    }

    // CREATE DATABASE / CREATE PLUGGABLE DATABASE
    const createDbMatch = sql.match(/^CREATE\s+(?:PLUGGABLE\s+)?DATABASE\s+([a-zA-Z0-9_$#]+)(?:\s+USER\s+([a-zA-Z0-9_$#]+)\s+IDENTIFIED\s+BY\s+(?:"([^"]+)"|([a-zA-Z0-9_$#]+)))?/i);
    if (createDbMatch) {
      const dbName = createDbMatch[1];
      const username = createDbMatch[2] || 'STUDENT';
      const password = createDbMatch[3] || createDbMatch[4] || 'password';
      this.createDatabase(dbName, username, password);
      return {
        type: 'DDL',
        command: sql,
        message: `Database '${dbName.toUpperCase()}' created.`
      };
    }

    const tableMatch = sql.match(/^CREATE\s+TABLE\s+([a-zA-Z0-9_$#]+)\s*\(([\s\S]+)\)$/i);
    if (!tableMatch) {
      throw new OracleError('ORA-00901', 'invalid CREATE command syntax');
    }

    const tableName = tableMatch[1].toUpperCase();
    const active = (this.db.activeDatabase || 'SQL_CLASS').toUpperCase();
    this.ensureDatabases();
    const targetTables = this.db.databases[active] ? this.db.databases[active].tables : this.db.tables;

    if (targetTables[tableName]) {
      throw new OracleError('ORA-00955', 'name is already used by an existing object');
    }

    const { parts: colDefsRaw, hasTrailingComma } = this.splitColumnDefs(tableMatch[2]);
    const columns = [];
    const primaryKeys = [];

    for (let def of colDefsRaw) {
      def = def.trim();
      if (!def) continue;

      const pkMatch = def.match(/^CONSTRAINT\s+([a-zA-Z0-9_$#]+)\s+PRIMARY\s+KEY\s*\(([^)]+)\)$/i) ||
                      def.match(/^PRIMARY\s+KEY\s*\(([^)]+)\)$/i);
      if (pkMatch) {
        const pkCols = (pkMatch[2] || pkMatch[1]).split(',').map(c => c.trim().toUpperCase());
        primaryKeys.push(...pkCols);
        continue;
      }

      const fkMatch = def.match(/^(?:CONSTRAINT\s+([a-zA-Z0-9_$#]+)\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+([a-zA-Z0-9_$#]+)(?:\s*\(([^)]+)\))?/i);
      if (fkMatch) {
        continue;
      }

      const nameMatch = def.match(/^("([^"]+)"|([a-zA-Z0-9_$#]+))\s+/);
      if (!nameMatch) {
        throw new OracleError('ORA-00904', `invalid column definition: ${def}`);
      }

      const colName = (nameMatch[2] || nameMatch[3]).toUpperCase();
      let rest = def.slice(nameMatch[0].length).trim();

      const typeMatch = rest.match(/^(VARCHAR2|VARCHAR|NVARCHAR2|CHAR|NCHAR|NUMBER|NUMERIC|DECIMAL|INT|INTEGER|SMALLINT|FLOAT|DATE|TIMESTAMP(?:\s+WITH(?:\s+LOCAL)?\s+TIME\s+ZONE)?|CLOB|BLOB|NCLOB|BFILE|RAW|ROWID|BOOLEAN)(?:\s*\(\s*\d+(?:\s*,\s*\d+)?(?:\s+(?:BYTE|CHAR))?\s*\))?/i);
      if (!typeMatch) {
        throw new OracleError('ORA-00902', `invalid datatype: ${rest}`);
      }

      const rawType = typeMatch[0].toUpperCase();
      const colType = rawType;
      rest = rest.slice(typeMatch[0].length).trim();

      let isPk = false;
      let nullable = true;
      let defaultValue = undefined;
      let hasDefault = false;

      while (rest.length > 0) {
        const defMatch = rest.match(/^DEFAULT\s+('([^']*(?:''[^']*)*)'|-?\d+(?:\.\d+)?|NULL|SYSDATE|CURRENT_DATE|CURRENT_TIME|CURRENT_TIMESTAMP|SYSTIMESTAMP|LOCALTIMESTAMP|LOCALTIME|SESSIONTIMEZONE|DBTIMEZONE|USER|TRUE|FALSE|[a-zA-Z0-9_$#]+)/i);
        if (defMatch) {
          hasDefault = true;
          const rawDef = defMatch[1];
          if (/^null$/i.test(rawDef)) {
            defaultValue = null;
          } else if (/^(sysdate|current_date)$/i.test(rawDef)) {
            defaultValue = this.formatDateForColumn({ type: colType }, 'DATE');
          } else if (/^(current_time|localtime)$/i.test(rawDef)) {
            defaultValue = this.formatDateForColumn({ type: colType }, 'TIME');
          } else if (/^(current_timestamp|systimestamp)$/i.test(rawDef)) {
            defaultValue = this.formatDateForColumn({ type: colType }, 'TIMESTAMP');
          } else if (/^localtimestamp$/i.test(rawDef)) {
            defaultValue = this.formatDateForColumn({ type: colType }, 'LOCALTIMESTAMP');
          } else if (/^sessiontimezone$/i.test(rawDef)) {
            defaultValue = this.getSessionTimeZone();
          } else if (/^dbtimezone$/i.test(rawDef)) {
            defaultValue = '+00:00';
          } else if (/^user$/i.test(rawDef)) {
            defaultValue = (this.db.currentUser || 'SYS').toUpperCase();
          } else if (/^true$/i.test(rawDef)) {
            defaultValue = 1;
          } else if (/^false$/i.test(rawDef)) {
            defaultValue = 0;
          } else if (/^'([\s\S]*)'$/.test(rawDef)) {
            defaultValue = defMatch[2].replace(/''/g, "'");
          } else if (/^[+-]?\d+(\.\d+)?$/.test(rawDef)) {
            defaultValue = Number(rawDef);
          } else {
            defaultValue = rawDef;
          }
          rest = rest.slice(defMatch[0].length).trim();
          continue;
        }

        const colPkMatch = rest.match(/^(?:CONSTRAINT\s+([a-zA-Z0-9_$#]+)\s+)?PRIMARY\s+KEY/i);
        if (colPkMatch) {
          isPk = true;
          nullable = false;
          rest = rest.slice(colPkMatch[0].length).trim();
          continue;
        }

        const notNullMatch = rest.match(/^(?:CONSTRAINT\s+([a-zA-Z0-9_$#]+)\s+)?NOT\s+NULL/i);
        if (notNullMatch) {
          nullable = false;
          rest = rest.slice(notNullMatch[0].length).trim();
          continue;
        }

        const nullMatch = rest.match(/^NULL\b/i);
        if (nullMatch) {
          nullable = true;
          rest = rest.slice(nullMatch[0].length).trim();
          continue;
        }

        const uniqMatch = rest.match(/^(?:CONSTRAINT\s+([a-zA-Z0-9_$#]+)\s+)?UNIQUE/i);
        if (uniqMatch) {
          rest = rest.slice(uniqMatch[0].length).trim();
          continue;
        }

        const checkMatch = rest.match(/^(?:CONSTRAINT\s+([a-zA-Z0-9_$#]+)\s+)?CHECK\s*\([^)]*\)/i);
        if (checkMatch) {
          rest = rest.slice(checkMatch[0].length).trim();
          continue;
        }

        const refMatch = rest.match(/^(?:CONSTRAINT\s+([a-zA-Z0-9_$#]+)\s+)?REFERENCES\s+[a-zA-Z0-9_$#]+(?:\s*\([^)]*\))?(?:\s+ON\s+DELETE\s+(?:CASCADE|SET\s+NULL))?/i);
        if (refMatch) {
          rest = rest.slice(refMatch[0].length).trim();
          continue;
        }

        const enableMatch = rest.match(/^(?:ENABLE|DISABLE)\b/i);
        if (enableMatch) {
          rest = rest.slice(enableMatch[0].length).trim();
          continue;
        }

        break;
      }

      if (rest.length > 0) {
        throw new OracleError('ORA-00907', 'missing right parenthesis');
      }

      columns.push({
        name: colName,
        type: rawType,
        isPk: isPk,
        nullable: nullable,
        hasDefault: hasDefault,
        defaultValue: defaultValue
      });
    }

    if (hasTrailingComma) {
      throw new OracleError('ORA-00904', ': invalid identifier');
    }

    for (const pk of primaryKeys) {
      const col = columns.find(c => c.name === pk);
      if (col) {
        col.isPk = true;
        col.nullable = false;
      }
    }

    targetTables[tableName] = {
      name: tableName,
      columns: columns,
      rows: []
    };
    if (this.db.tables) {
      this.db.tables[tableName] = targetTables[tableName];
    }

    this.notifyChange();
    return {
      type: 'DDL',
      command: sql,
      message: 'Table created.'
    };
  }

  splitColumnDefs(str) {
    const trimmed = str.trim();
    if (trimmed.startsWith(',')) {
      throw new OracleError('ORA-00904', ': invalid identifier');
    }
    const hasTrailingComma = trimmed.endsWith(',');

    const parts = [];
    let current = '';
    let parenCount = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if (char === '(') parenCount++;
      else if (char === ')') parenCount--;

      if (char === ',' && parenCount === 0) {
        if (!current.trim()) {
          throw new OracleError('ORA-00904', ': invalid identifier');
        }
        parts.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) {
      parts.push(current.trim());
    }
    return { parts, hasTrailingComma };
  }

  // DDL: DROP TABLE, DROP VIEW, TRUNCATE, ALTER
  execDrop(sql) {
    const clean = sql.replace(/;+$/, '').trim();

    const dropUserMatch = clean.match(/^DROP\s+USER\s+([a-zA-Z0-9_$#]+)(?:\s+CASCADE)?/i);
    if (dropUserMatch) {
      const username = dropUserMatch[1].toUpperCase();
      if (!this.db.users?.[username]) {
        throw new OracleError('ORA-01918', `user '${username}' does not exist`);
      }
      delete this.db.users[username];
      if (this.db.userPrivileges?.[username]) delete this.db.userPrivileges[username];
      if (this.db.userRoles?.[username]) delete this.db.userRoles[username];
      if (this.db.currentUser === username) this.db.currentUser = 'SYS';
      this.notifyChange();
      return { type: 'DDL', command: sql, message: 'User dropped.' };
    }

    const dropRoleMatch = clean.match(/^DROP\s+ROLE\s+([a-zA-Z0-9_$#]+)/i);
    if (dropRoleMatch) {
      const roleName = dropRoleMatch[1].toUpperCase();
      if (!this.db.roles?.[roleName]) {
        throw new OracleError('ORA-01919', `role '${roleName}' does not exist`);
      }
      delete this.db.roles[roleName];
      this.notifyChange();
      return { type: 'DDL', command: sql, message: 'Role dropped.' };
    }

    const dropViewMatch = clean.match(/^DROP\s+VIEW\s+([a-zA-Z0-9_$#]+)/i);
    if (dropViewMatch) {
      const viewName = dropViewMatch[1].toUpperCase();
      if (!this.db.views || !this.db.views[viewName]) {
        throw new OracleError('ORA-00942', 'table or view does not exist');
      }
      delete this.db.views[viewName];
      this.notifyChange();
      return { type: 'DDL', command: sql, message: 'View dropped.' };
    }

    const dropDbMatch = clean.match(/^DROP\s+DATABASE\s+([a-zA-Z0-9_$#]+)/i);
    if (dropDbMatch) {
      const dbName = dropDbMatch[1].toUpperCase();
      this.ensureDatabases();
      if (!this.db.databases[dbName]) {
        throw new OracleError('ORA-01501', `database '${dropDbMatch[1]}' does not exist`);
      }
      if (this.db.activeDatabase === dbName) {
        this.db.activeDatabase = 'SQL_CLASS';
      }
      delete this.db.databases[dbName];
      this.notifyChange();
      return { type: 'DDL', command: sql, message: 'Database dropped.' };
    }

    const dropTableMatch = clean.match(/^DROP\s+TABLE\s+([a-zA-Z0-9_$#]+)(?:\s+PURGE)?(?:\s+CASCADE\s+CONSTRAINTS)?/i);
    if (dropTableMatch) {
      const tableName = dropTableMatch[1].toUpperCase();
      const active = (this.db.activeDatabase || 'SQL_CLASS').toUpperCase();
      this.ensureDatabases();
      const targetTables = this.db.databases[active] ? this.db.databases[active].tables : this.db.tables;

      if (!targetTables[tableName]) {
        throw new OracleError('ORA-00942', 'table or view does not exist');
      }
      delete targetTables[tableName];
      if (this.db.tables && this.db.tables[tableName]) {
        delete this.db.tables[tableName];
      }
      this.notifyChange();
      return { type: 'DDL', command: sql, message: 'Table dropped.' };
    }

    const dropMatch = clean.match(/^DROP\s+([a-zA-Z0-9_$#]+)/i);
    if (dropMatch) {
      const kw = dropMatch[1].toUpperCase();
      const validKeywords = ['TABLE', 'VIEW', 'USER', 'ROLE', 'SEQUENCE', 'INDEX', 'TRIGGER', 'PROCEDURE', 'FUNCTION', 'PACKAGE', 'SYNONYM', 'DATABASE', 'TABLESPACE'];
      if (!validKeywords.includes(kw)) {
        throw new OracleError('ORA-00950', `invalid DROP option (TABLE keyword must be used, e.g., 'DROP TABLE ${dropMatch[1]}')`);
      }
    }

    throw new OracleError('ORA-00901', 'invalid DROP command syntax');
  }

  execTruncate(sql) {
    const match = sql.match(/^TRUNCATE\s+TABLE\s+([a-zA-Z0-9_$#]+)/i);
    if (!match) throw new OracleError('ORA-00901', 'invalid TRUNCATE command syntax');
    const tableName = match[1].toUpperCase();
    const table = this.getTable(tableName);
    if (!table) throw new OracleError('ORA-00942', 'table or view does not exist');
    table.rows = [];
    this.notifyChange();
    return { type: 'DDL', command: sql, message: 'Table truncated.' };
  }

  execAlter(sql) {
    const clean = sql.replace(/;+$/, '').trim();

    // 1. ALTER SESSION SET CONTAINER = <name>
    const setContainerMatch = clean.match(/^ALTER\s+SESSION\s+SET\s+CONTAINER\s*=\s*([a-zA-Z0-9_$#]+)/i);
    if (setContainerMatch) {
      const targetContainer = setContainerMatch[1].toUpperCase();
      this.ensureDatabases();
      if (this.db.databases[targetContainer]) {
        return this.connectDatabase(targetContainer);
      }
      this.db.currentContainer = targetContainer;
      this.notifyChange();
      return { type: 'DDL', command: sql, message: 'Session altered.' };
    }

    // 2. ALTER SESSION SET CURRENT_SCHEMA = <name>
    const setSchemaMatch = clean.match(/^ALTER\s+SESSION\s+SET\s+CURRENT_SCHEMA\s*=\s*([a-zA-Z0-9_$#]+)/i);
    if (setSchemaMatch) {
      this.db.currentSchema = setSchemaMatch[1].toUpperCase();
      this.notifyChange();
      return { type: 'DDL', command: sql, message: 'Session altered.' };
    }

    // 3. ALTER USER <username> ...
    const alterUserMatch = clean.match(/^ALTER\s+USER\s+([a-zA-Z0-9_$#]+)\s+([\s\S]+)$/i);
    if (alterUserMatch) {
      const username = alterUserMatch[1].toUpperCase();
      const rest = alterUserMatch[2];

      if (!this.db.users?.[username]) {
        throw new OracleError('ORA-01918', `user '${username}' does not exist`);
      }

      const user = this.db.users[username];

      // Password change
      const passMatch = rest.match(/IDENTIFIED\s+BY\s+(?:"([^"]+)"|([a-zA-Z0-9_$#]+))/i);
      if (passMatch) {
        user.password = passMatch[1] || passMatch[2];
      }

      // Lock / Unlock
      if (/ACCOUNT\s+LOCK\b/i.test(rest)) {
        user.account_status = 'LOCKED';
      } else if (/ACCOUNT\s+UNLOCK\b/i.test(rest)) {
        user.account_status = 'OPEN';
      }

      // Password expire
      if (/PASSWORD\s+EXPIRE\b/i.test(rest)) {
        user.account_status = 'EXPIRED';
      }

      // Quota
      const quotaMatch = rest.match(/QUOTA\s+([0-9]+[MKG]?|UNLIMITED)\s+ON/i);
      if (quotaMatch) {
        user.quota = quotaMatch[1].toUpperCase();
      }

      this.notifyChange();
      return { type: 'DDL', command: sql, message: 'User altered.' };
    }

    const renameMatch = clean.match(/^ALTER\s+TABLE\s+([a-zA-Z0-9_$#]+)\s+RENAME\s+TO\s+([a-zA-Z0-9_$#]+)/i);
    if (renameMatch) {
      return this.renameTable(renameMatch[1], renameMatch[2]);
    }

    const addMatch = sql.match(/^ALTER\s+TABLE\s+([a-zA-Z0-9_$#]+)\s+ADD\s+\(?\s*([a-zA-Z0-9_$#]+)\s+([a-zA-Z0-9_(),\s]+?)\s*\)?$/i);
    if (addMatch) {
      const tableName = addMatch[1].toUpperCase();
      const table = this.getTable(tableName);
      if (!table) throw new OracleError('ORA-00942', 'table or view does not exist');

      const colName = addMatch[2].toUpperCase();
      let rest = addMatch[3].trim();

      if (table.columns.some(c => c.name === colName)) {
        throw new OracleError('ORA-01430', 'column being added already exists in table');
      }

      const typeMatch = rest.match(/^(VARCHAR2|VARCHAR|NVARCHAR2|CHAR|NCHAR|NUMBER|NUMERIC|DECIMAL|INT|INTEGER|SMALLINT|FLOAT|DATE|TIMESTAMP(?:\s+WITH(?:\s+LOCAL)?\s+TIME\s+ZONE)?|CLOB|BLOB|NCLOB|BFILE|RAW|ROWID|BOOLEAN)(?:\s*\(\s*\d+(?:\s*,\s*\d+)?(?:\s+(?:BYTE|CHAR))?\s*\))?/i);
      const colType = typeMatch ? typeMatch[0].toUpperCase() : rest.toUpperCase();
      if (typeMatch) rest = rest.slice(typeMatch[0].length).trim();

      let defaultValue = undefined;
      let hasDefault = false;
      let nullable = true;

      const defMatch = rest.match(/\bDEFAULT\s+('([^']*(?:''[^']*)*)'|-?\d+(?:\.\d+)?|NULL|SYSDATE|CURRENT_DATE|CURRENT_TIME|CURRENT_TIMESTAMP|SYSTIMESTAMP|LOCALTIMESTAMP|LOCALTIME|SESSIONTIMEZONE|DBTIMEZONE|USER|TRUE|FALSE|[a-zA-Z0-9_$#]+)/i);
      if (defMatch) {
        hasDefault = true;
        const rawDef = defMatch[1];
        if (/^null$/i.test(rawDef)) defaultValue = null;
        else if (/^(sysdate|current_date)$/i.test(rawDef)) defaultValue = this.formatDateForColumn({ type: colType }, 'DATE');
        else if (/^(current_time|localtime)$/i.test(rawDef)) defaultValue = this.formatDateForColumn({ type: colType }, 'TIME');
        else if (/^(current_timestamp|systimestamp)$/i.test(rawDef)) defaultValue = this.formatDateForColumn({ type: colType }, 'TIMESTAMP');
        else if (/^localtimestamp$/i.test(rawDef)) defaultValue = this.formatDateForColumn({ type: colType }, 'LOCALTIMESTAMP');
        else if (/^sessiontimezone$/i.test(rawDef)) defaultValue = this.getSessionTimeZone();
        else if (/^dbtimezone$/i.test(rawDef)) defaultValue = '+00:00';
        else if (/^user$/i.test(rawDef)) defaultValue = (this.db.currentUser || 'SYS').toUpperCase();
        else if (/^true$/i.test(rawDef)) defaultValue = 1;
        else if (/^false$/i.test(rawDef)) defaultValue = 0;
        else if (/^'([\s\S]*)'$/.test(rawDef)) defaultValue = defMatch[2].replace(/''/g, "'");
        else if (/^[+-]?\d+(\.\d+)?$/.test(rawDef)) defaultValue = Number(rawDef);
        else defaultValue = rawDef;
      }

      if (/\bNOT\s+NULL\b/i.test(rest)) nullable = false;

      table.columns.push({
        name: colName,
        type: colType,
        nullable: nullable,
        hasDefault: hasDefault,
        defaultValue: defaultValue
      });
      for (const row of table.rows) {
        row[colName] = (hasDefault && defaultValue !== undefined) ? defaultValue : null;
      }
      this.notifyChange();
      return { type: 'DDL', command: sql, message: 'Table altered.' };
    }

    const dropColMatch = sql.match(/^ALTER\s+TABLE\s+([a-zA-Z0-9_$#]+)\s+DROP\s+COLUMN\s+([a-zA-Z0-9_$#]+)/i);
    if (dropColMatch) {
      const tableName = dropColMatch[1].toUpperCase();
      const table = this.getTable(tableName);
      if (!table) throw new OracleError('ORA-00942', 'table or view does not exist');

      const colName = dropColMatch[2].toUpperCase();
      const idx = table.columns.findIndex(c => c.name === colName);
      if (idx === -1) {
        throw new OracleError('ORA-00904', `"${colName}": invalid identifier`);
      }

      table.columns.splice(idx, 1);
      for (const row of table.rows) {
        delete row[colName];
      }
      this.notifyChange();
      return { type: 'DDL', command: sql, message: 'Table altered.' };
    }

    return { type: 'DDL', command: sql, message: 'Table altered.' };
  }

  execDescribe(sql) {
    const match = sql.match(/^(?:DESC|DESCRIBE)\s+([a-zA-Z0-9_$#]+)/i);
    if (!match) throw new OracleError('ORA-00900', 'invalid DESCRIBE syntax');
    const name = match[1].toUpperCase();
    const table = this.getTable(name);
    if (!table) {
      const view = this.getView(name);
      if (!view) throw new OracleError('ORA-04043', `object ${name} does not exist`);
      const res = this.execSelect(view.query);
      return {
        type: 'DESCRIBE',
        command: sql,
        target: name,
        columns: ['Name', 'Null?', 'Type'],
        rows: res.columns.map(c => ({ 'Name': c, 'Null?': '', 'Type': 'VARCHAR2(255)' }))
      };
    }

    return {
      type: 'DESCRIBE',
      command: sql,
      target: name,
      columns: ['Name', 'Null?', 'Type'],
      rows: table.columns.map(c => ({
        'Name': c.name,
        'Null?': c.nullable ? '' : 'NOT NULL',
        'Type': c.type
      }))
    };
  }

  execShow(sql) {
    const clean = sql.replace(/;+$/, '').trim();
    if (/^SHOW\s+CON_NAME\b/i.test(clean)) {
      const con = this.db.currentContainer || 'FREEPDB1';
      return {
        type: 'DDL',
        command: sql,
        message: `CON_NAME\n------------------------------\n${con}`
      };
    }
    if (/^SHOW\s+USER\b/i.test(clean)) {
      const user = (this.db.currentUser || 'SYS').toUpperCase();
      return {
        type: 'DDL',
        command: sql,
        message: `USER is "${user}"`
      };
    }
    return {
      type: 'DDL',
      command: sql,
      message: `${clean} evaluated.`
    };
  }

  execConnect(sql) {
    const clean = sql.replace(/;+$/, '').trim();
    if (/^(?:CONN|CONNECT)\s+\/\s+AS\s+SYSDBA\b/i.test(clean)) {
      this.db.currentUser = 'SYS';
      this.notifyChange();
      return { type: 'DDL', command: sql, message: 'Connected to SYS.' };
    }

    const match = clean.match(/^(?:CONN|CONNECT)\s+([a-zA-Z0-9_$#"]+)(?:\/([^@\s]+))?(?:@([^\s]+))?(?:\s+AS\s+([a-zA-Z0-9_$#]+))?/i);
    if (!match) {
      throw new OracleError('ORA-00900', 'invalid CONNECT syntax');
    }

    let p1 = match[1].replace(/"/g, '').toUpperCase();
    let pPassword = match[2];
    let pService = match[3];

    this.ensureDatabases();

    // 1. Direct database connect e.g. "CONNECT sql_class" or "CONN Oracle26"
    if (!pPassword && !pService && this.db.databases[p1]) {
      return this.connectDatabase(p1);
    }

    // 2. Connect with service e.g. "CONNECT student/pass@sql_class"
    if (pService) {
      const parts = pService.split('/');
      const targetDbName = parts[parts.length - 1].toUpperCase();
      if (this.db.databases[targetDbName]) {
        return this.connectDatabase(targetDbName, p1, pPassword);
      }
      this.db.currentContainer = targetDbName;
    }

    const username = p1;
    const user = this.db.users?.[username];
    if (!user) {
      throw new OracleError('ORA-01017', 'invalid username/password; logon denied');
    }

    if (user.account_status === 'LOCKED') {
      throw new OracleError('ORA-28000', 'the account is locked');
    }

    this.db.currentUser = username;
    this.notifyChange();
    return {
      type: 'DDL',
      command: sql,
      message: `Connected to ${this.db.currentContainer || 'SQL_CLASS'} as ${username}.`
    };
  }

  execDisconnect(sql) {
    this.db.currentUser = 'NONE';
    this.notifyChange();
    return { type: 'DDL', command: sql, message: 'Disconnected from Oracle Database.' };
  }

  execGrant(sql) {
    const clean = sql.replace(/;+$/, '').trim();

    // 1. Object privileges: GRANT ... ON [schema.]object TO grantee [WITH GRANT OPTION]
    const objMatch = clean.match(/^GRANT\s+([\s\S]+?)\s+ON\s+([a-zA-Z0-9_$#.]+)\s+TO\s+([a-zA-Z0-9_$#,\s]+)(?:\s+WITH\s+GRANT\s+OPTION)?/i);
    if (objMatch) {
      const privsStr = objMatch[1].trim();
      const targetObj = objMatch[2].trim().toUpperCase();
      const grantees = objMatch[3].split(',').map(g => g.trim().toUpperCase());
      const isGrantable = /WITH\s+GRANT\s+OPTION/i.test(clean) ? 'YES' : 'NO';

      const privList = privsStr.split(',').map(p => p.trim().toUpperCase());

      if (!this.db.tabPrivileges) this.db.tabPrivileges = {};

      for (const grantee of grantees) {
        if (!this.db.tabPrivileges[grantee]) this.db.tabPrivileges[grantee] = [];
        for (const priv of privList) {
          const parts = targetObj.split('.');
          const owner = parts.length > 1 ? parts[0] : 'HR';
          const tableName = parts.length > 1 ? parts[1] : parts[0];
          this.db.tabPrivileges[grantee].push({
            owner,
            tableName,
            privilege: priv,
            grantable: isGrantable,
            grantor: this.db.currentUser || 'SYS'
          });
        }
      }

      this.notifyChange();
      return { type: 'DDL', command: sql, message: 'Grant succeeded.' };
    }

    // 2. System privileges & Roles: GRANT priv_or_role [, ...] TO grantee [, ...] [WITH ADMIN OPTION]
    const sysMatch = clean.match(/^GRANT\s+([\s\S]+?)\s+TO\s+([a-zA-Z0-9_$#,\s]+)(?:\s+WITH\s+ADMIN\s+OPTION)?/i);
    if (sysMatch) {
      const itemsStr = sysMatch[1].trim();
      const grantees = sysMatch[2].split(',').map(g => g.trim().toUpperCase());
      const hasAdmin = /WITH\s+ADMIN\s+OPTION/i.test(clean) ? 'YES' : 'NO';
      const items = itemsStr.split(',').map(s => s.trim().toUpperCase());

      if (!this.db.userPrivileges) this.db.userPrivileges = {};
      if (!this.db.userRoles) this.db.userRoles = {};

      const knownRoles = new Set(Object.keys(this.db.roles || {}));

      for (const grantee of grantees) {
        for (const item of items) {
          if (knownRoles.has(item)) {
            if (!this.db.userRoles[grantee]) this.db.userRoles[grantee] = [];
            if (!this.db.userRoles[grantee].some(r => r.role === item)) {
              this.db.userRoles[grantee].push({ role: item, admin_option: hasAdmin });
            }
          } else {
            if (!this.db.userPrivileges[grantee]) this.db.userPrivileges[grantee] = [];
            if (!this.db.userPrivileges[grantee].some(p => p.privilege === item)) {
              this.db.userPrivileges[grantee].push({ privilege: item, admin_option: hasAdmin });
            }
          }
        }
      }

      this.notifyChange();
      return { type: 'DDL', command: sql, message: 'Grant succeeded.' };
    }

    throw new OracleError('ORA-00900', 'invalid GRANT statement syntax');
  }

  execRevoke(sql) {
    const clean = sql.replace(/;+$/, '').trim();

    // 1. REVOKE priv ON object FROM grantee
    const objMatch = clean.match(/^REVOKE\s+([\s\S]+?)\s+ON\s+([a-zA-Z0-9_$#.]+)\s+FROM\s+([a-zA-Z0-9_$#,\s]+)/i);
    if (objMatch) {
      const privs = objMatch[1].split(',').map(p => p.trim().toUpperCase());
      const targetObj = objMatch[2].trim().toUpperCase();
      const grantees = objMatch[3].split(',').map(g => g.trim().toUpperCase());

      const parts = targetObj.split('.');
      const tableName = parts.length > 1 ? parts[1] : parts[0];

      if (this.db.tabPrivileges) {
        for (const grantee of grantees) {
          if (this.db.tabPrivileges[grantee]) {
            this.db.tabPrivileges[grantee] = this.db.tabPrivileges[grantee].filter(
              t => !(t.tableName === tableName && privs.includes(t.privilege))
            );
          }
        }
      }

      this.notifyChange();
      return { type: 'DDL', command: sql, message: 'Revoke succeeded.' };
    }

    // 2. REVOKE priv_or_role FROM grantee
    const sysMatch = clean.match(/^REVOKE\s+([\s\S]+?)\s+FROM\s+([a-zA-Z0-9_$#,\s]+)/i);
    if (sysMatch) {
      const items = sysMatch[1].split(',').map(i => i.trim().toUpperCase());
      const grantees = sysMatch[2].split(',').map(g => g.trim().toUpperCase());

      for (const grantee of grantees) {
        if (this.db.userRoles?.[grantee]) {
          this.db.userRoles[grantee] = this.db.userRoles[grantee].filter(r => !items.includes(r.role));
        }
        if (this.db.userPrivileges?.[grantee]) {
          this.db.userPrivileges[grantee] = this.db.userPrivileges[grantee].filter(p => !items.includes(p.privilege));
        }
      }

      this.notifyChange();
      return { type: 'DDL', command: sql, message: 'Revoke succeeded.' };
    }

    throw new OracleError('ORA-00900', 'invalid REVOKE statement syntax');
  }

  // DML: INSERT, UPDATE, DELETE
  execInsert(sql) {
    const match = sql.match(/^INSERT\s+INTO\s+([a-zA-Z0-9_$#]+)(?:\s*\(([^)]+)\))?\s*VALUES\s*\(([\s\S]+)\)$/i);
    if (!match) {
      throw new OracleError('ORA-00928', 'missing SELECT or VALUES keyword in INSERT');
    }

    const tableName = match[1].toUpperCase();
    const table = this.getTable(tableName);
    if (!table) {
      throw new OracleError('ORA-00942', 'table or view does not exist');
    }

    const rawCols = match[2] ? match[2].split(',').map(c => c.trim().toUpperCase()) : null;
    const rawVals = this.splitValuesList(match[3]);

    let targetCols = rawCols;
    if (!targetCols) {
      targetCols = table.columns.map(c => c.name);
    }

    if (targetCols.length !== rawVals.length) {
      if (targetCols.length < rawVals.length) {
        throw new OracleError('ORA-00913', 'too many values');
      } else {
        throw new OracleError('ORA-00947', 'not enough values');
      }
    }

    const newRow = {};
    for (const col of table.columns) {
      newRow[col.name] = (col.hasDefault && col.defaultValue !== undefined) ? col.defaultValue : null;
    }

    for (let i = 0; i < targetCols.length; i++) {
      const colName = targetCols[i];
      const colMeta = table.columns.find(c => c.name === colName);
      if (!colMeta) {
        throw new OracleError('ORA-00904', `"${colName}": invalid identifier`);
      }

      const parsedVal = this.parseLiteralValue(rawVals[i], colMeta);

      if (parsedVal === null && !colMeta.nullable) {
        throw new OracleError('ORA-01400', `cannot insert NULL into ("STUDENT"."${tableName}"."${colName}")`);
      }

      if (parsedVal !== null && colMeta.type.includes('NUMBER')) {
        if (typeof parsedVal !== 'number' && isNaN(Number(parsedVal))) {
          throw new OracleError('ORA-01722', 'invalid number');
        }
        newRow[colName] = Number(parsedVal);
      } else if (parsedVal !== null && colMeta.type.includes('BOOL')) {
        newRow[colName] = (parsedVal === true || parsedVal === 1 || String(parsedVal).toLowerCase() === 'true') ? 1 : 0;
      } else {
        newRow[colName] = parsedVal;
      }
    }

    // Validate NOT NULL constraints for all columns (including omitted ones without default)
    for (const col of table.columns) {
      if (newRow[col.name] === null && !col.nullable) {
        throw new OracleError('ORA-01400', `cannot insert NULL into ("STUDENT"."${tableName}"."${col.name}")`);
      }
    }

    // Check primary key constraint
    const pkCols = table.columns.filter(c => c.isPk);
    if (pkCols.length > 0) {
      const duplicate = table.rows.some(existing => {
        return pkCols.every(pk => existing[pk.name] === newRow[pk.name]);
      });
      if (duplicate) {
        throw new OracleError('ORA-00001', `unique constraint (${tableName}_PK) violated`);
      }
    }

    table.rows.push(newRow);
    this.notifyChange();

    return {
      type: 'DML',
      command: sql,
      message: '1 row created.',
      rowsAffected: 1
    };
  }

  execUpdate(sql) {
    const match = sql.match(/^UPDATE\s+([a-zA-Z0-9_$#]+)\s+SET\s+([\s\S]+?)(?:\s+WHERE\s+([\s\S]+))?$/i);
    if (!match) {
      throw new OracleError('ORA-00971', 'missing SET keyword');
    }

    const tableName = match[1].toUpperCase();
    const table = this.getTable(tableName);
    if (!table) throw new OracleError('ORA-00942', 'table or view does not exist');

    const setAssignmentsRaw = match[2];
    const whereClause = match[3] ? match[3].trim() : null;

    const assignments = this.splitCommaExpressions(setAssignmentsRaw).map(a => {
      const eqIdx = a.indexOf('=');
      if (eqIdx === -1) throw new OracleError('ORA-00927', 'missing equal sign');
      const col = a.substring(0, eqIdx).trim().toUpperCase();
      const expr = a.substring(eqIdx + 1).trim();
      return { col, expr };
    });

    let updatedCount = 0;
    for (const row of table.rows) {
      if (!whereClause || this.evaluateWhereCondition(row, whereClause)) {
        for (const assign of assignments) {
          const colMeta = table.columns.find(c => c.name === assign.col);
          if (!colMeta) {
            throw new OracleError('ORA-00904', `"${assign.col}": invalid identifier`);
          }
          let val;
          if (/^default$/i.test(assign.expr.trim())) {
            val = (colMeta.hasDefault && colMeta.defaultValue !== undefined) ? colMeta.defaultValue : null;
          } else {
            val = this.evaluateExpression(assign.expr, row);
          }
          if (val === null && !colMeta.nullable) {
            throw new OracleError('ORA-01407', `cannot update ("STUDENT"."${tableName}"."${assign.col}") to NULL`);
          }
          if (val !== null && colMeta.type.includes('BOOL')) {
            val = (val === true || val === 1 || String(val).toLowerCase() === 'true') ? 1 : 0;
          }
          row[assign.col] = val;
        }
        updatedCount++;
      }
    }

    this.notifyChange();
    return {
      type: 'DML',
      command: sql,
      message: `${updatedCount} row${updatedCount === 1 ? '' : 's'} updated.`,
      rowsAffected: updatedCount
    };
  }

  execDelete(sql) {
    const match = sql.match(/^DELETE\s+(?:FROM\s+)?([a-zA-Z0-9_$#]+)(?:\s+WHERE\s+([\s\S]+))?$/i);
    if (!match) {
      throw new OracleError('ORA-00900', 'invalid DELETE command');
    }

    const tableName = match[1].toUpperCase();
    const table = this.getTable(tableName);
    if (!table) throw new OracleError('ORA-00942', 'table or view does not exist');

    const whereClause = match[2] ? match[2].trim() : null;
    const initialCount = table.rows.length;

    if (!whereClause) {
      table.rows = [];
    } else {
      table.rows = table.rows.filter(row => !this.evaluateWhereCondition(row, whereClause));
    }

    const deletedCount = initialCount - table.rows.length;
    this.notifyChange();
    return {
      type: 'DML',
      command: sql,
      message: `${deletedCount} row${deletedCount === 1 ? '' : 's'} deleted.`,
      rowsAffected: deletedCount
    };
  }

  // DQL: SELECT, JOINS, GROUP BY, AGGREGATES, SET OPS
  execSelect(sql) {
    const startTime = performance.now();

    const setOpMatch = sql.match(/\s+(UNION\s+ALL|UNION|INTERSECT|MINUS)\s+/i);
    if (setOpMatch) {
      const op = setOpMatch[1].toUpperCase();
      const splitIdx = setOpMatch.index;
      const leftSql = sql.substring(0, splitIdx).trim();
      const rightSql = sql.substring(splitIdx + setOpMatch[0].length).trim();

      const leftRes = this.execSelect(leftSql);
      const rightRes = this.execSelect(rightSql);

      if (leftRes.columns.length !== rightRes.columns.length) {
        throw new OracleError('ORA-01789', 'query block has incorrect number of result columns');
      }

      let combinedRows = [];
      if (op === 'UNION ALL') {
        combinedRows = [...leftRes.rows, ...rightRes.rows];
      } else if (op === 'UNION') {
        const map = new Map();
        for (const r of [...leftRes.rows, ...rightRes.rows]) {
          const key = JSON.stringify(r);
          if (!map.has(key)) map.set(key, r);
        }
        combinedRows = Array.from(map.values());
      } else if (op === 'INTERSECT') {
        const rightKeys = new Set(rightRes.rows.map(r => JSON.stringify(r)));
        combinedRows = leftRes.rows.filter(r => rightKeys.has(JSON.stringify(r)));
      } else if (op === 'MINUS') {
        const rightKeys = new Set(rightRes.rows.map(r => JSON.stringify(r)));
        combinedRows = leftRes.rows.filter(r => !rightKeys.has(JSON.stringify(r)));
      }

      return {
        type: 'SELECT',
        command: sql,
        columns: leftRes.columns,
        rows: combinedRows,
        executionTimeMs: Math.round((performance.now() - startTime) * 100) / 100
      };
    }

    const selectRegex = /^\s*SELECT\s+(DISTINCT\s+|DESTINCT\s+)?([\s\S]+?)\s+FROM\s+([\s\S]+?)(?:\s+WHERE\s+([\s\S]+?))?(?:\s+GROUP\s+BY\s+([\s\S]+?))?(?:\s+HAVING\s+([\s\S]+?))?(?:\s+ORDER\s+BY\s+([\s\S]+?))?(?:\s+FETCH\s+FIRST\s+(\d+)\s+ROWS\s+ONLY)?$/i;
    const match = sql.match(selectRegex);

    if (!match) {
      const simpleNoFrom = sql.match(/^\s*SELECT\s+([\s\S]+)$/i);
      if (simpleNoFrom) {
        throw new OracleError('ORA-00923', 'FROM keyword not found where expected');
      }
      throw new OracleError('ORA-00936', 'missing expression');
    }

    const isDistinct = !!match[1];
    const colsPart = match[2].trim();
    const fromPart = match[3].trim();
    let wherePart = match[4] ? match[4].trim() : null;
    const groupByPart = match[5] ? match[5].trim() : null;
    const havingPart = match[6] ? match[6].trim() : null;
    const orderByPart = match[7] ? match[7].trim() : null;
    const fetchFirst = match[8] ? parseInt(match[8], 10) : null;

    if (fromPart.startsWith(',') || fromPart.endsWith(',')) {
      throw new OracleError('ORA-00903', 'invalid table name');
    }
    if (wherePart && (wherePart.startsWith(',') || wherePart.endsWith(','))) {
      throw new OracleError('ORA-00936', 'missing expression');
    }
    if (groupByPart && (groupByPart.startsWith(',') || groupByPart.endsWith(','))) {
      throw new OracleError('ORA-00936', 'missing expression');
    }
    if (orderByPart && (orderByPart.startsWith(',') || orderByPart.endsWith(','))) {
      throw new OracleError('ORA-00936', 'missing expression');
    }

    let rownumLimit = null;
    if (wherePart) {
      const rownumMatch = wherePart.match(/\bROWNUM\s*(?:<=|<|=)\s*(\d+)\b/i);
      if (rownumMatch) {
        rownumLimit = parseInt(rownumMatch[1], 10);
      }
    }

    let dataset = this.resolveFromClause(fromPart);

    if (wherePart) {
      dataset = dataset.filter(row => this.evaluateWhereCondition(row, wherePart));
    }

    const selectExpressions = this.parseSelectColumns(colsPart);
    const hasAggregates = selectExpressions.some(e => e.isAggregate);

    if (groupByPart || hasAggregates) {
      dataset = this.processGroupBy(dataset, selectExpressions, groupByPart, havingPart);

      if (isDistinct) {
        const seen = new Set();
        dataset = dataset.filter(row => {
          const key = JSON.stringify(row);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }

      if (orderByPart) {
        dataset = this.processOrderBy(dataset, orderByPart, selectExpressions);
      }
    } else {
      let workingItems = dataset.map(sourceRow => {
        const projectedRow = this.projectSingleRow(sourceRow, selectExpressions);
        return { sourceRow, projectedRow };
      });

      if (orderByPart) {
        workingItems = this.processOrderByWorkingItems(workingItems, orderByPart, selectExpressions, isDistinct);
      }

      dataset = workingItems.map(item => item.projectedRow);

      if (isDistinct) {
        const seen = new Set();
        dataset = dataset.filter(row => {
          const key = JSON.stringify(row);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
    }

    const limit = fetchFirst || rownumLimit;
    if (limit !== null && limit >= 0) {
      dataset = dataset.slice(0, limit);
    }

    let finalColumns = [];
    if (dataset.length > 0) {
      finalColumns = Object.keys(dataset[0]);
    } else {
      finalColumns = selectExpressions.map(e => e.alias);
    }

    const executionTime = Math.round((performance.now() - startTime) * 100) / 100;

    return {
      type: 'SELECT',
      command: sql,
      columns: finalColumns,
      rows: dataset,
      executionTimeMs: executionTime
    };
  }

  getTableColumnNames(tableName) {
    if (!tableName) return [];
    const table = this.getTable(tableName);
    if (table && table.columns) {
      return table.columns.map(c => c.name.toUpperCase());
    }
    const view = this.getView(tableName);
    if (view) {
      try {
        const viewRes = this.execSelect(view.query);
        return viewRes.columns.map(c => c.toUpperCase());
      } catch (e) {
        return [];
      }
    }
    return [];
  }

  resolveFromClause(fromClause) {
    const joinRegex = /\s+(NATURAL\s+(?:(?:INNER|LEFT(?:\s+OUTER)?|RIGHT(?:\s+OUTER)?|FULL(?:\s+OUTER)?)\s+)?JOIN|INNER\s+JOIN|LEFT\s+(?:OUTER\s+)?JOIN|RIGHT\s+(?:OUTER\s+)?JOIN|FULL\s+(?:OUTER\s+)?JOIN|CROSS\s+JOIN|JOIN)\s+/i;
    
    if (joinRegex.test(fromClause)) {
      return this.resolveExplicitJoins(fromClause);
    }

    const tableRefs = this.splitCommaExpressions(fromClause);
    let combined = null;

    for (const tRef of tableRefs) {
      const { tableName, alias } = this.parseTableRef(tRef);
      const rows = this.getTableRowsExpanded(tableName, alias);

      if (combined === null) {
        combined = rows;
      } else {
        const temp = [];
        for (const left of combined) {
          for (const right of rows) {
            temp.push(Object.assign({}, left, right));
          }
        }
        combined = temp;
      }
    }

    return combined || [];
  }

  resolveExplicitJoins(fromClause) {
    const parts = fromClause.split(/\s+(NATURAL\s+(?:(?:INNER|LEFT(?:\s+OUTER)?|RIGHT(?:\s+OUTER)?|FULL(?:\s+OUTER)?)\s+)?JOIN|INNER\s+JOIN|LEFT\s+(?:OUTER\s+)?JOIN|RIGHT\s+(?:OUTER\s+)?JOIN|FULL\s+(?:OUTER\s+)?JOIN|CROSS\s+JOIN|JOIN)\s+/i);
    
    const firstTable = this.parseTableRef(parts[0].trim());
    let result = this.getTableRowsExpanded(firstTable.tableName, firstTable.alias);

    for (let i = 1; i < parts.length; i += 2) {
      const joinType = parts[i].toUpperCase().replace(/\s+/g, ' ');
      const targetStr = parts[i + 1].trim();

      let tablePart = targetStr;
      let onCondition = null;
      let joinCols = null;

      const usingMatch = targetStr.match(/\bUSING\s*\(([\s\S]+?)\)/i);
      const onIdx = targetStr.search(/\bON\b/i);

      if (usingMatch) {
        tablePart = targetStr.substring(0, usingMatch.index).trim();
        joinCols = usingMatch[1].split(',').map(c => c.trim().toUpperCase());
      } else if (onIdx !== -1) {
        tablePart = targetStr.substring(0, onIdx).trim();
        onCondition = targetStr.substring(onIdx + 2).trim();
      }

      const targetTable = this.parseTableRef(tablePart);
      const targetRows = this.getTableRowsExpanded(targetTable.tableName, targetTable.alias);

      if (joinType.startsWith('NATURAL')) {
        const rightCols = this.getTableColumnNames(targetTable.tableName);
        const leftCols = result.length > 0
          ? Object.keys(result[0]).filter(k => !k.includes('.')).map(k => k.toUpperCase())
          : this.getTableColumnNames(firstTable.tableName);

        const commonCols = rightCols.filter(c => leftCols.includes(c));
        joinCols = commonCols;
      }

      result = this.performJoin(result, targetRows, joinType, onCondition, targetTable, joinCols);
    }

    return result;
  }

  performJoin(leftRows, rightRows, joinType, onCondition, rightMeta, joinCols = null) {
    const output = [];
    const rightMatched = new Set();

    for (const left of leftRows) {
      let hasMatch = false;
      for (let j = 0; j < rightRows.length; j++) {
        const right = rightRows[j];
        const merged = Object.assign({}, left, right);

        let matches = false;
        if (joinCols && joinCols.length > 0) {
          matches = true;
          for (const col of joinCols) {
            const leftVal = left[col];
            const rightVal = right[col];
            if (leftVal === null || leftVal === undefined || rightVal === null || rightVal === undefined || String(leftVal) !== String(rightVal)) {
              matches = false;
              break;
            }
          }
        } else if (onCondition) {
          matches = this.evaluateWhereCondition(merged, onCondition);
        } else {
          // Cross join or natural join with no common columns
          matches = true;
        }

        if (matches) {
          hasMatch = true;
          rightMatched.add(j);
          output.push(merged);
        }
      }

      if (!hasMatch && (joinType.includes('LEFT') || joinType.includes('FULL'))) {
        const nullRight = {};
        if (rightRows.length > 0) {
          for (const k of Object.keys(rightRows[0])) nullRight[k] = null;
        }
        output.push(Object.assign({}, nullRight, left));
      }
    }

    if (joinType.includes('RIGHT') || joinType.includes('FULL')) {
      for (let j = 0; j < rightRows.length; j++) {
        if (!rightMatched.has(j)) {
          const nullLeft = {};
          if (leftRows.length > 0) {
            for (const k of Object.keys(leftRows[0])) nullLeft[k] = null;
          }
          output.push(Object.assign({}, nullLeft, rightRows[j]));
        }
      }
    }

    return output;
  }

  getTableRowsExpanded(tableName, alias) {
    let rawRows = [];
    let colNames = [];

    const table = this.getTable(tableName);
    if (table) {
      rawRows = table.rows;
      colNames = table.columns.map(c => c.name);
    } else {
      const view = this.getView(tableName);
      if (view) {
        const viewRes = this.execSelect(view.query);
        rawRows = viewRes.rows;
        colNames = viewRes.columns;
      } else {
        throw new OracleError('ORA-00942', 'table or view does not exist');
      }
    }

    const pfx = alias || tableName;
    return rawRows.map(r => {
      const mapped = {};
      for (const [k, v] of Object.entries(r)) {
        mapped[k.toUpperCase()] = v;
        mapped[`${pfx.toUpperCase()}.${k.toUpperCase()}`] = v;
        mapped[`${tableName.toUpperCase()}.${k.toUpperCase()}`] = v;
      }
      return mapped;
    });
  }

  parseTableRef(str) {
    const parts = str.trim().split(/\s+(?:AS\s+)?/i);
    const tableName = parts[0].trim();
    const alias = parts.length > 1 ? parts[1].trim() : null;
    return { tableName, alias };
  }

  findTopLevelAs(expr) {
    let i = 0;
    while (i < expr.length) {
      if (expr[i] === "'") {
        i++;
        while (i < expr.length) {
          if (expr[i] === "'") {
            i++;
            if (i < expr.length && expr[i] === "'") i++;
            else break;
          } else {
            i++;
          }
        }
        continue;
      }
      if (expr[i] === '"') {
        i++;
        while (i < expr.length && expr[i] !== '"') i++;
        if (i < expr.length) i++;
        continue;
      }
      if (expr[i] === '(') {
        let depth = 1;
        i++;
        let inQuote = false;
        while (i < expr.length && depth > 0) {
          if (expr[i] === "'") inQuote = !inQuote;
          else if (!inQuote) {
            if (expr[i] === '(') depth++;
            else if (expr[i] === ')') depth--;
          }
          i++;
        }
        continue;
      }
      if ((i === 0 || /\s/.test(expr[i - 1])) && expr.slice(i, i + 2).toUpperCase() === 'AS' && (i + 2 === expr.length || /\s/.test(expr[i + 2]))) {
        return { index: i, length: 2 };
      }
      i++;
    }
    return null;
  }

  hasInvalidAdjacentTerms(expr) {
    if (!expr) return false;
    const tokens = [];
    let i = 0;
    const str = expr.trim();

    while (i < str.length) {
      if (/\s/.test(str[i])) {
        i++;
        continue;
      }

      // Single-quoted string literal '...'
      if (str[i] === "'") {
        i++;
        while (i < str.length) {
          if (str[i] === "'") {
            i++;
            if (i < str.length && str[i] === "'") i++;
            else break;
          } else {
            i++;
          }
        }
        tokens.push('TERM');
        continue;
      }

      // Double-quoted identifier "..."
      if (str[i] === '"') {
        i++;
        while (i < str.length && str[i] !== '"') i++;
        if (i < str.length) i++;
        tokens.push('TERM');
        continue;
      }

      // Parentheses ( ... )
      if (str[i] === '(') {
        let depth = 1;
        const start = i + 1;
        i++;
        let inQuote = false;
        while (i < str.length && depth > 0) {
          if (str[i] === "'") inQuote = !inQuote;
          else if (!inQuote) {
            if (str[i] === '(') depth++;
            else if (str[i] === ')') depth--;
          }
          i++;
        }
        const inner = str.slice(start, i - 1).trim();
        if (!/^SELECT\b/i.test(inner)) {
          const parts = this.splitCommaExpressions(inner);
          for (const p of parts) {
            if (this.hasInvalidAdjacentTerms(p.trim())) return true;
          }
        }
        tokens.push('TERM');
        continue;
      }

      // Concatenation operator ||
      if (str.startsWith('||', i)) {
        tokens.push('OP');
        i += 2;
        continue;
      }

      // Binary / comparison operators
      if (str.startsWith('!=', i) || str.startsWith('<>', i) || str.startsWith('<=', i) || str.startsWith('>=', i) || str.startsWith(':=', i)) {
        tokens.push('OP');
        i += 2;
        continue;
      }

      if (['+', '-', '*', '/', '=', '<', '>', '~', '^', '%', '&', '|'].includes(str[i])) {
        tokens.push('OP');
        i++;
        continue;
      }

      // Word: identifier, number, keyword, or function name
      const wordMatch = str.slice(i).match(/^[a-zA-Z0-9_$#.]+/);
      if (wordMatch) {
        const word = wordMatch[0];
        i += word.length;
        let j = i;
        while (j < str.length && /\s/.test(str[j])) j++;
        if (j < str.length && str[j] === '(') {
          let depth = 1;
          const funcStart = j + 1;
          j++;
          let inQuote = false;
          while (j < str.length && depth > 0) {
            if (str[j] === "'") inQuote = !inQuote;
            else if (!inQuote) {
              if (str[j] === '(') depth++;
              else if (str[j] === ')') depth--;
            }
            j++;
          }
          const funcArgs = str.slice(funcStart, j - 1).trim();
          if (funcArgs) {
            const parts = this.splitCommaExpressions(funcArgs);
            for (const p of parts) {
              if (this.hasInvalidAdjacentTerms(p.trim())) return true;
            }
          }
          i = j;
          tokens.push('TERM');
          continue;
        }

        if (/^(AND|OR|NOT|LIKE|IN|IS|BETWEEN|ESCAPE|CASE|WHEN|THEN|ELSE|END|DISTINCT|DESTINCT|ALL)$/i.test(word)) {
          tokens.push('OP');
        } else {
          tokens.push('TERM');
        }
        continue;
      }

      i++;
    }

    for (let k = 0; k < tokens.length - 1; k++) {
      if (tokens[k] === 'TERM' && tokens[k + 1] === 'TERM') {
        return true;
      }
    }
    return false;
  }

  parseSelectColumns(colsStr) {
    if (colsStr.trim() === '*') {
      return [{ expr: '*', alias: '*', isWildcard: true, isAggregate: false }];
    }

    const trimmedCols = colsStr.trim();
    if (trimmedCols.startsWith(',') || trimmedCols.endsWith(',')) {
      throw new OracleError('ORA-00936', 'missing expression');
    }

    const items = this.splitCommaExpressions(colsStr);
    const parsed = [];

    for (const item of items) {
      if (!item.trim()) {
        throw new OracleError('ORA-00936', 'missing expression');
      }
      let expr = item.trim();
      let alias = null;

      // In Oracle, single quotes are string literals and CANNOT be used as column aliases.
      // E.g.: SELECT 1+1 AS 'Result' FROM dual OR SELECT (1+1 AS 'Result') FROM dual
      // Oracle throws ORA-00923: FROM keyword not found where expected
      if (/\bAS\s+'[^']*'/i.test(expr)) {
        throw new OracleError('ORA-00923', 'FROM keyword not found where expected');
      }

      // Check if alias is provided in single quotes without AS: e.g. SELECT 1+1 'Result' FROM dual
      const trailingSingleQuoteAlias = expr.match(/^([\s\S]+?)\s+('[^']*')$/);
      if (trailingSingleQuoteAlias) {
        const preceding = trailingSingleQuoteAlias[1].trim();
        const isOperatorEnding = /(?:[-+*/=<>!~|,]|\|\||\b(?:LIKE|IN|IS|AND|OR|NOT|THEN|ELSE|WHEN|CASE|BETWEEN))\s*$/i.test(preceding);
        if (!isOperatorEnding) {
          throw new OracleError('ORA-00923', 'FROM keyword not found where expected');
        }
      }

      // Check for invalid syntax: AS inside parentheses for non-subquery / non-CAST expressions
      // e.g. SELECT (1+1 AS Result) FROM dual; -> ORA-00907: missing right parenthesis
      const invalidParenAs = expr.match(/^\s*\(\s*(?!SELECT\b|CAST\b)[\s\S]+?\bAS\b[\s\S]+?\)\s*$/i);
      if (invalidParenAs) {
        throw new OracleError('ORA-00907', 'missing right parenthesis');
      }

      // 1. Explicit AS alias: expr AS "alias" or expr AS alias
      const topLevelAs = this.findTopLevelAs(expr);
      if (topLevelAs) {
        const left = expr.slice(0, topLevelAs.index).trim();
        const right = expr.slice(topLevelAs.index + topLevelAs.length).trim();
        if (!left) {
          throw new OracleError('ORA-00936', 'missing expression');
        }
        if (!right || right.startsWith("'")) {
          throw new OracleError('ORA-00923', 'FROM keyword not found where expected');
        }
        if (right.startsWith('"') && right.endsWith('"') && right.length >= 2) {
          alias = right.slice(1, -1); // Case-sensitive: retain exact casing for double quotes!
        } else if (/^[a-zA-Z][a-zA-Z0-9_$#]*$/.test(right)) {
          if (ORACLE_RESERVED_WORDS.has(right.toUpperCase())) {
            throw new OracleError('ORA-00923', 'FROM keyword not found where expected');
          }
          alias = right.toUpperCase();
        } else {
          // If right is a number, function call, multiple words, etc.
          throw new OracleError('ORA-00923', 'FROM keyword not found where expected');
        }
        expr = left;
      } else {
        // 2. Implicit alias without AS: expr "alias" or expr alias
        // An unquoted alias MUST start with a letter: [a-zA-Z][a-zA-Z0-9_$#]*
        // A quoted alias starts and ends with "..."
        const spaceMatch = expr.match(/^([\s\S]+?)\s+([a-zA-Z][a-zA-Z0-9_$#]*|"[\s\S]+?")$/i);
        const isAggOrFunc = /^[A-Z_]+\s*\(.*?\)$/i.test(expr);
        if (spaceMatch && !isAggOrFunc) {
          const preceding = spaceMatch[1].trim();
          const rawAlias = spaceMatch[2].trim();
          const isOperatorEnding = /(?:[-+*/=<>!~|,]|\|\||\b(?:LIKE|IN|IS|AND|OR|NOT|THEN|ELSE|WHEN|CASE|BETWEEN))\s*$/i.test(preceding);

          if (!isOperatorEnding) {
            if (rawAlias.startsWith('"') && rawAlias.endsWith('"')) {
              expr = preceding;
              alias = rawAlias.slice(1, -1); // Case-sensitive: retain exact casing!
            } else if (ORACLE_RESERVED_WORDS.has(rawAlias.toUpperCase())) {
              // In Oracle, using a reserved keyword as an unquoted alias without AS (e.g. SELECT 1 values FROM dual)
              // causes Oracle to expect the FROM keyword and throw ORA-00923
              throw new OracleError('ORA-00923', 'FROM keyword not found where expected');
            } else {
              expr = preceding;
              alias = rawAlias.toUpperCase();
            }
          }
        }

        if (!alias) {
          const dotParts = expr.split('.');
          if (dotParts.length === 2 && /^[a-zA-Z0-9_$#]+$/.test(dotParts[1].trim())) {
            alias = dotParts[1].trim().toUpperCase();
          } else {
            alias = expr.toUpperCase().replace(/\s+/g, ' ');
          }
        }
      }

      // 3. Check for invalid adjacent terms in expr (e.g. SELECT 11 ABS(-10) FROM dual, SELECT 11 22 FROM dual)
      if (this.hasInvalidAdjacentTerms(expr)) {
        throw new OracleError('ORA-00923', 'FROM keyword not found where expected');
      }

      const isAgg = /\b(COUNT|SUM|AVG|MIN|MAX)\s*\(/i.test(expr);
      parsed.push({
        expr,
        alias: alias || expr.toUpperCase(),
        isWildcard: expr === '*' || expr.endsWith('.*'),
        isAggregate: isAgg
      });
    }

    return parsed;
  }

  projectSingleRow(row, selectExpressions) {
    if (selectExpressions.length === 1 && selectExpressions[0].isWildcard && selectExpressions[0].expr === '*') {
      const clean = {};
      for (const [k, v] of Object.entries(row)) {
        if (!k.includes('.')) {
          clean[k] = v;
        }
      }
      return clean;
    }

    const projected = {};
    for (const item of selectExpressions) {
      if (item.isWildcard) {
        const pfx = item.expr.slice(0, -2).toUpperCase();
        for (const [k, v] of Object.entries(row)) {
          if (k.startsWith(pfx + '.')) {
            const cleanKey = k.substring(pfx.length + 1);
            projected[cleanKey] = v;
          }
        }
      } else {
        projected[item.alias] = this.evaluateExpression(item.expr, row);
      }
    }
    return projected;
  }

  projectColumns(dataset, selectExpressions) {
    return dataset.map(row => this.projectSingleRow(row, selectExpressions));
  }

  processGroupBy(dataset, selectExpressions, groupByPart, havingPart) {
    const groupCols = groupByPart
      ? this.splitCommaExpressions(groupByPart).map(c => c.trim().toUpperCase())
      : [];

    const groups = new Map();

    for (const row of dataset) {
      const keyObj = {};
      for (const c of groupCols) {
        keyObj[c] = this.evaluateExpression(c, row);
      }
      const key = JSON.stringify(keyObj);
      if (!groups.has(key)) {
        groups.set(key, { keyObj, rows: [] });
      }
      groups.get(key).rows.push(row);
    }

    if (!groupByPart && groups.size === 0) {
      groups.set('{}', { keyObj: {}, rows: [] });
    }

    const result = [];

    for (const group of groups.values()) {
      const row = {};
      const sampleRow = group.rows[0] || {};

      for (const item of selectExpressions) {
        if (item.isAggregate) {
          row[item.alias] = this.evaluateAggregateExpression(item.expr, group.rows);
        } else {
          const exprUpper = item.expr.toUpperCase();
          if (groupCols.length > 0 && !groupCols.includes(exprUpper) && !groupCols.some(g => g.endsWith('.' + exprUpper) || exprUpper.endsWith('.' + g))) {
            throw new OracleError('ORA-00979', 'not a GROUP BY expression');
          }
          row[item.alias] = this.evaluateExpression(item.expr, sampleRow);
        }
      }

      if (havingPart) {
        const passesHaving = this.evaluateHavingCondition(group.rows, row, havingPart);
        if (!passesHaving) continue;
      }

      result.push(row);
    }

    return result;
  }

  evaluateAggregateExpression(expr, groupRows) {
    const trimmed = expr.trim();
    // Fast path: if the ENTIRE trimmed string is a single aggregate function FUNC(...)
    const singleAggMatch = trimmed.match(/^\s*(COUNT|SUM|AVG|MIN|MAX)\s*\(/i);
    if (singleAggMatch) {
      const openParenIdx = trimmed.indexOf('(');
      let depth = 1;
      let closeParenIdx = -1;
      for (let i = openParenIdx + 1; i < trimmed.length; i++) {
        if (trimmed[i] === '(') depth++;
        else if (trimmed[i] === ')') {
          depth--;
          if (depth === 0) {
            closeParenIdx = i;
            break;
          }
        }
      }
      if (closeParenIdx === trimmed.length - 1) {
        return this.evaluateAggregate(trimmed, groupRows);
      }
    }

    let evalStr = trimmed;
    let iterations = 0;
    while (/\b(COUNT|SUM|AVG|MIN|MAX)\s*\(\s*(DISTINCT\s+|DESTINCT\s+)?([^()]*|\*)\s*\)/i.test(evalStr) && iterations < 10) {
      iterations++;
      evalStr = evalStr.replace(/\b(COUNT|SUM|AVG|MIN|MAX)\s*\(\s*(DISTINCT\s+|DESTINCT\s+)?([^()]*|\*)\s*\)/gi, (match) => {
        const val = this.evaluateAggregate(match, groupRows);
        if (val === null || val === undefined) return 'NULL';
        if (typeof val === 'number') return String(val);
        if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
        return String(val);
      });
    }

    const sampleRow = groupRows[0] || {};
    return this.evaluateExpression(evalStr, sampleRow);
  }

  cleanNumber(num) {
    if (typeof num !== 'number' || !isFinite(num)) return num;
    if (Number.isInteger(num)) return num;
    // Normalize IEEE-754 precision noise (e.g. -27.599999999999994 -> -27.6, 22.08000000000004 -> 22.08)
    return parseFloat(num.toFixed(12));
  }

  evaluateAggregate(expr, rows) {
    const match = expr.match(/^\s*(COUNT|SUM|AVG|MIN|MAX)\s*\(\s*(DISTINCT\s+|DESTINCT\s+)?([\s\S]+?)\s*\)\s*$/i);
    if (!match) return null;

    const func = match[1].toUpperCase();
    const isDistinct = !!match[2];
    const innerExpr = match[3].trim();

    if (func === 'COUNT' && innerExpr === '*') {
      return rows.length;
    }

    let values = rows.map(r => this.evaluateExpression(innerExpr, r)).filter(v => v !== null && v !== undefined);

    if (isDistinct) {
      values = Array.from(new Set(values));
    }

    if (func === 'COUNT') return values.length;
    if (values.length === 0) return null;

    if (func === 'SUM') {
      const sum = values.reduce((s, v) => s + Number(v), 0);
      return this.cleanNumber(sum);
    }
    if (func === 'AVG') {
      const sum = values.reduce((s, v) => s + Number(v), 0);
      return this.cleanNumber(Math.round((sum / values.length) * 100) / 100);
    }
    if (func === 'MIN') {
      const isNum = values.every(v => typeof v === 'number' || (!isNaN(Number(v)) && typeof v !== 'boolean'));
      if (isNum) {
        return values.reduce((min, v) => Number(v) < Number(min) ? v : min, values[0]);
      }
      return values.reduce((min, v) => v < min ? v : min, values[0]);
    }
    if (func === 'MAX') {
      const isNum = values.every(v => typeof v === 'number' || (!isNaN(Number(v)) && typeof v !== 'boolean'));
      if (isNum) {
        return values.reduce((max, v) => Number(v) > Number(max) ? v : max, values[0]);
      }
      return values.reduce((max, v) => v > max ? v : max, values[0]);
    }

    return null;
  }

  evaluateHavingCondition(groupRows, projectedRow, condition) {
    let cond = condition;
    const aggMatches = condition.match(/\b(COUNT|SUM|AVG|MIN|MAX)\s*\([^)]+\)/gi) || [];
    for (const agg of aggMatches) {
      const val = this.evaluateAggregate(agg, groupRows);
      cond = cond.replace(agg, val !== null ? val : 'NULL');
    }
    return this.evaluateWhereCondition(projectedRow, cond);
  }

  evaluateExpression(expr, row) {
    const trimmed = expr.trim();

    // Strip redundant outer matching parentheses around expressions
    if (trimmed.startsWith('(') && trimmed.endsWith(')') && !/^(COUNT|SUM|AVG|MIN|MAX|NVL|DECODE|UPPER|LOWER|INITCAP|INTICAP|LENGTH|TRIM|SUBSTR|CONCAT|ROUND|TRUNC|MOD|ABS|SIGN|CEIL|FLOOR|SQRT|POWER|SYS_CONTEXT)\s*\(/i.test(trimmed) && !/^\(\s*SELECT\b/i.test(trimmed)) {
      let depth = 0;
      let matchedOuter = true;
      for (let i = 0; i < trimmed.length - 1; i++) {
        if (trimmed[i] === '(') depth++;
        else if (trimmed[i] === ')') {
          depth--;
          if (depth === 0) {
            matchedOuter = false;
            break;
          }
        }
      }
      if (matchedOuter) {
        return this.evaluateExpression(trimmed.slice(1, -1).trim(), row);
      }
    }

    // Unary plus/minus preceding an expression: e.g. -marks, -ABS(fee), +ROUND(fee, 2), -NULL, +NULL
    const unaryMatch = trimmed.match(/^([+-])\s*([a-zA-Z_][a-zA-Z0-9_$#.]*|[a-zA-Z_]\w*\s*\([\s\S]*\)|NULL)$/i);
    if (unaryMatch) {
      const sign = unaryMatch[1] === '-' ? -1 : 1;
      const val = this.evaluateExpression(unaryMatch[2], row);
      if (val === null || val === undefined) return null;
      const num = Number(val);
      if (isNaN(num)) throw new OracleError('ORA-01722', 'invalid number');
      return this.cleanNumber(sign * num);
    }

    const nvlMatch = trimmed.match(/^NVL\s*\(\s*([\s\S]+?)\s*,\s*([\s\S]+?)\s*\)$/i);
    if (nvlMatch) {
      const val = this.evaluateExpression(nvlMatch[1], row);
      return (val === null || val === undefined) ? this.evaluateExpression(nvlMatch[2], row) : val;
    }

    const decodeMatch = trimmed.match(/^DECODE\s*\(([\s\S]+)\)$/i);
    if (decodeMatch) {
      const args = this.splitCommaExpressions(decodeMatch[1]);
      if (args.length < 3) throw new OracleError('ORA-00938', 'not enough arguments for function DECODE');
      const target = this.evaluateExpression(args[0], row);
      for (let i = 1; i < args.length - 1; i += 2) {
        const comp = this.evaluateExpression(args[i], row);
        if (target === comp) {
          return this.evaluateExpression(args[i + 1], row);
        }
      }
      if (args.length % 2 === 0) {
        return this.evaluateExpression(args[args.length - 1], row);
      }
      return null;
    }

    const stringFuncMatch = trimmed.match(/^(UPPER|LOWER|INITCAP|INTICAP|LENGTH|TRIM)\s*\(([\s\S]+)\)$/i);
    if (stringFuncMatch) {
      const fn = stringFuncMatch[1].toUpperCase();
      const argVal = this.evaluateExpression(stringFuncMatch[2], row);
      if (argVal === null || argVal === undefined) return null;
      const str = String(argVal);
      if (fn === 'UPPER') return str.toUpperCase();
      if (fn === 'LOWER') return str.toLowerCase();
      if (fn === 'LENGTH') return str.length;
      if (fn === 'TRIM') return str.trim();
      if (fn === 'INITCAP' || fn === 'INTICAP') {
        return str.replace(/\b\w+/g, s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase());
      }
    }

    const substrMatch = trimmed.match(/^SUBSTR\s*\(([\s\S]+)\)$/i);
    if (substrMatch) {
      const args = this.splitCommaExpressions(substrMatch[1]);
      const strVal = String(this.evaluateExpression(args[0], row) || '');
      const pos = parseInt(this.evaluateExpression(args[1], row), 10);
      const start = pos > 0 ? pos - 1 : (pos < 0 ? strVal.length + pos : 0);
      if (args.length > 2) {
        const len = parseInt(this.evaluateExpression(args[2], row), 10);
        return strVal.substr(start, len);
      }
      return strVal.substr(start);
    }

    const concatFuncMatch = trimmed.match(/^CONCAT\s*\(([\s\S]+)\)$/i);
    if (concatFuncMatch) {
      const args = this.splitCommaExpressions(concatFuncMatch[1]);
      if (args.length < 2) throw new OracleError('ORA-00938', 'not enough arguments for function CONCAT');
      if (args.length > 2) throw new OracleError('ORA-00939', 'too many arguments for function CONCAT');
      const val1 = this.evaluateExpression(args[0], row);
      const val2 = this.evaluateExpression(args[1], row);
      if (val1 === null && val2 === null) return null;
      const str1 = (val1 === null || val1 === undefined) ? '' : String(val1);
      const str2 = (val2 === null || val2 === undefined) ? '' : String(val2);
      return str1 + str2;
    }

    const mathFuncMatch = trimmed.match(/^(ROUND|TRUNC|MOD|ABS|SIGN|CEIL|FLOOR|SQRT|POWER)\s*\(([\s\S]+)\)$/i);
    if (mathFuncMatch) {
      const fn = mathFuncMatch[1].toUpperCase();
      const args = this.splitCommaExpressions(mathFuncMatch[2]);
      const rawArg0 = this.evaluateExpression(args[0], row);
      if (rawArg0 === null || rawArg0 === undefined) return null;
      const num1 = Number(rawArg0);
      if (isNaN(num1)) {
        if (fn === 'TRUNC') {
          const d = this.parseOracleDate(rawArg0);
          return d ? this.formatCurrentDate(d) : null;
        }
        return null;
      }

      if (fn === 'ABS') return this.cleanNumber(Math.abs(num1));
      if (fn === 'SIGN') return num1 > 0 ? 1 : (num1 < 0 ? -1 : 0);
      if (fn === 'CEIL') return Math.ceil(num1);
      if (fn === 'FLOOR') return Math.floor(num1);
      if (fn === 'SQRT') {
        if (num1 < 0) throw new OracleError('ORA-01428', 'argument out of range');
        return this.cleanNumber(Math.sqrt(num1));
      }
      if (fn === 'POWER') {
        const rawArg1 = this.evaluateExpression(args[1], row);
        if (rawArg1 === null || rawArg1 === undefined) return null;
        const num2 = Number(rawArg1);
        return this.cleanNumber(Math.pow(num1, num2));
      }
      if (fn === 'MOD') {
        const rawArg1 = this.evaluateExpression(args[1], row);
        if (rawArg1 === null || rawArg1 === undefined) return null;
        const num2 = Number(rawArg1);
        if (isNaN(num2)) return null;
        // In Oracle SQL, MOD(m, 0) returns m
        return num2 === 0 ? this.cleanNumber(num1) : this.cleanNumber(num1 % num2);
      }
      const decimals = args.length > 1 ? parseInt(this.evaluateExpression(args[1], row), 10) : 0;
      const factor = Math.pow(10, decimals);
      if (fn === 'ROUND') return this.cleanNumber(Math.round(num1 * factor) / factor);
      if (fn === 'TRUNC') return this.cleanNumber(Math.trunc(num1 * factor) / factor);
    }

    const addMonthsMatch = trimmed.match(/^ADD_MONTHS\s*\(([\s\S]+)\)$/i);
    if (addMonthsMatch) {
      const args = this.splitCommaExpressions(addMonthsMatch[1]);
      const dtVal = this.evaluateExpression(args[0], row);
      const numMonths = parseInt(this.evaluateExpression(args[1], row), 10) || 0;
      const d = this.parseOracleDate(dtVal) || new Date();
      d.setMonth(d.getMonth() + numMonths);
      return this.formatCurrentDate(d);
    }

    const lastDayMatch = trimmed.match(/^LAST_DAY\s*\(([\s\S]+)\)$/i);
    if (lastDayMatch) {
      const dtVal = this.evaluateExpression(lastDayMatch[1], row);
      const d = this.parseOracleDate(dtVal) || new Date();
      const lastD = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return this.formatCurrentDate(lastD);
    }

    const monthsBetweenMatch = trimmed.match(/^MONTHS_BETWEEN\s*\(([\s\S]+)\)$/i);
    if (monthsBetweenMatch) {
      const args = this.splitCommaExpressions(monthsBetweenMatch[1]);
      const d1 = this.parseOracleDate(this.evaluateExpression(args[0], row)) || new Date();
      const d2 = this.parseOracleDate(this.evaluateExpression(args[1], row)) || new Date();
      const diffMonths = (d1.getFullYear() - d2.getFullYear()) * 12 + (d1.getMonth() - d2.getMonth()) + (d1.getDate() - d2.getDate()) / 31;
      return this.cleanNumber(Math.round(diffMonths * 100) / 100);
    }

    const toCharMatch = trimmed.match(/^TO_CHAR\s*\(([\s\S]+)\)$/i);
    if (toCharMatch) {
      const args = this.splitCommaExpressions(toCharMatch[1]);
      const val = this.evaluateExpression(args[0], row);
      if (val === null || val === undefined) return null;
      if (args.length === 1) return String(val);
      const fmt = String(this.evaluateExpression(args[1], row) || '').toUpperCase();
      return this.formatDateWithOraclePattern(val, fmt);
    }

    const toDateMatch = trimmed.match(/^TO_DATE\s*\(([\s\S]+)\)$/i);
    if (toDateMatch) {
      const args = this.splitCommaExpressions(toDateMatch[1]);
      const str = String(this.evaluateExpression(args[0], row) || '');
      const d = this.parseOracleDate(str) || new Date();
      return this.formatCurrentDate(d);
    }

    const extractMatch = trimmed.match(/^EXTRACT\s*\(\s*(YEAR|MONTH|DAY|HOUR|MINUTE|SECOND)\s+FROM\s+([\s\S]+?)\s*\)$/i);
    if (extractMatch) {
      const part = extractMatch[1].toUpperCase();
      const val = this.evaluateExpression(extractMatch[2], row);
      const d = this.parseOracleDate(val) || new Date();
      if (part === 'YEAR') return d.getFullYear();
      if (part === 'MONTH') return d.getMonth() + 1;
      if (part === 'DAY') return d.getDate();
      if (part === 'HOUR') return d.getHours();
      if (part === 'MINUTE') return d.getMinutes();
      if (part === 'SECOND') return d.getSeconds();
    }

    // Date arithmetic: SYSDATE + n, CURRENT_DATE + n, SYSDATE - n, CURRENT_DATE - n
    const dateArithMatch = trimmed.match(/^(SYSDATE|CURRENT_DATE)\s*([+-])\s*(\d+(?:\.\d+)?)$/i);
    if (dateArithMatch) {
      const op = dateArithMatch[2];
      const days = parseFloat(dateArithMatch[3]);
      const now = new Date();
      const msChange = (op === '+' ? days : -days) * 24 * 60 * 60 * 1000;
      return this.formatCurrentDate(new Date(now.getTime() + msChange));
    }
    const dateArithRevMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*\+\s*(SYSDATE|CURRENT_DATE)$/i);
    if (dateArithRevMatch) {
      const days = parseFloat(dateArithRevMatch[1]);
      return this.formatCurrentDate(new Date(Date.now() + days * 24 * 60 * 60 * 1000));
    }

    if (/^SYSDATE$/i.test(trimmed)) {
      return this.formatSysdate();
    }

    if (/^CURRENT_DATE$/i.test(trimmed)) {
      return this.formatCurrentDate();
    }

    if (/^(CURRENT_TIME|LOCALTIME)$/i.test(trimmed)) {
      return this.formatCurrentTime();
    }

    if (/^(CURRENT_TIMESTAMP|SYSTIMESTAMP)$/i.test(trimmed)) {
      return this.formatCurrentTimestamp(true);
    }

    if (/^LOCALTIMESTAMP$/i.test(trimmed)) {
      return this.formatCurrentTimestamp(false);
    }

    if (/^SESSIONTIMEZONE$/i.test(trimmed)) {
      return this.getSessionTimeZone();
    }

    if (/^DBTIMEZONE$/i.test(trimmed)) {
      return '+00:00';
    }

    if (/^USER$/i.test(trimmed)) {
      return (this.db.currentUser || 'SYS').toUpperCase();
    }

    if (/^SYS_CONTEXT\s*\(\s*['"]USERENV['"]\s*,\s*['"]CURRENT_USER['"]\s*\)$/i.test(trimmed)) {
      return (this.db.currentUser || 'SYS').toUpperCase();
    }

    if (trimmed.includes('||')) {
      const concatParts = trimmed.split('||');
      return concatParts.map(p => {
        const v = this.evaluateExpression(p.trim(), row);
        return v === null ? '' : String(v);
      }).join('');
    }

    if (/^null$/i.test(trimmed)) return null;
    if (/^true$/i.test(trimmed)) return 1;
    if (/^false$/i.test(trimmed)) return 0;
    if (/^'([^']*(?:''[^']*)*)'$/.test(trimmed)) {
      return trimmed.slice(1, -1).replace(/''/g, "'");
    }
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return this.cleanNumber(Number(trimmed));
    }

    if (/[-+*/]/.test(trimmed)) {
      try {
        let evalStr = trimmed;

        // In Oracle SQL, strings in arithmetic expressions are implicitly converted to numbers (e.g. '1' + '1' -> 2).
        // If a string literal cannot be converted to a number, Oracle throws ORA-01722: invalid number.
        if (/'[^']*'/.test(evalStr)) {
          let hasInvalidNumber = false;
          evalStr = evalStr.replace(/'([^']*)'/g, (_, strVal) => {
            const unquoted = strVal.replace(/''/g, "'").trim();
            if (unquoted === '' || isNaN(Number(unquoted))) {
              hasInvalidNumber = true;
              return 'NaN';
            }
            return String(Number(unquoted));
          });
          if (hasInvalidNumber) {
            throw new OracleError('ORA-01722', 'invalid number');
          }
        }

        // Resolve nested/embedded SQL function calls within arithmetic: e.g. -ABS(fee), 100 - ABS(fee)
        while (/\b(ABS|ROUND|TRUNC|MOD|SIGN|CEIL|FLOOR|POWER|SQRT|NVL|DECODE|UPPER|LOWER|INITCAP|INTICAP|LENGTH|TRIM|SUBSTR|CONCAT)\s*\([^()]*\)/i.test(evalStr)) {
          evalStr = evalStr.replace(/\b(ABS|ROUND|TRUNC|MOD|SIGN|CEIL|FLOOR|POWER|SQRT|NVL|DECODE|UPPER|LOWER|INITCAP|INTICAP|LENGTH|TRIM|SUBSTR|CONCAT)\s*\(([^()]*)\)/gi, (funcCall) => {
            const val = this.evaluateExpression(funcCall, row);
            if (val === null || val === undefined) return 'NULL';
            const num = Number(val);
            if (isNaN(num)) return 'NaN';
            return num < 0 ? `(${num})` : String(num);
          });
        }

        let hasInvalidIdentifier = null;
        let hasInvalidNumber = false;

        evalStr = evalStr.replace(/\b([a-zA-Z_][a-zA-Z0-9_.]*)\b/g, (match) => {
          const up = match.toUpperCase();
          if (up === 'NULL') return 'NULL';
          if (/^(CASE|WHEN|THEN|ELSE|END|AND|OR|NOT)$/i.test(up)) return match;

          let colVal = undefined;
          if (row) {
            if (row[up] !== undefined) {
              colVal = row[up];
            } else {
              const suffix = '.' + up;
              for (const [k, v] of Object.entries(row)) {
                if (k.endsWith(suffix)) {
                  colVal = v;
                  break;
                }
              }
            }
          }

          if (colVal !== undefined) {
            if (colVal === null) return 'NULL';
            const num = Number(colVal);
            if (isNaN(num)) {
              hasInvalidNumber = true;
              return 'NaN';
            }
            return num < 0 ? `(${num})` : String(num);
          }

          // If not in row and we have a valid row, check if it's a group function or an unrecognized column identifier
          if (/^(COUNT|SUM|AVG|MIN|MAX)$/i.test(up)) {
            throw new OracleError('ORA-00934', 'group function is not allowed here');
          }
          if (row && Object.keys(row).length > 0) {
            hasInvalidIdentifier = up;
          }
          return match;
        });

        if (hasInvalidIdentifier) {
          throw new OracleError('ORA-00904', `"${hasInvalidIdentifier}": invalid identifier`);
        }
        if (hasInvalidNumber) {
          throw new OracleError('ORA-01722', 'invalid number');
        }

        // In SQL, any arithmetic operation with NULL results in NULL
        if (/\bNULL\b/i.test(evalStr)) {
          return null;
        }

        // Normalize adjacent signs (e.g. -- -> +, +- -> -, -+ -> -) to prevent JS syntax error on prefix operators
        evalStr = evalStr.replace(/--/g, ' + ').replace(/\+\+/g, ' + ').replace(/\+-/g, ' - ').replace(/-\+/g, ' - ');

        if (/^[\d\s+\-*/().]+$/.test(evalStr)) {
          const res = Function(`'use strict'; return (${evalStr});`)();
          return typeof res === 'number' ? this.cleanNumber(res) : res;
        }
      } catch (e) {
        if (e instanceof OracleError) throw e;
      }
    }

    const colUpper = trimmed.toUpperCase();
    if (row && row[colUpper] !== undefined) {
      return row[colUpper];
    }

    if (row) {
      const suffix = '.' + colUpper;
      for (const [k, v] of Object.entries(row)) {
        if (k.endsWith(suffix)) {
          return v;
        }
      }
    }

    const funcCallMatch = trimmed.match(/^([a-zA-Z_]\w*)\s*\(/);
    if (funcCallMatch && !trimmed.startsWith("'") && !trimmed.startsWith('"')) {
      const fnName = funcCallMatch[1].toUpperCase();
      if (/^(COUNT|SUM|AVG|MIN|MAX)$/.test(fnName)) {
        throw new OracleError('ORA-00934', 'group function is not allowed here');
      }
      throw new OracleError('ORA-00904', `"${fnName}": invalid identifier`);
    }

    if (/^[a-zA-Z0-9_$#.]+$/.test(trimmed) && row && Object.keys(row).length > 0) {
      throw new OracleError('ORA-00904', `"${colUpper}": invalid identifier`);
    }

    return trimmed;
  }

  evaluateWhereCondition(row, condition) {
    if (!condition || !condition.trim()) return true;

    let cond = condition;
    const subqueryMatch = cond.match(/\bIN\s*\(\s*(SELECT[\s\S]+?)\s*\)/i);
    if (subqueryMatch) {
      const subSelect = subqueryMatch[1];
      const subRes = this.execSelect(subSelect);
      const subCol = subRes.columns[0];
      const subVals = subRes.rows.map(r => r[subCol]);
      const formattedList = subVals.map(v => typeof v === 'string' ? `'${v}'` : String(v)).join(', ');
      cond = cond.replace(subqueryMatch[0], `IN (${formattedList})`);
    }

    return this.evalLogicalExpression(cond.trim(), row);
  }

  evalLogicalExpression(str, row) {
    const orParts = this.splitTopLevelLogical(str, 'OR');
    if (orParts.length > 1) {
      return orParts.some(part => this.evalLogicalExpression(part, row));
    }

    const andParts = this.splitTopLevelLogical(str, 'AND');
    if (andParts.length > 1) {
      return andParts.every(part => this.evalLogicalExpression(part, row));
    }

    let trimmed = str.trim();

    if (/^NOT\s+/i.test(trimmed)) {
      return !this.evalLogicalExpression(trimmed.slice(4).trim(), row);
    }

    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      let depth = 0;
      let isEnclosed = true;
      for (let i = 0; i < trimmed.length - 1; i++) {
        if (trimmed[i] === '(') depth++;
        else if (trimmed[i] === ')') depth--;
        if (depth === 0) {
          isEnclosed = false;
          break;
        }
      }
      if (isEnclosed) {
        return this.evalLogicalExpression(trimmed.slice(1, -1).trim(), row);
      }
    }

    return this.evalComparison(trimmed, row);
  }

  evalComparison(compStr, row) {
    const trimmed = compStr.trim();

    const isNullMatch = trimmed.match(/^([\s\S]+?)\s+IS\s+(NOT\s+)?NULL$/i);
    if (isNullMatch) {
      const val = this.evaluateExpression(isNullMatch[1], row);
      const isNot = !!isNullMatch[2];
      const isNull = (val === null || val === undefined);
      return isNot ? !isNull : isNull;
    }

    const betweenMatch = trimmed.match(/^([\s\S]+?)\s+(NOT\s+)?BETWEEN\s+([\s\S]+?)\s+AND\s+([\s\S]+)$/i);
    if (betweenMatch) {
      const val = this.evaluateExpression(betweenMatch[1], row);
      const isNot = !!betweenMatch[2];
      const low = this.evaluateExpression(betweenMatch[3], row);
      const high = this.evaluateExpression(betweenMatch[4], row);
      const inRange = (val >= low && val <= high);
      return isNot ? !inRange : inRange;
    }

    const inMatch = trimmed.match(/^([\s\S]+?)\s+(NOT\s+)?IN\s*\(([\s\S]+)\)$/i);
    if (inMatch) {
      const val = this.evaluateExpression(inMatch[1], row);
      const isNot = !!inMatch[2];
      const listVals = this.splitValuesList(inMatch[3]).map(v => this.parseLiteralValue(v));
      const has = listVals.some(lv => lv == val);
      return isNot ? !has : has;
    }

    const likeMatch = trimmed.match(/^([\s\S]+?)\s+(NOT\s+)?LIKE\s*'([\s\S]*?)'(?:\s+ESCAPE\s*'([\s\S]*?)')?$/i);
    if (likeMatch) {
      const rawVal = this.evaluateExpression(likeMatch[1], row);
      if (rawVal === null || rawVal === undefined) return false;
      const val = String(rawVal);
      const isNot = !!likeMatch[2];
      const pattern = likeMatch[3];
      const escapeChar = likeMatch[4];

      let regexStr = '^';
      for (let i = 0; i < pattern.length; i++) {
        if (escapeChar && pattern[i] === escapeChar && i + 1 < pattern.length) {
          i++;
          regexStr += pattern[i].replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1');
        } else if (pattern[i] === '%') {
          regexStr += '.*';
        } else if (pattern[i] === '_') {
          regexStr += '.';
        } else {
          regexStr += pattern[i].replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1');
        }
      }
      regexStr += '$';

      const regex = new RegExp(regexStr, 'i');
      const match = regex.test(val);
      return isNot ? !match : match;
    }

    const opMatch = trimmed.match(/^([\s\S]+?)\s*(<=|>=|!=|<>|=|<|>)\s*([\s\S]+)$/);
    if (opMatch) {
      const leftVal = this.evaluateExpression(opMatch[1], row);
      const op = opMatch[2];
      const rightVal = this.evaluateExpression(opMatch[3], row);

      if (leftVal === null || rightVal === null) {
        return false;
      }

      switch (op) {
        case '=': return leftVal == rightVal;
        case '!=':
        case '<>': return leftVal != rightVal;
        case '<': return leftVal < rightVal;
        case '<=': return leftVal <= rightVal;
        case '>': return leftVal > rightVal;
        case '>=': return leftVal >= rightVal;
      }
    }

    return true;
  }

  splitTopLevelLogical(str, op) {
    const parts = [];
    let current = '';
    let depth = 0;
    let inQuote = false;
    const opRegex = new RegExp(`^\\s+${op}\\s+`, 'i');

    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if (char === "'") inQuote = !inQuote;
      if (!inQuote) {
        if (char === '(') depth++;
        else if (char === ')') depth--;

        if (depth === 0) {
          const remainder = str.substring(i);
          const match = remainder.match(opRegex);
          if (match) {
            parts.push(current.trim());
            current = '';
            i += match[0].length - 1;
            continue;
          }
        }
      }
      current += char;
    }

    if (current.trim()) {
      parts.push(current.trim());
    }
    return parts;
  }

  parseOrderByCriteria(orderByPart) {
    return this.splitCommaExpressions(orderByPart).map(c => {
      let trimmed = c.trim();
      let dir = 'ASC';
      let nullsFirst = undefined;

      const nullsMatch = trimmed.match(/\s+NULLS\s+(FIRST|LAST)\s*$/i);
      if (nullsMatch) {
        nullsFirst = nullsMatch[1].toUpperCase() === 'FIRST';
        trimmed = trimmed.slice(0, nullsMatch.index).trim();
      }

      const dirMatch = trimmed.match(/\s+(ASC|DESC)\s*$/i);
      if (dirMatch) {
        dir = dirMatch[1].toUpperCase();
        trimmed = trimmed.slice(0, dirMatch.index).trim();
      }

      if (nullsFirst === undefined) {
        nullsFirst = (dir === 'DESC');
      }

      const rawExpr = trimmed;
      const expr = (rawExpr.startsWith('"') && rawExpr.endsWith('"')) ? rawExpr.slice(1, -1) : rawExpr;
      return { expr, rawExpr, dir, nullsFirst };
    });
  }

  processOrderByWorkingItems(workingItems, orderByPart, selectExpressions, isDistinct) {
    const criteria = this.parseOrderByCriteria(orderByPart);

    const sorted = [...workingItems];
    sorted.sort((a, b) => {
      for (const crit of criteria) {
        const getVal = (item) => {
          const { sourceRow, projectedRow } = item;

          // 1. Positional column index (1, 2, 3...)
          if (/^\d+$/.test(crit.expr)) {
            const pos = parseInt(crit.expr, 10);
            if (pos < 1 || pos > selectExpressions.length) {
              throw new OracleError('ORA-01785', 'ORDER BY item must be the number of a SELECT-list expression');
            }
            const targetAlias = selectExpressions[pos - 1].alias;
            return projectedRow[targetAlias];
          }

          const upperExpr = crit.expr.toUpperCase();

          // 2. Check if matches projected alias or expression in SELECT list
          if (projectedRow[crit.expr] !== undefined) return projectedRow[crit.expr];
          if (projectedRow[upperExpr] !== undefined) return projectedRow[upperExpr];
          const projEntry = Object.entries(projectedRow).find(([k]) => k.toUpperCase() === upperExpr);
          if (projEntry) return projEntry[1];

          const matchedSelect = selectExpressions.find(e => e.expr.toUpperCase() === upperExpr);
          if (matchedSelect && projectedRow[matchedSelect.alias] !== undefined) {
            return projectedRow[matchedSelect.alias];
          }

          // 3. If DISTINCT is used, ORDER BY items MUST appear in SELECT list
          if (isDistinct) {
            throw new OracleError('ORA-01791', 'not a SELECTed expression');
          }

          // 4. Evaluate against combined row (source columns + projected aliases)
          const combinedRow = Object.assign({}, sourceRow, projectedRow);
          return this.evaluateExpression(crit.expr, combinedRow);
        };

        const valA = getVal(a);
        const valB = getVal(b);

        if (valA === valB) continue;
        if (valA === null || valA === undefined) return crit.nullsFirst ? -1 : 1;
        if (valB === null || valB === undefined) return crit.nullsFirst ? 1 : -1;

        if (typeof valA === 'number' && typeof valB === 'number') {
          return crit.dir === 'ASC' ? valA - valB : valB - valA;
        }

        const comp = String(valA).localeCompare(String(valB));
        return crit.dir === 'ASC' ? comp : -comp;
      }
      return 0;
    });

    return sorted;
  }

  processOrderBy(dataset, orderByPart, selectExpressions = []) {
    const criteria = this.parseOrderByCriteria(orderByPart);

    const sorted = [...dataset];
    sorted.sort((a, b) => {
      for (const crit of criteria) {
        const getRowVal = (row) => {
          if (/^\d+$/.test(crit.expr) && selectExpressions && selectExpressions.length > 0) {
            const pos = parseInt(crit.expr, 10);
            if (pos >= 1 && pos <= selectExpressions.length) {
              const targetAlias = selectExpressions[pos - 1].alias;
              return row[targetAlias];
            }
          }
          if (row[crit.expr] !== undefined) return row[crit.expr];
          const upper = crit.expr.toUpperCase();
          if (row[upper] !== undefined) return row[upper];
          const entry = Object.entries(row).find(([k]) => k.toUpperCase() === upper);
          if (entry) return entry[1];
          return this.evaluateExpression(crit.expr, row);
        };

        const valA = getRowVal(a);
        const valB = getRowVal(b);

        if (valA === valB) continue;
        if (valA === null || valA === undefined) return crit.nullsFirst ? -1 : 1;
        if (valB === null || valB === undefined) return crit.nullsFirst ? 1 : -1;

        if (typeof valA === 'number' && typeof valB === 'number') {
          return crit.dir === 'ASC' ? valA - valB : valB - valA;
        }

        const comp = String(valA).localeCompare(String(valB));
        return crit.dir === 'ASC' ? comp : -comp;
      }
      return 0;
    });

    return sorted;
  }

  splitCommaExpressions(str) {
    const items = [];
    let current = '';
    let depth = 0;
    let inQuote = false;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if (char === "'") inQuote = !inQuote;
      if (!inQuote) {
        if (char === '(') depth++;
        else if (char === ')') depth--;

        if (char === ',' && depth === 0) {
          items.push(current.trim());
          current = '';
          continue;
        }
      }
      current += char;
    }

    if (current.trim()) items.push(current.trim());
    return items;
  }

  validateValueExpression(expr) {
    const trimmed = expr.trim();
    if (!trimmed) {
      throw new OracleError('ORA-00936', 'missing expression');
    }

    const tokens = [];
    let i = 0;
    while (i < trimmed.length) {
      if (/\s/.test(trimmed[i])) {
        i++;
        continue;
      }

      // String literal
      if (trimmed[i] === "'") {
        let str = "'";
        i++;
        while (i < trimmed.length) {
          if (trimmed[i] === "'") {
            str += "'";
            i++;
            if (i < trimmed.length && trimmed[i] === "'") {
              str += "'";
              i++;
            } else {
              break;
            }
          } else {
            str += trimmed[i];
            i++;
          }
        }
        tokens.push({ type: 'LITERAL', val: str });
        continue;
      }

      // Parentheses
      if (trimmed[i] === '(') {
        let depth = 1;
        let sub = '(';
        i++;
        let inSingle = false;
        while (i < trimmed.length && depth > 0) {
          const char = trimmed[i];
          if (char === "'") inSingle = !inSingle;
          if (!inSingle) {
            if (char === '(') depth++;
            else if (char === ')') depth--;
          }
          sub += char;
          i++;
        }
        tokens.push({ type: 'PAREN', val: sub });
        continue;
      }

      // Concatenation operator ||
      if (trimmed.startsWith('||', i)) {
        tokens.push({ type: 'OP', val: '||' });
        i += 2;
        continue;
      }

      // Arithmetic operators +, -, *, /
      if (['+', '-', '*', '/'].includes(trimmed[i])) {
        const prev = tokens[tokens.length - 1];
        if ((trimmed[i] === '+' || trimmed[i] === '-') && (!prev || prev.type === 'OP')) {
          tokens.push({ type: 'UNARY_OP', val: trimmed[i] });
        } else {
          tokens.push({ type: 'OP', val: trimmed[i] });
        }
        i++;
        continue;
      }

      // Atom (identifier, keyword, number)
      const wordMatch = trimmed.slice(i).match(/^[a-zA-Z0-9_$#.]+/);
      if (wordMatch) {
        tokens.push({ type: 'ATOM', val: wordMatch[0] });
        i += wordMatch[0].length;
        continue;
      }

      tokens.push({ type: 'CHAR', val: trimmed[i] });
      i++;
    }

    const isValTerm = (t) => t.type === 'LITERAL' || t.type === 'ATOM' || t.type === 'PAREN';

    for (let k = 0; k < tokens.length - 1; k++) {
      const cur = tokens[k];
      const next = tokens[k + 1];

      // Identifier followed by '(' is a function call
      if (cur.type === 'ATOM' && next.type === 'PAREN') {
        continue;
      }

      if (isValTerm(cur) && isValTerm(next)) {
        throw new OracleError('ORA-00917', 'missing comma');
      }
    }
  }

  splitValuesList(str) {
    const trimmed = str.trim();
    if (trimmed.startsWith(',') || trimmed.endsWith(',')) {
      throw new OracleError('ORA-00936', 'missing expression');
    }
    const items = this.splitCommaExpressions(trimmed);
    for (const item of items) {
      if (!item.trim()) {
        throw new OracleError('ORA-00936', 'missing expression');
      }
      this.validateValueExpression(item);
    }
    return items;
  }

  parseLiteralValue(valStr, colMeta = null) {
    const trimmed = valStr.trim();

    // 1. Single-quoted string literal: '...' (handle escaped '' inside)
    if (/^'([\s\S]*)'$/.test(trimmed)) {
      return trimmed.slice(1, -1).replace(/''/g, "'");
    }

    // 2. Numeric literal (integers, decimals: e.g. 1, 47000.98, -10, +5.5, .5)
    if (/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(trimmed)) {
      return Number(trimmed);
    }

    // 3. NULL (case-insensitive)
    if (/^null$/i.test(trimmed)) {
      return null;
    }

    // 4. DEFAULT (case-insensitive)
    if (/^default$/i.test(trimmed)) {
      if (colMeta && colMeta.hasDefault && colMeta.defaultValue !== undefined) {
        return colMeta.defaultValue;
      }
      return null;
    }

    // 5. TRUE / FALSE (case-insensitive) -> stored as 1 or 0
    if (/^true$/i.test(trimmed)) {
      return 1;
    }
    if (/^false$/i.test(trimmed)) {
      return 0;
    }

    // 6. SYSDATE / CURRENT_DATE (case-insensitive) -> system date/time
    if (/^(sysdate|current_date)$/i.test(trimmed)) {
      return this.formatDateForColumn(colMeta, 'DATE');
    }

    // 7. CURRENT_TIME / LOCALTIME (case-insensitive)
    if (/^(current_time|localtime)$/i.test(trimmed)) {
      return this.formatDateForColumn(colMeta, 'TIME');
    }

    // 8. CURRENT_TIMESTAMP / SYSTIMESTAMP (case-insensitive)
    if (/^(current_timestamp|systimestamp)$/i.test(trimmed)) {
      return this.formatDateForColumn(colMeta, 'TIMESTAMP');
    }

    // 9. LOCALTIMESTAMP (case-insensitive)
    if (/^localtimestamp$/i.test(trimmed)) {
      return this.formatDateForColumn(colMeta, 'LOCALTIMESTAMP');
    }

    // 10. SESSIONTIMEZONE (case-insensitive)
    if (/^sessiontimezone$/i.test(trimmed)) {
      return this.getSessionTimeZone();
    }

    // 11. DBTIMEZONE (case-insensitive)
    if (/^dbtimezone$/i.test(trimmed)) {
      return '+00:00';
    }

    // 12. USER (case-insensitive)
    if (/^user$/i.test(trimmed)) {
      return (this.db.currentUser || 'SYS').toUpperCase();
    }

    // 8. SQL Function calls / arithmetic expressions: UPPER('...'), 10 + 5, ROUND(...), etc.
    // In Oracle VALUES clause, column references are forbidden and result in ORA-00984.
    if (/^[A-Za-z_]\w*\s*\(/.test(trimmed) || /[-+*/]/.test(trimmed) || trimmed.includes('||')) {
      try {
        return this.evaluateExpression(trimmed, { __IS_VALUES_CLAUSE__: true });
      } catch (e) {
        if (e instanceof OracleError && e.code === 'ORA-00904') {
          throw new OracleError('ORA-00984', 'column not allowed here');
        }
        throw e;
      }
    }

    // 9. Any unquoted identifier or double-quoted identifier in VALUES is treated as a column reference
    // In Oracle SQL: ORA-00984: column not allowed here
    throw new OracleError('ORA-00984', 'column not allowed here');
  }
}

