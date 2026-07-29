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
const OPERATION_ACADEMIC_AREA_ID = 1;
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
  let secondCoordinationId;
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

      const otherSchoolName = `${runId}-OTRA-ESCUELA`;
      const otherSchoolResponse = await coordinatorApi.post('/api/documents', {
        multipart: {
          type: String(typeId),
          area: String(OPERATION_ACADEMIC_AREA_ID),
          coordination: String(secondCoordinationId),
          name: otherSchoolName,
          owner: String(ownerId),
          version: '1.0',
          revisor: String(coordinator.id),
          aprobador: String(coordinator.id),
          file: { name: 'otra-escuela.pdf', mimeType: 'application/pdf', buffer: fixtureBuffer },
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
          revisor: String(coordinator.id),
          aprobador: String(coordinator.id),
          file: { name: 'escuela-asignada.pdf', mimeType: 'application/pdf', buffer: fixtureBuffer },
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
          revisor: String(coordinator.id),
          aprobador: String(coordinator.id),
          file: { name: 'general-no-autorizado.pdf', mimeType: 'application/pdf', buffer: fixtureBuffer },
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
    await page.getByRole('button', { name: /Coordinación de Operación Académica/ }).click();
    await expect(page.getByText('Área seleccionada')).toBeVisible();
    await expect(page.getByRole('button', { name: /General de Operación Académica/ })).toBeVisible();
    await page.getByRole('button', { name: /Todas las áreas/ }).click();
    await expect(page.getByText('Repositorio central')).toBeVisible();
    await page.getByRole('tab', { name: 'Roles y responsabilidades' }).click();
    await expect(page.getByRole('heading', { name: 'Selecciona un rol para conocer su participación' })).toBeVisible();

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
