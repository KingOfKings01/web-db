import { writable } from 'svelte/store';
import { OracleDatabase } from './oracle-engine.js';

export const oracleDb = new OracleDatabase();

const COMPARISON_STORAGE_KEY = 'ORACLE_STUDIO_COMPARISON_TABLES';

function loadComparisonTables() {
  try {
    const savedTables = localStorage.getItem(COMPARISON_STORAGE_KEY);
    if (!savedTables) return [];
    const tables = JSON.parse(savedTables);
    return Array.isArray(tables) ? tables : [];
  } catch (error) {
    console.error('Failed to restore comparison tables', error);
    return [];
  }
}

export const tablesStore = writable(oracleDb.getTables());
export const comparisonTablesStore = writable(loadComparisonTables());
export const viewsStore = writable(oracleDb.getViews());

comparisonTablesStore.subscribe(tables => {
  try {
    localStorage.setItem(COMPARISON_STORAGE_KEY, JSON.stringify(tables));
  } catch (error) {
    console.error('Failed to save comparison tables', error);
  }
});

oracleDb.onChange(() => {
  tablesStore.set({ ...oracleDb.getTables() });
  viewsStore.set({ ...oracleDb.getViews() });
});
