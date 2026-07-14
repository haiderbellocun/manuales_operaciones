import { test, expect, request as playwrightRequest } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const serverRequire = createRequire(path.join(projectRoot, 'server/package.json'));
const dotenv = serverRequire('dotenv');
const pg = serverRequire('pg');
const jwt = serverRequire('jsonwebtoken');
const { Storage } = serverRequire('@google-cloud/storage');

dotenv.config({ path: path.join(projectRoot, 'server/.env'), quiet: true });
if (process.env.GOOGLE_APPLICATION_CREDENTIALS && !path.isAbsolute(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(
    projectRoot,
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
  );
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const query = (text, params) => pool.query(text, params);
const SESSION_COOKIE_NAME = 'acervo_session';
const signToken = user => jwt.sign(
  { sub: user.id, email: user.email, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: '4h' },
);
const bucket = new Storage().bucket(process.env.GCS_BUCKET);
const fileStorage = {
  async exists(storedName) {
    const [exists] = await bucket.file(storedName).exists();
    return exists;
  },
  async remove(storedName) {
    await bucket.file(storedName).delete({ ignoreNotFound: true });
  },
};

const apiBase = 'http://127.0.0.1:3100';
const fixtureBuffer = Buffer.concat([
  Buffer.from('%PDF-1.4\n% Acervo Operaciones E2E\n', 'utf8'),
  Buffer.alloc(4096, 0x20),
  Buffer.from('\n%%EOF\n', 'utf8'),
]);

test.describe.serial('Acervo Operaciones - suite integral', () => {
  const runId = `E2E-${Date.now()}`;
  const createdDocIds = [];
  const createdUserIds = [];
  let createdPersonId = null;
  let admin;
  let ownerId;
  let areaId;
  let coordinationAreaId;
  let coordinationId;
  let unrelatedCoordinationId;
  let typeId;
  let api;
  let adminToken;
  let documentId;
  let workflowId;

  async function makeApiFor(user) {
    const token = signToken({ id: user.id, email: user.email, role: user.role_id });
    return playwrightRequest.newContext({
      baseURL: apiBase,
      extraHTTPHeaders: { Cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });
  }

  async function countDocuments(name) {
    const { rows } = await query('SELECT COUNT(*)::int AS n FROM documents WHERE name = $1', [name]);
    return rows[0].n;
  }

  async function expectStatus(response, status) {
    if (response.status() !== status) {
      throw new Error(`Expected ${status}, received ${response.status()}: ${await response.text()}`);
    }
  }

  test.beforeAll(async () => {
    const { rows: adminRows } = await query(`
      SELECT * FROM users
      WHERE role_id = 1 AND status = 'Activo'
      ORDER BY id
      LIMIT 1
    `);
    admin = adminRows[0];
    expect(admin, 'Se requiere un administrador activo para la suite').toBeTruthy();
    adminToken = signToken({ id: admin.id, email: admin.email, role: admin.role_id });
    api = await makeApiFor(admin);

    const { rows: areaRows } = await query(`
      SELECT id FROM areas
      ORDER BY requires_coordination ASC, id
      LIMIT 1
    `);
    areaId = areaRows[0]?.id;
    const { rows: typeRows } = await query("SELECT id FROM document_types WHERE abbreviation = 'ANS' LIMIT 1");
    typeId = typeRows[0]?.id;
    expect(areaId).toBeTruthy();
    expect(typeId).toBeTruthy();

    const { rows: coordinationAreaRows } = await query(`
      SELECT a.id AS area_id, c.id AS coordination_id
      FROM areas a
      JOIN coordinations c ON c.area_id = a.id
      WHERE a.requires_coordination = true
      ORDER BY a.id, c.sort_order, c.id
      LIMIT 1
    `);
    coordinationAreaId = coordinationAreaRows[0]?.area_id || null;
    coordinationId = coordinationAreaRows[0]?.coordination_id || null;
    const { rows: unrelatedCoordinationRows } = await query(`
      SELECT id FROM coordinations
      WHERE area_id <> $1
      ORDER BY id
      LIMIT 1
    `, [areaId]);
    unrelatedCoordinationId = unrelatedCoordinationRows[0]?.id || null;

    const { rows: peopleRows } = await query(
      'SELECT id FROM people WHERE area_id = $1 OR area_id IS NULL ORDER BY id LIMIT 1',
      [areaId],
    );
    if (peopleRows[0]) {
      ownerId = peopleRows[0].id;
    } else {
      const { rows } = await query(`
        INSERT INTO people (name, role_title, area_id)
        VALUES ($1, 'Responsable E2E', $2)
        RETURNING id
      `, [`Responsable ${runId}`, areaId]);
      ownerId = rows[0].id;
      createdPersonId = ownerId;
    }
  });

  test.afterAll(async () => {
    try {
      if (createdDocIds.length) {
        const { rows: files } = await query(`
          SELECT stored_name FROM document_files WHERE doc_id = ANY($1::int[])
          UNION
          SELECT stored_name FROM document_versions
          WHERE doc_id = ANY($1::int[]) AND stored_name IS NOT NULL
        `, [createdDocIds]);
        await Promise.all(files.map(({ stored_name: storedName }) => (
          fileStorage.remove(storedName).catch(() => {})
        )));

        await query('DELETE FROM notifications WHERE doc_id = ANY($1::int[])', [createdDocIds]);
        await query('DELETE FROM activity_log WHERE doc_id = ANY($1::int[])', [createdDocIds]);
        await query('DELETE FROM update_requests WHERE doc_id = ANY($1::int[])', [createdDocIds]);
        await query('DELETE FROM documents WHERE id = ANY($1::int[])', [createdDocIds]);
      }
      if (createdUserIds.length) {
        await query('DELETE FROM notifications WHERE user_id = ANY($1::int[])', [createdUserIds]);
        await query('DELETE FROM users WHERE id = ANY($1::int[])', [createdUserIds]);
      }
      if (createdPersonId) await query('DELETE FROM people WHERE id = $1', [createdPersonId]);
    } finally {
      await api?.dispose();
      await pool.end();
    }
  });

  test('health, sesión y catálogos institucionales', async () => {
    const publicApi = await playwrightRequest.newContext({ baseURL: apiBase });
    const health = await publicApi.get('/api/health');
    expect(health.status()).toBe(200);
    expect((await health.json()).status).toBe('ok');
    await publicApi.dispose();

    const session = await api.get('/api/auth/session');
    expect(session.status()).toBe(200);
    expect((await session.json()).user.email).toBe(admin.email);

    for (const endpoint of ['/areas', '/coordinations', '/types', '/people', '/assignees', '/stats', '/reports/summary']) {
      const response = await api.get(`/api${endpoint}`);
      expect(response.status(), endpoint).toBe(200);
    }
  });

  test('bloquea sesiones invalidas, usuarios inactivos y escrituras CORS no permitidas', async () => {
    const publicApi = await playwrightRequest.newContext({ baseURL: apiBase });
    expect((await publicApi.get('/api/documents')).status()).toBe(401);
    await publicApi.dispose();

    const invalidApi = await playwrightRequest.newContext({
      baseURL: apiBase,
      extraHTTPHeaders: { Cookie: `${SESSION_COOKIE_NAME}=token-invalido` },
    });
    expect((await invalidApi.get('/api/auth/session')).status()).toBe(401);
    await invalidApi.dispose();

    const externalToken = jwt.sign(
      { sub: 99999999, email: 'externo@gmail.com', role: 1 },
      process.env.JWT_SECRET,
      { expiresIn: '5m' },
    );
    const externalApi = await playwrightRequest.newContext({
      baseURL: apiBase,
      extraHTTPHeaders: { Cookie: `${SESSION_COOKIE_NAME}=${externalToken}` },
    });
    expect((await externalApi.get('/api/auth/session')).status()).toBe(401);
    await externalApi.dispose();

    const suffix = Date.now();
    const { rows } = await query(`
      INSERT INTO users (name, email, role_id, status)
      VALUES ($1, $2, 6, 'Inactivo')
      RETURNING *
    `, [`Inactivo ${runId}`, `inactivo.e2e.${suffix}@cun.edu.co`]);
    createdUserIds.push(rows[0].id);
    const inactiveApi = await makeApiFor(rows[0]);
    expect((await inactiveApi.get('/api/documents')).status()).toBe(403);
    await inactiveApi.dispose();

    const corsResponse = await api.post('/api/auth/logout', {
      headers: { Origin: 'http://evil.example' },
    });
    expect(corsResponse.status()).toBe(403);
  });

  test('no crea registros cuando faltan datos, el formato es invalido o la coordinacion no cumple reglas', async () => {
    const missingName = `${runId}-SIN-ARCHIVO`;
    const missing = await api.post('/api/documents', {
      multipart: {
        type: String(typeId), area: String(areaId), name: missingName,
        owner: String(ownerId), version: '1.0', revisor: String(admin.id), aprobador: String(admin.id),
      },
    });
    await expectStatus(missing, 400);
    expect(await countDocuments(missingName)).toBe(0);

    const invalidName = `${runId}-FORMATO-INVALIDO`;
    const invalid = await api.post('/api/documents', {
      multipart: {
        type: String(typeId), area: String(areaId), name: invalidName,
        owner: String(ownerId), version: '1.0', revisor: String(admin.id), aprobador: String(admin.id),
        file: { name: 'archivo.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('invalid') },
      },
    });
    await expectStatus(invalid, 400);
    expect(await countDocuments(invalidName)).toBe(0);

    const missingDataName = `${runId}-SIN-DATOS`;
    const missingData = await api.post('/api/documents', {
      multipart: {
        type: String(typeId), area: String(areaId), name: missingDataName,
        version: '1.0', revisor: String(admin.id), aprobador: String(admin.id),
        file: { name: 'sin-responsable.pdf', mimeType: 'application/pdf', buffer: fixtureBuffer },
      },
    });
    await expectStatus(missingData, 400);
    expect(await countDocuments(missingDataName)).toBe(0);

    if (coordinationAreaId) {
      const missingCoordinationName = `${runId}-SIN-COORDINACION`;
      const missingCoordination = await api.post('/api/documents', {
        multipart: {
          type: String(typeId), area: String(coordinationAreaId), name: missingCoordinationName,
          owner: String(ownerId), version: '1.0', revisor: String(admin.id), aprobador: String(admin.id),
          file: { name: 'sin-coordinacion.pdf', mimeType: 'application/pdf', buffer: fixtureBuffer },
        },
      });
      await expectStatus(missingCoordination, 400);
      expect(await countDocuments(missingCoordinationName)).toBe(0);
    }

    if (unrelatedCoordinationId) {
      const wrongCoordinationName = `${runId}-COORDINACION-INVALIDA`;
      const wrongCoordination = await api.post('/api/documents', {
        multipart: {
          type: String(typeId), area: String(areaId), coordination: String(unrelatedCoordinationId),
          name: wrongCoordinationName, owner: String(ownerId), version: '1.0',
          revisor: String(admin.id), aprobador: String(admin.id),
          file: { name: 'coordinacion-invalida.pdf', mimeType: 'application/pdf', buffer: fixtureBuffer },
        },
      });
      await expectStatus(wrongCoordination, 400);
      expect(await countDocuments(wrongCoordinationName)).toBe(0);
    }
  });

  test('impide creacion documental a roles sin permiso de crear', async () => {
    const suffix = Date.now();
    const { rows } = await query(`
      INSERT INTO users (name, email, role_id, status)
      VALUES ($1, $2, 6, 'Activo')
      RETURNING *
    `, [`Consultor sin crear ${runId}`, `consultor.sin.crear.e2e.${suffix}@cun.edu.co`]);
    createdUserIds.push(rows[0].id);
    const consultantApi = await makeApiFor(rows[0]);
    const deniedName = `${runId}-CONSULTOR-CREA`;
    const denied = await consultantApi.post('/api/documents', {
      multipart: {
        type: String(typeId), area: String(areaId), name: deniedName,
        owner: String(ownerId), version: '1.0', revisor: String(admin.id), aprobador: String(admin.id),
        file: { name: 'consultor.pdf', mimeType: 'application/pdf', buffer: fixtureBuffer },
      },
    });
    expect(denied.status()).toBe(403);
    expect(await countDocuments(deniedName)).toBe(0);
    await consultantApi.dispose();
  });

  test('crea documento cuando un area exige coordinacion y se envia una valida', async () => {
    test.skip(!coordinationAreaId || !coordinationId, 'No hay area con coordinaciones para validar este escenario.');

    const coordinatedName = `${runId}-CON-COORDINACION`;
    const response = await api.post('/api/documents', {
      multipart: {
        type: String(typeId), area: String(coordinationAreaId), coordination: String(coordinationId),
        name: coordinatedName, owner: String(ownerId), version: '1.0',
        revisor: String(admin.id), aprobador: String(admin.id),
        file: { name: 'con-coordinacion.pdf', mimeType: 'application/pdf', buffer: fixtureBuffer },
      },
    });
    await expectStatus(response, 201);
    const document = await response.json();
    createdDocIds.push(Number(document.id));
    const { rows } = await query('SELECT coordination_id FROM documents WHERE id = $1', [document.id]);
    expect(Number(rows[0].coordination_id)).toBe(Number(coordinationId));
  });

  test('crea documento y archivo de forma atómica en PostgreSQL y Cloud Storage', async () => {
    const response = await api.post('/api/documents', {
      multipart: {
        type: String(typeId), area: String(areaId), name: `${runId}-ANS-ACERVO`,
        owner: String(ownerId), version: '1.0', versionNote: 'Versión inicial E2E',
        desc: 'Documento temporal generado por la suite E2E', tags: 'e2e,automatizado',
        revisor: String(admin.id), aprobador: String(admin.id),
        file: { name: 'ANS-ACV-001-E2E.pdf', mimeType: 'application/pdf', buffer: fixtureBuffer },
      },
    });
    expect(response.status()).toBe(201);
    const document = await response.json();
    documentId = Number(document.id);
    createdDocIds.push(documentId);
    expect(document.name).toContain(runId);

    const { rows } = await query('SELECT * FROM document_files WHERE doc_id = $1', [documentId]);
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].file_size)).toBeGreaterThan(0);
    expect(await fileStorage.exists(rows[0].stored_name)).toBeTruthy();

    const { rows: historyRows } = await query('SELECT COUNT(*)::int AS n FROM document_history WHERE doc_id = $1', [documentId]);
    const { rows: workflowRows } = await query('SELECT COUNT(*)::int AS n FROM workflow_items WHERE doc_id = $1', [documentId]);
    const { rows: activityRows } = await query('SELECT COUNT(*)::int AS n FROM activity_log WHERE doc_id = $1', [documentId]);
    expect(historyRows[0].n).toBeGreaterThan(0);
    expect(workflowRows[0].n).toBe(1);
    expect(activityRows[0].n).toBeGreaterThan(0);
  });

  test('responde correctamente ante documentos y acciones inexistentes', async () => {
    const missingId = 2147483000;
    expect((await api.get(`/api/documents/${missingId}`)).status()).toBe(404);
    expect((await api.get(`/api/documents/${missingId}/file/meta`)).status()).toBe(404);
    expect((await api.get(`/api/documents/${missingId}/file`)).status()).toBe(404);
    expect((await api.post(`/api/workflow/${missingId}/transition`, {
      data: { action: 'approve', comments: 'No existe' },
    })).status()).toBe(404);
  });

  test('consulta, descarga, favoritos, vistas, edición y solicitud de actualización', async () => {
    const detail = await api.get(`/api/documents/${documentId}`);
    expect(detail.status()).toBe(200);
    const meta = await api.get(`/api/documents/${documentId}/file/meta`);
    expect(meta.status()).toBe(200);
    const download = await api.get(`/api/documents/${documentId}/file`);
    expect(download.status()).toBe(200);
    expect((await download.body()).length).toBeGreaterThan(1000);

    expect((await api.post(`/api/documents/${documentId}/favorite`)).status()).toBe(200);
    expect((await api.post(`/api/documents/${documentId}/favorite`)).status()).toBe(200);
    expect((await api.post(`/api/documents/${documentId}/view`)).status()).toBe(200);
    expect((await api.put(`/api/documents/${documentId}`, { data: { desc: 'Actualizado por E2E' } })).status()).toBe(200);
    expect((await api.post(`/api/documents/${documentId}/update-request`, {
      data: { reason: 'Prueba E2E', detail: 'Validación automática de solicitudes' },
    })).status()).toBe(200);
  });

  test('recorre revisión, aprobación y publicación', async () => {
    const workflow = await api.get('/api/workflow');
    expect(workflow.status()).toBe(200);
    const item = (await workflow.json()).find(entry => Number(entry.docId) === documentId);
    expect(item).toBeTruthy();
    workflowId = Number(item.id);

    const invalidStage = await api.post(`/api/workflow/${workflowId}/transition`, {
      data: { action: 'publish', comments: 'Intento fuera de etapa' },
    });
    expect(invalidStage.status()).toBe(403);

    const approve = await api.post(`/api/workflow/${workflowId}/transition`, {
      data: { action: 'approve', comments: 'Revisión E2E aprobada' },
    });
    expect(approve.status()).toBe(200);
    expect((await approve.json()).status).toBe('approved_for_publication');

    const publish = await api.post(`/api/workflow/${workflowId}/transition`, {
      data: { action: 'publish', comments: 'Publicación E2E' },
    });
    expect(publish.status()).toBe(200);
    expect((await publish.json()).status).toBe('published');

    const detail = await api.get(`/api/documents/${documentId}`);
    expect((await detail.json()).state).toBe('publicado');
  });

  test('aplica permisos de descarga y administración por rol', async () => {
    const suffix = Date.now();
    const { rows } = await query(`
      INSERT INTO users (name, email, role_id, status)
      VALUES
        ($1, $2, 6, 'Activo'),
        ($3, $4, 7, 'Activo')
      RETURNING *
    `, [
      `Consultor ${runId}`, `consultor.e2e.${suffix}@cun.edu.co`,
      `Auditor ${runId}`, `auditor.e2e.${suffix}@cun.edu.co`,
    ]);
    createdUserIds.push(...rows.map(user => user.id));
    const consultant = rows.find(user => Number(user.role_id) === 6);
    const auditor = rows.find(user => Number(user.role_id) === 7);
    const consultantApi = await makeApiFor(consultant);
    const auditorApi = await makeApiFor(auditor);

    expect((await consultantApi.get(`/api/documents/${documentId}/file`)).status()).toBe(200);
    expect((await auditorApi.get(`/api/documents/${documentId}/file`)).status()).toBe(403);
    expect((await auditorApi.get(`/api/documents/${documentId}`)).status()).toBe(200);
    expect((await auditorApi.get('/api/users')).status()).toBe(403);
    expect((await api.get('/api/users')).status()).toBe(200);

    await consultantApi.dispose();
    await auditorApi.dispose();
  });

  test('crea y descarga una nueva versión', async () => {
    const missingFile = await api.post(`/api/documents/${documentId}/versions`, {
      multipart: { version: '1.0', note: 'Sin archivo' },
    });
    await expectStatus(missingFile, 400);

    const invalidFile = await api.post(`/api/documents/${documentId}/versions`, {
      multipart: {
        version: '1.0',
        note: 'Formato invalido',
        file: { name: 'version.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('invalid') },
      },
    });
    await expectStatus(invalidFile, 400);

    const response = await api.post(`/api/documents/${documentId}/versions`, {
      multipart: {
        version: '1.1', note: 'Versión automatizada E2E',
        file: { name: 'ANS-ACV-001-v1.1.pdf', mimeType: 'application/pdf', buffer: fixtureBuffer },
      },
    });
    expect(response.status()).toBe(201);
    const updated = await response.json();
    const version = updated.versions.find(item => item.version === '1.1');
    expect(version).toBeTruthy();
    expect((await api.get(`/api/documents/${documentId}/versions/${version.id}/file`)).status()).toBe(200);
  });

  test('módulos, actividad, reportes y notificaciones responden', async () => {
    for (const endpoint of ['/modules/ans', '/modules/cargos', '/modules/apps', '/activity', '/notifications']) {
      const response = await api.get(`/api${endpoint}`);
      expect(response.status(), endpoint).toBe(200);
    }
    const notifications = await api.get('/api/notifications');
    const payload = await notifications.json();
    expect(Array.isArray(payload.items)).toBeTruthy();
    expect((await api.post('/api/notifications/read-all')).status()).toBe(204);
  });

  test('navegación principal funciona en Chrome', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addCookies([{
      name: SESSION_COOKIE_NAME,
      value: adminToken,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Strict',
    }]);
    const page = await context.newPage();

    await page.goto('/');
    await expect(page.getByText('Acervo', { exact: true })).toBeVisible();
    await expect(page.getByText(/Buenos días|Buenos tardes|Buenos noches/)).toBeVisible();

    await page.goto('/biblioteca');
    await expect(page.getByRole('heading', { name: 'Biblioteca documental' })).toBeVisible();
    await page.goto('/gestion/cargar');
    await expect(page.getByRole('heading', { name: 'Cargar nuevo documento' })).toBeVisible();
    await page.goto('/gestion/usuarios');
    await expect(page.getByRole('heading', { name: 'Administración de usuarios y roles' })).toBeVisible();
    await page.goto('/reportes');
    await expect(page.getByRole('heading', { name: 'Reportes e indicadores de gestión' })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/biblioteca');
    await expect(page.getByRole('heading', { name: 'Biblioteca documental' })).toBeVisible();
    await context.close();
  });
});
