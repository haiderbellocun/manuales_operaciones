import { test, expect, request as playwrightRequest } from '@playwright/test';
import fs from 'fs';
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
const localStorageRoot = path.resolve(projectRoot, 'test-results', 'file-storage');
const useLocalStorage = process.env.FILE_STORAGE_MODE !== 'gcs';
const bucket = useLocalStorage ? null : new Storage().bucket(process.env.GCS_BUCKET);
const localObjectPath = storedName => path.resolve(
  localStorageRoot,
  ...String(storedName || '').split('/').filter(Boolean),
);
const fileStorage = {
  async exists(storedName) {
    if (useLocalStorage) return fs.existsSync(localObjectPath(storedName));
    const [exists] = await bucket.file(storedName).exists();
    return exists;
  },
  async remove(storedName) {
    if (useLocalStorage) {
      await fs.promises.rm(localObjectPath(storedName), { force: true });
      return;
    }
    await bucket.file(storedName).delete({ ignoreNotFound: true });
  },
};

const apiBase = 'http://127.0.0.1:3100';
const OPERATION_ACADEMIC_AREA_ID = 1;
const fixtureBuffer = Buffer.concat([
  Buffer.from('%PDF-1.4\n% Acervo Operaciones E2E\n', 'utf8'),
  Buffer.alloc(4096, 0x20),
  Buffer.from('\n%%EOF\n', 'utf8'),
]);
const infographicFixtureBuffer = fs.readFileSync(
  path.join(projectRoot, 'tests', 'fixtures', 'document-infographic-sample.png'),
);
const MAX_DOCUMENT_FILE_SIZE = 25 * 1024 * 1024;
const MAX_INFOGRAPHIC_FILE_SIZE = 10 * 1024 * 1024;
const infographicPart = (name = 'infografia-acervo.png') => ({
  name,
  mimeType: 'image/png',
  buffer: infographicFixtureBuffer,
});
const escapeRegExp = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const expectDocumentStoragePath = (storedName, docId, version, { infographic = false } = {}) => {
  const folder = infographic ? 'infographics/' : '';
  expect(storedName).toMatch(new RegExp(
    `^documents/${Number(docId)}/${folder}[^/]+_v${escapeRegExp(version)}_\\d{8}T\\d{9}Z\\.[a-z0-9]+$`,
  ));
  expect(storedName).not.toContain('pending-');
};

test.describe.serial('Acervo Operaciones - suite integral', () => {
  const runId = `E2E-${Date.now()}`;
  const createdDocIds = [];
  const createdUserIds = [];
  let createdPersonId = null;
  let admin;
  let leader;
  let reviewer;
  let approver;
  let coordinationReviewer;
  let coordinationApprover;
  let consultant;
  let auditor;
  let ownerId;
  let areaId;
  let coordinationAreaId;
  let coordinationId;
  let secondCoordinationId;
  let unrelatedCoordinationId;
  let typeId;
  let api;
  let leaderApi;
  let reviewerApi;
  let approverApi;
  let consultantApi;
  let auditorApi;
  let analyticsReaderApi;
  let adminToken;
  let auditorToken;
  let documentId;
  let publishedDocumentId;
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

    const identitySuffix = Date.now();
    const { rows: workflowUsers } = await query(`
      INSERT INTO users (name, email, role_id, status)
      VALUES
        ($1, $2, 4, 'Activo'),
        ($3, $4, 5, 'Activo'),
        ($5, $6, 2, 'Activo'),
        ($7, $8, 6, 'Activo')
      RETURNING *
    `, [
      `Revisor ${runId}`, `revisor.e2e.${identitySuffix}@cun.edu.co`,
      `Aprobador ${runId}`, `aprobador.e2e.${identitySuffix}@cun.edu.co`,
      `Lider ${runId}`, `lider.e2e.${identitySuffix}@cun.edu.co`,
      `Consultor flujo ${runId}`, `consultor.flujo.e2e.${identitySuffix}@cun.edu.co`,
    ]);
    createdUserIds.push(...workflowUsers.map(user => user.id));
    reviewer = workflowUsers.find(user => Number(user.role_id) === 4);
    approver = workflowUsers.find(user => Number(user.role_id) === 5);
    leader = workflowUsers.find(user => Number(user.role_id) === 2);
    consultant = workflowUsers.find(user => Number(user.role_id) === 6);
    leaderApi = await makeApiFor(leader);
    reviewerApi = await makeApiFor(reviewer);
    approverApi = await makeApiFor(approver);
    consultantApi = await makeApiFor(consultant);

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
    await query(
      'UPDATE users SET area_id = $1 WHERE id = ANY($2::int[])',
      [areaId, [leader.id, reviewer.id, approver.id]],
    );
    leader.area_id = areaId;
    reviewer.area_id = areaId;
    approver.area_id = areaId;

    if (coordinationAreaId && Number(coordinationAreaId) !== Number(areaId)) {
      const { rows: coordinationWorkflowUsers } = await query(`
        INSERT INTO users (name, email, role_id, area_id, status)
        VALUES
          ($1, $2, 4, $3, 'Activo'),
          ($4, $5, 5, $3, 'Activo')
        RETURNING *
      `, [
        `Revisor coordinacion ${runId}`,
        `revisor.coordinacion.e2e.${identitySuffix}@cun.edu.co`,
        coordinationAreaId,
        `Aprobador coordinacion ${runId}`,
        `aprobador.coordinacion.e2e.${identitySuffix}@cun.edu.co`,
      ]);
      createdUserIds.push(...coordinationWorkflowUsers.map(user => user.id));
      coordinationReviewer = coordinationWorkflowUsers.find(user => Number(user.role_id) === 4);
      coordinationApprover = coordinationWorkflowUsers.find(user => Number(user.role_id) === 5);
    } else {
      coordinationReviewer = reviewer;
      coordinationApprover = approver;
    }
    const { rows: secondCoordinationRows } = await query(`
      SELECT id
      FROM coordinations
      WHERE area_id = $1 AND id <> $2
      ORDER BY sort_order, id
      LIMIT 1
    `, [coordinationAreaId, coordinationId]);
    secondCoordinationId = secondCoordinationRows[0]?.id || null;
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
          SELECT stored_name FROM document_infographics WHERE doc_id = ANY($1::int[])
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
        await query(`
          DELETE FROM people p
          USING users u
          WHERE u.id = ANY($1::int[])
            AND LOWER(p.name) = LOWER(u.name)
        `, [createdUserIds]);
        await query('DELETE FROM users WHERE id = ANY($1::int[])', [createdUserIds]);
      }
      if (createdPersonId) await query('DELETE FROM people WHERE id = $1', [createdPersonId]);
    } finally {
      await leaderApi?.dispose();
      await reviewerApi?.dispose();
      await approverApi?.dispose();
      await consultantApi?.dispose();
      await auditorApi?.dispose();
      await analyticsReaderApi?.dispose();
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

    for (const endpoint of ['/areas', '/coordinations', '/types', '/people', '/assignees', '/stats', '/map/counts', '/reports/summary', '/reports/analytics?period=30']) {
      const response = await api.get(`/api${endpoint}`);
      expect(response.status(), endpoint).toBe(200);
    }

    const areaAssigneesResponse = await api.get(`/api/assignees?areaId=${areaId}`);
    await expectStatus(areaAssigneesResponse, 200);
    const areaAssignees = await areaAssigneesResponse.json();
    expect(areaAssignees).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: leader.id,
        role: 2,
        roleName: 'Lider de area',
        area: areaId,
        status: 'Activo',
      }),
      expect.objectContaining({ id: reviewer.id, role: 4, area: areaId, status: 'Activo' }),
      expect.objectContaining({ id: approver.id, role: 5, area: areaId, status: 'Activo' }),
    ]));
    expect(areaAssignees.every(user => (
      user.status === 'Activo'
      && [2, 4, 5, 8].includes(Number(user.role))
      && Number(user.area) === Number(areaId)
    ))).toBe(true);
    expect(areaAssignees.some(user => Number(user.id) === Number(consultant.id))).toBe(false);
  });

  test('verifica la estructura persistente de analítica e infografías', async () => {
    const { rows: documentColumns } = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'documents'
        AND column_name IN ('downloads', 'last_viewed_at', 'last_downloaded_at')
      ORDER BY column_name
    `);
    expect(documentColumns.map(column => column.column_name).sort()).toEqual([
      'downloads',
      'last_downloaded_at',
      'last_viewed_at',
    ]);
    expect(documentColumns.find(column => column.column_name === 'downloads')).toEqual(
      expect.objectContaining({ data_type: 'integer', is_nullable: 'NO' }),
    );

    const { rows: interactionColumns } = await query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'document_interactions'
    `);
    expect(interactionColumns.map(column => column.column_name)).toEqual(expect.arrayContaining([
      'doc_id', 'user_id', 'interaction_type', 'document_version', 'source', 'metadata', 'occurred_at',
    ]));

    const { rows: infographicColumns } = await query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'document_infographics'
    `);
    expect(infographicColumns.map(column => column.column_name)).toEqual(expect.arrayContaining([
      'doc_id', 'original_name', 'stored_name', 'mime_type', 'file_size',
      'document_version', 'uploaded_at', 'uploaded_by',
    ]));

    const { rows: analyticsIndexes } = await query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('document_interactions', 'document_infographics')
    `);
    expect(analyticsIndexes.map(index => index.indexname)).toEqual(expect.arrayContaining([
      'idx_document_interactions_doc_type_date',
      'idx_document_interactions_type_date',
      'idx_document_interactions_user_date',
      'idx_document_interactions_date',
      'idx_document_infographics_uploaded_at',
    ]));
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
        owner: String(ownerId), version: '1.0', revisor: String(reviewer.id), aprobador: String(approver.id),
        infographic: infographicPart(),
      },
    });
    await expectStatus(missing, 400);
    expect(await countDocuments(missingName)).toBe(0);

    const missingInfographicName = `${runId}-SIN-INFOGRAFIA`;
    const missingInfographic = await api.post('/api/documents', {
      multipart: {
        type: String(typeId), area: String(areaId), name: missingInfographicName,
        version: '1.0', revisor: String(reviewer.id), aprobador: String(approver.id),
        file: { name: 'sin-infografia.pdf', mimeType: 'application/pdf', buffer: fixtureBuffer },
      },
    });
    await expectStatus(missingInfographic, 400);
    expect(await countDocuments(missingInfographicName)).toBe(0);

    const invalidInfographicName = `${runId}-INFOGRAFIA-INVALIDA`;
    const invalidInfographic = await api.post('/api/documents', {
      multipart: {
        type: String(typeId), area: String(areaId), name: invalidInfographicName,
        version: '1.0', revisor: String(reviewer.id), aprobador: String(approver.id),
        file: { name: 'infografia-invalida.pdf', mimeType: 'application/pdf', buffer: fixtureBuffer },
        infographic: { name: 'infografia.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') },
      },
    });
    await expectStatus(invalidInfographic, 400);
    expect(await countDocuments(invalidInfographicName)).toBe(0);

    const oversizedInfographicName = `${runId}-INFOGRAFIA-MUY-GRANDE`;
    const oversizedInfographic = await api.post('/api/documents', {
      multipart: {
        type: String(typeId), area: String(areaId), name: oversizedInfographicName,
        version: '1.0', revisor: String(reviewer.id), aprobador: String(approver.id),
        file: { name: 'documento-valido.pdf', mimeType: 'application/pdf', buffer: fixtureBuffer },
        infographic: {
          name: 'infografia-muy-grande.png',
          mimeType: 'image/png',
          buffer: Buffer.alloc(MAX_INFOGRAPHIC_FILE_SIZE + 1, 0x61),
        },
      },
    });
    await expectStatus(oversizedInfographic, 400);
    expect((await oversizedInfographic.json()).message).toContain('10 MB');
    expect(await countDocuments(oversizedInfographicName)).toBe(0);

    const oversizedDocumentName = `${runId}-ARCHIVO-MUY-GRANDE`;
    const oversizedDocument = await api.post('/api/documents', {
      multipart: {
        type: String(typeId), area: String(areaId), name: oversizedDocumentName,
        version: '1.0', revisor: String(reviewer.id), aprobador: String(approver.id),
        file: {
          name: 'documento-muy-grande.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.alloc(MAX_DOCUMENT_FILE_SIZE + 1, 0x20),
        },
        infographic: infographicPart(),
      },
    });
    await expectStatus(oversizedDocument, 400);
    const oversizedDocumentPayload = await oversizedDocument.json();
    expect(oversizedDocumentPayload.code).toBe('LIMIT_FILE_SIZE');
    expect(oversizedDocumentPayload.message).toContain('25 MB');
    expect(await countDocuments(oversizedDocumentName)).toBe(0);

    const longVersionName = `${runId}-VERSION-MUY-LARGA`;
    const longVersion = await api.post('/api/documents', {
      multipart: {
        type: String(typeId), area: String(areaId), name: longVersionName,
        version: '123456789012345678901',
        revisor: String(reviewer.id), aprobador: String(approver.id),
        file: { name: 'version-larga.pdf', mimeType: 'application/pdf', buffer: fixtureBuffer },
        infographic: infographicPart(),
      },
    });
    await expectStatus(longVersion, 400);
    expect((await longVersion.json()).message).toContain('20 caracteres');
    expect(await countDocuments(longVersionName)).toBe(0);

    const invalidName = `${runId}-FORMATO-INVALIDO`;
    const invalid = await api.post('/api/documents', {
      multipart: {
        type: String(typeId), area: String(areaId), name: invalidName,
        owner: String(ownerId), version: '1.0', revisor: String(reviewer.id), aprobador: String(approver.id),
        file: { name: 'archivo.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('invalid') },
        infographic: infographicPart(),
      },
    });
    await expectStatus(invalid, 400);
    expect(await countDocuments(invalidName)).toBe(0);

    const missingDataName = `${runId}-SIN-DATOS`;
    const missingData = await api.post('/api/documents', {
      multipart: {
        type: String(typeId), area: String(areaId), name: missingDataName,
        version: '1.0', revisor: String(reviewer.id),
        file: { name: 'sin-responsable.pdf', mimeType: 'application/pdf', buffer: fixtureBuffer },
        infographic: infographicPart(),
      },
    });
    await expectStatus(missingData, 400);
    expect(await countDocuments(missingDataName)).toBe(0);

    if (unrelatedCoordinationId) {
      const wrongCoordinationName = `${runId}-COORDINACION-INVALIDA`;
      const wrongCoordination = await api.post('/api/documents', {
        multipart: {
          type: String(typeId), area: String(areaId), coordination: String(unrelatedCoordinationId),
          name: wrongCoordinationName, owner: String(ownerId), version: '1.0',
          revisor: String(reviewer.id), aprobador: String(approver.id),
          file: { name: 'coordinacion-invalida.pdf', mimeType: 'application/pdf', buffer: fixtureBuffer },
          infographic: infographicPart(),
        },
      });
      await expectStatus(wrongCoordination, 400);
      expect(await countDocuments(wrongCoordinationName)).toBe(0);
    }

    const invalidAssignmentsName = `${runId}-ROLES-FLUJO-INVALIDOS`;
    const invalidAssignments = await api.post('/api/documents', {
      multipart: {
        type: String(typeId),
        area: String(areaId),
        name: invalidAssignmentsName,
        owner: String(ownerId),
        version: '1.0',
        initialState: 'borrador',
        revisor: String(admin.id),
        aprobador: String(admin.id),
        file: { name: 'roles-invalidos.pdf', mimeType: 'application/pdf', buffer: fixtureBuffer },
        infographic: infographicPart(),
      },
    });
    await expectStatus(invalidAssignments, 400);
    expect(await countDocuments(invalidAssignmentsName)).toBe(0);

    if (coordinationAreaId && Number(coordinationAreaId) !== Number(areaId)) {
      const wrongAreaAssignmentsName = `${runId}-FLUJO-OTRA-AREA`;
      const wrongAreaAssignments = await api.post('/api/documents', {
        multipart: {
          type: String(typeId),
          area: String(areaId),
          name: wrongAreaAssignmentsName,
          version: '1.0',
          revisor: String(coordinationReviewer.id),
          aprobador: String(coordinationApprover.id),
          file: { name: 'flujo-otra-area.pdf', mimeType: 'application/pdf', buffer: fixtureBuffer },
          infographic: infographicPart(),
        },
      });
      await expectStatus(wrongAreaAssignments, 400);
      expect(await countDocuments(wrongAreaAssignmentsName)).toBe(0);
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
        owner: String(ownerId), version: '1.0', revisor: String(reviewer.id), aprobador: String(approver.id),
        file: { name: 'consultor.pdf', mimeType: 'application/pdf', buffer: fixtureBuffer },
        infographic: infographicPart(),
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
        revisor: String(coordinationReviewer.id), aprobador: String(coordinationApprover.id),
        file: { name: 'con-coordinacion.pdf', mimeType: 'application/pdf', buffer: fixtureBuffer },
        infographic: infographicPart(),
      },
    });
    await expectStatus(response, 201);
    const document = await response.json();
    createdDocIds.push(Number(document.id));
    const { rows } = await query('SELECT coordination_id FROM documents WHERE id = $1', [document.id]);
    expect(Number(rows[0].coordination_id)).toBe(Number(coordinationId));

    const filtered = await api.get(`/api/documents?area=${coordinationAreaId}&coordination=${coordinationId}`);
    await expectStatus(filtered, 200);
    const payload = await filtered.json();
    expect(payload.data.some(item => Number(item.id) === Number(document.id))).toBeTruthy();
    expect(payload.data.every(item => (
      !item.coordination || Number(item.coordination) === Number(coordinationId)
    ))).toBeTruthy();
  });

  test('comparte la lectura de Operacion Academica y conserva la escritura por subcoordinacion', async () => {
    test.skip(
      Number(coordinationAreaId) !== OPERATION_ACADEMIC_AREA_ID
        || !coordinationId
        || !secondCoordinationId,
      'Se requieren al menos dos subcoordinaciones de Operacion Academica.',
    );

    const suffix = Date.now();
    const { rows: scopedUsers } = await query(`
      INSERT INTO users (name, email, role_id, area_id, coordination_id, status)
      VALUES
        ($1, $2, 8, $3, NULL, 'Activo'),
        ($4, $5, 3, $3, $6, 'Activo')
      RETURNING *
    `, [
      `Coordinador OA ${runId}`,
      `coordinador.oa.e2e.${suffix}@cun.edu.co`,
      OPERATION_ACADEMIC_AREA_ID,
      `Editor escuela ${runId}`,
      `editor.escuela.e2e.${suffix}@cun.edu.co`,
      coordinationId,
    ]);
    createdUserIds.push(...scopedUsers.map(user => user.id));

    const coordinator = scopedUsers.find(user => Number(user.role_id) === 8);
    const schoolEditor = scopedUsers.find(user => Number(user.role_id) === 3);
    const coordinatorApi = await makeApiFor(coordinator);
    const schoolEditorApi = await makeApiFor(schoolEditor);

    try {
      const operationAssigneesResponse = await coordinatorApi.get(
        `/api/assignees?areaId=${OPERATION_ACADEMIC_AREA_ID}`,
      );
      await expectStatus(operationAssigneesResponse, 200);
      expect(await operationAssigneesResponse.json()).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: coordinator.id,
          role: 8,
          roleName: 'Coordinador Operacion Academica',
          area: OPERATION_ACADEMIC_AREA_ID,
          status: 'Activo',
        }),
      ]));

      const generalName = `${runId}-OA-GENERAL`;
      const generalResponse = await coordinatorApi.post('/api/documents', {
        multipart: {
          type: String(typeId),
          area: String(OPERATION_ACADEMIC_AREA_ID),
          name: generalName,
          owner: String(ownerId),
          version: '1.0',
          revisor: String(coordinator.id),
          aprobador: String(coordinator.id),
          file: { name: 'operacion-academica-general.pdf', mimeType: 'application/pdf', buffer: fixtureBuffer },
          infographic: infographicPart('infografia-operacion-general.png'),
        },
      });
      await expectStatus(generalResponse, 201);
      const generalDocument = await generalResponse.json();
      createdDocIds.push(Number(generalDocument.id));
      expect(generalDocument.coordination).toBeUndefined();

      const visibleGeneral = await schoolEditorApi.get(`/api/documents/${generalDocument.id}`);
      await expectStatus(visibleGeneral, 200);
      const deniedGeneralEdit = await schoolEditorApi.put(`/api/documents/${generalDocument.id}`, {
        data: { name: `${generalName}-EDITADO` },
      });
      await expectStatus(deniedGeneralEdit, 403);

      const coordinatorFlowResponse = await coordinatorApi.post('/api/documents', {
        multipart: {
          type: String(typeId),
          area: String(OPERATION_ACADEMIC_AREA_ID),
          name: `${runId}-FLUJO-COORDINADOR-OA`,
          owner: String(ownerId),
          version: '1.0',
          initialState: 'revision',
          revisor: String(coordinator.id),
          aprobador: String(coordinator.id),
          file: {
            name: 'flujo-coordinador-oa.pdf',
            mimeType: 'application/pdf',
            buffer: fixtureBuffer,
          },
          infographic: infographicPart('infografia-flujo-coordinador.png'),
        },
      });
      await expectStatus(coordinatorFlowResponse, 201);
      const coordinatorFlowDocument = await coordinatorFlowResponse.json();
      createdDocIds.push(Number(coordinatorFlowDocument.id));

      const coordinatorReviewInbox = await coordinatorApi.get('/api/workflow');
      await expectStatus(coordinatorReviewInbox, 200);
      const coordinatorReviewItem = (await coordinatorReviewInbox.json())
        .find(entry => Number(entry.docId) === Number(coordinatorFlowDocument.id));
      expect(coordinatorReviewItem).toBeTruthy();
      expect(coordinatorReviewItem.canMarkApproved).toBeTruthy();

      const coordinatorReview = await coordinatorApi.post(
        `/api/workflow/${coordinatorReviewItem.id}/transition`,
        { data: { action: 'review', comments: 'Revision del coordinador de Operacion Academica' } },
      );
      await expectStatus(coordinatorReview, 200);
      expect((await coordinatorReview.json()).status).toBe('approved_for_publication');

      const coordinatorApprovalInbox = await coordinatorApi.get('/api/workflow');
      await expectStatus(coordinatorApprovalInbox, 200);
      const coordinatorApprovalItem = (await coordinatorApprovalInbox.json())
        .find(entry => Number(entry.docId) === Number(coordinatorFlowDocument.id));
      expect(coordinatorApprovalItem).toBeTruthy();
      expect(coordinatorApprovalItem.canPublish).toBeTruthy();

      const coordinatorPublication = await coordinatorApi.post(
        `/api/workflow/${coordinatorApprovalItem.id}/transition`,
        { data: { action: 'publish', comments: 'Publicacion del coordinador de Operacion Academica' } },
      );
      await expectStatus(coordinatorPublication, 200);
      expect((await coordinatorPublication.json()).status).toBe('published');

      const otherSchoolName = `${runId}-OTRA-ESCUELA`;
      const otherSchoolResponse = await coordinatorApi.post('/api/documents', {
        multipart: {
          type: String(typeId),
          area: String(OPERATION_ACADEMIC_AREA_ID),
          coordination: String(secondCoordinationId),
          name: otherSchoolName,
          owner: String(ownerId),
          version: '1.0',
          revisor: String(coordinationReviewer.id),
          aprobador: String(coordinationApprover.id),
          file: { name: 'otra-escuela.pdf', mimeType: 'application/pdf', buffer: fixtureBuffer },
          infographic: infographicPart('infografia-otra-escuela.png'),
        },
      });
      await expectStatus(otherSchoolResponse, 201);
      const otherSchoolDocument = await otherSchoolResponse.json();
      createdDocIds.push(Number(otherSchoolDocument.id));

      const visibleOtherSchool = await schoolEditorApi.get(`/api/documents/${otherSchoolDocument.id}`);
      await expectStatus(visibleOtherSchool, 200);

      const deniedEdit = await schoolEditorApi.put(`/api/documents/${otherSchoolDocument.id}`, {
        data: { name: `${otherSchoolName}-EDITADO` },
      });
      await expectStatus(deniedEdit, 403);

      const ownSchoolName = `${runId}-ESCUELA-ASIGNADA`;
      const ownSchoolResponse = await schoolEditorApi.post('/api/documents', {
        multipart: {
          type: String(typeId),
          area: String(OPERATION_ACADEMIC_AREA_ID),
          coordination: String(coordinationId),
          name: ownSchoolName,
          owner: String(ownerId),
          version: '1.0',
          revisor: String(coordinationReviewer.id),
          aprobador: String(coordinationApprover.id),
          file: { name: 'escuela-asignada.pdf', mimeType: 'application/pdf', buffer: fixtureBuffer },
          infographic: infographicPart('infografia-escuela-asignada.png'),
        },
      });
      await expectStatus(ownSchoolResponse, 201);
      const ownSchoolDocument = await ownSchoolResponse.json();
      createdDocIds.push(Number(ownSchoolDocument.id));

      const allowedEdit = await schoolEditorApi.put(`/api/documents/${ownSchoolDocument.id}`, {
        data: { name: `${ownSchoolName}-EDITADO` },
      });
      await expectStatus(allowedEdit, 200);

      const visibleCoordinations = await schoolEditorApi.get(
        `/api/coordinations?areaId=${OPERATION_ACADEMIC_AREA_ID}`,
      );
      await expectStatus(visibleCoordinations, 200);
      const coordinationPayload = await visibleCoordinations.json();
      expect(coordinationPayload.some(item => Number(item.id) === Number(coordinationId))).toBeTruthy();
      expect(coordinationPayload.some(item => Number(item.id) === Number(secondCoordinationId))).toBeTruthy();

      const schoolLibrary = await schoolEditorApi.get(
        `/api/documents?area=${OPERATION_ACADEMIC_AREA_ID}`
          + `&coordination=${coordinationId}`
          + `&search=${encodeURIComponent(generalName)}`,
      );
      await expectStatus(schoolLibrary, 200);
      const schoolLibraryPayload = await schoolLibrary.json();
      expect(
        schoolLibraryPayload.data.some(item => Number(item.id) === Number(generalDocument.id)),
      ).toBeTruthy();

      const deniedGeneralName = `${runId}-GENERAL-NO-AUTORIZADO`;
      const deniedGeneral = await schoolEditorApi.post('/api/documents', {
        multipart: {
          type: String(typeId),
          area: String(OPERATION_ACADEMIC_AREA_ID),
          name: deniedGeneralName,
          owner: String(ownerId),
          version: '1.0',
          revisor: String(coordinationReviewer.id),
          aprobador: String(coordinationApprover.id),
          file: { name: 'general-no-autorizado.pdf', mimeType: 'application/pdf', buffer: fixtureBuffer },
          infographic: infographicPart(),
        },
      });
      await expectStatus(deniedGeneral, 403);
      expect(await countDocuments(deniedGeneralName)).toBe(0);
    } finally {
      await coordinatorApi.dispose();
      await schoolEditorApi.dispose();
    }
  });

  test('crea documento y archivo de forma atómica en PostgreSQL y Cloud Storage', async () => {
    const response = await api.post('/api/documents', {
      multipart: {
        type: String(typeId), area: String(areaId), name: `${runId}-ANS-ACERVO`,
        owner: String(ownerId), version: '1.0', versionNote: 'Versión inicial E2E',
        desc: 'Documento temporal generado por la suite E2E', tags: 'e2e,automatizado',
        initialState: 'borrador',
        revisor: String(reviewer.id), aprobador: String(approver.id),
        file: { name: 'ANS-ACV-001-E2E.pdf', mimeType: 'application/pdf', buffer: fixtureBuffer },
        infographic: infographicPart('infografia-ans-acervo.png'),
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
    expectDocumentStoragePath(rows[0].stored_name, documentId, '1.0');
    expect(await fileStorage.exists(rows[0].stored_name)).toBeTruthy();

    const { rows: infographicRows } = await query(
      'SELECT * FROM document_infographics WHERE doc_id = $1',
      [documentId],
    );
    expect(infographicRows).toHaveLength(1);
    expect(infographicRows[0]).toEqual(expect.objectContaining({
      original_name: 'infografia-ans-acervo.png',
      mime_type: 'image/png',
      document_version: '1.0',
      uploaded_by: admin.id,
    }));
    expect(Number(infographicRows[0].file_size)).toBe(infographicFixtureBuffer.length);
    expectDocumentStoragePath(infographicRows[0].stored_name, documentId, '1.0', { infographic: true });
    expect(await fileStorage.exists(infographicRows[0].stored_name)).toBeTruthy();
    expect(document.infographic).toEqual(expect.objectContaining({
      available: true,
      originalName: 'infografia-ans-acervo.png',
      mimeType: 'image/png',
      documentVersion: '1.0',
    }));

    const { rows: historyRows } = await query('SELECT COUNT(*)::int AS n FROM document_history WHERE doc_id = $1', [documentId]);
    const { rows: workflowRows } = await query(`
      SELECT stage, assignee_user_id, reviewer_user_id, approver_user_id
      FROM workflow_items
      WHERE doc_id = $1
    `, [documentId]);
    const { rows: activityRows } = await query('SELECT COUNT(*)::int AS n FROM activity_log WHERE doc_id = $1', [documentId]);
    const { rows: responsibleRows } = await query(`
      SELECT p.name
      FROM documents d
      JOIN people p ON p.id = d.owner_id
      WHERE d.id = $1
    `, [documentId]);
    expect(historyRows[0].n).toBeGreaterThan(0);
    expect(workflowRows).toHaveLength(1);
    expect(document.state).toBe('borrador');
    expect(workflowRows[0].stage).toBe('creacion');
    expect(Number(workflowRows[0].assignee_user_id)).toBe(Number(admin.id));
    expect(Number(workflowRows[0].reviewer_user_id)).toBe(Number(reviewer.id));
    expect(Number(workflowRows[0].approver_user_id)).toBe(Number(approver.id));
    expect(responsibleRows[0]?.name).toBe(admin.name);
    expect(activityRows[0].n).toBeGreaterThan(0);
  });

  test('permite cargar un documento directamente en revisión sin publicarlo', async () => {
    const response = await api.post('/api/documents', {
      multipart: {
        type: String(typeId),
        area: String(areaId),
        name: `${runId}-REVISION-DIRECTA`,
        owner: String(ownerId),
        version: '1.0',
        initialState: 'revision',
        revisor: String(reviewer.id),
        aprobador: String(approver.id),
        file: { name: 'revision-directa.pdf', mimeType: 'application/pdf', buffer: fixtureBuffer },
        infographic: infographicPart('infografia-revision-directa.png'),
      },
    });
    await expectStatus(response, 201);
    const document = await response.json();
    createdDocIds.push(Number(document.id));
    expect(document.state).toBe('revision');

    const { rows } = await query(`
      SELECT stage, assignee_user_id, reviewer_user_id, approver_user_id
      FROM workflow_items
      WHERE doc_id = $1
    `, [document.id]);
    expect(rows).toHaveLength(1);
    expect(rows[0].stage).toBe('revision');
    expect(Number(rows[0].assignee_user_id)).toBe(Number(reviewer.id));
    expect(Number(rows[0].reviewer_user_id)).toBe(Number(reviewer.id));
    expect(Number(rows[0].approver_user_id)).toBe(Number(approver.id));
    expect((await consultantApi.get(`/api/documents/${document.id}`)).status()).toBe(404);
  });

  test('permite que el lider asignado revise, apruebe y publique en su area', async () => {
    const response = await api.post('/api/documents', {
      multipart: {
        type: String(typeId),
        area: String(areaId),
        name: `${runId}-FLUJO-LIDER`,
        owner: String(ownerId),
        version: '1.0',
        initialState: 'revision',
        revisor: String(leader.id),
        aprobador: String(leader.id),
        file: { name: 'Flujo líder de área.pdf', mimeType: 'application/pdf', buffer: fixtureBuffer },
        infographic: infographicPart('infografia-flujo-lider.png'),
      },
    });
    await expectStatus(response, 201);
    const document = await response.json();
    createdDocIds.push(Number(document.id));
    expect(document.state).toBe('revision');
    const { rows: leaderFileRows } = await query(
      'SELECT original_name, stored_name FROM document_files WHERE doc_id = $1',
      [document.id],
    );
    expect(leaderFileRows[0].original_name).toBe('Flujo líder de área.pdf');
    expectDocumentStoragePath(leaderFileRows[0].stored_name, document.id, '1.0');
    expect(leaderFileRows[0].stored_name).not.toMatch(/[ áí]/i);
    expect((await consultantApi.get(`/api/documents/${document.id}`)).status()).toBe(404);

    const reviewInboxResponse = await leaderApi.get('/api/workflow');
    await expectStatus(reviewInboxResponse, 200);
    const reviewItem = (await reviewInboxResponse.json())
      .find(entry => Number(entry.docId) === Number(document.id));
    expect(reviewItem).toBeTruthy();
    expect(reviewItem.canMarkApproved).toBeTruthy();

    const review = await leaderApi.post(`/api/workflow/${reviewItem.id}/transition`, {
      data: { action: 'review', comments: 'Revision realizada por lider de area' },
    });
    await expectStatus(review, 200);
    expect((await review.json()).status).toBe('approved_for_publication');
    expect((await consultantApi.get(`/api/documents/${document.id}`)).status()).toBe(404);

    const approvalInboxResponse = await leaderApi.get('/api/workflow');
    await expectStatus(approvalInboxResponse, 200);
    const approvalItem = (await approvalInboxResponse.json())
      .find(entry => Number(entry.docId) === Number(document.id));
    expect(approvalItem).toBeTruthy();
    expect(approvalItem.canPublish).toBeTruthy();

    const publication = await leaderApi.post(`/api/workflow/${approvalItem.id}/transition`, {
      data: { action: 'publish', comments: 'Publicacion realizada por lider de area' },
    });
    await expectStatus(publication, 200);
    expect((await publication.json()).status).toBe('published');

    const publicDetail = await consultantApi.get(`/api/documents/${document.id}`);
    await expectStatus(publicDetail, 200);
    expect((await publicDetail.json()).state).toBe('publicado');
    publishedDocumentId = Number(document.id);
  });

  test('responde correctamente ante documentos y acciones inexistentes', async () => {
    const missingId = 2147483000;
    expect((await api.get(`/api/documents/${missingId}`)).status()).toBe(404);
    expect((await api.get(`/api/documents/${missingId}/file/meta`)).status()).toBe(404);
    expect((await api.get(`/api/documents/${missingId}/file`)).status()).toBe(404);
    expect((await api.post(`/api/workflow/${missingId}/transition`, {
      data: { action: 'review', comments: 'No existe' },
    })).status()).toBe(404);
  });

  test('consulta y reemplaza la infografia solo mientras el documento esta en borrador', async () => {
    const meta = await api.get(`/api/documents/${documentId}/infographic/meta`);
    await expectStatus(meta, 200);
    expect(await meta.json()).toEqual(expect.objectContaining({
      originalName: 'infografia-ans-acervo.png',
      mimeType: 'image/png',
      size: infographicFixtureBuffer.length,
      documentVersion: '1.0',
    }));

    const image = await api.get(`/api/documents/${documentId}/infographic`);
    await expectStatus(image, 200);
    expect(image.headers()['content-type']).toContain('image/png');
    expect((await image.body()).subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    const { rows: interactionsAfterImage } = await query(
      'SELECT COUNT(*)::int AS n FROM document_interactions WHERE doc_id = $1',
      [documentId],
    );
    expect(interactionsAfterImage[0].n).toBe(0);

    const invalidReplacement = await api.post(`/api/documents/${documentId}/infographic`, {
      multipart: {
        infographic: { name: 'no-es-imagen.pdf', mimeType: 'application/pdf', buffer: fixtureBuffer },
      },
    });
    await expectStatus(invalidReplacement, 400);
    expect((await consultantApi.post(`/api/documents/${documentId}/infographic`, {
      multipart: { infographic: infographicPart() },
    })).status()).toBe(403);

    const { rows: previousRows } = await query(
      'SELECT stored_name FROM document_infographics WHERE doc_id = $1',
      [documentId],
    );
    const previousStoredName = previousRows[0].stored_name;
    const replacement = await api.post(`/api/documents/${documentId}/infographic`, {
      multipart: { infographic: infographicPart('infografia-ans-reemplazada.png') },
    });
    await expectStatus(replacement, 200);
    expect(await replacement.json()).toEqual(expect.objectContaining({
      originalName: 'infografia-ans-reemplazada.png',
      mimeType: 'image/png',
      documentVersion: '1.0',
    }));
    const { rows: replacementRows } = await query(
      'SELECT * FROM document_infographics WHERE doc_id = $1',
      [documentId],
    );
    expect(replacementRows).toHaveLength(1);
    expect(replacementRows[0].stored_name).not.toBe(previousStoredName);
    expectDocumentStoragePath(replacementRows[0].stored_name, documentId, '1.0', { infographic: true });
    expect(await fileStorage.exists(replacementRows[0].stored_name)).toBeTruthy();
    expect(await fileStorage.exists(previousStoredName)).toBeFalsy();
  });

  test('consulta, descarga, favoritos, vistas, edición y solicitud de actualización', async () => {
    const detail = await api.get(`/api/documents/${documentId}`);
    expect(detail.status()).toBe(200);
    const meta = await api.get(`/api/documents/${documentId}/file/meta`);
    expect(meta.status()).toBe(200);

    const preview = await api.get(`/api/documents/${documentId}/file?mode=preview`);
    expect(preview.status()).toBe(200);
    expect((await preview.body()).length).toBeGreaterThan(1000);
    const { rows: previewEvents } = await query(
      'SELECT COUNT(*)::int AS n FROM document_interactions WHERE doc_id = $1',
      [documentId],
    );
    expect(previewEvents[0].n).toBe(0);

    const download = await api.get(`/api/documents/${documentId}/file`);
    expect(download.status()).toBe(200);
    expect((await download.body()).length).toBeGreaterThan(1000);
    expect(Number(download.headers()['x-document-downloads'])).toBe(1);

    expect((await api.post(`/api/documents/${documentId}/favorite`)).status()).toBe(200);
    expect((await api.post(`/api/documents/${documentId}/favorite`)).status()).toBe(200);
    const view = await api.post(`/api/documents/${documentId}/view`, {
      data: { source: 'e2e_document_detail' },
    });
    expect(view.status()).toBe(200);
    const viewMetrics = await view.json();
    expect(viewMetrics).toEqual(expect.objectContaining({
      type: 'view',
      views: 1,
      downloads: 1,
    }));

    const { rows: interactionRows } = await query(`
      SELECT interaction_type, user_id, document_version, source, occurred_at
      FROM document_interactions
      WHERE doc_id = $1
      ORDER BY occurred_at, id
    `, [documentId]);
    expect(interactionRows).toHaveLength(2);
    expect(interactionRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        interaction_type: 'download',
        user_id: admin.id,
        document_version: '1.0',
        source: 'current_file',
      }),
      expect.objectContaining({
        interaction_type: 'view',
        user_id: admin.id,
        document_version: '1.0',
        source: 'e2e_document_detail',
      }),
    ]));
    expect(interactionRows.every(row => row.occurred_at)).toBeTruthy();

    const { rows: metricRows } = await query(`
      SELECT views, downloads, last_viewed_at, last_downloaded_at
      FROM documents
      WHERE id = $1
    `, [documentId]);
    expect(metricRows[0]).toEqual(expect.objectContaining({ views: 1, downloads: 1 }));
    expect(metricRows[0].last_viewed_at).toBeTruthy();
    expect(metricRows[0].last_downloaded_at).toBeTruthy();

    expect((await api.put(`/api/documents/${documentId}`, { data: { desc: 'Actualizado por E2E' } })).status()).toBe(200);
    expect((await api.post(`/api/documents/${documentId}/update-request`, {
      data: { reason: 'Prueba E2E', detail: 'Validación automática de solicitudes' },
    })).status()).toBe(200);
  });

  test('mantiene privado el documento hasta que revisor y aprobador completan sus etapas', async () => {
    expect((await consultantApi.get(`/api/documents/${documentId}`)).status()).toBe(404);

    const workflow = await api.get('/api/workflow');
    expect(workflow.status()).toBe(200);
    const item = (await workflow.json()).find(entry => Number(entry.docId) === documentId);
    expect(item).toBeTruthy();
    workflowId = Number(item.id);

    const invalidStage = await api.post(`/api/workflow/${workflowId}/transition`, {
      data: { action: 'publish', comments: 'Intento fuera de etapa' },
    });
    expect(invalidStage.status()).toBe(403);

    const submit = await api.post(`/api/workflow/${workflowId}/transition`, {
      data: { action: 'submit', comments: 'Borrador terminado' },
    });
    expect(submit.status()).toBe(200);
    expect((await submit.json()).status).toBe('submitted_to_review');

    const adminCannotReview = await api.post(`/api/workflow/${workflowId}/transition`, {
      data: { action: 'review', comments: 'El administrador no reemplaza al revisor' },
    });
    expect(adminCannotReview.status()).toBe(403);

    const reviewerWorkflow = await reviewerApi.get('/api/workflow');
    expect(reviewerWorkflow.status()).toBe(200);
    const reviewerItem = (await reviewerWorkflow.json())
      .find(entry => Number(entry.docId) === documentId);
    expect(reviewerItem).toBeTruthy();
    expect(reviewerItem.canMarkApproved).toBeTruthy();
    expect(reviewerItem.canSendToApproval).toBeTruthy();

    const review = await reviewerApi.post(`/api/workflow/${workflowId}/transition`, {
      data: { action: 'approve', comments: 'Revisión E2E aprobada' },
    });
    expect(review.status()).toBe(200);
    expect((await review.json()).status).toBe('approved_for_publication');

    const approvedDetail = await api.get(`/api/documents/${documentId}`);
    expect(approvedDetail.status()).toBe(200);
    expect((await approvedDetail.json()).state).toBe('aprobado');
    const lockedEdit = await api.put(`/api/documents/${documentId}`, {
      data: { desc: 'No debe modificarse después de la revisión' },
    });
    expect(lockedEdit.status()).toBe(409);
    expect((await consultantApi.get(`/api/documents/${documentId}`)).status()).toBe(404);
    const consultantLibrary = await consultantApi.get('/api/documents');
    expect(consultantLibrary.status()).toBe(200);
    expect((await consultantLibrary.json()).data.some(
      document => Number(document.id) === documentId,
    )).toBeFalsy();

    const reviewerCannotPublish = await reviewerApi.post(`/api/workflow/${workflowId}/transition`, {
      data: { action: 'publish', comments: 'El revisor no puede publicar' },
    });
    expect(reviewerCannotPublish.status()).toBe(403);

    const approverWorkflow = await approverApi.get('/api/workflow');
    expect(approverWorkflow.status()).toBe(200);
    const approverItem = (await approverWorkflow.json())
      .find(entry => Number(entry.docId) === documentId);
    expect(approverItem).toBeTruthy();
    expect(approverItem.canPublish).toBeTruthy();

    const publish = await approverApi.post(`/api/workflow/${workflowId}/transition`, {
      data: { action: 'publish', comments: 'Publicación E2E' },
    });
    expect(publish.status()).toBe(200);
    expect((await publish.json()).status).toBe('published');

    const detail = await consultantApi.get(`/api/documents/${documentId}`);
    expect(detail.status()).toBe(200);
    expect((await detail.json()).state).toBe('publicado');

    const lockedInfographic = await api.post(`/api/documents/${documentId}/infographic`, {
      multipart: { infographic: infographicPart('infografia-no-debe-cambiar.png') },
    });
    await expectStatus(lockedInfographic, 409);
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
    const downloadConsultant = rows.find(user => Number(user.role_id) === 6);
    auditor = rows.find(user => Number(user.role_id) === 7);
    const downloadConsultantApi = await makeApiFor(downloadConsultant);
    auditorApi = await makeApiFor(auditor);
    auditorToken = signToken({ id: auditor.id, email: auditor.email, role: auditor.role_id });

    const { rows: metricsBeforePreview } = await query(
      'SELECT views, downloads FROM documents WHERE id = $1',
      [documentId],
    );
    expect((await downloadConsultantApi.get(`/api/documents/${documentId}/file`)).status()).toBe(200);
    const preview = await auditorApi.get(`/api/documents/${documentId}/file?mode=preview`);
    await expectStatus(preview, 200);
    expect((await preview.body()).length).toBeGreaterThan(1000);
    expect(preview.headers()['content-disposition']).toContain('inline');
    expect(preview.headers()['x-document-downloads']).toBeUndefined();
    expect((await auditorApi.get(`/api/documents/${documentId}/file`)).status()).toBe(403);
    expect((await auditorApi.get(`/api/documents/${documentId}/infographic`)).status()).toBe(200);
    expect((await auditorApi.get(`/api/documents/${documentId}`)).status()).toBe(200);
    expect((await auditorApi.get('/api/users')).status()).toBe(403);
    expect((await api.get('/api/users')).status()).toBe(200);

    const { rows: metricsAfterPreview } = await query(
      'SELECT views, downloads FROM documents WHERE id = $1',
      [documentId],
    );
    expect(Number(metricsAfterPreview[0].views)).toBe(Number(metricsBeforePreview[0].views));
    expect(Number(metricsAfterPreview[0].downloads)).toBe(Number(metricsBeforePreview[0].downloads) + 1);

    const interactionActors = [api, leaderApi, reviewerApi, approverApi, consultantApi, auditorApi];
    for (let index = 0; index < interactionActors.length; index += 1) {
      const interaction = await interactionActors[index].post(`/api/documents/${documentId}/view`, {
        data: { source: `e2e_actor_${index + 1}` },
      });
      await expectStatus(interaction, 200);
    }

    await downloadConsultantApi.dispose();
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

    const invalidInfographic = await api.post(`/api/documents/${documentId}/versions`, {
      multipart: {
        version: '1.1',
        note: 'Infografia invalida',
        file: { name: 'version-con-infografia.pdf', mimeType: 'application/pdf', buffer: fixtureBuffer },
        infographic: { name: 'infografia-version.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') },
      },
    });
    await expectStatus(invalidInfographic, 400);

    const unexpectedFile = await api.post(`/api/documents/${documentId}/versions`, {
      multipart: {
        version: '1.1',
        note: 'Archivo adicional no permitido',
        file: { name: 'version-valida.pdf', mimeType: 'application/pdf', buffer: fixtureBuffer },
        infographic: infographicPart('infografia-version-valida.png'),
        attachment: { name: 'archivo-adicional.pdf', mimeType: 'application/pdf', buffer: fixtureBuffer },
      },
    });
    await expectStatus(unexpectedFile, 400);
    const unexpectedFilePayload = await unexpectedFile.json();
    expect(unexpectedFilePayload).toEqual(expect.objectContaining({
      code: 'LIMIT_UNEXPECTED_FILE',
    }));
    expect(unexpectedFilePayload.message).toContain('Adjunta únicamente el documento y la infografía');
    expect(unexpectedFilePayload.message).not.toContain('Too many files');

    const longVersion = await api.post(`/api/documents/${documentId}/versions`, {
      multipart: {
        version: '123456789012345678901',
        note: 'Version fuera del limite permitido',
        file: { name: 'version-muy-larga.pdf', mimeType: 'application/pdf', buffer: fixtureBuffer },
      },
    });
    await expectStatus(longVersion, 400);
    expect((await longVersion.json()).message).toContain('20 caracteres');
    const { rows: unchangedVersionRows } = await query(
      'SELECT version, state FROM documents WHERE id = $1',
      [documentId],
    );
    expect(unchangedVersionRows[0]).toEqual(expect.objectContaining({
      version: '1.0',
      state: 'publicado',
    }));

    const sameVersion = await api.post(`/api/documents/${documentId}/versions`, {
      multipart: {
        version: '1.0',
        note: 'Numero de version repetido',
        file: { name: 'version-repetida.pdf', mimeType: 'application/pdf', buffer: fixtureBuffer },
      },
    });
    await expectStatus(sameVersion, 409);

    const { rows: previousInfographicRows } = await query(
      'SELECT stored_name FROM document_infographics WHERE doc_id = $1',
      [documentId],
    );
    const previousInfographicStoredName = previousInfographicRows[0].stored_name;
    const { rows: previousFileRows } = await query(
      'SELECT stored_name, original_name FROM document_files WHERE doc_id = $1',
      [documentId],
    );
    const previousFileStoredName = previousFileRows[0].stored_name;

    const response = await api.post(`/api/documents/${documentId}/versions`, {
      multipart: {
        version: '1.1', note: 'Versión automatizada E2E',
        file: { name: 'ANS-ACV-001-v1.1.pdf', mimeType: 'application/pdf', buffer: fixtureBuffer },
        infographic: infographicPart('infografia-ans-v1.1.png'),
      },
    });
    expect(response.status()).toBe(201);
    const updated = await response.json();
    const archivedVersion = updated.versions.find(item => item.version === '1.0');
    expect(archivedVersion).toEqual(expect.objectContaining({
      originalName: previousFileRows[0].original_name,
      storedName: previousFileStoredName,
    }));
    expectDocumentStoragePath(archivedVersion.storedName, documentId, '1.0');
    expect(updated.versions.some(item => item.version === '1.1')).toBeFalsy();
    expect(updated.infographic).toEqual(expect.objectContaining({
      available: true,
      originalName: 'infografia-ans-v1.1.png',
      mimeType: 'image/png',
      documentVersion: '1.1',
    }));
    const { rows: currentInfographicRows } = await query(
      'SELECT * FROM document_infographics WHERE doc_id = $1',
      [documentId],
    );
    expect(currentInfographicRows).toHaveLength(1);
    expect(currentInfographicRows[0].original_name).toBe('infografia-ans-v1.1.png');
    expect(currentInfographicRows[0].document_version).toBe('1.1');
    expectDocumentStoragePath(currentInfographicRows[0].stored_name, documentId, '1.1', { infographic: true });
    expect(await fileStorage.exists(currentInfographicRows[0].stored_name)).toBeTruthy();
    expect(await fileStorage.exists(previousInfographicStoredName)).toBeFalsy();
    const { rows: currentVersionFileRows } = await query(
      'SELECT stored_name FROM document_files WHERE doc_id = $1',
      [documentId],
    );
    expectDocumentStoragePath(currentVersionFileRows[0].stored_name, documentId, '1.1');
    expect(currentVersionFileRows[0].stored_name).not.toBe(previousFileStoredName);
    expect((await api.get(`/api/documents/${documentId}/infographic`)).status()).toBe(200);
    expect((await api.get(`/api/documents/${documentId}/versions/${archivedVersion.id}/file`)).status()).toBe(200);
    const { rows: versionDownloadRows } = await query(`
      SELECT interaction_type, document_version, source, user_id
      FROM document_interactions
      WHERE doc_id = $1 AND source = 'version_file'
      ORDER BY occurred_at DESC, id DESC
      LIMIT 1
    `, [documentId]);
    expect(versionDownloadRows[0]).toEqual(expect.objectContaining({
      interaction_type: 'download',
      document_version: '1.0',
      source: 'version_file',
      user_id: admin.id,
    }));
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

    expect(publishedDocumentId).toBeTruthy();
    for (let index = 0; index < 6; index += 1) {
      const response = await api.post(`/api/documents/${publishedDocumentId}/view`, {
        data: { source: `e2e_analytics_pagination_${index + 1}` },
      });
      await expectStatus(response, 200);
    }

    const analyticsResponse = await api.get('/api/reports/analytics?period=all');
    await expectStatus(analyticsResponse, 200);
    const analytics = await analyticsResponse.json();
    expect(analytics.period.key).toBe('all');
    expect(analytics.totals).toEqual(expect.objectContaining({
      documents: expect.any(Number),
      views: expect.any(Number),
      downloads: expect.any(Number),
      publishedDocuments: expect.any(Number),
      averageIntervalSamples: expect.any(Number),
      lastViewedAt: expect.any(String),
      lastDownloadedAt: expect.any(String),
    }));
    expect(Array.isArray(analytics.ranking)).toBeTruthy();
    expect(Array.isArray(analytics.topViewed)).toBeTruthy();
    expect(Array.isArray(analytics.topDownloaded)).toBeTruthy();
    expect(Array.isArray(analytics.withoutViews)).toBeTruthy();
    expect(Array.isArray(analytics.withoutUse)).toBeTruthy();
    expect(Array.isArray(analytics.trend)).toBeTruthy();
    expect(Array.isArray(analytics.monthlyTrend)).toBeTruthy();
    expect(Array.isArray(analytics.recent)).toBeTruthy();
    expect(Array.isArray(analytics.usageByArea)).toBeTruthy();
    expect(Array.isArray(analytics.usageByCategory)).toBeTruthy();
    expect(Array.isArray(analytics.usageByProcess)).toBeTruthy();
    expect(Array.isArray(analytics.topUsers)).toBeTruthy();
    expect(analytics.recent.length).toBeGreaterThan(5);
    expect(analytics.monthlyTrend).toHaveLength(12);
    expect(analytics.dimensionSources).toEqual({
      category: 'document_type_provisional',
      process: 'catalog_pending',
    });
    expect(analytics.ranking.some(item => Number(item.id) === documentId)).toBeTruthy();
  });

  test('valida acumulados, filtros, alcance y privacidad de la analítica por rol', async () => {
    const { rows: databaseTotalsRows } = await query(`
      SELECT
        COUNT(*)::int AS documents,
        COALESCE(SUM(views), 0)::bigint AS views,
        COALESCE(SUM(downloads), 0)::bigint AS downloads,
        COUNT(*) FILTER (WHERE state = 'publicado')::int AS published_documents
      FROM documents
    `);
    const databaseTotals = databaseTotalsRows[0];

    const allResponse = await api.get('/api/reports/analytics?period=all');
    await expectStatus(allResponse, 200);
    const all = await allResponse.json();
    expect(all.canIdentifyUsers).toBe(true);
    expect(all.totals.documents).toBe(Number(databaseTotals.documents));
    expect(all.totals.views).toBe(Number(databaseTotals.views));
    expect(all.totals.downloads).toBe(Number(databaseTotals.downloads));
    expect(all.totals.publishedDocuments).toBe(Number(databaseTotals.published_documents));
    expect(all.totals.periodViews).toBe(all.totals.views);
    expect(all.totals.periodDownloads).toBe(all.totals.downloads);
    expect(all.topUsers.length).toBeGreaterThan(5);
    expect(all.recent.length).toBeLessThanOrEqual(15);
    expect(all.recent.some(item => item.userId && item.userName)).toBe(true);
    expect(all.recent.every((item, index, items) => (
      index === 0 || new Date(items[index - 1].occurredAt) >= new Date(item.occurredAt)
    ))).toBe(true);
    expect(all.monthlyTrend).toHaveLength(12);

    const invalidPeriodResponse = await api.get('/api/reports/analytics?period=no-valido');
    await expectStatus(invalidPeriodResponse, 200);
    expect((await invalidPeriodResponse.json()).period.key).toBe('30');

    const sevenDaysResponse = await api.get('/api/reports/analytics?period=7');
    await expectStatus(sevenDaysResponse, 200);
    const sevenDays = await sevenDaysResponse.json();
    expect(sevenDays.period.key).toBe('7');
    expect(sevenDays.trend).toHaveLength(7);

    const filteredResponse = await api.get(
      `/api/reports/analytics?period=all&area=${areaId}&type=${typeId}`,
    );
    await expectStatus(filteredResponse, 200);
    const filtered = await filteredResponse.json();
    expect(filtered.filters).toEqual(expect.objectContaining({
      area: Number(areaId),
      type: Number(typeId),
    }));
    expect(filtered.usageByArea.every(item => Number(item.id) === Number(areaId))).toBe(true);
    for (const collection of [
      filtered.ranking,
      filtered.topViewed,
      filtered.topDownloaded,
      filtered.withoutViews,
      filtered.withoutUse,
    ]) {
      expect(collection.every(item => (
        Number(item.area) === Number(areaId) && Number(item.type) === Number(typeId)
      ))).toBe(true);
    }

    if (coordinationAreaId && coordinationId) {
      const coordinationResponse = await api.get(
        `/api/reports/analytics?period=all&area=${coordinationAreaId}&coordination=${coordinationId}`,
      );
      await expectStatus(coordinationResponse, 200);
      const coordinationAnalytics = await coordinationResponse.json();
      for (const collection of [
        coordinationAnalytics.ranking,
        coordinationAnalytics.topViewed,
        coordinationAnalytics.topDownloaded,
        coordinationAnalytics.withoutViews,
        coordinationAnalytics.withoutUse,
      ]) {
        expect(collection.every(item => Number(item.coordination) === Number(coordinationId))).toBe(true);
      }
    }

    const consultantResponse = await consultantApi.get('/api/reports/analytics?period=all');
    await expectStatus(consultantResponse, 200);
    const consultantAnalytics = await consultantResponse.json();
    const { rows: publishedRows } = await query(
      "SELECT COUNT(*)::int AS n FROM documents WHERE state = 'publicado'",
    );
    expect(consultantAnalytics.totals.documents).toBe(publishedRows[0].n);
    expect(consultantAnalytics.canIdentifyUsers).toBe(false);
    expect(consultantAnalytics.topUsers).toEqual([]);
    expect(consultantAnalytics.recent.every(item => (
      item.userId === null && item.userName === null
    ))).toBe(true);
    expect(consultantAnalytics.ranking.every(item => item.state === 'publicado')).toBe(true);

    const leaderResponse = await leaderApi.get('/api/reports/analytics?period=all');
    await expectStatus(leaderResponse, 200);
    const leaderAnalytics = await leaderResponse.json();
    expect(leaderAnalytics.canIdentifyUsers).toBe(true);
    expect(leaderAnalytics.usageByArea.every(item => Number(item.id) === Number(areaId))).toBe(true);

    const auditorResponse = await auditorApi.get('/api/reports/analytics?period=all');
    await expectStatus(auditorResponse, 200);
    const auditorAnalytics = await auditorResponse.json();
    expect(auditorAnalytics.totals.documents).toBe(Number(databaseTotals.documents));
    expect(auditorAnalytics.canIdentifyUsers).toBe(false);
    expect(auditorAnalytics.topUsers).toEqual([]);

    const { rows: actorRows } = await query(`
      SELECT COUNT(DISTINCT user_id)::int AS users
      FROM document_interactions
      WHERE source LIKE 'e2e_actor_%'
    `);
    expect(actorRows[0].users).toBe(6);
  });

  test('el analista institucional consulta todas las metricas y coordinaciones sin administrar', async ({ browser }) => {
    const rolesResponse = await api.get('/api/roles');
    await expectStatus(rolesResponse, 200);
    const analyticsRole = (await rolesResponse.json()).find(role => Number(role.id) === 9);
    expect(analyticsRole).toEqual(expect.objectContaining({
      name: 'Analista institucional de métricas',
      perms: {
        crear: false,
        editar: false,
        aprobar: false,
        publicar: false,
        archivar: false,
        consultar: true,
        descargar: false,
        administrar: false,
      },
    }));

    const protectedRoleResponse = await api.put('/api/roles/9', {
      data: {
        name: analyticsRole.name,
        desc: analyticsRole.desc,
        perms: {
          crear: true,
          editar: true,
          aprobar: true,
          publicar: true,
          archivar: true,
          consultar: false,
          descargar: true,
          administrar: true,
        },
      },
    });
    await expectStatus(protectedRoleResponse, 200);
    expect((await protectedRoleResponse.json()).perms).toEqual({
      crear: false,
      editar: false,
      aprobar: false,
      publicar: false,
      archivar: false,
      consultar: true,
      descargar: false,
      administrar: false,
    });

    const suffix = Date.now();
    const userName = `Analista metricas ${runId}`;
    const createResponse = await api.post('/api/users', {
      data: {
        name: userName,
        email: `analista.metricas.e2e.${suffix}@cun.edu.co`,
        role: 9,
        area: areaId,
        coordination: coordinationId || '',
        status: 'Activo',
      },
    });
    await expectStatus(createResponse, 201);
    const analyticsReader = await createResponse.json();
    createdUserIds.push(analyticsReader.id);
    expect(analyticsReader).toEqual(expect.objectContaining({
      role: 9,
      area: null,
      roleName: 'Analista institucional de métricas',
    }));
    expect(analyticsReader.coordination).toBeUndefined();
    analyticsReaderApi = await makeApiFor({
      id: analyticsReader.id,
      email: analyticsReader.email,
      role_id: analyticsReader.role,
    });

    const [adminAreasResponse, readerAreasResponse, adminCoordinationsResponse, readerCoordinationsResponse] = await Promise.all([
      api.get('/api/areas'),
      analyticsReaderApi.get('/api/areas'),
      api.get('/api/coordinations'),
      analyticsReaderApi.get('/api/coordinations'),
    ]);
    for (const response of [adminAreasResponse, readerAreasResponse, adminCoordinationsResponse, readerCoordinationsResponse]) {
      await expectStatus(response, 200);
    }
    const adminAreas = await adminAreasResponse.json();
    const readerAreas = await readerAreasResponse.json();
    const adminCoordinations = await adminCoordinationsResponse.json();
    const readerCoordinations = await readerCoordinationsResponse.json();
    expect(readerAreas.map(area => area.id)).toEqual(adminAreas.map(area => area.id));
    expect(readerCoordinations.map(coordination => coordination.id))
      .toEqual(adminCoordinations.map(coordination => coordination.id));

    const [adminDocumentsResponse, readerDocumentsResponse] = await Promise.all([
      api.get('/api/documents?limit=100'),
      analyticsReaderApi.get('/api/documents?limit=100'),
    ]);
    await expectStatus(adminDocumentsResponse, 200);
    await expectStatus(readerDocumentsResponse, 200);
    const adminDocuments = await adminDocumentsResponse.json();
    const readerDocuments = await readerDocumentsResponse.json();
    expect(readerDocuments.total).toBe(adminDocuments.total);
    expect(readerDocuments.data.map(document => document.id).sort((a, b) => a - b))
      .toEqual(adminDocuments.data.map(document => document.id).sort((a, b) => a - b));
    expect(readerDocuments.data.some(document => document.state !== 'publicado')).toBe(true);

    for (let index = 1; index <= 3; index += 1) {
      const readerInteraction = await analyticsReaderApi.post(`/api/documents/${documentId}/view`, {
        data: { source: `e2e_global_analytics_role_${index}` },
      });
      await expectStatus(readerInteraction, 200);
    }
    const [adminAnalyticsResponse, readerAnalyticsResponse] = await Promise.all([
      api.get('/api/reports/analytics?period=all'),
      analyticsReaderApi.get('/api/reports/analytics?period=all'),
    ]);
    await expectStatus(adminAnalyticsResponse, 200);
    await expectStatus(readerAnalyticsResponse, 200);
    const adminAnalytics = await adminAnalyticsResponse.json();
    const readerAnalytics = await readerAnalyticsResponse.json();
    expect(readerAnalytics.canIdentifyUsers).toBe(true);
    expect(readerAnalytics.totals).toEqual(adminAnalytics.totals);
    expect(readerAnalytics.usageByArea).toEqual(adminAnalytics.usageByArea);
    expect(readerAnalytics.ranking).toEqual(adminAnalytics.ranking);
    expect(readerAnalytics.topUsers.some(user => user.name === userName)).toBe(true);
    expect(readerAnalytics.recent.some(item => item.userName === userName)).toBe(true);

    expect((await analyticsReaderApi.get(`/api/documents/${documentId}/file?mode=preview`)).status()).toBe(200);
    expect((await analyticsReaderApi.get(`/api/documents/${documentId}/file`)).status()).toBe(403);
    expect((await analyticsReaderApi.get('/api/users')).status()).toBe(403);
    expect((await analyticsReaderApi.get('/api/roles')).status()).toBe(403);
    expect((await analyticsReaderApi.post('/api/documents', { data: {} })).status()).toBe(403);

    const analyticsReaderToken = signToken({
      id: analyticsReader.id,
      email: analyticsReader.email,
      role: analyticsReader.role,
    });
    const context = await browser.newContext({ viewport: { width: 1366, height: 820 } });
    await context.addCookies([{
      name: SESSION_COOKIE_NAME,
      value: analyticsReaderToken,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Strict',
    }]);
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto('/reportes');
    await expect(page.getByRole('heading', { name: 'Analítica documental' })).toBeVisible();
    await expect(page.getByText('La identificación de usuarios está restringida para tu rol.')).toHaveCount(0);
    await expect(page.locator('.analytics-users-list')).toContainText(userName);
    await expect(page.getByText('Usuarios y roles', { exact: true })).toHaveCount(0);
    expect(pageErrors).toEqual([]);
    await context.close();
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
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.goto('/');
    await expect(page.getByText('Acervo', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: /¿Qué necesitas hacer hoy\?/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Mapa de áreas' })).toBeVisible();
    const skipTour = page.getByRole('button', { name: 'Omitir recorrido' });
    if (await skipTour.isVisible()) {
      await expect(page.locator('.map-tour-spotlight')).toBeVisible();
      await expect(page.locator('.map-home-hero')).toHaveAttribute('data-map-tour-target', 'true');
      await skipTour.click();
    }
    await page.getByRole('tab', { name: 'Mapa de áreas' }).click();
    await expect(page.getByText('Repositorio central')).toBeVisible();
    const operationAreaNode = page.locator('.area-map-node').filter({ hasText: 'COA' }).first();
    await operationAreaNode.scrollIntoViewIfNeeded();
    await operationAreaNode.click();
    await expect(page.getByText('Área seleccionada')).toBeVisible();
    await expect(page.locator('.operation-map-node').filter({ hasText: 'GENERAL' })).toBeVisible();
    await page.getByRole('button', { name: /Todas las áreas/ }).click();
    await expect(page.getByText('Repositorio central')).toBeVisible();
    await page.getByRole('tab', { name: 'Roles y responsabilidades' }).click();
    await expect(page.getByRole('heading', { name: 'Selecciona un rol para conocer su participación' })).toBeVisible();

    await page.goto('/biblioteca');
    await expect(page.getByRole('heading', { name: 'Biblioteca documental' })).toBeVisible();
    const documentCard = page.locator('.doc-card').filter({ hasText: `${runId}-ANS-ACERVO` });
    await expect(documentCard).toBeVisible();
    await page.mouse.move(0, 0);
    await documentCard.scrollIntoViewIfNeeded();
    await documentCard.hover();
    await expect(page.getByTestId('document-hover-preview')).toBeVisible();
    await expect(page.getByTestId('document-hover-preview').locator('img')).toBeVisible();
    await expect(page.getByTestId('document-hover-preview')).toContainText(`${runId}-ANS-ACERVO`);
    await page.goto('/gestion/cargar');
    await expect(page.getByRole('heading', { name: 'Cargar nuevo documento' })).toBeVisible();
    await page.goto('/gestion/usuarios');
    await expect(page.getByRole('heading', { name: 'Administración de usuarios y roles' })).toBeVisible();
    await page.goto('/reportes');
    await expect(page.getByRole('heading', { name: 'Analítica documental' })).toBeVisible();
    await expect(page.getByText('Consultas históricas')).toBeVisible();
    await expect(page.getByText('Tendencia mensual')).toBeVisible();
    await expect(page.getByText('Consultas por área')).toBeVisible();
    const recentPagination = page.getByTestId('analytics-pagination-recent');
    const recentRows = page.locator('.analytics-recent-list > button');
    await expect(recentPagination).toBeVisible();
    await expect(recentPagination).toContainText('1–5 de');
    await expect(recentRows).toHaveCount(5);
    await recentPagination.getByRole('button', { name: 'Página siguiente de interacciones recientes' }).click();
    await expect(recentPagination.getByRole('button', { name: 'Página 2 de interacciones recientes' })).toHaveAttribute('aria-current', 'page');
    await expect(recentPagination).toContainText('6–');
    await recentPagination.getByRole('button', { name: 'Página anterior de interacciones recientes' }).click();
    await expect(recentPagination.getByRole('button', { name: 'Página 1 de interacciones recientes' })).toHaveAttribute('aria-current', 'page');
    const usersPagination = page.getByTestId('analytics-pagination-users');
    const userRows = page.locator('.analytics-users-list > .analytics-user-row');
    await expect(usersPagination).toBeVisible();
    await expect(usersPagination).toContainText('1–5 de');
    await expect(userRows).toHaveCount(5);
    await usersPagination.getByRole('button', { name: 'Página siguiente de usuarios más activos' }).click();
    await expect(usersPagination.getByRole('button', { name: 'Página 2 de usuarios más activos' })).toHaveAttribute('aria-current', 'page');
    await expect(usersPagination).toContainText('6–');
    const analyticsRefresh = page.waitForResponse(response => (
      response.url().includes('/api/reports/analytics')
      && response.url().includes('period=all')
      && response.request().method() === 'GET'
    ));
    await page.locator('.analytics-filter-bar .custom-select-trigger').first().click();
    await page.getByRole('option', { name: 'Todo el histórico' }).click();
    expect((await analyticsRefresh).status()).toBe(200);
    await expect(usersPagination.getByRole('button', { name: 'Página 1 de usuarios más activos' })).toHaveAttribute('aria-current', 'page');
    const exportButton = page.getByRole('button', { name: 'Exportar CSV' });
    await expect(exportButton).toBeVisible();
    await exportButton.click();
    await expect(page.getByTestId('app-toast')).toContainText('Reporte exportado');

    await page.goto(`/documentos/${documentId}`);
    await expect(page.getByText('Infografía documental')).toBeVisible();
    await expect(page.locator('.doc-info-sheet')).toBeVisible();
    await expect(page.locator('.doc-info-image-visual img')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ver documento' })).toBeVisible();
    await expect(page.locator('.doc-preview-real')).toHaveCount(0);
    await page.getByRole('button', { name: 'Ver documento' }).click();
    await expect(page.locator('.doc-preview-real')).toBeVisible();

    expect(publishedDocumentId).toBeTruthy();
    await page.goto(`/documentos/${publishedDocumentId}`);

    const storageFailurePattern = `**/api/documents/${publishedDocumentId}/file`;
    const storageFailureHandler = async route => route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'STORAGE_UNAVAILABLE',
        message: 'Service Unavailable: credentials could not be loaded',
      }),
    });
    await page.route(storageFailurePattern, storageFailureHandler);
    await page.getByRole('button', { name: 'Descargar', exact: true }).first().click();
    await expect(page.getByTestId('app-toast')).toContainText('No se pudo descargar el documento');
    await expect(page.getByTestId('app-toast')).toContainText('El almacenamiento de archivos no está disponible');
    await expect(page.getByTestId('app-toast')).not.toContainText('Service Unavailable');
    await page.unroute(storageFailurePattern, storageFailureHandler);

    const successfulDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Descargar', exact: true }).first().click();
    expect((await successfulDownload).suggestedFilename()).toBe('Flujo líder de área.pdf');

    const versionButton = page.getByRole('button', { name: 'Nueva versión' });
    await expect(versionButton).toBeVisible();
    await versionButton.click();

    const versionModal = page.locator('.modal').filter({ hasText: 'Nueva versión' });
    await expect(versionModal).toBeVisible();
    await expect(versionModal.getByText('Archivo de la nueva versión *')).toBeVisible();
    await expect(versionModal.getByText('Actualizar infografía')).toBeVisible();
    await expect(versionModal.getByText('Opcional', { exact: true })).toBeVisible();
    await expect(versionModal.locator('input.input:not([type])')).toHaveValue('1.1');
    await expect(versionModal.locator('input.input:not([type])')).toHaveAttribute('maxlength', '20');

    await versionModal.locator('input[type="file"][accept*=".pdf"]').setInputFiles({
      name: 'archivo-no-permitido.exe',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('archivo invalido'),
    });
    await expect(page.getByTestId('app-toast')).toContainText('Archivo no válido');
    await expect(page.getByTestId('app-toast')).toContainText('Formato no permitido');
    await versionModal.locator('input[type="file"][accept*=".pdf"]').setInputFiles({
      name: 'flujo-visual-v1.1.pdf',
      mimeType: 'application/pdf',
      buffer: fixtureBuffer,
    });
    await versionModal.locator('input[type="file"][accept*=".png"]').setInputFiles({
      name: 'infografia-flujo-visual-v1.1.png',
      mimeType: 'image/png',
      buffer: infographicFixtureBuffer,
    });
    await versionModal
      .locator('.form-row')
      .filter({ hasText: 'Nota de versión' })
      .locator('textarea')
      .fill('Actualización integral creada desde la interfaz E2E');

    const versionFailurePattern = `**/api/documents/${publishedDocumentId}/versions`;
    const versionFailureHandler = async route => route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'LIMIT_FILE_COUNT', message: 'Too many files' }),
    });
    await page.route(versionFailurePattern, versionFailureHandler);
    await versionModal.getByRole('button', { name: 'Crear versión' }).click();
    await expect(versionModal).toBeVisible();
    await expect(page.getByTestId('app-toast')).toContainText('No se pudo crear la nueva versión');
    await expect(page.getByTestId('app-toast')).toContainText('Solo puedes adjuntar un archivo documental y una infografía');
    await expect(page.getByTestId('app-toast')).not.toContainText('Too many files');
    await page.unroute(versionFailurePattern, versionFailureHandler);

    const createVersionResponse = page.waitForResponse(response => (
      response.request().method() === 'POST'
      && /\/api\/documents\/\d+\/versions$/.test(response.url())
    ));
    await versionModal.getByRole('button', { name: 'Crear versión' }).click();
    expect((await createVersionResponse).status()).toBe(201);
    await expect(versionModal).toBeHidden();
    await expect(page.getByTestId('app-toast')).toContainText('Versión 1.1 creada');
    await expect(page.getByTestId('app-toast')).toContainText('quedó en Borrador');
    await expect(page.locator('.doc-header-meta')).toContainText('Versión 1.1');

    const { rows: uiVersionRows } = await query(`
      SELECT d.version, d.state, di.original_name, di.document_version
      FROM documents d
      LEFT JOIN document_infographics di ON di.doc_id = d.id
      WHERE d.id = $1
    `, [publishedDocumentId]);
    expect(uiVersionRows[0]).toEqual(expect.objectContaining({
      version: '1.1',
      state: 'borrador',
      original_name: 'infografia-flujo-visual-v1.1.png',
      document_version: '1.1',
    }));

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/biblioteca');
    await expect(page.getByRole('heading', { name: 'Biblioteca documental' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.goto('/reportes');
    await expect(page.getByRole('heading', { name: 'Analítica documental' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    expect(pageErrors).toEqual([]);
    await context.close();
  });

  test('el auditor consulta analítica y previsualiza sin permiso de descarga', async ({ browser }) => {
    expect(auditorToken).toBeTruthy();
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addCookies([{
      name: SESSION_COOKIE_NAME,
      value: auditorToken,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Strict',
    }]);
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.goto('/reportes');
    await expect(page.getByRole('heading', { name: 'Analítica documental' })).toBeVisible();
    await expect(page.getByText('La identificación de usuarios está restringida para tu rol.')).toBeVisible();
    await expect(page.getByTestId('analytics-pagination-users')).toHaveCount(0);

    await page.goto(`/documentos/${documentId}`);
    await expect(page.getByText('Infografía documental')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Descargar', exact: true })).toHaveCount(0);
    const previewResponse = page.waitForResponse(response => (
      response.url().includes(`/api/documents/${documentId}/file?mode=preview`)
      && response.request().method() === 'GET'
    ));
    await page.getByRole('button', { name: 'Ver documento' }).click();
    expect((await previewResponse).status()).toBe(200);
    await expect(page.locator('.doc-preview-real')).toBeVisible();
    await expect(page.locator('.doc-preview-iframe')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Descargar', exact: true })).toHaveCount(0);
    expect(pageErrors).toEqual([]);

    await context.close();
  });
});
