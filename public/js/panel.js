/**
 * Analyst panel (RF-06 to RF-11). Every piece of data is rendered with Dom.h, i.e. as
 * text, never as HTML (RNF-07).
 */
(function () {
  'use strict';

  const { h } = Dom;

  const STATUS_LABELS = { PENDIENTE: 'Pendiente', VIABLE: 'Viable', NO_VIABLE: 'No viable' };
  const dateFormat = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
  const dayFormat = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' });
  const formatDate = (iso) => dateFormat.format(new Date(iso));
  const formatDay = (iso) => dayFormat.format(new Date(iso));

  const els = {
    analystName: document.getElementById('analyst-name'),
    logoutButton: document.getElementById('logout-button'),
    filter: document.getElementById('status-filter'),
    tableBody: document.getElementById('applicants-body'),
    empty: document.getElementById('applicants-empty'),
    status: document.getElementById('panel-status'),
    detail: document.getElementById('detail'),
  };

  let selectedId = null;

  class SessionExpiredError extends Error {}

  /** API call that sends the analyst to the login page if the session is gone (RNF-02). */
  async function call(method, url, options) {
    const res = await Api.request(method, url, options);
    if (res.status === 401) {
      window.location.assign('/login.html');
      throw new SessionExpiredError();
    }
    return res;
  }

  function announce(message, kind = '') {
    els.status.textContent = message;
    els.status.className = `form-status ${kind}`.trim();
  }

  const statusBadge = (status) =>
    h('span', { className: `badge badge-${status.toLowerCase()}` }, STATUS_LABELS[status]);

  // ---- List (RF-06, RF-11) -------------------------------------------------

  function renderList(applicants) {
    els.tableBody.replaceChildren(
      ...applicants.map((applicant) =>
        h(
          'tr',
          { 'data-id': applicant.id, 'aria-current': applicant.id === selectedId && 'true' },
          h(
            'td',
            {},
            // The name is the button that opens the detail (keyboard accessible).
            h(
              'button',
              {
                type: 'button',
                className: 'button link',
                onClick: () => {
                  announce(''); // a message about another applicant would be misleading
                  showDetail(applicant.id, { focus: true });
                },
              },
              applicant.fullName,
            ),
          ),
          h('td', {}, applicant.career),
          h('td', { className: 'numeric' }, applicant.semester),
          h('td', { className: 'nowrap' }, statusBadge(applicant.status)),
          h('td', { className: 'nowrap' }, formatDay(applicant.createdAt)),
        ),
      ),
    );
    els.empty.hidden = applicants.length > 0;
    els.empty.textContent = els.filter.value
      ? 'No hay practicantes con este estado.'
      : 'Aún no hay postulaciones.';
  }

  async function loadList() {
    const status = els.filter.value;
    const url = status ? `/api/applicants?status=${encodeURIComponent(status)}` : '/api/applicants';
    const res = await call('GET', url);
    if (!res.ok) {
      announce(Api.errorMessage(res, 'No fue posible cargar la lista.'), 'error');
      return;
    }
    renderList(res.data);
  }

  // ---- Detail, decision and history (RF-07 to RF-10) -----------------------

  function renderHistory(changes) {
    if (changes.length === 0) {
      return h('p', { className: 'empty' }, 'Aún no hay decisiones.');
    }
    return h(
      'ol',
      { className: 'history' },
      changes.map((change) =>
        h(
          'li',
          {},
          h(
            'span',
            { className: 'history-change' },
            statusBadge(change.previousStatus),
            ' → ',
            statusBadge(change.newStatus),
          ),
          h(
            'span',
            { className: 'history-meta' },
            `por ${change.changedBy} · ${formatDate(change.changedAt)}`,
          ),
        ),
      ),
    );
  }

  function renderDetail(applicant, history) {
    const decisionButton = (status, label, className) =>
      h(
        'button',
        {
          type: 'button',
          className: `button ${className}`,
          disabled: applicant.status === status,
          onClick: () => decide(applicant.id, status),
        },
        label,
      );

    const field = (label, value) => [h('dt', {}, label), h('dd', {}, value)];

    els.detail.replaceChildren(
      h('h2', { id: 'detail-title', tabindex: '-1' }, applicant.fullName),
      h(
        'dl',
        { className: 'detail-fields' },
        field('Estado', statusBadge(applicant.status)),
        field('Correo', applicant.email),
        field('Carrera', applicant.career),
        field('Semestre', applicant.semester),
        field('Registro', formatDate(applicant.createdAt)),
        field('Autorización', formatDate(applicant.dataConsentAt)),
      ),
      h(
        'div',
        { className: 'actions', role: 'group', 'aria-label': 'Decisión' },
        decisionButton('VIABLE', 'Marcar como viable', 'success'),
        decisionButton('NO_VIABLE', 'Marcar como no viable', 'danger'),
      ),
      h(
        'a',
        { className: 'button secondary', href: `/api/applicants/${applicant.id}/cv`, download: '' },
        'Descargar hoja de vida (PDF)',
      ),
      h('h3', {}, 'Historial de decisiones'),
      renderHistory(history),
    );
  }

  async function showDetail(id, { focus = false } = {}) {
    selectedId = id;
    const [detail, history] = await Promise.all([
      call('GET', `/api/applicants/${id}`),
      call('GET', `/api/applicants/${id}/status-history`),
    ]);
    if (!detail.ok || !history.ok) {
      announce(Api.errorMessage(detail.ok ? history : detail), 'error');
      return;
    }
    renderDetail(detail.data, history.data);
    for (const row of els.tableBody.rows) {
      if (Number(row.dataset.id) === id) row.setAttribute('aria-current', 'true');
      else row.removeAttribute('aria-current');
    }
    // Move focus to the detail so keyboard and screen reader users land on it.
    if (focus) document.getElementById('detail-title').focus();
  }

  async function decide(id, status) {
    const res = await call('PUT', `/api/applicants/${id}/status`, { json: { status } });
    if (!res.ok) {
      announce(Api.errorMessage(res), 'error');
      return;
    }
    announce(`Decisión registrada: ${res.data.fullName} es ${STATUS_LABELS[status]}.`, 'success');
    await loadList(); // the status (and the filter result) changed
    await showDetail(id);
  }

  // ---- Session -------------------------------------------------------------

  async function logout() {
    await Api.request('POST', '/api/auth/logout').catch(() => {});
    window.location.assign('/login.html');
  }

  async function init() {
    const me = await call('GET', '/api/auth/me');
    els.analystName.textContent = me.data.username;
    document.body.classList.remove('pending');

    els.logoutButton.addEventListener('click', logout);
    els.filter.addEventListener('change', loadList);
    await loadList();
  }

  init().catch((err) => {
    if (err instanceof SessionExpiredError) return;
    document.body.classList.remove('pending');
    announce('No hay conexión con el servidor. Recarga la página.', 'error');
  });
})();
