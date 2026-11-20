/**
 * File utility helpers for Oracle SQL Developer Web Studio
 * Supports Export (Download SQL / CSV) and Import (File Picker)
 */

export function downloadFile(filename, content, mimeType = 'text/plain;charset=utf-8') {
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 200);
    return true;
  } catch (err) {
    console.error('Failed to trigger file download', err);
    return false;
  }
}

export function openSqlFileDialog(onFileSelected) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.sql,.txt,.csv';
  input.style.display = 'none';

  input.onchange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result || '';
      onFileSelected({
        name: file.name,
        size: file.size,
        type: file.type || (file.name.endsWith('.csv') ? 'text/csv' : 'text/sql'),
        content: String(content)
      });
    };
    reader.onerror = (err) => {
      console.error('Failed to read file', err);
      alert('Could not read the selected file: ' + (err.message || String(err)));
    };
    reader.readAsText(file);
  };

  document.body.appendChild(input);
  input.click();
  setTimeout(() => document.body.removeChild(input), 1000);
}
