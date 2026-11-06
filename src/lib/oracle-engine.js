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
  currentContainer: 'FREEPDB1',
  currentUser: 'SYS',
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
            if (!parsed.currentContainer) parsed.currentContainer = 'FREEPDB1';
            if (!parsed.currentUser) parsed.currentUser = 'SYS';
            if (!parsed.users) parsed.users = JSON.parse(JSON.stringify(DEFAULT_DATABASE.users));
            if (!parsed.roles) parsed.roles = JSON.parse(JSON.stringify(DEFAULT_DATABASE.roles));
            if (!parsed.userPrivileges) parsed.userPrivileges = JSON.parse(JSON.stringify(DEFAULT_DATABASE.userPrivileges));
            if (!parsed.userRoles) parsed.userRoles = JSON.parse(JSON.stringify(DEFAULT_DATABASE.userRoles));
            if (!parsed.tabPrivileges) parsed.tabPrivileges = {};
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

  getTables() {
    return this.db.tables;
  }

  getViews() {
    return this.db.views || {};
  }

  getTable(name) {
    if (!name) return null;
    const upper = name.toUpperCase();
    if (this.db.tables[upper]) return this.db.tables[upper];
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

  formatSysdate() {
    const d = new Date();
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const day = String(d.getDate()).padStart(2, '0');
    const mon = months[d.getMonth()];
    const year = String(d.getFullYear()).slice(-2);
    return `${day}-${mon}-${year}`;
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

    const tableMatch = sql.match(/^CREATE\s+TABLE\s+([a-zA-Z0-9_$#]+)\s*\(([\s\S]+)\)$/i);
    if (!tableMatch) {
      throw new OracleError('ORA-00901', 'invalid CREATE command syntax');
    }

    const tableName = tableMatch[1].toUpperCase();
    if (this.db.tables[tableName]) {
      throw new OracleError('ORA-00955', 'name is already used by an existing object');
    }

    const colDefsRaw = this.splitColumnDefs(tableMatch[2]);
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

      const colParts = def.split(/\s+/);
      const colName = colParts[0].toUpperCase();
      const rest = def.slice(colParts[0].length).trim();

      const typeMatch = rest.match(/^([a-zA-Z0-9_]+(?:\s*\(\s*\d+(?:\s*,\s*\d+)?\s*\))?)/i);
      if (!typeMatch) {
        throw new OracleError('ORA-00904', `invalid column definition: ${def}`);
      }

      const rawType = typeMatch[1].toUpperCase();
      let isPk = /PRIMARY\s+KEY/i.test(rest);
      let nullable = !/NOT\s+NULL/i.test(rest);
      if (isPk) nullable = false;

      columns.push({
        name: colName,
        type: rawType,
        isPk: isPk,
        nullable: nullable
      });
    }

    for (const pk of primaryKeys) {
      const col = columns.find(c => c.name === pk);
      if (col) {
        col.isPk = true;
        col.nullable = false;
      }
    }

    this.db.tables[tableName] = {
      name: tableName,
      columns: columns,
      rows: []
    };

    this.notifyChange();
    return {
      type: 'DDL',
      command: sql,
      message: 'Table created.'
    };
  }

  splitColumnDefs(str) {
    const parts = [];
    let current = '';
    let parenCount = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if (char === '(') parenCount++;
      else if (char === ')') parenCount--;

      if (char === ',' && parenCount === 0) {
        parts.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) parts.push(current.trim());
    return parts;
  }

  // DDL: DROP TABLE, DROP VIEW, TRUNCATE, ALTER
  execDrop(sql) {
    const dropUserMatch = sql.match(/^DROP\s+USER\s+([a-zA-Z0-9_$#]+)(?:\s+CASCADE)?/i);
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

    const dropRoleMatch = sql.match(/^DROP\s+ROLE\s+([a-zA-Z0-9_$#]+)/i);
    if (dropRoleMatch) {
      const roleName = dropRoleMatch[1].toUpperCase();
      if (!this.db.roles?.[roleName]) {
        throw new OracleError('ORA-01919', `role '${roleName}' does not exist`);
      }
      delete this.db.roles[roleName];
      this.notifyChange();
      return { type: 'DDL', command: sql, message: 'Role dropped.' };
    }

    const dropViewMatch = sql.match(/^DROP\s+VIEW\s+([a-zA-Z0-9_$#]+)/i);
    if (dropViewMatch) {
      const viewName = dropViewMatch[1].toUpperCase();
      if (!this.db.views || !this.db.views[viewName]) {
        throw new OracleError('ORA-00942', 'table or view does not exist');
      }
      delete this.db.views[viewName];
      this.notifyChange();
      return { type: 'DDL', command: sql, message: 'View dropped.' };
    }

    const dropTableMatch = sql.match(/^DROP\s+TABLE\s+([a-zA-Z0-9_$#]+)(?:\s+PURGE)?(?:\s+CASCADE\s+CONSTRAINTS)?/i);
    if (dropTableMatch) {
      const tableName = dropTableMatch[1].toUpperCase();
      if (!this.db.tables[tableName]) {
        throw new OracleError('ORA-00942', 'table or view does not exist');
      }
      delete this.db.tables[tableName];
      this.notifyChange();
      return { type: 'DDL', command: sql, message: 'Table dropped.' };
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

    const addMatch = sql.match(/^ALTER\s+TABLE\s+([a-zA-Z0-9_$#]+)\s+ADD\s+\(?([a-zA-Z0-9_$#]+)\s+([a-zA-Z0-9_()]+)\)?/i);
    if (addMatch) {
      const tableName = addMatch[1].toUpperCase();
      const table = this.getTable(tableName);
      if (!table) throw new OracleError('ORA-00942', 'table or view does not exist');

      const colName = addMatch[2].toUpperCase();
      const colType = addMatch[3].toUpperCase();

      if (table.columns.some(c => c.name === colName)) {
        throw new OracleError('ORA-01430', 'column being added already exists in table');
      }

      table.columns.push({ name: colName, type: colType, nullable: true });
      for (const row of table.rows) {
        row[colName] = null;
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

    let username = match[1].replace(/"/g, '').toUpperCase();
    const service = match[3];

    if (service) {
      const parts = service.split('/');
      const pdbName = parts[parts.length - 1].toUpperCase();
      if (['FREEPDB1', 'XEPDB1', 'CDB$ROOT'].includes(pdbName)) {
        this.db.currentContainer = pdbName;
      }
    }

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
      message: `Connected to ${this.db.currentContainer || 'FREEPDB1'}.`
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
      newRow[col.name] = null;
    }

    for (let i = 0; i < targetCols.length; i++) {
      const colName = targetCols[i];
      const colMeta = table.columns.find(c => c.name === colName);
      if (!colMeta) {
        throw new OracleError('ORA-00904', `"${colName}": invalid identifier`);
      }

      const parsedVal = this.parseLiteralValue(rawVals[i]);

      if (parsedVal === null && !colMeta.nullable) {
        throw new OracleError('ORA-01400', `cannot insert NULL into ("STUDENT"."${tableName}"."${colName}")`);
      }

      if (parsedVal !== null && colMeta.type.includes('NUMBER')) {
        if (typeof parsedVal !== 'number' && isNaN(Number(parsedVal))) {
          throw new OracleError('ORA-01722', 'invalid number');
        }
        newRow[colName] = Number(parsedVal);
      } else {
        newRow[colName] = parsedVal;
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
          const val = this.evaluateExpression(assign.expr, row);
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

    const selectRegex = /^\s*SELECT\s+(DISTINCT\s+)?([\s\S]+?)\s+FROM\s+([\s\S]+?)(?:\s+WHERE\s+([\s\S]+?))?(?:\s+GROUP\s+BY\s+([\s\S]+?))?(?:\s+HAVING\s+([\s\S]+?))?(?:\s+ORDER\s+BY\s+([\s\S]+?))?(?:\s+FETCH\s+FIRST\s+(\d+)\s+ROWS\s+ONLY)?$/i;
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
    } else {
      dataset = this.projectColumns(dataset, selectExpressions);
    }

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
      dataset = this.processOrderBy(dataset, orderByPart);
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

  parseSelectColumns(colsStr) {
    if (colsStr.trim() === '*') {
      return [{ expr: '*', alias: '*', isWildcard: true, isAggregate: false }];
    }

    const items = this.splitCommaExpressions(colsStr);
    const parsed = [];

    for (const item of items) {
      let expr = item.trim();
      let alias = null;

      const asMatch = expr.match(/^([\s\S]+?)\s+AS\s+([a-zA-Z0-9_$#]+|"[\s\S]+?")$/i);
      if (asMatch) {
        expr = asMatch[1].trim();
        alias = asMatch[2].replace(/^"|"$/g, '').toUpperCase();
      } else {
        const spaceMatch = expr.match(/^([\s\S]+)\s+([a-zA-Z0-9_$#]+)$/i);
        if (spaceMatch && !/^[A-Z_]+\s*\(.*?\)$/i.test(expr)) {
          expr = spaceMatch[1].trim();
          alias = spaceMatch[2].toUpperCase();
        } else {
          const dotParts = expr.split('.');
          if (dotParts.length === 2 && /^[a-zA-Z0-9_$#]+$/.test(dotParts[1].trim())) {
            alias = dotParts[1].trim().toUpperCase();
          } else {
            alias = expr.toUpperCase().replace(/\s+/g, '_');
          }
        }
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

  projectColumns(dataset, selectExpressions) {
    if (selectExpressions.length === 1 && selectExpressions[0].isWildcard && selectExpressions[0].expr === '*') {
      return dataset.map(row => {
        const clean = {};
        for (const [k, v] of Object.entries(row)) {
          if (!k.includes('.')) {
            clean[k] = v;
          }
        }
        return clean;
      });
    }

    return dataset.map(row => {
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
    });
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
          row[item.alias] = this.evaluateAggregate(item.expr, group.rows);
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

  evaluateAggregate(expr, rows) {
    const match = expr.match(/^\s*(COUNT|SUM|AVG|MIN|MAX)\s*\(\s*(DISTINCT\s+)?([\s\S]+?)\s*\)\s*$/i);
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
      return values.reduce((sum, v) => sum + Number(v), 0);
    }
    if (func === 'AVG') {
      const sum = values.reduce((sum, v) => sum + Number(v), 0);
      return Math.round((sum / values.length) * 100) / 100;
    }
    if (func === 'MIN') {
      return values.reduce((min, v) => v < min ? v : min, values[0]);
    }
    if (func === 'MAX') {
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

    const stringFuncMatch = trimmed.match(/^(UPPER|LOWER|INITCAP|LENGTH|TRIM)\s*\(([\s\S]+)\)$/i);
    if (stringFuncMatch) {
      const fn = stringFuncMatch[1].toUpperCase();
      const argVal = this.evaluateExpression(stringFuncMatch[2], row);
      if (argVal === null || argVal === undefined) return null;
      const str = String(argVal);
      if (fn === 'UPPER') return str.toUpperCase();
      if (fn === 'LOWER') return str.toLowerCase();
      if (fn === 'LENGTH') return str.length;
      if (fn === 'TRIM') return str.trim();
      if (fn === 'INITCAP') {
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

    const mathFuncMatch = trimmed.match(/^(ROUND|TRUNC|MOD|ABS)\s*\(([\s\S]+)\)$/i);
    if (mathFuncMatch) {
      const fn = mathFuncMatch[1].toUpperCase();
      const args = this.splitCommaExpressions(mathFuncMatch[2]);
      const num1 = Number(this.evaluateExpression(args[0], row));
      if (isNaN(num1)) return null;

      if (fn === 'ABS') return Math.abs(num1);
      if (fn === 'MOD') {
        const num2 = Number(this.evaluateExpression(args[1], row));
        return num1 % num2;
      }
      const decimals = args.length > 1 ? parseInt(this.evaluateExpression(args[1], row), 10) : 0;
      const factor = Math.pow(10, decimals);
      if (fn === 'ROUND') return Math.round(num1 * factor) / factor;
      if (fn === 'TRUNC') return Math.trunc(num1 * factor) / factor;
    }

    if (/^SYSDATE$/i.test(trimmed)) {
      return this.formatSysdate();
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

    if (trimmed === 'NULL' || trimmed === 'null') return null;
    if (/^'([\s\S]*)'$/.test(trimmed)) {
      return trimmed.slice(1, -1).replace(/''/g, "'");
    }
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return Number(trimmed);
    }

    if (/[-+*/]/.test(trimmed)) {
      try {
        const evalStr = trimmed.replace(/\b([a-zA-Z_][a-zA-Z0-9_.]*)\b/g, (match) => {
          const up = match.toUpperCase();
          if (row && (row[up] !== undefined)) {
            return row[up] === null ? '0' : String(Number(row[up]));
          }
          return match;
        });
        if (/^[\d\s+\-*/().]+$/.test(evalStr)) {
          return Function(`'use strict'; return (${evalStr});`)();
        }
      } catch (e) {}
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

    const likeMatch = trimmed.match(/^([\s\S]+?)\s+(NOT\s+)?LIKE\s+'([\s\S]*?)'$/i);
    if (likeMatch) {
      const val = String(this.evaluateExpression(likeMatch[1], row) || '');
      const isNot = !!likeMatch[2];
      const pattern = likeMatch[3];
      const regexStr = '^' + pattern.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1').replace(/%/g, '.*').replace(/_/g, '.') + '$';
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

  processOrderBy(dataset, orderByPart) {
    const criteria = this.splitCommaExpressions(orderByPart).map(c => {
      const parts = c.trim().split(/\s+/);
      const col = parts[0].toUpperCase();
      const dir = (parts[1] && parts[1].toUpperCase() === 'DESC') ? 'DESC' : 'ASC';
      return { col, dir };
    });

    const sorted = [...dataset];
    sorted.sort((a, b) => {
      for (const crit of criteria) {
        const valA = a[crit.col] !== undefined ? a[crit.col] : this.evaluateExpression(crit.col, a);
        const valB = b[crit.col] !== undefined ? b[crit.col] : this.evaluateExpression(crit.col, b);

        if (valA === valB) continue;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;

        if (valA < valB) return crit.dir === 'ASC' ? -1 : 1;
        if (valA > valB) return crit.dir === 'ASC' ? 1 : -1;
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

  splitValuesList(str) {
    return this.splitCommaExpressions(str);
  }

  parseLiteralValue(valStr) {
    const trimmed = valStr.trim();
    if (/^null$/i.test(trimmed)) return null;
    if (/^'([\s\S]*)'$/.test(trimmed)) {
      return trimmed.slice(1, -1).replace(/''/g, "'");
    }
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return Number(trimmed);
    }
    return trimmed;
  }
}

