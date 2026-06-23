import { listDocuments, getDocument } from './documents.js';

const TYPE = {
  manualFunciones: 2,
  descriptorCargo: 3,
  manualAplicacion: 4,
  ans: 5,
};

function cleanTitle(name = '') {
  return name
    .replace(/^ANS\s*[—-]\s*/i, '')
    .replace(/^Manual de funciones\s*[—-]\s*/i, '')
    .replace(/^Descriptor de cargo\s*[—-]\s*/i, '')
    .replace(/^Manual de aplicación\s*[—-]\s*/i, '')
    .trim();
}

function moduleBase(doc) {
  return {
    id: doc.ans || doc.cargo || doc.app || String(doc.id),
    docId: doc.id,
    documentNumber: doc.documentNumber,
    name: cleanTitle(doc.name),
    fullName: doc.name,
    area: doc.area,
    type: doc.type,
    state: doc.state,
    version: doc.version,
    vigencia: doc.vigencia,
    updated: doc.updated,
    owner: doc.owner,
    description: doc.desc,
    tags: doc.tags || [],
    views: doc.views,
  };
}

async function listByTypes(auth, typeIds) {
  const results = await Promise.all(typeIds.map(type => listDocuments(auth, { type, limit: 100 })));
  return results.flatMap(r => r.data);
}

function findByModuleId(docs, id, key) {
  return docs.find(doc => String(doc[key] || doc.id) === String(id));
}

export async function listAns(auth) {
  const docs = await listByTypes(auth, [TYPE.ans]);
  return docs.map(doc => ({
    ...moduleBase(doc),
    objective: doc.desc,
    scope: doc.desc,
    responseTime: null,
    resolutionTime: null,
    channels: [],
    restrictions: [],
    commitments: [],
  }));
}

export async function getAns(auth, id) {
  const docs = await listByTypes(auth, [TYPE.ans]);
  const doc = findByModuleId(docs, id, 'ans');
  if (!doc) return null;
  return {
    ...moduleBase(doc),
    objective: doc.desc,
    scope: doc.desc,
    responseTime: null,
    resolutionTime: null,
    channels: [],
    restrictions: [],
    commitments: [],
    document: await getDocument(doc.id, auth),
  };
}

export async function listCargos(auth) {
  const docs = await listByTypes(auth, [TYPE.manualFunciones, TYPE.descriptorCargo]);
  return docs.map(doc => ({
    ...moduleBase(doc),
    level: null,
    manager: null,
    responsibilities: [],
    skills: [],
    kpis: [],
  }));
}

export async function getCargo(auth, id) {
  const docs = await listByTypes(auth, [TYPE.manualFunciones, TYPE.descriptorCargo]);
  const doc = findByModuleId(docs, id, 'cargo');
  if (!doc) return null;
  return {
    ...moduleBase(doc),
    objective: doc.desc,
    level: null,
    manager: null,
    responsibilities: [],
    functions: [],
    skills: [],
    tools: [],
    kpis: [],
    relatedDocs: (doc.related || []),
    document: await getDocument(doc.id, auth),
  };
}

export async function listApps(auth) {
  const docs = await listByTypes(auth, [TYPE.manualAplicacion]);
  return docs.map(doc => ({
    ...moduleBase(doc),
    status: doc.state === 'revision' ? 'En revisión documental' : 'Documentada',
    versionApp: doc.version,
    users: null,
  }));
}

export async function getApp(auth, id) {
  const docs = await listByTypes(auth, [TYPE.manualAplicacion]);
  const doc = findByModuleId(docs, id, 'app');
  if (!doc) return null;
  return {
    ...moduleBase(doc),
    objective: doc.desc,
    status: doc.state === 'revision' ? 'En revisión documental' : 'Documentada',
    versionApp: doc.version,
    flows: [],
    roles: [],
    faqs: [],
    document: await getDocument(doc.id, auth),
  };
}
