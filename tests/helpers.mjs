import { chromium } from 'playwright';

export const BASE = 'http://localhost:3777';

export function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT FAIL: ' + msg);
}

export async function launch(opts = {}) {
  const browser = await chromium.launch({
    channel: 'msedge',
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
      .concat(opts.args || [])
  });
  const ctx = await browser.newContext({ permissions: ['camera'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 150)));
  return { browser, page, errors };
}
