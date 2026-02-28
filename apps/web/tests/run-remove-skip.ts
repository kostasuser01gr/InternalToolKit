
import { removeTestSkip } from './remove-skip';

async function run() {
  await removeTestSkip('./tests/smoke.spec.ts');
  await removeTestSkip('./tests/modules.spec.ts');
}

run();
