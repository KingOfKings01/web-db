# Oracle SQL Web Studio (Svelte 5 + Vite)

A modern, reactive, lightning-fast Oracle Database learning studio built with **Svelte 5** and **Vite**. 
Designed for students to write and test Oracle SQL queries with instant live feedback, drag-and-compare table canvases, and client-side database persistence using `localStorage`.

---

## 🚀 How to Run

### Development Mode (with Hot Module Replacement):
```bash
npm run dev
```
Open **`http://localhost:5173`** in your browser. Or simply double-click **`start_app.bat`**.

### Access from another device on the same Wi-Fi:
```bash
npm run dev:lan
```
On the other device, open **`http://<your-computer-ip>:5173`**. On Windows, run `ipconfig` and use the computer's IPv4 address. If prompted, allow Node.js through Windows Firewall on your private network. Keep the dev server running while other devices use the app.

### Production Build:
```bash
npm run build
```
The optimized bundle will be compiled to the `dist/` directory (total size ~37 kB gzipped).

### Preview Production Build:
```bash
npm run preview
```

---

## ☁️ Deploying to Vercel

The project is fully pre-configured for **zero-config deployment on Vercel** via [`vercel.json`](file:///d:/NetTech%20India/Oracle%20DB/Web%20DB/vercel.json):

### Method A: Via Git (Recommended)
1. Push this folder to a GitHub, GitLab, or Bitbucket repository.
2. In your [Vercel Dashboard](https://vercel.com/new), import the repository.
3. Vercel automatically detects the Vite framework and runs `npm run build` with output in `dist/`.
4. Click **Deploy**.

### Method B: Via Vercel CLI
Run the following in this project folder:
```bash
npx vercel
```
Follow the interactive prompts to deploy directly.
For production:
```bash
npx vercel --prod
```

---

## 🌟 Architecture & Features

### 1. Modern Component Architecture (Svelte 5)
* **[`src/App.svelte`](file:///d:/NetTech%20India/Oracle%20DB/Web%20DB/src/App.svelte)**: Root coordinator managing UI state, reactive stores, and responsive layout.
* **[`src/components/SqlEditor.svelte`](file:///d:/NetTech%20India/Oracle%20DB/Web%20DB/src/components/SqlEditor.svelte)**: Rich SQL editor with line numbers, syntax highlighting, keyboard shortcuts (<kbd>Ctrl+Enter</kbd>, <kbd>F9</kbd>), and dynamic selection detection.
* **[`src/components/OutputView.svelte`](file:///d:/NetTech%20India/Oracle%20DB/Web%20DB/src/components/OutputView.svelte)**: Tabular query output, row indices, execution timers, NULL indicators, and Oracle error reporting.
* **[`src/components/TableCanvasModal.svelte`](file:///d:/NetTech%20India/Oracle%20DB/Web%20DB/src/components/TableCanvasModal.svelte)**: Full-window draggable table compare board with infinite dot-grid, side-by-side auto-tile, pointer-capture dragging, cross-table search, and relational hover matching.
* **[`src/components/SchemaSidebar.svelte`](file:///d:/NetTech%20India/Oracle%20DB/Web%20DB/src/components/SchemaSidebar.svelte)**: Left sidebar tree showing tables (`Courses [-]`, `Students [-]`), column data types (`[number]`, `[varchar2(20)]`), and click-to-insert.
* **[`src/components/AvailableTablesSidebar.svelte`](file:///d:/NetTech%20India/Oracle%20DB/Web%20DB/src/components/AvailableTablesSidebar.svelte)**: Right sidebar showing real-time live preview of table rows.
* **[`src/components/Header.svelte`](file:///d:/NetTech%20India/Oracle%20DB/Web%20DB/src/components/Header.svelte)**: Sample queries selector, compare board button, reset database, and light/dark theme switch.

### 2. Mock Oracle Database Engine ([`src/lib/oracle-engine.js`](file:///d:/NetTech%20India/Oracle%20DB/Web%20DB/src/lib/oracle-engine.js))
* **Zero Backend Required**: Runs 100% in-browser using pure JavaScript.
* **Persistent**: All data, schemas, and views persist in `localStorage`.
* **Oracle Commands**: `SELECT` (with joins, `GROUP BY`, `HAVING`, `ORDER BY`), `INSERT`, `UPDATE`, `DELETE`, `CREATE TABLE`, `DROP TABLE`, `TRUNCATE TABLE`, `ALTER TABLE`, `CREATE VIEW`, `DESCRIBE`, and `DUAL` table.
* **Oracle Functions**: `NVL()`, `DECODE()`, `SYSDATE`, `ROUND()`, `TRUNC()`, `UPPER()`, `LOWER()`, `INITCAP()`, `COUNT()`, `SUM()`, `AVG()`, `MIN()`, `MAX()`, and concatenation `||`.
* **Oracle `ORA-` Errors**: Accurately simulates `ORA-00942`, `ORA-00904`, `ORA-00001`, `ORA-01400`, `ORA-01722`, `ORA-00955`, and `ORA-00979`.

### 3. Drag Bug Protection
* Built with Pointer Events (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`) and `setPointerCapture`.
* Immediate `e.buttons === 0` fail-safe guard preventing the window or splitter from ever getting stuck in drag mode.
