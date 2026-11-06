-- 1. Where am I? (should say FREEPDB1, not CDB$ROOT)
SHOW CON_NAME;

-- 2. Is the PDB open? (want READ WRITE)
SELECT name, open_mode FROM v$pdbs;

-- 3. Switch into the PDB
ALTER SESSION SET CONTAINER = FREEPDB1;

-- 4. Create the user
CREATE USER jhon IDENTIFIED BY "StrongPass#123"
  DEFAULT TABLESPACE users
  TEMPORARY TABLESPACE temp
  QUOTA UNLIMITED ON users;

-- 5. Give permissions
GRANT CREATE SESSION, CREATE TABLE, CREATE VIEW, CREATE SEQUENCE TO jhon;

-- 6. Who am I logged in as?
SHOW USER;

-- B --

-- Log in as the new user (use no password so it prompts, avoids # problems)
CONN jhon@localhost:1521/FREEPDB1

-- Daily user management

-- Change password / unlock account
ALTER USER jhon IDENTIFIED BY "NewPass#456";
ALTER USER jhon ACCOUNT UNLOCK;

-- Give or remove a role or privilege
GRANT CONNECT, RESOURCE TO jhon;
REVOKE CREATE VIEW FROM jhon;

-- Check what a user has
SELECT * FROM dba_sys_privs  WHERE grantee = 'JHON';
SELECT * FROM dba_role_privs WHERE grantee = 'JHON';
SELECT * FROM dba_tab_privs  WHERE grantee = 'JHON';

-- List all users you created (hides Oracle's built-in ones)
SELECT username, account_status FROM dba_users WHERE oracle_maintained = 'N';

-- Delete the user and everything they own (cannot be undone)
DROP USER jhon CASCADE;

-- LOCK and UNLOCK a user account
ALTER USER jhon ACCOUNT LOCK;
-- check the status
SELECT username, account_status FROM dba_users WHERE username = 'JHON';
ALTER USER jhon ACCOUNT UNLOCK;


-- FOR LOGOUT

-- EXIT          -- closes the session and leaves the tool
-- QUIT          -- same as EXIT
-- DISCONNECT    -- ends the session but keeps SQL*Plus open, so you can CONN as someone else

DISCONNECT
CONN jhon@localhost:1521/FREEPDB1