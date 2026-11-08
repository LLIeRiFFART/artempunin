import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const files = [
  'index.html',
  'index-ru.html',
  'services/landing.html',
  'services/landing-ru.html',
  'services/multipage.html',
  'services/multipage-ru.html',
  'services/hosting.html',
  'services/hosting-ru.html',
  'services/support.html',
  'services/support-ru.html',
  'robots.txt',
  'sitemap.xml'
];

const raw = process.argv[2];
if (!raw) {
  console.error('Использование: node set-domain.mjs example.com');
  process.exit(1);
}

const domain = raw.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) {
  console.error('Не похоже на домен: ' + domain);
  process.exit(1);
}

const markerFile = '.domain';
const prev = existsSync(markerFile) ? readFileSync(markerFile, 'utf8').trim() : '';
const targets = ['__DOMAIN__'];
if (prev && prev !== domain) targets.push(prev);

let total = 0;
for (const file of files) {
  if (!existsSync(file)) {
    console.warn('пропуск (нет файла): ' + file);
    continue;
  }
  let text = readFileSync(file, 'utf8');
  let count = 0;
  for (const t of targets) {
    const parts = text.split(t);
    count += parts.length - 1;
    text = parts.join(domain);
  }
  if (count > 0) {
    writeFileSync(file, text);
    console.log(file + ': ' + count);
    total += count;
  }
}

writeFileSync(markerFile, domain + '\n');
console.log(total > 0
  ? 'Готово: ' + total + ' замен → https://' + domain
  : 'Заменять нечего — похоже, домен уже ' + domain);
