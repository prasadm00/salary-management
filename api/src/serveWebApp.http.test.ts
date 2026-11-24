import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { unusedServices } from './tests/stubs.js';

describe('serving the web app from the API', () => {
  let webDir: string;
  const dependencies = { ...unusedServices, checkDatabase: () => Promise.resolve(true) };

  beforeAll(() => {
    webDir = mkdtempSync(join(tmpdir(), 'web-dist-'));
    mkdirSync(join(webDir, 'assets'));
    writeFileSync(join(webDir, 'index.html'), '<!doctype html><title>Salary app</title>');
    writeFileSync(join(webDir, 'assets', 'app.js'), 'console.warn("app")');
  });

  afterAll(() => {
    rmSync(webDir, { recursive: true, force: true });
  });

  it('serves the home page', async () => {
    const response = await request(createApp({ ...dependencies, webDir })).get('/');

    expect(response.status).toBe(200);
    expect(response.text).toContain('Salary app');
  });

  it('serves the web app for page addresses that only the browser app knows', async () => {
    const response = await request(createApp({ ...dependencies, webDir })).get('/employees/5');

    expect(response.status).toBe(200);
    expect(response.text).toContain('Salary app');
  });

  it('serves script and style files', async () => {
    const response = await request(createApp({ ...dependencies, webDir })).get('/assets/app.js');

    expect(response.status).toBe(200);
    expect(response.type).toContain('javascript');
  });

  it('still answers unknown /api paths with the JSON "not found", not the web page', async () => {
    const response = await request(createApp({ ...dependencies, webDir })).get('/api/nothing-here');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });

  it('does not answer other methods with the web page', async () => {
    const response = await request(createApp({ ...dependencies, webDir })).post('/employees');

    expect(response.status).toBe(404);
    expect(response.text).not.toContain('Salary app');
  });

  it('serves nothing extra when no web folder is given (development and tests)', async () => {
    const response = await request(createApp(dependencies)).get('/');

    expect(response.status).toBe(404);
  });
});
