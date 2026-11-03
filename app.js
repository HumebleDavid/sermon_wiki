/**
 * 홍동우 목사의 설교 저장소 (Theological & Sermon Archive)
 * 클라이언트 단일 페이지 어플리케이션 (SPA) 코어 엔진
 */

(function () {
  'use strict';

  // 1. 상태 관리
  const state = {
    vault: window.VAULT_DATA || null,
    currentDocId: null,
    theme: localStorage.getItem('hd_archive_theme') || 'light',
    font: localStorage.getItem('hd_archive_font') || 'serif',
    fontSize: parseInt(localStorage.getItem('hd_archive_size'), 10) || 18,
    searchQuery: '',
    openGroups: new Set() // 열려있는 아코디언 폴더 ID 목록
  };

  const FONT_SIZES = [15, 16.5, 18, 20, 22];

  // 2. DOM 요소 캐싱
  const dom = {
    html: document.documentElement,
    app: document.getElementById('app'),
    sidebar: document.getElementById('sidebar'),
    drawerBackdrop: document.getElementById('drawer-backdrop'),
    openDrawerBtn: document.getElementById('open-drawer-btn'),
    closeDrawerBtn: document.getElementById('close-drawer-btn'),
    
    // 검색
    searchInput: document.getElementById('search-input'),
    searchClearBtn: document.getElementById('search-clear-btn'),
    searchResultsPanel: document.getElementById('search-results-panel'),
    searchResultsList: document.getElementById('search-results-list'),
    searchResultsCount: document.getElementById('search-results-count'),
    searchBackBtn: document.getElementById('search-back-btn'),
    sidebarSplitContainer: document.getElementById('sidebar-split-container'),
    
    // 사이드바 2단 트리 컨테이너
    rawTreeContainer: document.getElementById('raw-tree-container'),
    wikiTreeContainer: document.getElementById('wiki-tree-container'),
    rawTotalBadge: document.getElementById('raw-total-badge'),
    wikiTotalBadge: document.getElementById('wiki-total-badge'),
    
    // 상단 툴바 및 네비게이션
    breadcrumbs: document.getElementById('breadcrumbs'),
    crumbCategory: document.getElementById('crumb-category'),
    crumbTitle: document.getElementById('crumb-title'),
    crossNavContainer: document.getElementById('cross-nav-container'),
    crossNavBtn: document.getElementById('cross-nav-btn'),
    crossNavIcon: document.getElementById('cross-nav-icon'),
    crossNavLabel: document.getElementById('cross-nav-label'),
    
    // 컨트롤 (서체, 글자크기, 테마)
    fontSerifBtn: document.getElementById('font-serif-btn'),
    fontSansBtn: document.getElementById('font-sans-btn'),
    fontDecreaseBtn: document.getElementById('font-decrease-btn'),
    fontIncreaseBtn: document.getElementById('font-increase-btn'),
    fontSizeIndicator: document.getElementById('font-size-indicator'),
    themeToggleBtn: document.getElementById('theme-toggle-btn'),
    themeIcon: document.getElementById('theme-icon'),
    
    // 본문 영역
    contentScroll: document.getElementById('content-scroll'),
    contentArea: document.getElementById('content-area'),
    scrollToTopBtn: document.getElementById('scroll-to-top-btn')
  };

  // 3. 초기화 실행
  function init() {
    if (!state.vault) {
      dom.contentArea.innerHTML = `
        <div class="loading-state">
          <p style="color:red; font-weight:bold;">데이터 파일(data.js)을 불러오지 못했습니다.</p>
          <p>터미널에서 <code>python3 03_Web/build_web.py</code> 명령어를 실행해 data.js를 생성해 주세요.</p>
        </div>`;
      return;
    }

    applyTheme(state.theme);
    applyFont(state.font);
    applyFontSize(state.fontSize);

    renderSidebarTrees();
    setupEventListeners();
    handleRouting();

    window.addEventListener('hashchange', handleRouting);
  }

  // 4. 테마 및 타이포그래피 제어
  function applyTheme(theme) {
    state.theme = theme;
    dom.html.setAttribute('data-theme', theme);
    localStorage.setItem('hd_archive_theme', theme);
    dom.themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  function applyFont(font) {
    state.font = font;
    dom.html.setAttribute('data-font', font);
    localStorage.setItem('hd_archive_font', font);
    if (font === 'serif') {
      dom.fontSerifBtn.classList.add('active');
      dom.fontSansBtn.classList.remove('active');
    } else {
      dom.fontSansBtn.classList.add('active');
      dom.fontSerifBtn.classList.remove('active');
    }
  }

  function applyFontSize(size) {
    state.fontSize = size;
    dom.html.style.setProperty('--article-font-size', size + 'px');
    dom.fontSizeIndicator.textContent = size + 'px';
    localStorage.setItem('hd_archive_size', size);
  }

  // 5. 사이드바 트리 렌더링 (RAW 상단 50% / WIKI 하단 50%)
  function renderSidebarTrees() {
    const rawTree = state.vault.raw_tree;
    const wikiTree = state.vault.wiki_tree;

    // --- 상단 📖 RAW 트리 렌더링 ---
    let rawHtml = '';
    
    // 4대 사역 시기별 설교 아코디언
    if (rawTree.sermons && rawTree.sermons.length > 0) {
      rawTree.sermons.forEach(period => {
        let totalPeriodDocs = 0;
        period.folders.forEach(f => totalPeriodDocs += f.docs.length);

        const periodGroupId = 'raw-' + period.period_id;
        const isOpen = state.openGroups.has(periodGroupId);

        rawHtml += `
          <div class="tree-group ${isOpen ? 'open' : ''}" data-group-id="${periodGroupId}">
            <div class="tree-group-header" onclick="window.HD_APP.toggleGroup('${periodGroupId}')">
              <span class="tree-group-title">
                <svg class="tree-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
                <span>${escapeHtml(period.period_name)}</span>
              </span>
              <span class="badge">${totalPeriodDocs}</span>
            </div>
            <div class="tree-group-content">
        `;

        // 하위 강해 시리즈 폴더
        period.folders.forEach(folder => {
          const folderGroupId = 'raw-sub-' + folder.folder_id;
          const isSubOpen = state.openGroups.has(folderGroupId);

          rawHtml += `
            <div class="tree-group ${isSubOpen ? 'open' : ''}" data-group-id="${folderGroupId}">
              <div class="tree-group-header" onclick="window.HD_APP.toggleGroup('${folderGroupId}')">
                <span class="tree-group-title">
                  <svg class="tree-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                  <span>${escapeHtml(folder.folder_name)}</span>
                </span>
                <span class="badge">${folder.docs.length}</span>
              </div>
              <div class="tree-group-content">
          `;

          // 개별 설교문 링크
          folder.docs.forEach(doc => {
            const shortDate = doc.date ? doc.date.substring(2) : '';
            const isActive = state.currentDocId === doc.id;
            rawHtml += `
              <a href="#doc/${encodeURIComponent(doc.id)}" class="tree-item ${isActive ? 'active' : ''}" data-doc-id="${doc.id}" title="${escapeHtml(doc.title || doc.basename)}">
                <span class="tree-item-title">${escapeHtml(doc.title || doc.basename)}</span>
                <span class="tree-item-date">${shortDate}</span>
              </a>
            `;
          });

          rawHtml += `
              </div>
            </div>
          `;
        });

        rawHtml += `
            </div>
          </div>
        `;
      });
    }

    // 외부 기고문 (Articles) 폴더
    if (rawTree.articles && rawTree.articles.length > 0) {
      const artGroupId = 'raw-articles';
      const isArtOpen = state.openGroups.has(artGroupId);

      rawHtml += `
        <div class="tree-group ${isArtOpen ? 'open' : ''}" data-group-id="${artGroupId}">
          <div class="tree-group-header" onclick="window.HD_APP.toggleGroup('${artGroupId}')">
            <span class="tree-group-title">
              <svg class="tree-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
              <span>📰 외부 기고문 (Articles)</span>
            </span>
            <span class="badge">${rawTree.articles.length}</span>
          </div>
          <div class="tree-group-content">
      `;

      rawTree.articles.forEach(doc => {
        const shortDate = doc.date ? doc.date.substring(2) : '';
        const isActive = state.currentDocId === doc.id;
        rawHtml += `
          <a href="#doc/${encodeURIComponent(doc.id)}" class="tree-item ${isActive ? 'active' : ''}" data-doc-id="${doc.id}" title="${escapeHtml(doc.title || doc.basename)}">
            <span class="tree-item-title">${escapeHtml(doc.title || doc.basename)}</span>
            <span class="tree-item-date">${shortDate}</span>
          </a>
        `;
      });

      rawHtml += `
          </div>
        </div>
      `;
    }

    dom.rawTreeContainer.innerHTML = rawHtml;
    dom.rawTotalBadge.textContent = (state.vault.meta.counts.raw_sermons + state.vault.meta.counts.raw_articles) + '편';

    // --- 하단 🧠 WIKI 트리 렌더링 ---
    let wikiHtml = '';

    // 1. 시대별 총괄 보고서 (synthesis)
    wikiHtml += renderWikiCategory('wiki-synthesis', '📊 시대별 총괄 보고서', wikiTree.synthesis, 'synthesis');

    // 2. 연속 강해 거시 분석 (series)
    wikiHtml += renderWikiCategory('wiki-series', '📚 연속 강해 거시 분석', wikiTree.series, 'series');

    // 3. 핵심 신학 개념 (concepts)
    wikiHtml += renderWikiCategory('wiki-concepts', '💡 핵심 신학 개념', wikiTree.concepts, 'concepts');

    // 4. 신학자 및 사상가 (theologians)
    wikiHtml += renderWikiCategory('wiki-theologians', '👤 신학자 및 사상가', wikiTree.theologians, 'theologians');

    // 5. 개별 1:1 분석 노트 (sources - 4대 시기 및 기고문 서브그룹)
    if (wikiTree.sources_by_period && wikiTree.sources_by_period.length > 0) {
      const srcGroupId = 'wiki-sources-root';
      const isSrcOpen = state.openGroups.has(srcGroupId);
      let totalSources = 0;
      wikiTree.sources_by_period.forEach(p => totalSources += p.docs.length);

      wikiHtml += `
        <div class="tree-group ${isSrcOpen ? 'open' : ''}" data-group-id="${srcGroupId}">
          <div class="tree-group-header" onclick="window.HD_APP.toggleGroup('${srcGroupId}')">
            <span class="tree-group-title">
              <svg class="tree-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
              <span>📝 개별 1:1 분석 노트</span>
            </span>
            <span class="badge">${totalSources}</span>
          </div>
          <div class="tree-group-content">
      `;

      wikiTree.sources_by_period.forEach(pGroup => {
        const pSubGroupId = 'wiki-src-sub-' + pGroup.period_id;
        const isPSubOpen = state.openGroups.has(pSubGroupId);

        wikiHtml += `
          <div class="tree-group ${isPSubOpen ? 'open' : ''}" data-group-id="${pSubGroupId}">
            <div class="tree-group-header" onclick="window.HD_APP.toggleGroup('${pSubGroupId}')">
              <span class="tree-group-title">
                <svg class="tree-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
                <span>${escapeHtml(pGroup.period_name)}</span>
              </span>
              <span class="badge">${pGroup.docs.length}</span>
            </div>
            <div class="tree-group-content">
        `;

        pGroup.docs.forEach(doc => {
          const shortDate = doc.date ? doc.date.substring(2) : '';
          const isActive = state.currentDocId === doc.id;
          wikiHtml += `
            <a href="#doc/${encodeURIComponent(doc.id)}" class="tree-item ${isActive ? 'active' : ''}" data-doc-id="${doc.id}" title="${escapeHtml(doc.title || doc.basename)}">
              <span class="tree-item-title">${escapeHtml(doc.title || doc.basename)}</span>
              <span class="tree-item-date">${shortDate}</span>
            </a>
          `;
        });

        wikiHtml += `
            </div>
          </div>
        `;
      });

      wikiHtml += `
          </div>
        </div>
      `;
    }

    dom.wikiTreeContainer.innerHTML = wikiHtml;
    dom.wikiTotalBadge.textContent = state.vault.wiki_tree.counts.total + '편';
  }

  function renderWikiCategory(groupId, title, docs, type) {
    if (!docs || docs.length === 0) return '';
    const isOpen = state.openGroups.has(groupId);

    let html = `
      <div class="tree-group ${isOpen ? 'open' : ''}" data-group-id="${groupId}">
        <div class="tree-group-header" onclick="window.HD_APP.toggleGroup('${groupId}')">
          <span class="tree-group-title">
            <svg class="tree-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
            <span>${title}</span>
          </span>
          <span class="badge">${docs.length}</span>
        </div>
        <div class="tree-group-content">
    `;

    docs.forEach(doc => {
      const isActive = state.currentDocId === doc.id;
      const displayTitle = doc.title || doc.basename;
      html += `
        <a href="#doc/${encodeURIComponent(doc.id)}" class="tree-item ${isActive ? 'active' : ''}" data-doc-id="${doc.id}" title="${escapeHtml(displayTitle)}">
          <span class="tree-item-title">${escapeHtml(displayTitle)}</span>
        </a>
      `;
    });

    html += `
        </div>
      </div>
    `;
    return html;
  }

  // 6. 아코디언 폴더 토글 및 자동 펼침
  function toggleGroup(groupId) {
    if (state.openGroups.has(groupId)) {
      state.openGroups.delete(groupId);
    } else {
      state.openGroups.add(groupId);
    }
    
    const groupEl = document.querySelector(`[data-group-id="${groupId}"]`);
    if (groupEl) {
      groupEl.classList.toggle('open');
    }
  }

  function ensureDocumentTreeOpen(docId) {
    // 현재 문서가 위치한 트리 폴더를 찾아 자동 오픈
    document.querySelectorAll('.tree-item').forEach(item => {
      if (item.getAttribute('data-doc-id') === docId) {
        item.classList.add('active');
        let parent = item.closest('.tree-group');
        while (parent) {
          const gId = parent.getAttribute('data-group-id');
          if (gId) {
            state.openGroups.add(gId);
            parent.classList.add('open');
          }
          parent = parent.parentElement.closest('.tree-group');
        }
      } else {
        item.classList.remove('active');
      }
    });
  }

  // 7. 싱글 페이지 라우팅 (Hash Router)
  function handleRouting() {
    const hash = window.location.hash || '#home';

    if (hash === '#home' || hash === '#') {
      state.currentDocId = null;
      renderHomeDashboard();
      updateToolbarForHome();
      closeDrawerOnMobile();
      return;
    }

    if (hash.startsWith('#doc/')) {
      const rawTarget = decodeURIComponent(hash.substring(5));
      loadDocument(rawTarget);
      closeDrawerOnMobile();
      return;
    }

    // 기타 해시는 홈으로 리다이렉트
    window.location.hash = '#home';
  }

  // 8. 문서 로드 및 렌더링
  function loadDocument(target) {
    // 1) 정확한 경로 ID 매칭
    let doc = state.vault.docs[target];

    // 2) lookup 색인 테이블 탐색 (파일명 또는 별칭 정규화)
    if (!doc && state.vault.lookup) {
      const normKey = target.trim().replace(/\.md$/, '').toLowerCase();
      const mappedId = state.vault.lookup[normKey] || state.vault.lookup[target];
      if (mappedId && state.vault.docs[mappedId]) {
        doc = state.vault.docs[mappedId];
      }
    }

    // 3) 그래도 못 찾은 경우 부분 일치 검색
    if (!doc) {
      const cleaned = target.replace(/^.*[\\\/]/, '').replace(/\.md$/, '');
      for (const [id, d] of Object.entries(state.vault.docs)) {
        if (d.basename === cleaned || d.title === cleaned || id.endsWith(target)) {
          doc = d;
          break;
        }
      }
    }

    if (!doc) {
      renderNotFound(target);
      return;
    }

    state.currentDocId = doc.id;
    ensureDocumentTreeOpen(doc.id);
    renderDocumentView(doc);
    updateToolbarForDoc(doc);
    dom.contentScroll.scrollTop = 0;
  }

  // 9. 문서 뷰 렌더링
  function renderDocumentView(doc) {
    let html = '';

    // A. 메타데이터 요약 카드 (YAML 프론트매터 시각화)
    html += renderMetaCard(doc);

    // B. 본문 렌더링 (콜아웃, 위키링크, 3단 인용구, 마크다운 파싱)
    html += `
      <div class="article-body">
        ${renderMarkdownBody(doc.body)}
      </div>
    `;

    dom.contentArea.innerHTML = html;

    // 위키링크 이벤트 바인딩
    dom.contentArea.querySelectorAll('.wiki-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetDoc = link.getAttribute('data-target');
        window.location.hash = '#doc/' + encodeURIComponent(targetDoc);
      });
    });
  }

  // A-1. 프론트매터 요약 카드 렌더링
  function renderMetaCard(doc) {
    const meta = doc.meta || {};
    const isRaw = doc.section === 'raw';
    const badgeClass = isRaw ? 'raw' : 'wiki';
    const categoryName = getCategoryDisplayName(doc);

    let html = `
      <div class="meta-card">
        <div class="meta-header-row">
          <span class="meta-category-badge ${badgeClass}">${categoryName}</span>
          ${doc.date ? `<span class="meta-date">📅 ${doc.date}</span>` : ''}
        </div>
        <h1 class="meta-title">${escapeHtml(doc.title || doc.basename)}</h1>
    `;

    // 핵심 명제 / 주제 박스
    if (meta.subject) {
      html += `
        <div class="meta-subject-box">
          <div class="meta-subject-label">주제 및 핵심 명제 (Subject)</div>
          <div class="meta-subject-text">${escapeHtml(meta.subject)}</div>
        </div>
      `;
    }

    // 메타데이터 그리드 (성경본문, 청중, 목회적 맥락, 신학자, 개념)
    const gridItems = [];

    if (meta.scripture && meta.scripture.length > 0) {
      const scriptures = Array.isArray(meta.scripture) ? meta.scripture.join(', ') : meta.scripture;
      gridItems.push(`
        <div class="meta-grid-item">
          <span class="meta-grid-label">📖 본문 말씀:</span>
          <span class="meta-grid-value">${escapeHtml(scriptures)}</span>
        </div>
      `);
    }

    if (meta.series) {
      gridItems.push(`
        <div class="meta-grid-item">
          <span class="meta-grid-label">📚 시리즈:</span>
          <span class="meta-grid-value">${escapeHtml(meta.series)}</span>
        </div>
      `);
    }

    if (meta.audience) {
      gridItems.push(`
        <div class="meta-grid-item">
          <span class="meta-grid-label">👥 설교 청중:</span>
          <span class="meta-grid-value">${escapeHtml(meta.audience)}</span>
        </div>
      `);
    }

    if (meta.pastoral_context) {
      gridItems.push(`
        <div class="meta-grid-item">
          <span class="meta-grid-label">🏛️ 목회 상황:</span>
          <span class="meta-grid-value">${escapeHtml(meta.pastoral_context)}</span>
        </div>
      `);
    }

    if (meta.role) {
      gridItems.push(`
        <div class="meta-grid-item">
          <span class="meta-grid-label">💼 사역 직분:</span>
          <span class="meta-grid-value">${escapeHtml(meta.role)}</span>
        </div>
      `);
    }

    if (gridItems.length > 0) {
      html += `<div class="meta-grid">${gridItems.join('')}</div>`;
    }

    // 태그 및 연결 칩
    const chips = [];
    if (meta.tags && Array.isArray(meta.tags)) {
      meta.tags.forEach(tag => {
        chips.push(`<span class="meta-chip tag">#${escapeHtml(tag)}</span>`);
      });
    }

    if (meta.theologians && Array.isArray(meta.theologians)) {
      meta.theologians.forEach(th => {
        const thClean = th.replace(/[\[\]]/g, '');
        chips.push(`<a href="#doc/${encodeURIComponent(thClean)}" class="meta-chip wiki-link">👤 ${escapeHtml(thClean)}</a>`);
      });
    }

    if (meta.concepts && Array.isArray(meta.concepts)) {
      meta.concepts.forEach(cp => {
        const cpClean = cp.replace(/[\[\]]/g, '');
        chips.push(`<a href="#doc/${encodeURIComponent(cpClean)}" class="meta-chip wiki-link">💡 ${escapeHtml(cpClean)}</a>`);
      });
    }

    if (chips.length > 0) {
      html += `<div class="meta-chips">${chips.join('')}</div>`;
    }

    html += `</div>`;
    return html;
  }

  function getCategoryDisplayName(doc) {
    if (doc.section === 'raw') {
      return doc.category === 'articles' ? '📖 RAW 기고문' : '📖 RAW 원본 설교문';
    }
    const cat = doc.category;
    if (cat === 'synthesis') return '📊 WIKI 시대별 총괄 보고서';
    if (cat === 'series') return '📚 WIKI 연속 강해 거시 분석';
    if (cat === 'concepts') return '💡 WIKI 핵심 신학 개념';
    if (cat === 'theologians') return '👤 WIKI 신학자 및 사상가';
    if (cat === 'sources') return '📝 WIKI 1:1 정밀 분석 노트';
    return '🧠 WIKI 지식베이스';
  }

  // B-1. 마크다운 본문 파서 및 특수 문법 변환
  function renderMarkdownBody(body) {
    if (!body) return '<p>내용이 비어 있습니다.</p>';

    let text = body;

    // 1. 이미 메타카드에서 렌더링한 상단 제목(`# 제목`)과 본문 블록(`> **본문 말씀**`)은 본문에서 중복 제거
    text = text.replace(/^#\s+[^\n]+\n+/, '');
    text = text.replace(/^>\s+\*\*본문 말씀\*\*\s*:[^\n]+\n+/, '');

    // 2. 3단 필수 인용구(Verbatim + 맥락 + 신학적 함의) 사전 변환
    text = text.replace(
      />\s*"([^"]+)"\s*\n+>\s*—\s*\*\*강해 및 목회적 맥락:\*\*\s*([^\n]+(?:\n>[^\n]+)*)\n+>\s*—\s*\*\*신학적 함의:\*\*\s*([^\n]+(?:\n>[^\n]+)*)/g,
      function (match, quote, context, theology) {
        const cleanContext = context.replace(/\n>\s*/g, ' ').trim();
        const cleanTheology = theology.replace(/\n>\s*/g, ' ').trim();
        return `
<div class="mandatory-quote-block">
  <div class="mandatory-quote-text">“${quote}”</div>
  <div class="mandatory-quote-context"><strong>강해 및 목회적 맥락:</strong> ${cleanContext}</div>
  <div class="mandatory-quote-theology"><strong>신학적 함의:</strong> ${cleanTheology}</div>
</div>
        `;
      }
    );

    // 3. 옵시디언 콜아웃 블록 파싱 (`> [!quote]`, `> [!abstract]`, `> [!question]`, `> [!note]` 등)
    text = text.replace(
      /^>\s*\[!([a-zA-Z]+)\]\s*([^\n]*)\n((?:>[ \t]*[^\n]*\n*)+)/gm,
      function (match, type, title, content) {
        const calloutType = type.toLowerCase();
        const displayTitle = title.trim() || type.toUpperCase();
        const cleanContent = content.replace(/^>[ \t]?/gm, '').trim();
        
        let icon = '📌';
        if (calloutType === 'quote') icon = '💬';
        else if (calloutType === 'abstract' || calloutType === 'summary') icon = '📋';
        else if (calloutType === 'question') icon = '❓';
        else if (calloutType === 'note' || calloutType === 'info') icon = 'ℹ️';
        else if (calloutType === 'warning') icon = '⚠️';

        return `
<div class="callout callout-${calloutType}">
  <div class="callout-title">
    <span>${icon}</span>
    <span>${displayTitle}</span>
  </div>
  <div class="callout-body">
    ${cleanContent}
  </div>
</div>\n
        `;
      }
    );

    // 4. 위키링크 `[[문서명]]` 또는 `[[문서명|별칭]]` 변환
    text = text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, function (match, target, alias) {
      const displayText = alias ? alias.trim() : target.trim();
      const cleanTarget = target.trim();
      return `<a href="#doc/${encodeURIComponent(cleanTarget)}" class="wiki-link" data-target="${escapeHtml(cleanTarget)}">${escapeHtml(displayText)}</a>`;
    });

    // 5. 마크다운 변환 (marked 라이브러리 사용, 오프라인 시 자체 폴백)
    if (typeof marked !== 'undefined' && marked.parse) {
      try {
        marked.setOptions({
          gfm: true,
          breaks: true
        });
        return marked.parse(text);
      } catch (err) {
        console.warn('Marked parse failed, using fallback:', err);
      }
    }

    return fallbackMarkdownParser(text);
  }

  // 오프라인 대비 자체 마크다운 폴백 파서
  function fallbackMarkdownParser(src) {
    let out = src;
    out = out.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    // 헤딩
    out = out.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
    out = out.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    out = out.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    out = out.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    
    // 볼드 / 이탤릭
    out = out.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // 단락
    out = out.split(/\n\n+/).map(p => {
      p = p.trim();
      if (!p) return '';
      if (p.startsWith('<h') || p.startsWith('<div') || p.startsWith('<ul') || p.startsWith('<table')) {
        return p;
      }
      return `<p>${p.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');

    return out;
  }

  // 10. 상단 툴바 및 교차 이동 버튼(RAW <-> WIKI) 상태 갱신
  function updateToolbarForDoc(doc) {
    dom.crumbCategory.textContent = doc.section === 'raw' ? 'RAW 아카이브' : 'WIKI 지식베이스';
    dom.crumbTitle.textContent = doc.title || doc.basename;

    const crossMap = state.vault.cross_map;
    let targetDocId = null;
    let btnLabel = '';
    let btnIcon = '';

    if (doc.section === 'raw' && crossMap && crossMap.raw_to_wiki) {
      targetDocId = crossMap.raw_to_wiki[doc.id];
      btnLabel = 'WIKI 분석 노트 보기';
      btnIcon = '🧠';
    } else if (doc.section === 'wiki' && doc.category === 'sources' && crossMap && crossMap.wiki_to_raw) {
      targetDocId = crossMap.wiki_to_raw[doc.id];
      btnLabel = 'RAW 원본 설교문 보기';
      btnIcon = '📖';
    }

    if (targetDocId && state.vault.docs[targetDocId]) {
      dom.crossNavContainer.classList.remove('hidden');
      dom.crossNavIcon.textContent = btnIcon;
      dom.crossNavLabel.textContent = btnLabel;
      dom.crossNavBtn.onclick = () => {
        window.location.hash = '#doc/' + encodeURIComponent(targetDocId);
      };
    } else {
      dom.crossNavContainer.classList.add('hidden');
    }
  }

  function updateToolbarForHome() {
    dom.crumbCategory.textContent = '홍동우 목사의 설교 저장소';
    dom.crumbTitle.textContent = '아카이브 홈 대시보드';
    dom.crossNavContainer.classList.add('hidden');
  }

  // 11. 홈 대시보드 화면 렌더링
  function renderHomeDashboard() {
    const meta = state.vault.meta;
    const counts = meta.counts;

    const html = `
      <div class="home-dashboard">
        <header class="home-hero">
          <span class="home-hero-badge">THEOLOGICAL & SERMON ARCHIVE (2016–2026)</span>
          <h1 class="home-hero-title">홍동우 목사의 설교 저장소</h1>
          <p class="home-hero-desc">
            지난 10년간의 목회 현장(Y교회, C교회, 사당역 성경공부방, D교회)에서 선포된 138편의 설교·기고문 원본과<br>
            성서해석학·교리적 강조점·목회적 조율을 학술적으로 분석한 269편의 신학 지식베이스를 집대성한 아카이브입니다.
          </p>
          <div class="home-hero-stats">
            <span class="stat-pill">📖 RAW 설교 <strong>${counts.raw_sermons}편</strong></span>
            <span class="stat-pill">📰 RAW 기고문 <strong>${counts.raw_articles}편</strong></span>
            <span class="stat-pill">📊 총괄 보고서 <strong>${counts.wiki_synthesis}편</strong></span>
            <span class="stat-pill">📚 연속 강해 <strong>${counts.wiki_series}편</strong></span>
            <span class="stat-pill">💡 신학 개념 <strong>${counts.wiki_concepts}편</strong></span>
            <span class="stat-pill">👤 신학자 <strong>${counts.wiki_theologians}편</strong></span>
          </div>
        </header>

        <!-- 4대 사역 시기 카드 그리드 -->
        <h2 class="dashboard-section-title">🏛️ 4대 사역 시기별 아카이브</h2>
        <div class="periods-grid">
          
          <!-- Period 1: Y교회 -->
          <div class="period-card" onclick="location.hash='#doc/02_Wiki/synthesis/Period_1_2016-2019_Y교회_사역총괄보고서.md'">
            <div class="period-card-header">
              <span class="period-card-badge">Period 1</span>
              <span class="period-card-count">16편</span>
            </div>
            <h3 class="period-card-title">1. 2016–2019 Y교회</h3>
            <div class="period-card-role">전임전도사 | 고등부·청년부·장년 공예배</div>
            <p class="period-card-desc">
              70년 전통 중형교회의 지적이고 적극적인 회중을 상대로 선포된 복음의 본질, 칭의, 성도의 사회적 책임. 현재 남아있는 복원 설교문 16편 중심.
            </p>
            <div class="period-card-footer">
              <span>총괄보고서 및 설교문 보기</span>
              <span>&rarr;</span>
            </div>
          </div>

          <!-- Period 2: C교회 -->
          <div class="period-card" onclick="location.hash='#doc/02_Wiki/synthesis/Period_2_2021-2023_C교회_사역총괄보고서.md'">
            <div class="period-card-header">
              <span class="period-card-badge">Period 2</span>
              <span class="period-card-count">50편</span>
            </div>
            <h3 class="period-card-title">2. 2021–2023 C교회</h3>
            <div class="period-card-role">전임전도사 → 부목사 안수 | 청년부·대예배·오후예배</div>
            <p class="period-card-desc">
              신학적 열망에 목마른 소형교회 회중을 향한 호흡이 긴 연속 강해(갈라디아서, 요한계시록, 레위기, 누가복음)와 목사 안수를 통한 정체성 전환기.
            </p>
            <div class="period-card-footer">
              <span>총괄보고서 및 설교문 보기</span>
              <span>&rarr;</span>
            </div>
          </div>

          <!-- Period 3: 사당역 성경공부방 -->
          <div class="period-card" onclick="location.hash='#doc/02_Wiki/synthesis/Period_3_2024-2026_사당역성경공부방_사역총괄보고서.md'">
            <div class="period-card-header">
              <span class="period-card-badge">Period 3</span>
              <span class="period-card-count">17편</span>
            </div>
            <h3 class="period-card-title">3. 사당역 성경공부방 & 초빙</h3>
            <div class="period-card-role">탈제도권 연구자·초빙강사 | 가나안 성도·대학·수련회</div>
            <p class="period-card-desc">
              제도권 교회의 울타리를 넘어 비극, 기억, 민주주의 시대의 성서 해석, 오이코스 대학 강의 8강을 펼친 '신학적 확장 및 사상 정련기'.
            </p>
            <div class="period-card-footer">
              <span>총괄보고서 및 강의안 보기</span>
              <span>&rarr;</span>
            </div>
          </div>

          <!-- Period 4: D교회 -->
          <div class="period-card" onclick="location.hash='#doc/02_Wiki/synthesis/Period_4_2026_D교회_사역총괄보고서.md'">
            <div class="period-card-header">
              <span class="period-card-badge">Period 4</span>
              <span class="period-card-count">57편</span>
            </div>
            <h3 class="period-card-title">4. 2026 D교회</h3>
            <div class="period-card-role">청년부 부목사 | 청년부 연속강해 & 수요예배 중직자</div>
            <p class="period-card-desc">
              담임목사 궐위와 청빙이라는 비상 상황 속에서 청년부 실존적 본문강해(야곱, 욥기, 요나서, 다니엘서)와 중직자 영적 위로 및 좌표 설정.
            </p>
            <div class="period-card-footer">
              <span>총괄보고서 및 설교문 보기</span>
              <span>&rarr;</span>
            </div>
          </div>

        </div>

        <!-- 주요 큐레이션 및 마스터 보고서 -->
        <h2 class="dashboard-section-title">🌟 핵심 신학 총괄 보고서 및 마스터 카탈로그</h2>
        <div class="featured-grid">
          
          <a href="#doc/02_Wiki/synthesis/00_2016-2026_10년_사역계승_및_신학궤적_마스터보고서.md" class="featured-card">
            <div class="featured-card-icon">👑</div>
            <h3 class="featured-card-title">10년 사역계승 및 신학궤적 마스터 보고서</h3>
            <p class="featured-card-desc">
              2016년 고등부 사역부터 2026년 청빙 과도기까지 10년간의 성서해석학적 진화와 수사학적 조율을 총괄 분석한 마스터 피스.
            </p>
          </a>

          <a href="#doc/01_Raw/articles/251101 고통은 낭만적이지 않다.md" class="featured-card">
            <div class="featured-card-icon">📰</div>
            <h3 class="featured-card-title">대표 기고문: 고통은 낭만적이지 않다</h3>
            <p class="featured-card-desc">
              로마서 8:28의 합력하여 선이라는 섭리적 맹신을 비판하고, 미완의 창조 속 고통받는 자와 연대하시는 하나님을 규명한 시론.
            </p>
          </a>

          <a href="#doc/02_Wiki/series/2026_D교회_욥기강해.md" class="featured-card">
            <div class="featured-card-icon">📖</div>
            <h3 class="featured-card-title">거시 분석: 2026 D교회 욥기 강해 (6강)</h3>
            <p class="featured-card-desc">
              인과응보적 신학을 고발하고, 고통의 신비 앞에서 절망을 딛고 하나님과 직접 대면하는 욥의 정직한 탄식을 다룬 청년부 연속 강해.
            </p>
          </a>

          <a href="#doc/02_Wiki/theologians/톰_라이트.md" class="featured-card">
            <div class="featured-card-icon">👤</div>
            <h3 class="featured-card-title">핵심 신학자: 톰 라이트 (N. T. Wright)</h3>
            <p class="featured-card-desc">
              바울 신학의 새로운 관점(NPP), 하나님 나라의 현재적 침투, 부활의 역사성과 새 창조의 출발로서의 기독교 변증.
            </p>
          </a>

          <a href="#doc/02_Wiki/concepts/이신칭의와_차별철폐.md" class="featured-card">
            <div class="featured-card-icon">💡</div>
            <h3 class="featured-card-title">핵심 개념: 이신칭의와 차별철폐</h3>
            <p class="featured-card-desc">
              개인주의적 영혼 구원 교리를 넘어, 그리스도 안에서 모든 사회적 특권과 차별을 허무는 공동체적 복음의 본질.
            </p>
          </a>

          <a href="#doc/02_Wiki/index.md" class="featured-card">
            <div class="featured-card-icon">📋</div>
            <h3 class="featured-card-title">마스터 카탈로그 (index.md)</h3>
            <p class="featured-card-desc">
              407편의 설교문, 기고문, 신학자, 개념 노트를 총망라한 볼트 전체 색인 카탈로그.
            </p>
          </a>

        </div>
      </div>
    `;

    dom.contentArea.innerHTML = html;
  }

  function renderNotFound(target) {
    dom.contentArea.innerHTML = `
      <div class="loading-state">
        <h2 style="font-size: 24px; margin-bottom: 8px;">문서를 찾을 수 없습니다</h2>
        <p style="color: var(--text-muted); margin-bottom: 20px;">
          요청하신 경로(<code>${escapeHtml(target)}</code>)에 해당하는 문서를 아카이브에서 찾을 수 없습니다.
        </p>
        <a href="#home" class="cross-nav-btn" style="text-decoration:none;">홈 대시보드로 돌아가기</a>
      </div>
    `;
    updateToolbarForHome();
  }

  // 12. 실시간 통합 검색 시스템
  let searchDebounceTimeout = null;

  function handleSearchInput(e) {
    const query = e.target.value.trim();
    state.searchQuery = query;

    if (query.length > 0) {
      dom.searchClearBtn.classList.remove('hidden');
    } else {
      dom.searchClearBtn.classList.add('hidden');
      closeSearchResults();
      return;
    }

    clearTimeout(searchDebounceTimeout);
    searchDebounceTimeout = setTimeout(() => {
      executeSearch(query);
    }, 180);
  }

  function executeSearch(query) {
    const q = query.toLowerCase();
    const results = [];

    for (const [id, doc] of Object.entries(state.vault.docs)) {
      let score = 0;
      let matchedSnippet = '';

      const title = (doc.title || '').toLowerCase();
      const basename = (doc.basename || '').toLowerCase();
      const subject = (doc.meta?.subject || '').toLowerCase();
      const body = (doc.body || '').toLowerCase();

      // 성경본문 매칭
      let scriptureMatch = false;
      if (doc.meta?.scripture) {
        const scStr = Array.isArray(doc.meta.scripture) ? doc.meta.scripture.join(' ') : doc.meta.scripture;
        if (scStr.toLowerCase().includes(q)) {
          score += 60;
          scriptureMatch = true;
        }
      }

      // 태그 매칭
      if (doc.meta?.tags && Array.isArray(doc.meta.tags)) {
        if (doc.meta.tags.some(t => t.toLowerCase().includes(q))) {
          score += 50;
        }
      }

      // 제목 및 파일명 가중치
      if (title.includes(q)) score += 100;
      if (basename.includes(q)) score += 80;
      if (subject.includes(q)) score += 70;

      // 본문 검색 및 스니펫 추출
      const bodyIdx = body.indexOf(q);
      if (bodyIdx !== -1) {
        score += 20;
        const start = Math.max(0, bodyIdx - 40);
        const end = Math.min(doc.body.length, bodyIdx + query.length + 60);
        matchedSnippet = doc.body.substring(start, end).replace(/\n/g, ' ');
      }

      if (score > 0) {
        results.push({
          doc,
          score,
          snippet: matchedSnippet || doc.meta?.subject || (doc.body ? doc.body.substring(0, 90) : '')
        });
      }
    }

    // 연관도 정렬
    results.sort((a, b) => b.score - a.score);
    renderSearchResults(results, query);
  }

  function renderSearchResults(results, query) {
    dom.sidebarSplitContainer.classList.add('hidden');
    dom.searchResultsPanel.classList.remove('hidden');
    dom.searchResultsCount.textContent = `검색 결과 ${results.length}건`;

    if (results.length === 0) {
      dom.searchResultsList.innerHTML = `
        <li style="padding: 24px 12px; text-align: center; color: var(--text-muted); font-size: 13px;">
          '${escapeHtml(query)}' 검색어와 일치하는 문서가 없습니다.
        </li>
      `;
      return;
    }

    let html = '';
    results.slice(0, 80).forEach(({ doc, snippet }) => {
      const isRaw = doc.section === 'raw';
      const badgeClass = isRaw ? 'raw' : 'wiki';
      const badgeText = isRaw ? 'RAW' : 'WIKI';
      const displayTitle = doc.title || doc.basename;

      html += `
        <li class="search-result-item" onclick="location.hash='#doc/${encodeURIComponent(doc.id)}'">
          <span class="search-result-badge ${badgeClass}">${badgeText}</span>
          <div class="search-result-title">${highlightKeyword(displayTitle, query)}</div>
          <div class="search-result-snippet">${highlightKeyword(snippet, query)}</div>
        </li>
      `;
    });

    dom.searchResultsList.innerHTML = html;
  }

  function highlightKeyword(text, keyword) {
    if (!text || !keyword) return escapeHtml(text || '');
    const escaped = escapeHtml(text);
    const regex = new RegExp(`(${escapeRegex(keyword)})`, 'gi');
    return escaped.replace(regex, '<mark style="background-color:rgba(212,163,115,0.4); border-radius:2px; padding:0 2px;">$1</mark>');
  }

  function closeSearchResults() {
    dom.searchResultsPanel.classList.add('hidden');
    dom.sidebarSplitContainer.classList.remove('hidden');
    dom.searchInput.value = '';
    dom.searchClearBtn.classList.add('hidden');
  }

  // 13. 이벤트 리스너 등록
  function setupEventListeners() {
    // 테마 토글
    dom.themeToggleBtn.addEventListener('click', () => {
      applyTheme(state.theme === 'dark' ? 'light' : 'dark');
    });

    // 서체 토글 (명조 / 고딕)
    dom.fontSerifBtn.addEventListener('click', () => applyFont('serif'));
    dom.fontSansBtn.addEventListener('click', () => applyFont('sans'));

    // 글자 크기 조절
    dom.fontDecreaseBtn.addEventListener('click', () => {
      const currentIdx = FONT_SIZES.indexOf(state.fontSize);
      if (currentIdx > 0) {
        applyFontSize(FONT_SIZES[currentIdx - 1]);
      }
    });

    dom.fontIncreaseBtn.addEventListener('click', () => {
      const currentIdx = FONT_SIZES.indexOf(state.fontSize);
      if (currentIdx < FONT_SIZES.length - 1) {
        applyFontSize(FONT_SIZES[currentIdx + 1]);
      }
    });

    // 검색창 이벤트
    dom.searchInput.addEventListener('input', handleSearchInput);
    dom.searchClearBtn.addEventListener('click', closeSearchResults);
    dom.searchBackBtn.addEventListener('click', closeSearchResults);

    // 모바일 드로어 제어
    dom.openDrawerBtn.addEventListener('click', openDrawerOnMobile);
    dom.closeDrawerBtn.addEventListener('click', closeDrawerOnMobile);
    dom.drawerBackdrop.addEventListener('click', closeDrawerOnMobile);

    // 스크롤 탑 버튼
    dom.contentScroll.addEventListener('scroll', () => {
      if (dom.contentScroll.scrollTop > 260) {
        dom.scrollToTopBtn.classList.remove('hidden');
      } else {
        dom.scrollToTopBtn.classList.add('hidden');
      }
    });

    dom.scrollToTopBtn.addEventListener('click', () => {
      dom.contentScroll.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function openDrawerOnMobile() {
    dom.sidebar.classList.add('drawer-open');
    dom.drawerBackdrop.classList.add('active');
  }

  function closeDrawerOnMobile() {
    dom.sidebar.classList.remove('drawer-open');
    dom.drawerBackdrop.classList.remove('active');
  }

  // 유틸리티 함수
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // 글로벌 네임스페이스 노출 (HTML onclick 핸들러 지원)
  window.HD_APP = {
    toggleGroup,
    loadDocument
  };

  // DOMContentLoaded 시 실행
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
