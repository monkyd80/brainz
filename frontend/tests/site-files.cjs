const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const library = { exports: {} };
vm.runInNewContext(ts.transpile(fs.readFileSync('src/lib/site-files.ts', 'utf8'), { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }), { exports: library.exports, FormData });
const { MAX_SITE_FILE_BYTES, validateSiteFiles, siteWriteRequest, formatSiteFileDate, formatSiteFileSize } = library.exports;

test('5MB is accepted and oversized or empty files are rejected', () => {
  const exact = new File([new Uint8Array(MAX_SITE_FILE_BYTES)], 'allowed.bin');
  assert.doesNotThrow(() => validateSiteFiles([exact]));
  assert.throws(() => validateSiteFiles([new File([new Uint8Array(MAX_SITE_FILE_BYTES + 1)], 'large.bin')]), /5MB/);
  assert.throws(() => validateSiteFiles([new File([], 'empty.txt')]), /비어/);
});

test('multipart requests preserve JSON values, names and all selected files', async () => {
  const payload = { name: '첨부 사이트', current_file_date: null, remote_support: false };
  const files = [new File(['hello'], '한글 파일.txt'), new File(['two'], 'other.pdf')];
  const headers = { Authorization: 'Token test', 'Content-Type': 'application/json' };
  const request = siteWriteRequest(payload, files, headers);
  assert.equal(request.headers.Authorization, headers.Authorization);
  assert.equal(request.headers['Content-Type'], undefined);
  assert.deepEqual(JSON.parse(request.body.get('data')), payload);
  assert.equal(request.body.getAll('files').length, 2);
  assert.equal(request.body.getAll('files')[0].name, '한글 파일.txt');
  assert.equal(await request.body.getAll('files')[0].text(), 'hello');
  const json = siteWriteRequest(payload, [], headers);
  assert.equal(json.headers, headers);
  assert.deepEqual(JSON.parse(json.body), payload);
});

test('file list renders required columns, Korean date, file name and readable size', () => {
  const component = { exports: {} };
  vm.runInNewContext(ts.transpile(fs.readFileSync('src/components/site-files.tsx', 'utf8'), { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React }), {
    exports: component.exports, React, process: { env: {} }, require: name => name === 'react' ? React : library.exports,
  });
  const file = { id: 1, company: 2, original_name: '사이트 자료.pdf', size: 1048576, uploaded_at: '2026-10-27T00:15:00Z' };
  const html = renderToStaticMarkup(React.createElement(component.exports.SiteFilesPanel, { files: [file] }));
  for (const text of ['추가정보파일', '이름', '업로드 날짜', '용량', file.original_name, '1.00 MB']) assert.ok(html.includes(text), text);
  assert.ok(formatSiteFileDate(file.uploaded_at).includes('09:15'));
  assert.equal(formatSiteFileSize(0), '0 B');
  assert.equal(formatSiteFileSize(1024), '1.0 KB');
  const empty = renderToStaticMarkup(React.createElement(component.exports.SiteFilesPanel));
  assert.ok(empty.includes('등록된 파일이 없습니다.'));
});
