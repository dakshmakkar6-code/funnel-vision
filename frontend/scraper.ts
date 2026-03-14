import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve paths relative to this file (ESM-safe)
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// python_scraper lives one level up from frontend/
const PYTHON_EXE = path.resolve(__dirname, '../python_scraper/.venv/Scripts/python.exe');
const SCRAPER_SCRIPT = path.resolve(__dirname, '../python_scraper/scraper_web.py');

export async function scrapePage(url: string) {
  console.log(`[scraper] Spawning: ${PYTHON_EXE} ${SCRAPER_SCRIPT} "${url}"`);
  
  return new Promise((resolve, reject) => {
    const pyProcess = spawn(PYTHON_EXE, [SCRAPER_SCRIPT, url]);
    let stdout = '';
    let stderr = '';

    pyProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pyProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pyProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`[scraper] Python exited with code ${code}`);
        console.error(`[scraper] Stderr: ${stderr}`);
        return reject(new Error(stderr || `Python script exited with code ${code}`));
      }

      try {
        // Find JSON in the stdout (handles potential noise)
        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No valid JSON found in scraper output');
        }
        const data = JSON.parse(jsonMatch[0]);
        resolve(data);
      } catch (err: any) {
        console.error('[scraper] Output Parser error:', err.message);
        console.error('[scraper] Raw stdout:', stdout);
        reject(new Error(`Failed to parse scraper data: ${err.message}`));
      }
    });
  });
}
