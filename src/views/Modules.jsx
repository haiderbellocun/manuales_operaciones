import { useState } from 'react';
import { DATA } from '../data';
import { useAuth } from '../context/AuthContext';
import { Icon, StateBadge, AreaTag, KpiCard, Avatar, ImgPlaceholder } from '../components';

function FieldBlock({ label, children, icon }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div className="row gap-8 mb-12">{icon && <Icon name={icon} size={16} style={{ color: 'var(--brand-600)' }} />}<h4 className="field-block-label">{label}</h4></div>
      {children}
    </div>
  );
}

export function AnsModule({ nav }) {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('crear');
  const list = Object.keys(DATA.ANS).map(id => ({ id, ...DATA.ANS[id], doc: DATA.docById(DATA.ANS[id].docId) }));
  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="breadcrumb"><a onClick={() => nav('dashboard')}>Inicio</a><span className="sep">/</span><span>Módulos</span><span className="sep">/</span><span style={{ color: 'var(--ink-700)' }}>ANS</span></div>
        <div className="row between wrap gap-12">
          <div><h1 className="page-title">Acuerdos de Nivel de Servicio</h1><p className="page-sub">{list.length} ANS registrados · compromisos de servicio entre áreas y clientes</p></div>
          {canCreate && <button className="btn btn-primary" onClick={() => nav('upload')}><Icon name="plus" size={16} />Nuevo ANS</button>}
        </div>
      </div>
      <div className="module-grid">
        {list.map(a => {
          const area = DATA.areaById(a.doc.area);
          return (
            <div key={a.id} className="card module-card" onClick={() => nav('ansDetail', { id: a.id })} role="button" tabIndex={0}>
              <div className="module-card-head">
                <div className="row between mb-12"><span className="kpi-ico" style={{ width: 40, height: 40, borderRadius: 11, background: area.color, color: '#fff' }}><Icon name="handshake" size={20} /></span><StateBadge state={a.doc.state} /></div>
                <div className="module-card-title">{a.name}</div>
                <div className="mono text-xs muted" style={{ marginTop: 5 }}>{a.doc.documentNumber} · v{a.doc.version}</div>
              </div>
              <div className="module-card-meta">
                <div><div className="eyebrow" style={{ fontSize: 10 }}>Cliente</div><div className="text-sm" style={{ fontWeight: 600, marginTop: 3 }}>{a.cliente.split('/')[0].split('—')[0].trim()}</div></div>
                <div><div className="eyebrow" style={{ fontSize: 10 }}>Proveedor</div><div className="text-sm" style={{ fontWeight: 600, marginTop: 3 }}>{area.abbreviation}</div></div>
                <div><div className="eyebrow" style={{ fontSize: 10 }}>T. respuesta</div><div className="row gap-6 text-sm" style={{ fontWeight: 600, marginTop: 3, color: 'var(--brand-700)' }}><Icon name="clock" size={14} />{a.tResp}</div></div>
                <div><div className="eyebrow" style={{ fontSize: 10 }}>T. resolución</div><div className="row gap-6 text-sm" style={{ fontWeight: 600, marginTop: 3, color: 'var(--brand-700)' }}><Icon name="check" size={14} />{a.tResol.split('(')[0].trim()}</div></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AnsDetail({ nav, ansId }) {
  const { hasPermission } = useAuth();
  const canDownload = hasPermission('descargar');
  const a = DATA.ANS[ansId];
  if (!a) return <div className="page"><p>ANS no encontrado.</p></div>;
  const doc = DATA.docById(a.docId);
  const area = DATA.areaById(doc.area);
  const Chips = ({ items, tone }) => <div className="row gap-8 wrap">{items.map((c, i) => <span key={i} className="tag" style={tone === 'red' ? { background: 'var(--st-vencido-bg)', color: 'var(--st-vencido-fg)', borderColor: 'transparent' } : null}>{c}</span>)}</div>;

  return (
    <div className="page fade-in">
      <div className="breadcrumb"><a onClick={() => nav('dashboard')}>Inicio</a><span className="sep">/</span><a onClick={() => nav('ans')}>ANS</a><span className="sep">/</span><span style={{ color: 'var(--ink-700)' }}>{doc.documentNumber}</span></div>
      <div className="card doc-header">
        <div className="doc-header-accent" style={{ background: area.color }}></div>
        <div className="doc-header-body">
          <div className="row between wrap gap-16">
            <div className="row gap-16 doc-header-info">
              <span className="kpi-ico doc-header-icon"><Icon name="handshake" size={28} /></span>
              <div>
                <div className="row gap-8 mb-12"><span className="tag tag-type">ANS</span><AreaTag areaId={doc.area} /><StateBadge state={doc.state} /></div>
                <h1 className="doc-header-title">{a.name}</h1>
                <div className="mono text-sm muted" style={{ marginTop: 8 }}>{doc.documentNumber} · Versión {doc.version} · Vigencia {DATA.fmtDate(doc.vigencia)}</div>
              </div>
            </div>
            <div className="row gap-8 doc-header-actions">
              <button className="btn btn-ghost" onClick={() => nav('detail', { id: doc.id })}><Icon name="doc" size={16} />Ver documento</button>
              {canDownload && <button className="btn btn-primary"><Icon name="download" size={16} />Descargar</button>}
            </div>
          </div>
        </div>
      </div>
      <div className="grid-kpi mb-24">
        <KpiCard icon="clock" value={a.tResp} label="Tiempo de respuesta" tone="amber" />
        <KpiCard icon="check" value={a.tResol.split('/')[0].trim()} label="Tiempo de resolución" tone="brand" />
        <div className="kpi"><div className="kpi-top"><span className="kpi-ico" style={{ background: 'var(--st-publicado-bg)', color: 'var(--st-publicado-fg)' }}><Icon name="building" size={19} /></span></div><div style={{ fontSize: 16, fontWeight: 700, margin: '12px 0 2px' }}>{area.name}</div><div className="kpi-label">Proveedor del servicio</div></div>
      </div>
      <div className="detail-grid">
        <div className="card" style={{ padding: '24px 28px' }}>
          <FieldBlock label="Objetivo" icon="compass"><p className="field-text">{a.objetivo}</p></FieldBlock>
          <FieldBlock label="Alcance" icon="shield"><p className="field-text">{a.alcance}</p></FieldBlock>
          <div className="two-col-grid">
            <FieldBlock label="Canales oficiales" icon="mail"><ul className="field-list">{a.canales.map((c, i) => <li key={i}>{c}</li>)}</ul></FieldBlock>
            <FieldBlock label="Horario de atención" icon="clock"><p className="field-text">{a.horario}</p></FieldBlock>
          </div>
          <FieldBlock label="Causales de devolución o rechazo" icon="alert"><Chips items={a.causales} tone="red" /></FieldBlock>
          <FieldBlock label="Restricciones" icon="x"><ul className="field-list">{a.restricciones.map((c, i) => <li key={i}>{c}</li>)}</ul></FieldBlock>
          <FieldBlock label="Compromisos de las partes" icon="handshake"><div className="commit-list">{a.compromisos.map((c, i) => <div key={i} className="row gap-10 commit-item"><Icon name="check" size={16} style={{ color: 'var(--brand-600)', flexShrink: 0, marginTop: 1 }} />{c}</div>)}</div></FieldBlock>
        </div>
        <div className="detail-sidebar">
          <div className="card" style={{ padding: '20px 22px' }}>
            <h3 className="section-title">Partes del acuerdo</h3>
            <div className="spec-list">
              <div className="spec-row"><span className="k">Cliente</span><span className="v spec-v-wrap">{a.cliente}</span></div>
              <div className="spec-row"><span className="k">Proveedor</span><span className="v spec-v-wrap">{a.proveedor}</span></div>
            </div>
            <h4 className="subsection-label">Responsables</h4>
            {a.responsables.map((r, i) => <div key={i} className="row gap-10" style={{ marginBottom: 8 }}><Avatar name={r} size={32} /><span className="text-sm" style={{ fontWeight: 600 }}>{r}</span></div>)}
          </div>
          <div className="card" style={{ padding: '20px 22px' }}>
            <h3 className="section-title">Aprobación</h3>
            <div className="approval-box">
              <Icon name="check" size={20} style={{ color: 'var(--brand-700)' }} />
              <div><div className="text-sm" style={{ fontWeight: 700 }}>Documento {DATA.STATES[doc.state].label.toLowerCase()}</div><div className="text-xs muted">Firmado por {DATA.personById(doc.owner).name}</div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CargosModule({ nav }) {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('crear');
  const [area, setArea] = useState('all');
  const list = Object.keys(DATA.CARGOS)
    .map(id => ({ id, ...DATA.CARGOS[id] }))
    .filter(c => area === 'all' || DATA.areaById(c.area)?.id === area);
  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="breadcrumb"><a onClick={() => nav('dashboard')}>Inicio</a><span className="sep">/</span><span>Módulos</span><span className="sep">/</span><span style={{ color: 'var(--ink-700)' }}>Funciones y cargos</span></div>
        <div className="row between wrap gap-12"><div><h1 className="page-title">Manuales de funciones y descriptores de cargo</h1><p className="page-sub">Consulta los cargos del área: funciones, competencias, perfil y relaciones</p></div>{canCreate && <button className="btn btn-primary" onClick={() => nav('upload')}><Icon name="plus" size={16} />Nuevo cargo</button>}</div>
      </div>
      <div className="row gap-8 wrap mb-24">
        <span className={'chip' + (area === 'all' ? ' active' : '')} onClick={() => setArea('all')}>Todas las áreas</span>
        {DATA.AREAS.map(a => <span key={a.id} className={'chip' + (area === a.id ? ' active' : '')} onClick={() => setArea(a.id)}><span className="area-dot" style={{ background: area === a.id ? '#fff' : a.color }}></span>{a.abbreviation}</span>)}
      </div>
      <div className="cargo-grid">
        {list.map(c => {
          const ar = DATA.areaById(c.area);
          return (
            <div key={c.id} className="card cargo-card" onClick={() => nav('cargoDetail', { id: c.id })} role="button" tabIndex={0}>
              <div className="row between mb-12"><span className="kpi-ico" style={{ width: 44, height: 44, borderRadius: 11, background: 'var(--brand-50)', color: 'var(--brand-700)' }}><Icon name="idcard" size={21} /></span><span className="tag" style={{ background: ar.color, color: '#fff', borderColor: 'transparent' }}>{ar.abbreviation}</span></div>
              <div className="cargo-name">{c.name}</div>
              <div className="text-sm muted" style={{ marginTop: 4 }}>{c.nivel} · reporta a {c.jefe}</div>
              <p className="cargo-preview">{c.objetivo}</p>
              <div className="row between cargo-foot"><span className="text-xs muted">{c.especificas.length} funciones · {c.kpis.length} KPIs</span><span className="link">Ver ficha →</span></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CargoDetail({ nav, cargoId }) {
  const c = DATA.CARGOS[cargoId];
  if (!c) return <div className="page"><p>Cargo no encontrado.</p></div>;
  const ar = DATA.areaById(c.area);
  const doc = DATA.docById(c.docId);
  const List = ({ items, check }) => <div className="list-items">{items.map((it, i) => <div key={i} className="row gap-10 list-item"><Icon name={check ? 'check' : 'arrowRight'} size={15} style={{ color: 'var(--brand-600)', flexShrink: 0, marginTop: 2 }} />{it}</div>)}</div>;

  return (
    <div className="page fade-in">
      <div className="breadcrumb"><a onClick={() => nav('dashboard')}>Inicio</a><span className="sep">/</span><a onClick={() => nav('cargos')}>Funciones y cargos</a><span className="sep">/</span><span style={{ color: 'var(--ink-700)' }}>{c.name}</span></div>
      <div className="card doc-header">
        <div className="doc-header-accent" style={{ background: ar.color }}></div>
        <div className="doc-header-body">
          <div className="row between wrap gap-16">
            <div className="row gap-16 doc-header-info">
              <span className="kpi-ico doc-header-icon"><Icon name="idcard" size={28} /></span>
              <div>
                <div className="row gap-8 mb-12"><span className="tag tag-type">Descriptor de cargo</span><AreaTag areaId={c.area} /><span className="tag">{c.nivel}</span></div>
                <h1 className="doc-header-title">{c.name}</h1>
                <div className="text-sm muted" style={{ marginTop: 8 }}>Reporta a: <strong style={{ color: 'var(--ink-700)' }}>{c.jefe}</strong> · {ar.name}</div>
              </div>
            </div>
            {doc && <button className="btn btn-ghost" onClick={() => nav('detail', { id: doc.id })}><Icon name="doc" size={16} />Documento {doc.documentNumber}</button>}
          </div>
        </div>
      </div>
      <div className="detail-grid">
        <div className="card" style={{ padding: '24px 28px' }}>
          <FieldBlock label="Objetivo del cargo" icon="compass"><p className="field-text field-text-lg">{c.objetivo}</p></FieldBlock>
          <div className="two-col-grid">
            <FieldBlock label="Funciones generales" icon="list"><List items={c.generales} /></FieldBlock>
            <FieldBlock label="Funciones específicas" icon="flow"><List items={c.especificas} /></FieldBlock>
          </div>
          <FieldBlock label="Responsabilidades" icon="shield"><List items={c.responsabilidades} check /></FieldBlock>
          <div className="two-col-grid">
            <FieldBlock label="Competencias técnicas" icon="settings"><div className="row gap-8 wrap">{c.tecnicas.map((t, i) => <span key={i} className="tag tag-type">{t}</span>)}</div></FieldBlock>
            <FieldBlock label="Competencias blandas" icon="sparkles"><div className="row gap-8 wrap">{c.blandas.map((t, i) => <span key={i} className="tag">{t}</span>)}</div></FieldBlock>
          </div>
          <FieldBlock label="Perfil requerido" icon="idcard"><p className="field-text">{c.perfil}</p></FieldBlock>
        </div>
        <div className="detail-sidebar">
          <div className="card" style={{ padding: '20px 22px' }}>
            <h3 className="section-title">Indicadores (KPIs)</h3>
            {c.kpis.map((k, i) => <div key={i} className="row gap-10 kpi-item" style={{ borderTop: i ? '1px solid var(--line-soft)' : 'none' }}><Icon name="trend" size={16} style={{ color: 'var(--brand-600)' }} />{k}</div>)}
          </div>
          <div className="card" style={{ padding: '20px 22px' }}>
            <h3 className="section-title">Herramientas de trabajo</h3>
            <div className="row gap-8 wrap">{c.herramientas.map((h, i) => <span key={i} className="tag"><Icon name="settings" size={12} />{h}</span>)}</div>
          </div>
          <div className="card" style={{ padding: '20px 22px' }}>
            <h3 className="section-title">Relación con otros cargos</h3>
            {c.relaciones.map((r, i) => <div key={i} className="row gap-10 rel-item"><Icon name="link" size={15} style={{ color: 'var(--ink-400)' }} /><span className="text-sm">{r}</span></div>)}
          </div>
          {c.docs?.length > 0 && (
            <div className="card" style={{ padding: '20px 22px' }}>
              <h3 className="section-title">Documentos asociados</h3>
              {c.docs.map(id => { const d = DATA.docById(id); return d ? <div key={id} className="row gap-10 rel-item doc-link" onClick={() => nav('detail', { id })} role="button" tabIndex={0}><Icon name="doc" size={15} style={{ color: 'var(--brand-600)' }} /><span className="text-sm grow" style={{ fontWeight: 500 }}>{d.name}</span><Icon name="chevRight" size={14} style={{ color: 'var(--ink-300)' }} /></div> : null; })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AppsModule({ nav }) {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('crear');
  const list = Object.keys(DATA.APPS).map(id => ({ id, ...DATA.APPS[id] }));
  const estadoTone = (e) => e === 'Producción' ? 'aprobado' : e === 'En desarrollo' ? 'revision' : 'borrador';
  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="breadcrumb"><a onClick={() => nav('dashboard')}>Inicio</a><span className="sep">/</span><span>Módulos</span><span className="sep">/</span><span style={{ color: 'var(--ink-700)' }}>Aplicaciones</span></div>
        <div className="row between wrap gap-12"><div><h1 className="page-title">Manuales de aplicaciones</h1><p className="page-sub">{list.length} aplicaciones desarrolladas por el área · manuales, roles, flujos y soporte</p></div>{canCreate && <button className="btn btn-primary" onClick={() => nav('upload')}><Icon name="plus" size={16} />Nueva aplicación</button>}</div>
      </div>
      <div className="apps-grid">
        {list.map(ap => (
          <div key={ap.id} className="card app-card" onClick={() => nav('appDetail', { id: ap.id })} role="button" tabIndex={0}>
            <div className="app-card-body">
              <div className="row between mb-12"><span className="kpi-ico app-icon"><Icon name="app" size={22} /></span><span className={'badge badge-' + estadoTone(ap.estado)}><span className="b-dot"></span>{ap.estado}</span></div>
              <div className="app-name">{ap.name}</div>
              <p className="app-desc">{ap.objetivo}</p>
            </div>
            <div className="app-card-foot">
              <div className="row gap-12 text-xs muted"><span className="mono">{ap.versionApp}</span><span className="row gap-6"><Icon name="users" size={13} />{ap.usuarios.toLocaleString('es')}</span></div>
              <AreaTag areaId={ap.area} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AppDetail({ nav, appId }) {
  const ap = DATA.APPS[appId];
  const [openFaq, setOpenFaq] = useState(0);
  if (!ap) return <div className="page"><p>Aplicación no encontrada.</p></div>;
  const ansDoc = ap.ans ? DATA.ANS[ap.ans] : null;

  return (
    <div className="page fade-in">
      <div className="breadcrumb"><a onClick={() => nav('dashboard')}>Inicio</a><span className="sep">/</span><a onClick={() => nav('apps')}>Aplicaciones</a><span className="sep">/</span><span style={{ color: 'var(--ink-700)' }}>{ap.name}</span></div>
      <div className="card" style={{ padding: '24px 28px', marginBottom: 24 }}>
        <div className="row between wrap gap-16">
          <div className="row gap-16 doc-header-info">
            <span className="kpi-ico app-icon-lg"><Icon name="app" size={28} /></span>
            <div>
              <div className="row gap-8 mb-12"><AreaTag areaId={ap.area} /><span className="badge badge-aprobado"><span className="b-dot"></span>{ap.estado}</span><span className="tag mono">{ap.versionApp}</span></div>
              <h1 className="doc-header-title">{ap.name}</h1>
              <p className="app-detail-desc">{ap.objetivo}</p>
            </div>
          </div>
          <div className="row gap-8 doc-header-actions">
            {ap.manualUser && <button className="btn btn-ghost" onClick={() => nav('detail', { id: ap.manualUser })}><Icon name="doc" size={16} />Manual de usuario</button>}
            <button className="btn btn-primary"><Icon name="eye" size={16} />Abrir aplicación</button>
          </div>
        </div>
      </div>
      <div className="detail-grid">
        <div>
          <div className="card" style={{ padding: '22px 24px', marginBottom: 24 }}>
            <h3 className="section-title">Flujos principales</h3>
            <div className="flow-chain">
              {ap.flujos.map((f, i) => (
                <div key={i} className="flow-step-item">
                  <div className="flow-step-box">
                    <span className="flow-step-num">{i + 1}</span>
                    <span className="text-sm" style={{ fontWeight: 600 }}>{f}</span>
                  </div>
                  {i < ap.flujos.length - 1 && <Icon name="chevRight" size={18} style={{ color: 'var(--ink-300)', margin: '0 4px' }} />}
                </div>
              ))}
            </div>
          </div>
          <div className="card" style={{ padding: '22px 24px', marginBottom: 24 }}>
            <h3 className="section-title">Capturas y videos de apoyo</h3>
            <div className="media-grid">
              <ImgPlaceholder label={'captura: pantalla principal'} height={150} />
              <ImgPlaceholder label={'video: recorrido guiado'} height={150} />
            </div>
          </div>
          {ap.faqs.length > 0 && (
            <div className="card" style={{ padding: '22px 24px' }}>
              <h3 className="section-title">Preguntas frecuentes</h3>
              {ap.faqs.map((f, i) => (
                <div key={i} className="faq-item">
                  <button type="button" className="row between faq-btn" onClick={() => setOpenFaq(openFaq === i ? -1 : i)}>
                    <span className="text-sm" style={{ fontWeight: 600 }}>{f.q}</span>
                    <Icon name="chevDown" size={16} style={{ color: 'var(--ink-400)', transform: openFaq === i ? 'rotate(180deg)' : '', transition: 'transform .15s' }} />
                  </button>
                  {openFaq === i && <p className="faq-answer">{f.a}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="detail-sidebar">
          <div className="card" style={{ padding: '20px 22px' }}>
            <h3 className="section-title">Roles de usuario</h3>
            {ap.roles.map((r, i) => <div key={i} className="row gap-10 rel-item"><Icon name="users" size={15} style={{ color: 'var(--brand-600)' }} /><span className="text-sm">{r}</span></div>)}
          </div>
          <div className="card" style={{ padding: '20px 22px' }}>
            <h3 className="section-title">Responsables</h3>
            <div className="row gap-10 mb-12"><Avatar name={ap.respFunc} size={36} /><div><div className="text-sm" style={{ fontWeight: 600 }}>{ap.respFunc}</div><div className="text-xs muted">Responsable funcional</div></div></div>
            <div className="row gap-10"><Avatar name={ap.respTec} size={36} color="var(--ink-600)" /><div><div className="text-sm" style={{ fontWeight: 600 }}>{ap.respTec}</div><div className="text-xs muted">Responsable técnico</div></div></div>
          </div>
          {ansDoc && (
            <div className="card ans-link-card" onClick={() => nav('ansDetail', { id: ap.ans })} role="button" tabIndex={0}>
              <div className="row gap-10 mb-12"><Icon name="handshake" size={18} style={{ color: 'var(--brand-700)' }} /><span className="text-sm" style={{ fontWeight: 700 }}>ANS asociado</span></div>
              <div className="text-sm" style={{ fontWeight: 600 }}>{ansDoc.name}</div>
              <div className="row gap-12 text-xs muted mt-8"><span>Resp. {ansDoc.tResp}</span><span className="link">Ver ANS →</span></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
