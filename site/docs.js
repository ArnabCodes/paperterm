const search = document.querySelector('#docs-query');
const sections = [...document.querySelectorAll('[data-doc-section]')];
const links = [...document.querySelectorAll('.docs-sidebar nav a')];
const indexes = sections.map(section => section.textContent.toLocaleLowerCase());
document.querySelector('.docs-search').hidden = false;
function filter() {
  const terms = search.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  let count = 0;
  sections.forEach((section, index) => {
    const match = terms.every(term => indexes[index].includes(term));
    section.hidden = !match;
    links[index].hidden = !match;
    if (match) count++;
  });
  document.querySelector('#docs-empty').hidden = count !== 0;
  document.querySelector('#docs-status').textContent = `${count} of ${sections.length} topics${terms.length ? ' match' : ''}`;
}
function current() { links.forEach(link => { if (link.hash === location.hash) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current'); }); }
search.addEventListener('input', filter);
search.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); search.value = ''; filter(); } });
document.querySelector('#docs-clear').addEventListener('click', () => { search.value = ''; filter(); search.focus(); });
window.addEventListener('hashchange', () => {
  const target = sections.find(section => `#${section.id}` === location.hash);
  if (target?.hidden) { search.value = ''; filter(); target.scrollIntoView(); }
  current();
});
current(); filter();
