/* eslint-disable no-console */
import 'dotenv/config';

async function main() {
  try {
    const { NewsCuratorService } = await import('../src/news/newsCuratorService');
    const curator = NewsCuratorService.getInstance();
    await curator.analyzeAndCurateNews();
    console.log(JSON.stringify({ status: 'ok' }));
  } catch (e: any) {
    console.error('ERROR_RUNTIME', e?.message || String(e));
    process.exit(1);
  }
}

main();


