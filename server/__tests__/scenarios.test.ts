import { runScenarios, SCENARIOS } from '../scenarios';
import { testApp } from './helpers';

describe('sandbox scenarios', () => {
  it('every scenario reaches its expected outcome and the audit chain verifies', async () => {
    const { app, ctx } = testApp();
    const results = await runScenarios(ctx);
    for (const r of results)
      expect({ name: r.name, ok: r.ok, final: r.finalStatus, error: r.error, steps: r.steps }).toMatchObject({ name: r.name, ok: true });
    expect(results).toHaveLength(SCENARIOS.length + 1);
    await app.close();
  });
});
