import type { Config } from 'jest';

import base from './jest.config.ts';

// Pruebas contra el Postgres real (`npm run test:db`). Aparte de `npm test`
// para que este no dependa de Docker. Ver docs/05 y docs/07 seccion 13.
const config: Config = {
  ...base,
  testRegex: '.*\\.db-spec\\.ts$',
  globalSetup: '<rootDir>/test/db/preparar-base.ts',
};

export default config;
