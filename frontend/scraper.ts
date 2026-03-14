import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = util.promisify(exec);

// Resolve paths relative to this file (ESM-safe)
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// python_scraper lives one level up from frontend/
const PYTHON_EXE = path.resolve(__dirname, '../python_scraper/.venv/Scripts/python.exe');
const SCRAPER_SCRIPT = path.resolve(__dirname, '../python_scraper/scraper_web.py');

export async function scrapePage(url: string) {
  console.log(`[scraper] Running: ${PYTHON_EXE} ${SCRAPER_SCRIPT} "${url}"`);

  try {
    const { stdout, stderr } = await execAsync(
      `"${PYTHON_EXE}" "${SCRAPER_SCRIPT}" "${url}"`,
      { timeout: 90_000 }  // 90-second hard limit
    );

    if (stderr) {
      // Playwright logs to stderr – only warn, don't throw
      console.warn('[scraper] Python stderr (non-fatal):', stderr.substring(0, 500));
    }

    const trimmed = stdout.trim();
    if (!trimmed) {
      throw new Error('Python scraper produced no output. Check that the URL is reachable.');
    }

    const result = JSON.parse(trimmed);

    if (result.error) {
      throw new Error(`Python scraper error: ${result.error}`);
    }

    return result;
  } catch (error: any) {
    console.error('[scraper] Failed:', error?.message ?? error);
    throw error;
  }
}
