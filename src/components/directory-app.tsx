"use client";

import {
  AlertTriangle, Bell, BookUser, Building2, Check, CheckCircle2, ChevronRight,
  ClipboardCopy, Cloud, Download, Eye, EyeOff, FileSpreadsheet, Filter, Globe,
  HelpCircle, KeyRound, LayoutDashboard, LayoutGrid, LockKeyhole, LogOut, Mail,
  MapPin, Menu, Pencil, Phone, Plus, Search, Settings, ShieldCheck, Smartphone,
  StickyNote, Table2, Trash2, Upload, UserRound, Users, X,
} from "lucide-react";
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Address, AppUser, AuditItem, Category, Contact, Credential, FamilyUser, Method } from "@/components/types";

type Section = "dashboard" | "contacts" | "companies" | "credentials" | "addresses" | "notes" | "import" | "settings";
type Meta = { categories: Category[]; users: FamilyUser[]; audit: AuditItem[] };

const nav: { id: Section; label: string; icon: typeof Users }[] = [
  { id: "dashboard", label: "Resumen", icon: LayoutDashboard },
  { id: "contacts", label: "Contactos", icon: Users },
  { id: "companies", label: "Empresas", icon: Building2 },
  { id: "credentials", label: "Credenciales", icon: KeyRound },
  { id: "addresses", label: "Direcciones", icon: MapPin },
  { id: "notes", label: "Notas", icon: StickyNote },
  { id: "import", label: "Importar", icon: Upload },
  { id: "settings", label: "Configuración", icon: Settings },
];

async function jsonRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "No fue posible completar la operación");
  return data;
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function firstMethod(contact: Contact, type: Method["type"]) {
  return contact.methods.find((method) => method.type === type)?.value ?? "";
}

export function DirectoryApp({ initialUser }: { initialUser: AppUser }) {
  const [section, setSection] = useState<Section>("contacts");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [meta, setMeta] = useState<Meta>({ categories: [], users: [], audit: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);
  const [contactModal, setContactModal] = useState<Contact | "new" | null>(null);
  const [credentialModal, setCredentialModal] = useState<{ contact: Contact; credential?: Credential } | null>(null);
  const [passwordModal, setPasswordModal] = useState(initialUser.must_change_password);
  const [backupModal, setBackupModal] = useState(false);
  const [toast, setToast] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const kind = section === "companies" ? "company" : "all";
      const data = await jsonRequest<{ contacts: Contact[] }>(`/api/contacts?q=${encodeURIComponent(search)}&kind=${kind}&status=${status}`);
      setContacts(data.contacts);
      setSelectedId((current) => current && data.contacts.some((contact) => contact.id === current) ? current : data.contacts[0]?.id ?? null);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, [search, section, status]);

  const loadMeta = useCallback(async () => {
    try { setMeta(await jsonRequest<Meta>("/api/meta")); } catch { /* La pantalla principal sigue funcionando. */ }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadContacts, 220);
    return () => window.clearTimeout(timer);
  }, [loadContacts]);
  useEffect(() => {
    const timer = window.setTimeout(loadMeta, 0);
    return () => window.clearTimeout(timer);
  }, [loadMeta]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  const selected = contacts.find((contact) => contact.id === selectedId) ?? null;
  const credentials = useMemo(() => contacts.flatMap((contact) => contact.credentials.map((credential) => ({ ...credential, contact }))), [contacts]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3600);
  }

  async function refresh(message?: string) {
    await Promise.all([loadContacts(), loadMeta()]);
    if (message) notify(message);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  function chooseSection(next: Section) {
    setSection(next);
    setMobileNav(false);
    if (next !== "companies") setSearch("");
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="brand-lockup">
          <span className="brand-mark"><BookUser aria-hidden="true" /></span>
          <span><strong>DIRECTORIO</strong><small>Familia Barrios</small></span>
        </div>
        <button className="mobile-close" aria-label="Cerrar menú" onClick={() => setMobileNav(false)}><X /></button>
        <nav className="main-nav" aria-label="Navegación principal">
          {nav.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} className={section === item.id ? "active" : ""} onClick={() => chooseSection(item.id)}><Icon size={19} /><span>{item.label}</span></button>;
          })}
        </nav>
        <div className="sidebar-spacer" />
        <div className="storage-card">
          <span><Cloud size={17} /> Almacenamiento</span>
          <strong>Protegido en la nube</strong>
          <div className="storage-track"><i /></div>
          <small>Cifrado activo · Neon</small>
        </div>
        <button className="account-card" onClick={() => chooseSection("settings")}>
          <span className="avatar small">{initials(initialUser.name)}</span>
          <span><strong>{initialUser.name}</strong><small>{initialUser.role === "admin" ? "Administrador" : "Familiar"}</small></span>
          <ChevronRight size={16} />
        </button>
      </aside>
      {mobileNav && <button className="sidebar-scrim" aria-label="Cerrar menú" onClick={() => setMobileNav(false)} />}

      <div className="app-main">
        <header className="topbar">
          <button className="icon-button menu-button" aria-label="Abrir menú" onClick={() => setMobileNav(true)}><Menu /></button>
          <div className="global-search">
            <Search size={19} />
            <input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar contactos, empresas, NIT, correos, teléfonos…" />
            <kbd>Ctrl K</kbd>
          </div>
          <div className="topbar-actions"><button className="icon-button" aria-label="Notificaciones"><Bell size={19} /></button><button className="icon-button" aria-label="Ayuda"><HelpCircle size={19} /></button><span className="top-avatar">{initials(initialUser.name)}</span></div>
        </header>

        <main className="content-area">
          {section === "dashboard" && <Dashboard contacts={contacts} audit={meta.audit} onOpen={(id) => { setSelectedId(id); setSection("contacts"); }} />}
          {(section === "contacts" || section === "companies") && (
            <ContactsView
              contacts={contacts} selected={selected} loading={loading} status={status}
              title={section === "companies" ? "Empresas" : "Contactos"}
              onStatus={setStatus} onSelect={setSelectedId} onNew={() => setContactModal("new")}
              onEdit={(contact) => setContactModal(contact)} onCredential={(contact) => setCredentialModal({ contact })}
              onEditCredential={(contact, credential) => setCredentialModal({ contact, credential })}
              onArchive={async (contact) => {
                if (!window.confirm(`¿Archivar a ${contact.display_name}? Podrás verlo usando el filtro de inactivos.`)) return;
                await jsonRequest(`/api/contacts/${contact.id}`, { method: "DELETE" });
                await refresh("Contacto archivado");
              }}
              notify={notify}
            />
          )}
          {section === "credentials" && <CredentialsView items={credentials} notify={notify} onOpen={(id) => { setSelectedId(id); setSection("contacts"); }} onEdit={(contact, credential) => setCredentialModal({ contact, credential })} />}
          {section === "addresses" && <AddressesView contacts={contacts} onOpen={(id) => { setSelectedId(id); setSection("contacts"); }} />}
          {section === "notes" && <NotesView contacts={contacts} onOpen={(id) => { setSelectedId(id); setSection("contacts"); }} />}
          {section === "import" && <ImportView onImported={() => refresh("Importación terminada")} notify={notify} />}
          {section === "settings" && <SettingsView user={initialUser} family={meta.users} audit={meta.audit} onPassword={() => setPasswordModal(true)} onBackup={() => setBackupModal(true)} onLogout={logout} />}
        </main>
      </div>

      {contactModal && <ContactModal contact={contactModal === "new" ? null : contactModal} categories={meta.categories} onClose={() => setContactModal(null)} onSaved={async () => { setContactModal(null); await refresh("Contacto guardado"); }} />}
      {credentialModal && <CredentialModal contact={credentialModal.contact} credential={credentialModal.credential} onClose={() => setCredentialModal(null)} onSaved={async () => { const message = credentialModal.credential ? "Credencial actualizada" : "Credencial cifrada y guardada"; setCredentialModal(null); await refresh(message); }} />}
      {passwordModal && <PasswordModal required={initialUser.must_change_password} onClose={() => !initialUser.must_change_password && setPasswordModal(false)} onSaved={() => { setPasswordModal(false); notify("Contraseña actualizada"); }} />}
      {backupModal && <BackupModal onClose={() => setBackupModal(false)} notify={notify} />}
      {toast && <div className="toast"><CheckCircle2 size={18} />{toast}</div>}
    </div>
  );
}

function PageHeading({ icon, title, copy, actions }: { icon: ReactNode; title: string; copy: string; actions?: ReactNode }) {
  return <div className="page-heading"><div className="page-title"><span>{icon}</span><div><h1>{title}</h1><p>{copy}</p></div></div>{actions && <div className="page-actions">{actions}</div>}</div>;
}

function Dashboard({ contacts, audit, onOpen }: { contacts: Contact[]; audit: AuditItem[]; onOpen: (id: string) => void }) {
  const active = contacts.filter((contact) => contact.status === "active").length;
  const companies = contacts.filter((contact) => contact.kind === "company").length;
  const credentials = contacts.reduce((sum, contact) => sum + contact.credentials.length, 0);
  return <section>
    <PageHeading icon={<LayoutDashboard />} title="Resumen familiar" copy="Una vista rápida de la información que está a salvo." />
    <div className="metric-grid">
      <Metric icon={<Users />} label="Contactos activos" value={active} tone="blue" />
      <Metric icon={<Building2 />} label="Empresas" value={companies} tone="gold" />
      <Metric icon={<KeyRound />} label="Credenciales cifradas" value={credentials} tone="purple" />
      <Metric icon={<ShieldCheck />} label="Protección" value="Activa" tone="green" />
    </div>
    <div className="dashboard-grid">
      <div className="panel"><div className="panel-title"><div><h2>Actualizados recientemente</h2><p>Los últimos registros modificados</p></div></div><div className="recent-list">{contacts.slice(0, 6).map((contact) => <button key={contact.id} onClick={() => onOpen(contact.id)}><span className="avatar">{initials(contact.display_name)}</span><span><strong>{contact.display_name}</strong><small>{contact.legal_name || firstMethod(contact, "email") || "Sin información adicional"}</small></span><ChevronRight size={17} /></button>)}</div></div>
      <div className="panel"><div className="panel-title"><div><h2>Actividad de seguridad</h2><p>Acciones recientes registradas</p></div></div><div className="audit-list">{audit.length ? audit.slice(0, 7).map((item) => <div key={item.id}><span className="audit-dot" /><span><strong>{auditLabel(item.action)}</strong><small>{item.user_name || "Sistema"} · {new Date(item.created_at).toLocaleString("es-CO")}</small></span></div>) : <Empty icon={<ShieldCheck />} text="Disponible para el administrador" />}</div></div>
    </div>
  </section>;
}

function Metric({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string | number; tone: string }) {
  return <div className="metric-card"><span className={`metric-icon ${tone}`}>{icon}</span><div><strong>{value}</strong><small>{label}</small></div></div>;
}

function ContactsView(props: {
  contacts: Contact[]; selected: Contact | null; loading: boolean; status: string; title: string;
  onStatus: (value: string) => void; onSelect: (id: string) => void; onNew: () => void;
  onEdit: (contact: Contact) => void; onCredential: (contact: Contact) => void;
  onEditCredential: (contact: Contact, credential: Credential) => void;
  onArchive: (contact: Contact) => void; notify: (message: string) => void;
}) {
  const [cards, setCards] = useState(false);
  return <section>
    <PageHeading icon={props.title === "Empresas" ? <Building2 /> : <Users />} title={props.title} copy="Administra y consulta la información compartida de la familia." actions={<><a className="secondary-button" href="/api/export"><Download size={17} /> Exportar CSV</a><button className="primary-button" onClick={props.onNew}><Plus size={18} /> Nuevo contacto</button></>} />
    <div className="filterbar"><button className="filter-control"><Filter size={16} /> Todos los tipos</button><label className="filter-control"><span className={`status-dot ${props.status}`} /> Estado:<select value={props.status} onChange={(event) => props.onStatus(event.target.value)}><option value="all">Todos</option><option value="active">Activos</option><option value="inactive">Inactivos</option></select></label><button className="clear-filter" onClick={() => props.onStatus("all")}>Limpiar filtros</button><span className="view-toggle"><button className={!cards ? "active" : ""} onClick={() => setCards(false)} aria-label="Vista de tabla"><Table2 size={17} /></button><button className={cards ? "active" : ""} onClick={() => setCards(true)} aria-label="Vista de tarjetas"><LayoutGrid size={17} /></button></span></div>
    <div className={`directory-layout ${props.selected ? "has-detail" : ""}`}>
      <div className="panel contact-list-panel">
        <div className="list-summary">Mostrando <strong>{props.contacts.length}</strong> registros</div>
        {props.loading ? <div className="loading-lines">{Array.from({ length: 6 }, (_, index) => <i key={index} />)}</div> : props.contacts.length === 0 ? <Empty icon={<Users />} text="No hay registros que coincidan con la búsqueda" /> : cards ? <div className="contact-cards">{props.contacts.map((contact) => <ContactCard key={contact.id} contact={contact} active={contact.id === props.selected?.id} onClick={() => props.onSelect(contact.id)} />)}</div> : <ContactTable contacts={props.contacts} selected={props.selected?.id ?? null} onSelect={props.onSelect} />}
      </div>
      {props.selected && <DetailPanel contact={props.selected} onClose={() => props.onSelect("")} onEdit={() => props.onEdit(props.selected!)} onCredential={() => props.onCredential(props.selected!)} onEditCredential={(credential) => props.onEditCredential(props.selected!, credential)} onArchive={() => props.onArchive(props.selected!)} notify={props.notify} />}
    </div>
  </section>;
}

function ContactTable({ contacts, selected, onSelect }: { contacts: Contact[]; selected: string | null; onSelect: (id: string) => void }) {
  return <div className="table-scroll"><table className="contact-table"><thead><tr><th>Nombre completo</th><th>Razón social</th><th>NIT / Cédula</th><th>Teléfono / Celular</th><th>Correo</th><th>Estado</th></tr></thead><tbody>{contacts.map((contact) => <tr key={contact.id} className={selected === contact.id ? "selected" : ""} onClick={() => onSelect(contact.id)}><td><span className="person-cell"><span className="avatar">{initials(contact.display_name)}</span><strong>{contact.display_name}</strong></span></td><td>{contact.legal_name || "—"}</td><td>{contact.tax_id || contact.document_number || "—"}</td><td>{firstMethod(contact, "mobile") || firstMethod(contact, "phone") || "—"}</td><td>{firstMethod(contact, "email") || "—"}</td><td><span className={`status-badge ${contact.status}`}>{contact.status === "active" ? "Activo" : "Inactivo"}</span></td></tr>)}</tbody></table></div>;
}

function ContactCard({ contact, active, onClick }: { contact: Contact; active: boolean; onClick: () => void }) {
  return <button className={`contact-card ${active ? "selected" : ""}`} onClick={onClick}><span className="avatar large">{initials(contact.display_name)}</span><strong>{contact.display_name}</strong><small>{contact.legal_name || (contact.kind === "company" ? "Empresa" : "Persona")}</small><span>{firstMethod(contact, "mobile") || firstMethod(contact, "email") || "Sin teléfono ni correo"}</span><span className={`status-badge ${contact.status}`}>{contact.status === "active" ? "Activo" : "Inactivo"}</span></button>;
}

function DetailPanel({ contact, onClose, onEdit, onCredential, onEditCredential, onArchive, notify }: { contact: Contact; onClose: () => void; onEdit: () => void; onCredential: () => void; onEditCredential: (credential: Credential) => void; onArchive: () => void; notify: (message: string) => void }) {
  const [tab, setTab] = useState<"info" | "credentials" | "notes">("info");
  return <aside className="detail-panel">
    <div className="detail-header"><div className="detail-title"><span className="avatar large">{initials(contact.display_name)}</span><span><strong>{contact.display_name}</strong><small>{contact.legal_name || (contact.kind === "company" ? "Empresa" : "Persona")}</small></span><span className={`status-badge ${contact.status}`}>{contact.status === "active" ? "Activo" : "Inactivo"}</span></div><button className="icon-button" onClick={onClose} aria-label="Cerrar detalle"><X size={20} /></button></div>
    <div className="detail-tabs"><button className={tab === "info" ? "active" : ""} onClick={() => setTab("info")}><UserRound size={16} /> Información</button><button className={tab === "credentials" ? "active" : ""} onClick={() => setTab("credentials")}><KeyRound size={16} /> Credenciales ({contact.credentials.length})</button><button className={tab === "notes" ? "active" : ""} onClick={() => setTab("notes")}><StickyNote size={16} /> Notas ({contact.notes.length})</button></div>
    <div className="detail-body">
      {tab === "info" && <>
        <div className="detail-section"><div className="section-heading"><h3>Información general</h3><button className="small-button" onClick={onEdit}><Pencil size={15} /> Editar</button></div><div className="info-grid"><Info icon={<UserRound />} label="Nombre" value={contact.display_name} /><Info icon={<Building2 />} label="Razón social" value={contact.legal_name} /><Info icon={<ShieldCheck />} label={contact.tax_id ? "NIT" : contact.document_type || "Documento"} value={contact.tax_id || contact.document_number} /><Info icon={<Globe />} label="Sitio web" value={contact.website} link /><Info icon={<Phone />} label="Teléfono" value={firstMethod(contact, "phone")} /><Info icon={<Smartphone />} label="Celular" value={firstMethod(contact, "mobile")} /><Info icon={<Mail />} label="Correo electrónico" value={firstMethod(contact, "email")} /><Info icon={<MapPin />} label="Dirección" value={contact.addresses[0] ? [contact.addresses[0].line1, contact.addresses[0].city, contact.addresses[0].region, contact.addresses[0].country].filter(Boolean).join(", ") : ""} /></div></div>
        <div className="detail-section"><div className="section-heading"><h3>Categorías</h3></div><div className="category-list">{contact.categories.length ? contact.categories.map((category) => <span key={category.id} style={{ "--cat": category.color } as React.CSSProperties}>{category.name}</span>) : <small>Sin categorías</small>}</div></div>
      </>}
      {tab === "credentials" && <div className="detail-section"><div className="section-heading"><h3>Cuentas y credenciales</h3><button className="small-button" onClick={onCredential}><Plus size={15} /> Agregar</button></div>{contact.credentials.length ? <div className="credential-list">{contact.credentials.map((credential) => <CredentialRow key={credential.id} credential={credential} notify={notify} onEdit={() => onEditCredential(credential)} />)}</div> : <Empty icon={<KeyRound />} text="No hay credenciales guardadas" />}</div>}
      {tab === "notes" && <div className="detail-section"><div className="section-heading"><h3>Notas</h3></div>{contact.notes.length ? <div className="notes-list">{contact.notes.map((note) => <article key={note.id}><p>{note.body}</p><small>{new Date(note.created_at).toLocaleDateString("es-CO")}</small></article>)}</div> : <Empty icon={<StickyNote />} text="No hay notas para este contacto" />}</div>}
    </div>
    <div className="detail-footer"><button className="danger-link" onClick={onArchive}><Trash2 size={16} /> Archivar contacto</button></div>
  </aside>;
}

function Info({ icon, label, value, link }: { icon: ReactNode; label: string; value?: string | null; link?: boolean }) {
  return <div className="info-item"><span>{icon}</span><div><small>{label}</small>{value ? link ? <a href={value.startsWith("http") ? value : `https://${value}`} target="_blank" rel="noreferrer">{value}</a> : <strong>{value}</strong> : <em>Sin registrar</em>}</div></div>;
}

function CredentialRow({ credential, notify, onEdit }: { credential: Credential; notify: (message: string) => void; onEdit: () => void }) {
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(false);
  async function reveal() {
    if (secret) { setSecret(""); return; }
    setLoading(true);
    try {
      const data = await jsonRequest<{ secret: string }>(`/api/credentials/${credential.id}/reveal`, { method: "POST" });
      setSecret(data.secret);
      window.setTimeout(() => setSecret(""), 20000);
    } catch (error) { notify(error instanceof Error ? error.message : "No fue posible revelar"); }
    finally { setLoading(false); }
  }
  async function copy() {
    let value = secret;
    if (!value) value = (await jsonRequest<{ secret: string }>(`/api/credentials/${credential.id}/reveal`, { method: "POST" })).secret;
    await navigator.clipboard.writeText(value);
    notify("Contraseña copiada; el portapapeles se limpiará en 30 segundos si la pestaña sigue abierta");
    window.setTimeout(async () => { try { if (await navigator.clipboard.readText() === value) await navigator.clipboard.writeText(""); } catch { /* El navegador puede bloquear la lectura. */ } }, 30000);
  }
  return <div className="credential-row"><span className="platform-icon"><KeyRound size={17} /></span><span><strong>{credential.platform}</strong><small>{credential.username || "Sin usuario"}</small></span><code>{secret || "••••••••••••"}</code><button onClick={reveal} aria-label="Revelar contraseña" disabled={loading}>{secret ? <EyeOff size={17} /> : <Eye size={17} />}</button><button onClick={copy} aria-label="Copiar contraseña"><ClipboardCopy size={17} /></button><button onClick={onEdit} aria-label={`Editar credencial de ${credential.platform}`}><Pencil size={17} /></button></div>;
}

function CredentialsView({ items, notify, onOpen, onEdit }: { items: (Credential & { contact: Contact })[]; notify: (message: string) => void; onOpen: (id: string) => void; onEdit: (contact: Contact, credential: Credential) => void }) {
  return <section><PageHeading icon={<KeyRound />} title="Credenciales" copy="Accesos cifrados asociados a personas y empresas." /><div className="panel standalone-panel">{items.length ? <div className="credential-table"><div className="credential-table-head"><span>Plataforma</span><span>Propietario</span><span>Usuario</span><span>Contraseña</span><span>Acciones</span></div>{items.map((item) => <div className="credential-table-row" key={item.id}><strong>{item.platform}</strong><button onClick={() => onOpen(item.contact.id)}>{item.contact.display_name}</button><span>{item.username || "—"}</span><CredentialRow credential={item} notify={notify} onEdit={() => onEdit(item.contact, item)} /></div>)}</div> : <Empty icon={<KeyRound />} text="Todavía no hay credenciales guardadas" />}</div></section>;
}

function AddressesView({ contacts, onOpen }: { contacts: Contact[]; onOpen: (id: string) => void }) {
  const items = contacts.flatMap((contact) => contact.addresses.map((address) => ({ contact, address })));
  return <section><PageHeading icon={<MapPin />} title="Direcciones" copy="Ubicaciones de personas y empresas." /><div className="tile-grid">{items.length ? items.map(({ contact, address }, index) => <button className="address-tile" key={`${contact.id}-${index}`} onClick={() => onOpen(contact.id)}><span><MapPin /></span><div><strong>{contact.display_name}</strong><p>{address.line1}</p><small>{[address.city, address.region, address.country].filter(Boolean).join(", ")}</small></div></button>) : <div className="panel"><Empty icon={<MapPin />} text="No hay direcciones registradas" /></div>}</div></section>;
}

function NotesView({ contacts, onOpen }: { contacts: Contact[]; onOpen: (id: string) => void }) {
  const items = contacts.flatMap((contact) => contact.notes.map((note) => ({ contact, note })));
  return <section><PageHeading icon={<StickyNote />} title="Notas" copy="Información libre asociada a los registros." /><div className="notes-board">{items.length ? items.map(({ contact, note }) => <button key={note.id} onClick={() => onOpen(contact.id)}><span><StickyNote size={18} /></span><strong>{contact.display_name}</strong><p>{note.body}</p><small>{new Date(note.created_at).toLocaleDateString("es-CO")}</small></button>) : <div className="panel"><Empty icon={<StickyNote />} text="No hay notas registradas" /></div>}</div></section>;
}

function ImportView({ onImported, notify }: { onImported: () => void; notify: (message: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: { registro: string; error: string }[] } | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    setLoading(true);
    try {
      const form = new FormData(); form.set("file", file);
      const data = await jsonRequest<{ imported: number; skipped: number; errors: { registro: string; error: string }[] }>("/api/import", { method: "POST", body: form });
      setResult(data); onImported();
    } catch (error) { notify(error instanceof Error ? error.message : "La importación falló"); }
    finally { setLoading(false); }
  }
  return <section><PageHeading icon={<Upload />} title="Importar libreta" copy="Carga muchos contactos a la vez con un archivo CSV." actions={<a className="secondary-button" href="/plantilla-importacion.csv" download><Download size={17} /> Descargar plantilla</a>} />
    <div className="import-grid"><form className="panel import-panel" onSubmit={submit}><div className="import-step"><span>1</span><div><h2>Descarga y llena la plantilla</h2><p>Una fila puede incluir un contacto y una credencial. Repite el mismo <code>registro_id</code> para agregar varias credenciales al mismo contacto.</p></div></div><div className="import-step"><span>2</span><div><h2>Selecciona el archivo</h2><label className="dropzone"><FileSpreadsheet size={38} /><strong>{file?.name || "Arrastra o selecciona tu CSV"}</strong><small>CSV con punto y coma · máximo 5 MB / 3.000 filas</small><input type="file" accept=".csv,text/csv" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label></div></div><div className="sensitive-warning"><AlertTriangle size={20} /><p>Si incluyes contraseñas en el CSV, bórralo de tu computador después de importarlo. La aplicación las cifra al guardarlas.</p></div><button className="primary-button" disabled={!file || loading}>{loading ? "Importando…" : "Importar datos"}</button></form>
    <div className="panel format-panel"><h2>Columnas más importantes</h2><dl><div><dt>registro_id</dt><dd>Agrupa filas de un mismo contacto.</dd></div><div><dt>tipo</dt><dd><code>persona</code> o <code>empresa</code>.</dd></div><div><dt>nombre_mostrar</dt><dd>Nombre visible y obligatorio.</dd></div><div><dt>nit / numero_documento</dt><dd>Se usan para evitar duplicados.</dd></div><div><dt>categorias</dt><dd>Sepáralas con <code>|</code>.</dd></div><div><dt>contrasena_plataforma</dt><dd>Se cifra inmediatamente.</dd></div></dl>{result && <div className="import-result"><h3>Resultado</h3><span><Check size={16} /> {result.imported} importados</span><span>{result.skipped} duplicados omitidos</span>{result.errors.length > 0 && <details><summary>{result.errors.length} errores</summary>{result.errors.map((error) => <p key={error.registro}><strong>{error.registro}:</strong> {error.error}</p>)}</details>}</div>}</div></div>
  </section>;
}

function SettingsView({ user, family, audit, onPassword, onBackup, onLogout }: { user: AppUser; family: FamilyUser[]; audit: AuditItem[]; onPassword: () => void; onBackup: () => void; onLogout: () => void }) {
  return <section><PageHeading icon={<Settings />} title="Configuración" copy="Acceso familiar, seguridad y respaldos." /><div className="settings-grid"><div className="panel settings-card"><div className="settings-icon"><Users /></div><div><h2>Grupo familiar</h2><p>Solo estas cuatro cuentas pueden iniciar sesión.</p></div><div className="family-list">{family.map((member) => <div key={member.id}><span className="avatar">{initials(member.name)}</span><span><strong>{member.name}</strong><small>{member.email}</small></span><span className={`status-badge ${member.active ? "active" : "inactive"}`}>{member.active ? "Activo" : "Inactivo"}</span></div>)}</div></div><div className="panel settings-card"><div className="settings-icon"><LockKeyhole /></div><div><h2>Seguridad de tu cuenta</h2><p>Usa una contraseña única que no emplees en ninguna otra plataforma.</p></div><button className="secondary-button" onClick={onPassword}>Cambiar mi contraseña</button><button className="danger-link" onClick={onLogout}><LogOut size={16} /> Cerrar sesión</button></div><div className="panel settings-card"><div className="settings-icon"><Download /></div><div><h2>Respaldo completo</h2><p>Descarga contactos y credenciales en un archivo cifrado con una clave elegida por ti.</p></div><button className="secondary-button" onClick={onBackup}>Crear respaldo cifrado</button><a className="text-link" href="/api/export">Exportar CSV sin contraseñas</a></div>{user.role === "admin" && <div className="panel settings-card audit-card"><div className="settings-icon"><ShieldCheck /></div><div><h2>Auditoría reciente</h2><p>Revelaciones de claves, cambios, importaciones y exportaciones.</p></div><div className="audit-list">{audit.slice(0, 10).map((item) => <div key={item.id}><span className="audit-dot" /><span><strong>{auditLabel(item.action)}</strong><small>{item.user_name} · {new Date(item.created_at).toLocaleString("es-CO")}</small></span></div>)}</div></div>}</div></section>;
}

function ContactModal({ contact, categories, onClose, onSaved }: { contact: Contact | null; categories: Category[]; onClose: () => void; onSaved: () => void }) {
  const [methods, setMethods] = useState<Method[]>(contact?.methods.length ? contact.methods.map((item) => ({ ...item })) : [{ type: "mobile", label: "Principal", value: "", is_primary: true }, { type: "email", label: "Principal", value: "", is_primary: true }]);
  const [addresses, setAddresses] = useState<Address[]>(contact?.addresses.length ? contact.addresses.map((item) => ({ ...item })) : []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      kind: form.get("kind"), first_name: form.get("first_name"), middle_name: form.get("middle_name"),
      last_name: form.get("last_name"), second_last_name: form.get("second_last_name"), display_name: form.get("display_name"),
      legal_name: form.get("legal_name"), document_type: form.get("document_type"), document_number: form.get("document_number"),
      tax_id: form.get("tax_id"), verification_digit: form.get("verification_digit"), website: form.get("website"),
      birth_date: form.get("birth_date"), status: form.get("status"), custom_fields: {},
      methods: methods.filter((method) => method.value.trim()), addresses: addresses.filter((address) => address.line1.trim()),
      categories: form.getAll("categories"), note: contact ? null : form.get("note"),
    };
    try {
      await jsonRequest(contact ? `/api/contacts/${contact.id}` : "/api/contacts", { method: contact ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : "No fue posible guardar"); setSaving(false); }
  }
  return <Modal title={contact ? "Editar contacto" : "Nuevo contacto"} onClose={onClose} wide><form className="form-stack" onSubmit={submit}><div className="form-grid"><label>Tipo de registro<select name="kind" defaultValue={contact?.kind || "person"}><option value="person">Persona</option><option value="company">Empresa</option></select></label><label>Estado<select name="status" defaultValue={contact?.status || "active"}><option value="active">Activo</option><option value="inactive">Inactivo</option></select></label><label className="span-2">Nombre para mostrar *<input name="display_name" required minLength={2} defaultValue={contact?.display_name || ""} placeholder="Ej. Juan Pablo Ramírez" /></label><label>Nombres<input name="first_name" defaultValue={contact?.first_name || ""} /></label><label>Segundo nombre<input name="middle_name" defaultValue={contact?.middle_name || ""} /></label><label>Apellidos<input name="last_name" defaultValue={contact?.last_name || ""} /></label><label>Segundo apellido<input name="second_last_name" defaultValue={contact?.second_last_name || ""} /></label><label className="span-2">Razón social<input name="legal_name" defaultValue={contact?.legal_name || ""} /></label><label>Tipo de documento<select name="document_type" defaultValue={contact?.document_type || "CC"}><option>CC</option><option>CE</option><option>Pasaporte</option><option>Otro</option></select></label><label>Número de documento<input name="document_number" defaultValue={contact?.document_number || ""} /></label><label>NIT<input name="tax_id" defaultValue={contact?.tax_id || ""} /></label><label>Dígito de verificación<input name="verification_digit" maxLength={2} defaultValue={contact?.verification_digit || ""} /></label><label>Sitio web<input name="website" type="url" defaultValue={contact?.website || ""} placeholder="https://" /></label><label>Fecha de nacimiento<input name="birth_date" type="date" defaultValue={contact?.birth_date?.slice(0, 10) || ""} /></label></div>
    <FormSection title="Teléfonos y correos" action={<button type="button" className="small-button" onClick={() => setMethods([...methods, { type: "mobile", label: "Otro", value: "", is_primary: false }])}><Plus size={14} /> Agregar</button>}>{methods.map((method, index) => <div className="repeat-row" key={method.id || index}><select value={method.type} onChange={(event) => setMethods(methods.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value as Method["type"] } : item))}><option value="mobile">Celular</option><option value="phone">Teléfono</option><option value="email">Correo</option><option value="other">Otro</option></select><input value={method.value} onChange={(event) => setMethods(methods.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))} placeholder={method.type === "email" ? "correo@ejemplo.com" : "Número"} /><input value={method.label} onChange={(event) => setMethods(methods.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} placeholder="Etiqueta" /><button type="button" onClick={() => setMethods(methods.filter((_, itemIndex) => itemIndex !== index))} aria-label="Eliminar"><X size={17} /></button></div>)}</FormSection>
    <FormSection title="Direcciones" action={<button type="button" className="small-button" onClick={() => setAddresses([...addresses, { label: "Principal", line1: "", city: "", region: "", postal_code: "", country: "Colombia", is_primary: addresses.length === 0 }])}><Plus size={14} /> Agregar</button>}>{addresses.map((address, index) => <div className="address-form" key={address.id || index}><input value={address.line1} onChange={(event) => setAddresses(addresses.map((item, itemIndex) => itemIndex === index ? { ...item, line1: event.target.value } : item))} placeholder="Dirección" /><input value={address.city || ""} onChange={(event) => setAddresses(addresses.map((item, itemIndex) => itemIndex === index ? { ...item, city: event.target.value } : item))} placeholder="Ciudad" /><input value={address.region || ""} onChange={(event) => setAddresses(addresses.map((item, itemIndex) => itemIndex === index ? { ...item, region: event.target.value } : item))} placeholder="Departamento" /><input value={address.country} onChange={(event) => setAddresses(addresses.map((item, itemIndex) => itemIndex === index ? { ...item, country: event.target.value } : item))} placeholder="País" /><button type="button" onClick={() => setAddresses(addresses.filter((_, itemIndex) => itemIndex !== index))} aria-label="Eliminar"><X size={17} /></button></div>)}</FormSection>
    <FormSection title="Categorías"><div className="category-checks">{categories.map((category) => <label key={category.id}><input type="checkbox" name="categories" value={category.id} defaultChecked={contact?.categories.some((item) => item.id === category.id)} /><span style={{ "--cat": category.color } as React.CSSProperties}>{category.name}</span></label>)}</div></FormSection>
    {!contact && <label>Nota inicial<textarea name="note" rows={3} placeholder="Información adicional útil…" /></label>}{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={saving}>{saving ? "Guardando…" : "Guardar contacto"}</button></div></form></Modal>;
}

function CredentialModal({ contact, credential, onClose, onSaved }: { contact: Contact; credential?: Credential; onClose: () => void; onSaved: () => void }) {
  const [show, setShow] = useState(false); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setError(""); const form = new FormData(event.currentTarget); const secret = String(form.get("secret") || ""); try { await jsonRequest(credential ? `/api/credentials/${credential.id}` : "/api/credentials", { method: credential ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...(!credential && { contact_id: contact.id }), platform: form.get("platform"), username: form.get("username"), ...(secret && { secret }), url: form.get("url"), notes: form.get("notes") }) }); onSaved(); } catch (err) { setError(err instanceof Error ? err.message : "No fue posible guardar"); setSaving(false); } }
  return <Modal title={`${credential ? "Editar" : "Nueva"} credencial · ${contact.display_name}`} onClose={onClose}><form className="form-stack" onSubmit={submit}><label>Plataforma *<input name="platform" required defaultValue={credential?.platform || ""} placeholder="Ej. DIAN, Google, banco…" /></label><label>Usuario<input name="username" autoComplete="off" defaultValue={credential?.username || ""} /></label><label>{credential ? "Nueva contraseña" : "Contraseña *"}<span className="password-field"><input name="secret" required={!credential} type={show ? "text" : "password"} autoComplete="new-password" placeholder={credential ? "Déjala vacía para conservar la actual" : ""} /><button type="button" onClick={() => setShow(!show)} aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label><label>Dirección web<input name="url" type="url" defaultValue={credential?.url || ""} placeholder="https://" /></label><label>Notas<textarea name="notes" rows={3} defaultValue={credential?.notes || ""} /></label><div className="encryption-callout"><ShieldCheck size={18} /> {credential ? "Si escribes una nueva contraseña, se cifrará y reemplazará la anterior." : "Se cifrará antes de guardarse."}</div>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={saving}>{saving ? "Cifrando…" : credential ? "Guardar cambios" : "Guardar credencial"}</button></div></form></Modal>;
}

function PasswordModal({ required, onClose, onSaved }: { required: boolean; onClose: () => void; onSaved: () => void }) {
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); const form = new FormData(event.currentTarget); if (form.get("newPassword") !== form.get("confirmPassword")) { setError("Las nuevas contraseñas no coinciden"); setSaving(false); return; } try { await jsonRequest("/api/auth/change-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ currentPassword: form.get("currentPassword"), newPassword: form.get("newPassword") }) }); onSaved(); } catch (err) { setError(err instanceof Error ? err.message : "No fue posible cambiarla"); setSaving(false); } }
  return <Modal title={required ? "Crea tu contraseña personal" : "Cambiar contraseña"} onClose={onClose} locked={required}><form className="form-stack" onSubmit={submit}>{required && <div className="encryption-callout"><LockKeyhole size={18} /> Por seguridad, debes reemplazar la contraseña temporal antes de continuar.</div>}<label>Contraseña actual<input name="currentPassword" type="password" required autoComplete="current-password" /></label><label>Nueva contraseña<input name="newPassword" type="password" required autoComplete="new-password" /></label><label>Confirmar nueva contraseña<input name="confirmPassword" type="password" required autoComplete="new-password" /></label><small>Mínimo 12 caracteres, con mayúscula, minúscula, número y símbolo.</small>{error && <div className="form-error">{error}</div>}<div className="modal-actions">{!required && <button type="button" className="secondary-button" onClick={onClose}>Cancelar</button>}<button className="primary-button" disabled={saving}>{saving ? "Actualizando…" : "Guardar nueva contraseña"}</button></div></form></Modal>;
}

function BackupModal({ onClose, notify }: { onClose: () => void; notify: (message: string) => void }) {
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setLoading(true); const form = new FormData(event.currentTarget); if (form.get("backupPassword") !== form.get("confirmBackup")) { setError("Las claves del respaldo no coinciden"); setLoading(false); return; } try { const response = await fetch("/api/export", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ currentPassword: form.get("currentPassword"), backupPassword: form.get("backupPassword") }) }); if (!response.ok) { const data = await response.json(); throw new Error(data.error); } const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `respaldo-directorio-${new Date().toISOString().slice(0, 10)}.dfbackup`; anchor.click(); URL.revokeObjectURL(url); onClose(); notify("Respaldo cifrado descargado. Guarda también su clave en un lugar distinto"); } catch (err) { setError(err instanceof Error ? err.message : "No fue posible crear el respaldo"); } finally { setLoading(false); } }
  return <Modal title="Crear respaldo cifrado" onClose={onClose}><form className="form-stack" onSubmit={submit}><div className="sensitive-warning"><AlertTriangle size={20} /><p>Si olvidas la clave del respaldo, no será posible recuperar su contenido. No uses la misma contraseña de tu cuenta.</p></div><label>Contraseña actual de tu cuenta<input name="currentPassword" type="password" required /></label><label>Clave para cifrar el respaldo<input name="backupPassword" type="password" minLength={12} required /></label><label>Confirmar clave del respaldo<input name="confirmBackup" type="password" minLength={12} required /></label>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={loading}>{loading ? "Cifrando…" : "Descargar respaldo"}</button></div></form></Modal>;
}

function Modal({ title, onClose, children, wide, locked }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean; locked?: boolean }) {
  return <div className="modal-backdrop" role="presentation"><div className={`modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}><div className="modal-header"><h2>{title}</h2>{!locked && <button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>}</div><div className="modal-body">{children}</div></div></div>;
}

function FormSection({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) { return <fieldset className="form-section"><legend><span>{title}</span>{action}</legend>{children}</fieldset>; }
function Empty({ icon, text }: { icon: ReactNode; text: string }) { return <div className="empty-state"><span>{icon}</span><p>{text}</p></div>; }
function auditLabel(action: string) { return ({ "credential.reveal": "Credencial revelada", "credential.create": "Credencial creada", "credential.update": "Credencial actualizada", "credential.delete": "Credencial eliminada", "contact.create": "Contacto creado", "contact.update": "Contacto actualizado", "contact.archive": "Contacto archivado", "import.csv": "Archivo importado", "export.csv": "CSV exportado", "export.encrypted_backup": "Respaldo cifrado", "password.change": "Contraseña actualizada" } as Record<string, string>)[action] || action; }
