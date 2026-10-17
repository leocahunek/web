const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const context = vm.createContext({
  URL, window: {},
  document: { currentScript: { src: 'https://example.com/web/assets/portfolio-store.js' } }
});
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../assets/portfolio-store.js'), 'utf8'), context);
const { normalizeProjects, photoLimit } = context.window.LeoPortfolio;
const legacy = { id:'photo', name:'Projekt', cat:'photo', image:'https://example.com/cover.jpg' };
const normalize = project => JSON.parse(JSON.stringify(normalizeProjects([project])[0]));

test('legacy single-image and video projects remain compatible', () => {
  assert.deepEqual(normalize(legacy).images, [legacy.image]);
  const video = normalize({...legacy, cat:'video', image:'', video:'https://example.com/movie.mp4'});
  assert.equal(video.video, 'https://example.com/movie.mp4');
  assert.deepEqual(video.images, []);
});
test('photo order determines cover and survives repeated normalization', () => {
  const images = ['https://example.com/second.jpg', legacy.image];
  const result = normalize({...legacy, images});
  assert.equal(result.image, images[0]);
  assert.deepEqual(result.images, images);
  assert.deepEqual(normalize(result), result);
  assert.equal(legacy.image, 'https://example.com/cover.jpg');
});
test('all photo URLs are validated, including non-cover photos', () => {
  for (const invalid of ['javascript:alert(1)', 'http://external.example/photo.jpg', 'https://user:pass@example.com/photo.jpg', '', null]) {
    assert.throws(() => normalize({...legacy, images:[legacy.image, invalid]}));
  }
  assert.throws(() => normalize({...legacy, images:'not-an-array'}));
});
test('photo count is bounded and existing cover can fill an empty photo list', () => {
  assert.equal(normalize({...legacy, images:Array(photoLimit).fill(legacy.image)}).images.length, photoLimit);
  assert.throws(() => normalize({...legacy, images:Array(photoLimit + 1).fill(legacy.image)}));
  assert.deepEqual(normalize({...legacy, images:[]}).images, [legacy.image]);
  assert.throws(() => normalize({...legacy, image:'', images:[]}));
});

test('travel photography supports the same ordered photo galleries', () => {
  const images = [legacy.image, 'https://example.com/travel.jpg'];
  const project = normalize({...legacy, cat:'travel', images});
  assert.equal(project.cat,'travel');
  assert.equal(project.art,'travel');
  assert.deepEqual(project.images,images);
  assert.deepEqual(normalize(project),project);
  assert.throws(() => normalize({...legacy,cat:'unknown'}));
});
