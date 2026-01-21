const DOCS_API = '/api/docs';
const DOCS_PATH = '/docs/';

let docs = [];
let docsCategories = {};

const elList = document.getElementById('doc-list');
const elBody = document.getElementById('doc-body');
const elMeta = document.getElementById('doc-meta');
const elSearch = document.getElementById('search');
const elCategories = document.getElementById('categories');

// Document categorization
const docCategories = {
  'Getting Started': ['GETTING_STARTED.md', 'MASTER_DOCUMENTATION.md', 'README.md'],
  'API Reference': ['API_REFERENCE.md', 'ENDPOINTS_CHEATSHEET.md', 'ENDPOINTS_BY_TOKEN.md'],
  'Integration Guides': ['UNITY_INTEGRATION.md'],
  'Features': ['FRIENDS_SYSTEM.md', 'FRIENDS_CHEATSHEET.md', 'WEBSOCKET_SUMMARY.md'],
  'Deployment': ['DEPLOYMENT_GUIDE.md', 'DEPLOYMENT_READY.md', 'PRODUCTION_READINESS.md'],
  'Security': ['SECURITY_AUDIT.md', 'ADMIN_SYSTEM_AUDIT.md'],
  'Reference': ['AI_ASSISTANT_GUIDE.md', 'DOCUMENTATION_INDEX.md', 'INDEX.md']
};

marked.setOptions({
  breaks: true,
  gfm: true
});

function makeCategories(items) {
  elCategories.innerHTML = '';
  
  // Build categories
  for (const [category, docNames] of Object.entries(docCategories)) {
    const hasMatch = docNames.some(name => items.includes(name));
    if (!hasMatch) continue;
    
    const div = document.createElement('div');
    div.className = 'category-group';
    
    const title = document.createElement('button');
    title.className = 'category-title';
    title.textContent = category;
    title.onclick = () => {
      div.classList.toggle('expanded');
    };
    
    const items_list = document.createElement('ul');
    items_list.className = 'category-items';
    
    docNames.forEach(name => {
      if (items.includes(name)) {
        const li = document.createElement('li');
        li.textContent = name.replace('.md', '').replace(/_/g, ' ');
        li.dataset.file = name;
        li.addEventListener('click', () => loadDoc(name, li));
        items_list.appendChild(li);
      }
    });
    
    div.appendChild(title);
    div.appendChild(items_list);
    div.classList.add('expanded'); // Start expanded
    elCategories.appendChild(div);
  }
}

function makeList(items){
  elList.innerHTML = '';
  items.forEach(name => {
    const li = document.createElement('li');
    li.textContent = name.replace('.md', '').replace(/_/g, ' ');
    li.dataset.file = name;
    li.addEventListener('click', () => loadDoc(name, li));
    elList.appendChild(li);
  });
}

async function loadDoc(name, liEl){
  document.querySelectorAll('#doc-list li, .category-items li').forEach(i=>i.classList.remove('active'));
  if(liEl) liEl.classList.add('active');

  elMeta.textContent = `Loading ${name.replace('.md', '')} ...`;

  try{
    const resp = await fetch(DOCS_PATH + encodeURIComponent(name));
    if(!resp.ok) throw new Error('Failed to load');
    const md = await resp.text();
    
    const html = marked.parse(md);
    
    elBody.innerHTML = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'code', 'pre', 'ul', 'ol', 'li', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'img', 'hr', 'div', 'span'],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'id', 'title']
    });
    
    // Add IDs to headings
    const headings = document.querySelectorAll('#doc-body h1, #doc-body h2, #doc-body h3, #doc-body h4, #doc-body h5, #doc-body h6');
    headings.forEach((heading, index) => {
      if (!heading.id) {
        const slug = heading.textContent
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-');
        heading.id = slug || `heading-${index}`;
      }
    });
    
    // Highlight code
    document.querySelectorAll('#doc-body pre code').forEach(block => {
      if (hljs) {
        hljs.highlightElement(block);
      }
    });
    
    // Bind anchor links
    document.querySelectorAll('#doc-body a[href^="#"]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = link.getAttribute('href').substring(1);
        scrollToHeading(target);
      });
    });
    
    elMeta.textContent = `📄 ${name.replace('.md', '')} — v2.0 • Updated Oct 27, 2025`;
  }catch(err){
    elBody.innerHTML = `<div style="color: #ff6b6b; padding: 20px;">Error: ${err.message}</div>`;
  }
}

function scrollToHeading(targetId) {
  let element = document.getElementById(targetId);
  
  if (!element) {
    // Try to find by text match
    const allHeadings = document.querySelectorAll('#doc-body h1, #doc-body h2, #doc-body h3, #doc-body h4, #doc-body h5, #doc-body h6');
    for (let heading of allHeadings) {
      const headingSlug = heading.textContent
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');
      
      if (headingSlug === targetId) {
        element = heading;
        break;
      }
    }
  }
  
  if (element) {
    const header = document.querySelector('header');
    const headerHeight = header ? header.offsetHeight : 80;
    const offset = element.getBoundingClientRect().top + window.scrollY - headerHeight - 20;
    
    window.scrollTo({
      top: offset,
      behavior: 'smooth'
    });
    
    // Highlight
    element.style.transition = 'all 0.3s ease';
    element.style.backgroundColor = 'rgba(110, 231, 183, 0.2)';
    element.style.borderLeft = '3px solid rgba(110, 231, 183, 0.8)';
    element.style.paddingLeft = '12px';
    
    setTimeout(() => {
      element.style.backgroundColor = '';
      element.style.borderLeft = '';
      element.style.paddingLeft = '';
    }, 3000);
  }
}

elSearch.addEventListener('input', e=>{
  const q = e.target.value.toLowerCase();
  const filtered = docs.filter(d => d.toLowerCase().includes(q));
  if (q.length > 0) {
    makeList(filtered); // Show flat list when searching
  } else {
    makeList([]); // Empty when not searching, use categories
  }
  makeCategories(filtered.length > 0 ? filtered : docs);
});

fetch(DOCS_API)
  .then(r => r.json())
  .then(data => {
    docs = data.files || [];
    docs.sort((a, b) => {
      if (a === 'GETTING_STARTED.md') return -1;
      if (b === 'GETTING_STARTED.md') return 1;
      if (a === 'MASTER_DOCUMENTATION.md') return -1;
      if (b === 'MASTER_DOCUMENTATION.md') return 1;
      return a.localeCompare(b);
    });
    
    makeCategories(docs);
    
    const startDoc = docs.find(d => d === 'GETTING_STARTED.md') || 
                     docs.find(d => d === 'MASTER_DOCUMENTATION.md');
    if (startDoc) {
      loadDoc(startDoc, null);
    } else if (docs.length) {
      loadDoc(docs[0], null);
    }
  })
  .catch(err => {
    elBody.innerHTML = `<div style="color: #ff6b6b; padding: 20px;">Failed to load: ${err.message}</div>`;
  });
