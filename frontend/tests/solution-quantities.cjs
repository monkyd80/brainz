const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function evaluate(code, context = {}) {
  vm.createContext(context);
  vm.runInContext(ts.transpile(code, { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React }), context);
  return context;
}
const library = evaluate(fs.readFileSync('src/lib/solutions.ts', 'utf8'), { exports: {} }).exports;
Object.assign(library, evaluate(fs.readFileSync('src/lib/site-files.ts', 'utf8'), { exports: {}, FormData }).exports);
Object.assign(library, evaluate(fs.readFileSync('src/lib/site-deliveries.ts', 'utf8'), { exports: {} }).exports);
const source = fs.readFileSync('src/app/dashboard/page.tsx', 'utf8');
const formSource = fs.readFileSync('src/components/site-add-dialog.tsx', 'utf8');
const historyLabels = source.slice(source.indexOf('const HISTORY_FIELD_LABELS:'), source.indexOf('type SearchCategory'));
const fields = { sms: { linux_windows_quantity: 0, unix_quantity: 12 }, nms: { snmp_quantity: 99, icmp_quantity: 23, sdn_quantity: 0 }, dbms: { oracle_quantity: 5 } };

test('new sites and edits save detail counts even when main counts are blank', async () => {
  for (const [name, end] of [['createCompany', 'responseData'], ['updateCompany', 'deleteCompany']]) {
    const form = new FormData();
    form.set('name', '수량 테스트');
    for (const [category, values] of Object.entries(fields)) {
      form.set(`license_${category}_used`, '');
      form.set(`license_${category}_label`, category.toUpperCase());
      for (const [field, value] of Object.entries(values)) form.set(`license_${category}_${field}`, String(value));
    }
    const calls = [];
    const context = { ...library, editing: { id: 1, solutions: [], hardware_specs: [] }, API: '/api', crypto: webcrypto, FormData: function () { return form; }, localStorage: { getItem: () => 'test' }, readSystemRows: () => [], setAllCompanies() {}, setMyCompanies() {}, setEditing() {}, openCompany() {}, refreshSiteData: async () => {}, fetch: async (url, options) => { calls.push({ url: new URL(url, 'http://localhost').pathname, body: options.body && JSON.parse(options.body) }); return { ok: true, json: async () => ({ id: 1 }) }; } };
    const code = source.slice(source.indexOf(`  async function ${name}(`), source.indexOf(`  async function ${end}(`));
    evaluate(code + `\nthis.run = ${name};`, context);
    await context.run({ preventDefault() {}, currentTarget: {} });
    const saved = name === 'createCompany'
      ? calls.find(call => call.url === '/api/companies/').body.registration_records.solutions
      : calls.filter(call => call.url === '/api/solutions/').map(call => call.body);
    assert.equal(saved.length, 3, name);
    for (const row of saved) {
      for (const [field, value] of Object.entries(fields[row.category])) assert.equal(row[field], value, `${name}: ${field}`);
      assert.equal(row.used_quantity, null);
    }
  }
});

test('reopening a saved site retains zero and all six counts', () => {
  const code = source.slice(source.indexOf('function editInitialValues('), source.indexOf('type SearchScope'));
  const { read } = evaluate(code + '\nthis.read = editInitialValues;', { ...library });
  const values = read({ name: 'site', support_staff: '', solutions: Object.entries(fields).map(([category, quantities]) => ({ category, ...quantities })) });
  for (const [category, quantities] of Object.entries(fields)) {
    for (const [field, value] of Object.entries(quantities)) assert.equal(values[`license_${category}_${field}`], String(value));
  }
  const blank = new FormData();
  blank.set('license_sms_linux_windows_quantity', '0');
  assert.equal(library.solutionQuantityValues(blank, 'sms').linux_windows_quantity, 0);
  assert.equal(library.solutionQuantityValues(blank, 'sms').unix_quantity, null);
});

test('cards show only their own number inputs above additional information', () => {
  const start = formSource.indexOf('function LicenseInput(');
  const end = formSource.indexOf('\nfunction Check(', start);
  const { Card } = evaluate(formSource.slice(start, end) + '\nthis.Card = LicenseInput;', { React, ...library, useInitialValue: () => '' });
  for (const category of ['sms', 'nms', 'dbms', 'apm']) {
    const html = renderToStaticMarkup(React.createElement(Card, { code: category, label: category.toUpperCase() }));
    for (const [field, label] of library.solutionQuantityFields[category] ?? []) {
      assert.ok(html.includes(`aria-label="${category.toUpperCase()} ${label}"`));
      assert.ok(html.indexOf(`name="license_${category}_${field}"`) < html.indexOf(`name="license_${category}_additional"`));
    }
    const count = (html.match(/type="number"/g) ?? []).length;
    assert.equal(count, 2 + (library.solutionQuantityFields[category]?.length ?? 0));
  }
});

function renderSolutionSection(rows) {
  const start = source.indexOf('function SolutionSection(');
  const end = source.indexOf('\nfunction InfoGrid(', start);
  const { Section } = evaluate(source.slice(start, end) + '\n' + historyLabels + '\nthis.Section = SolutionSection;', { React, ...library });
  return renderToStaticMarkup(React.createElement(Section, { rows }));
}

test('center details and site summaries show category counts, including zero', () => {
  for (const [category, quantities] of Object.entries(fields)) {
    const row = { category, product_name: category.toUpperCase(), ...quantities };
    const html = renderSolutionSection([row]);
    const summary = library.solutionSummary([row]);
    for (const [field, label] of library.solutionQuantityFields[category]) {
      assert.ok(html.includes(`>${label}</dt>`), category);
      assert.ok(summary.includes(`${label}: ${quantities[field]}`), category);
    }
    if (Object.values(quantities).includes(0)) assert.match(html, />0<\/dd>/);
    for (const [other, definitions] of Object.entries(library.solutionQuantityFields)) {
      if (other !== category) for (const [, label] of definitions) assert.ok(!html.includes(`>${label}</dt>`));
    }
  }
});

test('solution cards omit empty entries and fields while keeping notes and legacy values', () => {
  const empty = { category: 'apm', product_name: '빈 솔루션', used_quantity: null, other_detail: '  ', additional_info: ' - ' };
  const html = renderSolutionSection([
    empty,
    { category: 'oz', additional_info: '보고서 안내\n두 번째 줄' },
    { category: 'other', product_name: '기존 솔루션', license_detail: '기존 라이선스', quantity: 0 },
  ]);
  assert.equal((html.match(/<article /g) ?? []).length, 2);
  assert.doesNotMatch(html, /빈 솔루션|>사용 개수<|>전체 개수<|>기타<|등록된 정보가 없습니다/);
  assert.match(html, />OZ 보고서<\/h4>/);
  assert.match(html, /보고서 안내\n두 번째 줄/);
  assert.match(html, /기존 라이선스/);
  assert.match(html, />0<\/dd>/);
  const noCards = renderSolutionSection([empty]);
  assert.doesNotMatch(noCards, /<article /);
  assert.match(noCards, /등록된 정보가 없습니다/);
});

test('basic and detail tabs list checked deliveries once in the contract and product section', () => {
  const sections = source.slice(source.indexOf('function Content('), source.indexOf('function Hardware('));
  const { CenterContent } = evaluate(sections + '\n' + historyLabels + '\nthis.CenterContent = Content;', {
    React, ...library, SiteFilesPanel: () => null,
  });
  const delivery = { supplied_server: true, supplied_os: false, supplied_db: true };
  const products = [{ product_name: 'EMS' }, { product_name: 'NMS' }];

  for (const tab of ['basic', 'detail']) {
    for (const contract_products of [[], products]) {
      const company = { id: 1, name: '납품 테스트', contract_products, ...delivery };
      const render = company => renderToStaticMarkup(React.createElement(CenterContent, { tab, company, onDashboardOpen: () => {} }));
      const html = render(company);
      const contract = html.match(/>계약·제품<\/h3>[\s\S]*?<\/section>/)?.[0];
      assert.ok(contract, tab);
      assert.match(contract, />납품 정보<\/dt><dd[^>]*>Server 납품 \/ DB 납품<\/dd>/);
      assert.equal((html.match(/>납품 정보<\/dt>/g) ?? []).length, 1);
      assert.doesNotMatch(html, /OS 납품/);

      const unchecked = render({ ...company, supplied_server: false, supplied_db: false });
      assert.doesNotMatch(unchecked, /Server 납품|OS 납품|DB 납품/);
      if (contract_products.length) {
        assert.match(unchecked, />납품 정보<\/dt><dd[^>]*>없음<\/dd>/);
      } else {
        assert.doesNotMatch(unchecked, />납품 정보<\/dt>/);
      }
    }
  }
});

test('product search joins matching content by site and item', () => {
  const terms = source.slice(source.indexOf('const searchTerms = '), source.indexOf('type SearchRow'));
  const search = source.slice(source.indexOf('  const rowsFor = '), source.indexOf('  const sortedTextResults = '));
  const { searchRows } = evaluate(
    terms + '\nthis.searchRows = (companies, conditions, resultQuery = "") => {\n' + search + '\nreturn textResults; };',
    { ...library, HISTORY_FIELD_LABELS: { package_name: '패키지' }, useMemo: run => run() },
  );
  const company = {
    id: 1, name: '납품 테스트', supplied_server: true, supplied_os: false, supplied_db: true,
    contract_products: [
      { package_name: 'EMS Basic' }, { package_name: 'EMS Pro' }, { package_name: 'EMS Pro' },
    ],
  };
  const sites = [company, { ...company, id: 2, supplied_server: false, supplied_db: false }];
  const results = searchRows(sites, [{ category: 'product', value: '납품 EMS' }]);
  assert.deepEqual(Array.from(results, row => [row.company.id, row.item, row.content]), [
    [1, '계약·제품 · 패키지', 'EMS Basic / EMS Pro'],
    [1, '계약·제품 · 납품', 'Server 납품 / DB 납품'],
    [2, '계약·제품 · 패키지', 'EMS Basic / EMS Pro'],
  ]);
  assert.equal(searchRows(sites, [{ category: 'product', value: '납품' }], 'DB 납품')[0].content, 'DB 납품');
  assert.equal(searchRows(sites, [{ category: 'product', value: 'OS 납품' }]).length, 0);
  assert.deepEqual(Array.from(searchRows(sites, [{ category: 'product', value: ' ALL ' }]), row => row.content),
    ['EMS Basic / EMS Pro', 'Server 납품 / DB 납품', 'EMS Basic / EMS Pro']);
  assert.ok(searchRows([{ ...company, id: 3, current_file_date: '2026-04-08' }], [
    { category: 'registrationDate', value: 'all' }, { category: 'product', value: 'DB 납품' },
  ]).some(row => row.content === '2026-04-08'));
  assert.equal(searchRows(sites, [
    { category: 'product', value: 'all' }, { category: 'site', value: '일치하지 않는 사이트' },
  ]).length, 0);
});
