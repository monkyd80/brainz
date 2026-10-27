const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
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
const source = fs.readFileSync('src/app/dashboard/page.tsx', 'utf8');
const formSource = fs.readFileSync('src/components/site-add-dialog.tsx', 'utf8');
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
    const context = { ...library, editing: { id: 1, solutions: [], hardware_specs: [] }, API: '/api', FormData: function () { return form; }, localStorage: { getItem: () => 'test' }, readSystemRows: () => [], setAllCompanies() {}, setMyCompanies() {}, setEditing() {}, openCompany() {}, refreshSiteData: async () => {}, fetch: async (url, options) => { calls.push({ url, body: options.body && JSON.parse(options.body) }); return { ok: true, json: async () => ({ id: 1 }) }; } };
    const code = source.slice(source.indexOf(`  async function ${name}(`), source.indexOf(`  async function ${end}(`));
    evaluate(code + `\nthis.run = ${name};`, context);
    await context.run({ preventDefault() {}, currentTarget: {} });
    const saved = calls.filter(call => call.url === '/api/solutions/');
    assert.equal(saved.length, 3, name);
    for (const call of saved) {
      for (const [field, value] of Object.entries(fields[call.body.category])) assert.equal(call.body[field], value, `${name}: ${field}`);
      assert.equal(call.body.used_quantity, null);
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

test('center details and site summaries show category counts, including zero', () => {
  const start = source.indexOf('function RecordSection(');
  const end = source.indexOf('\nfunction InfoGrid(', start);
  const labels = source.slice(source.indexOf('const HISTORY_FIELD_LABELS:'), source.indexOf('type SearchCategory'));
  const { Section } = evaluate(source.slice(start, end) + '\n' + labels + '\nthis.Section = RecordSection;', { React, ...library });
  for (const [category, quantities] of Object.entries(fields)) {
    const row = { category, product_name: category.toUpperCase(), ...quantities };
    const html = renderToStaticMarkup(React.createElement(Section, { title: '구축 솔루션 (License)', rows: [row] }));
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
