// rows[].type: step | cond | caution | special
const TYPE_LABEL = { step: "절차", cond: "조건", caution: "주의", special: "특이사항" };

const SAMPLE_BLOCKS = [
  {
    id: "b_sample_3", title: "전화 응대 기본 매뉴얼", categories: ["응대", "공통"],
    rows: [
      { type: "step", text: "인사 및 소속 안내 후 고객 확인" },
      { type: "step", text: "문의 유형 파악" },
      { type: "cond", text: "문의 유형이 무엇인가?", branches: [
        { label: "결제 관련", targetBlockId: "b_sample_1" },
        { label: "배송 관련", targetBlockId: "b_sample_4" }
      ] },
      { type: "caution", text: "개인정보(카드번호 전체, 비밀번호)는 구두로 요구하지 않는다." },
      { type: "special", text: "VIP 고객은 담당자 직통 번호로 즉시 연결한다." }
    ],
    attachments: []
  },
  {
    id: "b_sample_1", title: "결제 오류 대응", categories: ["결제", "장애대응"],
    rows: [
      { type: "step", text: "주문번호 확인" },
      { type: "step", text: "결제 상태 조회", branches: [{ label: "", targetBlockId: "b_sample_2" }] },
      { type: "cond", text: "결제 상태가 '승인'인가?", branches: [
        { label: "예: 중복 결제 확인", targetBlockId: "b_sample_5" },
        { label: "아니오: 재시도 안내", targetBlockId: null }
      ] },
      { type: "caution", text: "환불 약속은 담당 부서 확인 전에 하지 않는다." }
    ],
    attachments: []
  },
  {
    id: "b_sample_2", title: "결제 상태 조회 방법", categories: ["결제"],
    rows: [
      { type: "step", text: "관리자 콘솔 > 결제 탭 > 주문번호 입력 후 조회" },
      { type: "special", text: "야간(22시~06시)에는 조회 지연이 발생할 수 있다." }
    ],
    attachments: []
  },
  {
    id: "b_sample_4", title: "배송 문의 대응", categories: ["배송"],
    rows: [{ type: "step", text: "운송장 번호로 배송 조회 후 현재 위치 안내" }],
    attachments: []
  },
  {
    id: "b_sample_5", title: "중복 결제 처리", categories: ["결제", "장애대응"],
    rows: [
      { type: "step", text: "중복 결제 내역 2건 이상 확인" },
      { type: "caution", text: "취소 처리는 반드시 담당자 승인 후 진행한다." },
      { type: "step", text: "필요 시 결제 오류 대응 절차 재확인", branches: [{ label: "", targetBlockId: "b_sample_1" }] }
    ],
    attachments: []
  }
];

const state = {
  blocks: new Map(),
  folderName: null,
  lastFolderName: null,
  attachRoots: [],
  loadErrors: [],
  mainId: null,
  history: [],
  activeCategories: new Set(),
  searchText: "",
  expanded: new Set(),
  editing: null // { draft, catText, isNew }
};

function h(tag, props, ...children) {
  const el = document.createElement(tag);
  Object.entries(props || {}).forEach(([k, v]) => {
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el[k] = v;
    else if (k === "value") el.value = v;
    else el.setAttribute(k, v);
  });
  children.flat().forEach(c => { if (c != null) el.append(c); });
  return el;
}

async function guard(fn) {
  try { await fn(); }
  catch (e) { if (e && e.name !== "AbortError") alert("오류: " + (e.message || e)); }
}

function getBlock(id) { return state.blocks.get(id); }
function allBlocks() { return [...state.blocks.values()].sort((a, b) => a.title.localeCompare(b.title, "ko")); }
function allCategories() { return [...new Set(allBlocks().flatMap(b => b.categories))].sort((a, b) => a.localeCompare(b, "ko")); }

function blockText(b) {
  const rows = b.rows.map(r => (r.text || "") + " " + (r.branches || []).map(br => br.label || "").join(" ") +
    " " + (r.attachments || []).map(a => a.name || "").join(" "));
  return b.title + " " + b.categories.join(" ") + " " + rows.join(" ");
}

function filteredBlocks() {
  const terms = state.searchText.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return allBlocks().filter(b => {
    if (![...state.activeCategories].every(c => b.categories.includes(c))) return false;
    const text = blockText(b).toLowerCase();
    return terms.every(t => text.includes(t));
  });
}

/* ---------- 폴더/데이터 ---------- */
async function loadFolder() {
  const { blocks, errors } = await Storage.loadAll();
  state.blocks = new Map(blocks.map(b => [b.id, b]));
  state.loadErrors = errors;
  state.history = [];
  state.expanded.clear();
  state.editing = null;
  state.mainId = state.blocks.has(state.mainId) ? state.mainId : (allBlocks()[0] || {}).id || null;
  render();
}

function openFolder() {
  guard(async () => { state.folderName = await Storage.pickFolder(); await loadFolder(); });
}

function reopenLast() {
  guard(async () => {
    const name = await Storage.reopenLast();
    if (!name) { alert("권한을 얻지 못했습니다. 폴더 열기를 사용하세요."); return; }
    state.folderName = name;
    await loadFolder();
  });
}

function createSamples() {
  guard(async () => {
    for (const b of SAMPLE_BLOCKS) await Storage.save(JSON.parse(JSON.stringify(b)));
    state.mainId = "b_sample_3";
    await loadFolder();
  });
}

function setMain(id, pushHistory) {
  if (state.editing && !confirm("편집 중인 내용이 버려집니다. 계속할까요?")) return;
  state.editing = null;
  if (pushHistory && state.mainId) state.history.push(state.mainId);
  state.mainId = id;
  state.expanded.clear();
  render();
}

function selectFromList(id) { state.history = []; setMain(id, false); }

/* ---------- CRUD ---------- */
function startNew() {
  if (!Storage.hasFolder()) return;
  state.editing = {
    isNew: true,
    catText: "",
    draft: { id: Storage.newId(), title: "", categories: [], rows: [{ type: "step", text: "" }] }
  };
  render();
}

function startEdit(id) {
  const b = getBlock(id);
  state.editing = { isNew: false, catText: b.categories.join(", "), draft: JSON.parse(JSON.stringify(b)) };
  render();
}

function saveEditing() {
  guard(async () => {
    const { draft, catText } = state.editing;
    if (!draft.title.trim()) { alert("제목을 입력하세요."); return; }
    draft.title = draft.title.trim();
    draft.categories = [...new Set(catText.split(",").map(s => s.trim()).filter(Boolean))];
    draft.rows.forEach(r => {
      if (r.branches) {
        r.branches = r.branches.filter(b => b.targetBlockId || (b.label || "").trim());
        if (!r.branches.length) delete r.branches;
      }
      if (r.attachments) {
        r.attachments = r.attachments.filter(a => (a.path || "").trim());
        if (!r.attachments.length) delete r.attachments;
      }
    });
    draft.rows = draft.rows.filter(r => (r.text || "").trim() || r.branches || r.attachments);
    delete draft.attachments;
    const saved = await Storage.save(draft);
    state.blocks.set(saved.id, saved);
    state.editing = null;
    state.mainId = saved.id;
    state.expanded.clear();
    render();
  });
}

function cancelEditing() {
  state.editing = null;
  render();
}

function deleteBlock(id) {
  const b = getBlock(id);
  const refs = allBlocks().filter(o => o.id !== id && o.rows.some(r => (r.branches || []).some(br => br.targetBlockId === id)));
  const msg = '"' + b.title + '" 블록 파일을 삭제합니다. 되돌릴 수 없습니다.' +
    (refs.length ? "\n\n이 블록을 참조하는 블록 " + refs.length + "개: " + refs.map(r => r.title).join(", ") + "\n(해당 링크는 '블록 없음'으로 표시됩니다.)" : "");
  if (!confirm(msg)) return;
  guard(async () => {
    await Storage.remove(id);
    state.blocks.delete(id);
    state.history = state.history.filter(x => x !== id);
    state.mainId = state.history.pop() || (allBlocks()[0] || {}).id || null;
    state.expanded.clear();
    render();
  });
}

/* ---------- 사이드바 ---------- */
function renderSidebar() {
  const side = document.getElementById("sidebar");
  side.innerHTML = "";
  if (!Storage.hasFolder()) {
    side.append(h("div", { class: "side-note" }, "폴더가 열려 있지 않습니다."));
    return;
  }
  side.append(
    h("div", { class: "folder-row" },
      h("span", { class: "folder-name", title: state.folderName }, state.folderName),
      h("button", { onclick: openFolder }, "변경")),
    h("button", { class: "primary", onclick: startNew }, "+ 새 블록"),
    h("input", { id: "searchInput", type: "text", placeholder: "검색...", value: state.searchText,
      oninput: (e) => { state.searchText = e.target.value; renderList(); } }),
    h("div", { id: "categoryFilters" }),
    h("div", { id: "blockList" }),
    h("div", { class: "side-note" }, "첨부 링크를 연결 프로그램으로 열려면 PC마다 1회 helper\\register.cmd를 실행하세요.")
  );
  renderList();
}

function renderList() {
  const filters = document.getElementById("categoryFilters");
  const list = document.getElementById("blockList");
  if (!filters || !list) return;
  filters.innerHTML = "";
  allCategories().forEach(cat => {
    filters.append(h("div", {
      class: "category-chip" + (state.activeCategories.has(cat) ? " active" : ""),
      onclick: () => {
        if (state.activeCategories.has(cat)) state.activeCategories.delete(cat); else state.activeCategories.add(cat);
        renderList();
      }
    }, cat));
  });
  list.innerHTML = "";
  const found = filteredBlocks();
  const filtering = state.activeCategories.size > 0 || state.searchText.trim() !== "";
  if (filtering) {
    list.append(h("div", { class: "result-row" },
      h("span", {}, "결과 " + found.length + "건"),
      h("button", { onclick: () => {
        state.activeCategories.clear();
        state.searchText = "";
        const input = document.getElementById("searchInput");
        if (input) input.value = "";
        renderList();
      } }, "필터 해제")));
  }
  found.forEach(b => {
    list.append(h("div", {
      class: "block-list-item" + (b.id === state.mainId ? " current" : ""),
      onclick: () => selectFromList(b.id)
    }, b.title));
  });
  if (state.loadErrors.length) {
    list.append(h("div", { class: "side-note warn", title: state.loadErrors.join("\n") }, "읽지 못한 파일 " + state.loadErrors.length + "개 (마우스를 올리면 목록)"));
  }
}

function renderTopbar() {
  const back = document.getElementById("backBtn");
  back.disabled = state.history.length === 0 || !!state.editing;
  back.onclick = () => { const prev = state.history.pop(); state.mainId = prev; state.expanded.clear(); render(); };
  const names = state.editing ? [state.editing.isNew ? "새 블록" : "편집: " + state.editing.draft.title]
    : [...state.history, state.mainId].filter(id => getBlock(id)).map(id => getBlock(id).title);
  document.getElementById("crumb").textContent = names.join("  ›  ");
}

/* ---------- 뷰어 ---------- */
function renderNode(block, ancestors, pathKey, isMain) {
  const header = h("div", { class: "node-header" }, h("span", { class: "title" }, block.title),
    block.categories.map(c => h("span", { class: "tag" }, c)));
  if (isMain) {
    header.append(
      h("button", { onclick: () => startEdit(block.id) }, "편집"),
      h("button", { class: "danger", onclick: () => deleteBlock(block.id) }, "삭제"));
  } else {
    header.append(h("button", { onclick: () => setMain(block.id, true) }, "메인으로 열기"));
  }

  const chain = [...ancestors, block.id];
  const rows = h("div", { class: "rows" });
  block.rows.forEach((row, i) => {
    const el = h("div", { class: "row " + row.type }, h("span", { class: "pin" }));
    if (row.type !== "step") el.append(h("div", { class: "row-label" }, TYPE_LABEL[row.type] || row.type));
    el.append(h("div", { class: "row-text" }, row.text || ""));
    if (row.attachments && row.attachments.length) {
      el.append(h("div", { class: "row-attach" },
        row.attachments.map(a => h("a", { href: openerUrl(a.path), title: fileUrlToPath(a.path) }, "첨부: " + (a.name || a.path)))));
    }
    if (row.branches && row.branches.length) {
      const wrap = h("div", { class: "branches" });
      row.branches.forEach((br, j) => wrap.append(renderBranch(br, chain, pathKey + "/" + i + "." + j)));
      el.append(wrap);
    }
    rows.append(el);
  });

  return h("div", { class: "node" }, header, rows);
}

function renderBranch(br, chain, key) {
  const el = h("div", { class: "branch" });
  if (br.label) el.append(h("div", { class: "branch-label" }, br.label));
  if (!br.targetBlockId) return el;

  const target = getBlock(br.targetBlockId);
  if (!target) { el.append(h("span", { class: "ref-chip disabled" }, "(블록 없음)")); return el; }

  const cyclic = chain.includes(target.id);
  const open = state.expanded.has(key);
  const chip = h("span", { class: "ref-chip" + (open ? " open" : "") + (cyclic ? " disabled" : "") },
    target.title + (cyclic ? " (순환 참조)" : ""));
  el.append(chip);
  if (!cyclic) {
    chip.onclick = () => {
      if (state.expanded.has(key)) state.expanded.delete(key); else state.expanded.add(key);
      renderCanvas();
    };
    if (open) el.append(h("div", { class: "ref-body" }, renderNode(target, chain, key, false)));
  }
  return el;
}

/* ---------- 첨부파일 ---------- */
// file:///D:/a/b.docx -> D:\a\b.docx, file://server/share/x -> \\server\share\x
function fileUrlToPath(u) {
  let s = String(u || "").replace(/^file:/i, "");
  try { s = decodeURIComponent(s); } catch (e) { /* 디코딩 불가 시 원문 사용 */ }
  if (/^\/*[A-Za-z]:/.test(s)) s = s.replace(/^\/+/, "");
  return s.replace(/\//g, "\\");
}

// 브라우저가 직접 열면 다운로드/브라우저 표시가 되므로, 등록된 도우미(helper/register.cmd)로 전달
function openerUrl(fileUrl) {
  return "ohmyopen:open?p=" + encodeURIComponent(fileUrlToPath(fileUrl));
}

function fileUrlBase(abs) {
  const p = abs.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  return p.startsWith("//") ? "file:" + p : "file:///" + p.replace(/^\/+/, "");
}

function askRootPath(name, current) {
  const abs = prompt("폴더 '" + name + "'의 전체 경로를 입력하세요.\n(탐색기 주소창에서 복사한 경로, 예: D:\\Manuals\\files)", current || "");
  return abs && abs.trim() ? abs.trim() : null;
}

// 이 앱의 주소(file:///D:/a/b/index.html)에 선택한 폴더와 같은 이름의 상위 폴더가 있으면 그 경로를 추정
function guessRootPath(name) {
  try {
    const parts = decodeURIComponent(location.pathname).split("/").filter(Boolean);
    parts.pop();
    for (let i = parts.length - 1; i >= 0; i--) {
      if (parts[i].toLowerCase() === name.toLowerCase()) {
        const path = parts.slice(0, i + 1).join("\\");
        return location.host ? "\\\\" + location.host + "\\" + path : path;
      }
    }
  } catch (e) { /* 추정 실패 시 직접 입력 */ }
  return null;
}

async function saveRoots() {
  await Storage.setAttachRoots(state.attachRoots);
  renderCanvas();
}

function addRoot() {
  guard(async () => {
    const handle = await window.showDirectoryPicker({ mode: "read" });
    for (const r of state.attachRoots) {
      if (await r.handle.isSameEntry(handle)) { alert("이미 등록된 폴더입니다: " + r.abs); return; }
    }
    const guess = guessRootPath(handle.name);
    const abs = guess && confirm("'" + handle.name + "' 폴더의 경로를 아래로 등록할까요?\n\n" + guess + "\n\n[취소]를 누르면 직접 입력합니다.")
      ? guess : askRootPath(handle.name, guess || "");
    if (!abs) return;
    state.attachRoots.push({ id: Storage.newId(), name: handle.name, handle, abs });
    await saveRoots();
  });
}

function editRoot(i) {
  guard(async () => {
    const r = state.attachRoots[i];
    const abs = askRootPath(r.name, r.abs);
    if (!abs) return;
    r.abs = abs;
    await saveRoots();
  });
}

function removeRoot(i) {
  guard(async () => {
    if (!confirm("기준 폴더 '" + state.attachRoots[i].abs + "' 등록을 해제합니다.\n(이미 추가된 첨부 링크는 유지됩니다.)")) return;
    state.attachRoots.splice(i, 1);
    await saveRoots();
  });
}

function addAttachments(row) {
  guard(async () => {
    if (!state.attachRoots.length) { alert("먼저 편집기 아래쪽 '+ 기준 폴더 추가'로 첨부 기준 폴더를 등록하세요."); return; }
    // 파일 선택 창을 열기 전(클릭 직후)에 모든 기준 폴더의 읽기 권한을 확보
    const usable = [];
    for (const r of state.attachRoots) {
      try {
        let p = await r.handle.queryPermission({ mode: "read" });
        if (p !== "granted") p = await r.handle.requestPermission({ mode: "read" });
        if (p === "granted") usable.push(r);
      } catch (e) { /* 이동·삭제된 폴더는 건너뜀 */ }
    }
    if (!usable.length) { alert("사용할 수 있는 기준 폴더가 없습니다. 폴더 권한을 허용하거나 기준 폴더를 다시 등록하세요."); return; }

    const picked = await window.showOpenFilePicker({ multiple: true, startIn: usable[0].handle });
    const outside = [];
    for (const fh of picked) {
      let best = null;
      for (const r of usable) {
        const rel = await r.handle.resolve(fh);
        if (rel && (!best || rel.length < best.rel.length)) best = { root: r, rel };
      }
      if (!best) { outside.push(fh.name); continue; }
      (row.attachments = row.attachments || []).push({
        name: fh.name,
        path: fileUrlBase(best.root.abs) + "/" + best.rel.map(encodeURIComponent).join("/")
      });
    }
    if (outside.length) alert("등록된 기준 폴더 하위에 없는 파일은 추가하지 않았습니다:\n" + outside.join("\n") + "\n\n해당 파일을 포함하는 폴더를 '+ 기준 폴더 추가'로 등록하세요.");
    renderCanvas();
  });
}

/* ---------- 편집기 ---------- */
function renderEditor() {
  const ed = state.editing;
  const d = ed.draft;
  const others = allBlocks().filter(b => b.id !== d.id);

  const rowsBox = h("div", {});
  d.rows.forEach((row, i) => {
    const typeSel = h("select", { onchange: (e) => { row.type = e.target.value; renderCanvas(); } },
      Object.entries(TYPE_LABEL).map(([k, v]) => h("option", { value: k, ...(row.type === k ? { selected: "selected" } : {}) }, v)));
    const text = h("textarea", { rows: "2", oninput: (e) => { row.text = e.target.value; } });
    text.value = row.text || "";

    const branchBox = h("div", { class: "ed-branches" });
    (row.branches || []).forEach((br, j) => {
      const sel = h("select", { onchange: (e) => { br.targetBlockId = e.target.value || null; } },
        h("option", { value: "" }, "(연결 없음)"),
        others.map(o => h("option", { value: o.id, ...(br.targetBlockId === o.id ? { selected: "selected" } : {}) }, o.title)));
      branchBox.append(h("div", { class: "ed-line" },
        h("input", { type: "text", placeholder: "분기 라벨", value: br.label || "", oninput: (e) => { br.label = e.target.value; } }),
        sel,
        h("button", { onclick: () => { row.branches.splice(j, 1); renderCanvas(); } }, "✕")));
    });

    const attBox = h("div", { class: "ed-branches" });
    (row.attachments || []).forEach((a, j) => {
      attBox.append(h("div", { class: "ed-line" },
        h("input", { type: "text", placeholder: "표시 이름", value: a.name || "", oninput: (e) => { a.name = e.target.value; } }),
        h("span", { class: "ed-path", title: a.path }, a.path),
        h("button", { onclick: () => { row.attachments.splice(j, 1); renderCanvas(); } }, "✕")));
    });

    rowsBox.append(h("div", { class: "ed-row " + row.type },
      h("div", { class: "ed-line" }, typeSel,
        h("button", { onclick: () => { if (i > 0) { [d.rows[i - 1], d.rows[i]] = [d.rows[i], d.rows[i - 1]]; renderCanvas(); } } }, "↑"),
        h("button", { onclick: () => { if (i < d.rows.length - 1) { [d.rows[i + 1], d.rows[i]] = [d.rows[i], d.rows[i + 1]]; renderCanvas(); } } }, "↓"),
        h("button", { onclick: () => { d.rows.splice(i, 1); renderCanvas(); } }, "행 삭제")),
      text, attBox, branchBox,
      h("div", { class: "ed-line" },
        h("button", { onclick: () => addAttachments(row) }, "+ 첨부 (파일 선택)"),
        h("button", { onclick: () => { (row.branches = row.branches || []).push({ label: "", targetBlockId: null }); renderCanvas(); } }, "+ 분기 연결"))));
  });

  const rootsBox = h("div", {});
  state.attachRoots.forEach((r, i) => rootsBox.append(h("div", { class: "ed-line" },
    h("span", { class: "ed-path", title: r.abs }, r.abs),
    h("button", { onclick: () => editRoot(i) }, "경로 수정"),
    h("button", { onclick: () => removeRoot(i) }, "해제"))));

  return h("div", { class: "node editor" },
    h("div", { class: "node-header" }, h("span", { class: "title" }, ed.isNew ? "새 블록" : "블록 편집"),
      h("button", { class: "primary", onclick: saveEditing }, "저장"),
      h("button", { onclick: cancelEditing }, "취소")),
    h("div", { class: "ed-body" },
      h("label", {}, "제목"),
      h("input", { type: "text", value: d.title, oninput: (e) => { d.title = e.target.value; } }),
      h("label", {}, "카테고리 (쉼표로 구분)"),
      h("input", { type: "text", value: ed.catText, oninput: (e) => { ed.catText = e.target.value; } }),
      h("label", {}, "내용 행"),
      rowsBox,
      h("button", { onclick: () => { d.rows.push({ type: "step", text: "" }); renderCanvas(); } }, "+ 행 추가"),
      h("label", {}, "첨부 기준 폴더 (등록된 폴더 하위의 파일을 첨부할 수 있음)"),
      rootsBox,
      h("button", { onclick: addRoot }, "+ 기준 폴더 추가")));
}

/* ---------- 캔버스 ---------- */
function renderWelcome() {
  const box = h("div", { class: "welcome" });
  if (!Storage.isSupported()) {
    box.append(h("p", {}, "이 브라우저는 폴더 접근 API를 지원하지 않습니다. Edge 또는 Chrome에서 여십시오."));
    return box;
  }
  box.append(h("p", {}, "블록 JSON 파일을 저장할 폴더를 선택하세요."),
    h("button", { class: "primary", onclick: openFolder }, "폴더 열기"));
  if (state.lastFolderName) {
    box.append(h("button", { onclick: reopenLast }, "마지막 폴더 다시 열기: " + state.lastFolderName));
  }
  return box;
}

function renderCanvas() {
  const canvas = document.getElementById("canvas");
  const scroll = canvas.scrollTop;
  canvas.innerHTML = "";
  if (!Storage.hasFolder()) canvas.append(renderWelcome());
  else if (state.editing) canvas.append(renderEditor());
  else if (state.mainId && getBlock(state.mainId)) canvas.append(renderNode(getBlock(state.mainId), [], "root", true));
  else {
    canvas.append(h("div", { class: "welcome" },
      h("p", {}, "이 폴더에 블록이 없습니다."),
      h("button", { class: "primary", onclick: startNew }, "+ 새 블록"),
      h("button", { onclick: createSamples }, "샘플 블록 생성")));
  }
  canvas.scrollTop = scroll;
}

function render() {
  renderSidebar();
  renderTopbar();
  renderCanvas();
}

/* ---------- 보기 설정(테마) ---------- */
const THEMES = [["dark", "다크"], ["light", "라이트"], ["soft", "저자극"]];
const view = { theme: "dark" };

function loadView() {
  try {
    const s = JSON.parse(localStorage.getItem("ohmymanual.view") || "{}");
    if (THEMES.some(t => t[0] === s.theme)) view.theme = s.theme;
  } catch (e) { /* 저장값 없음/차단 시 기본값 */ }
}

function applyView() {
  document.documentElement.setAttribute("data-theme", view.theme);
  document.getElementById("themeBtn").textContent = "테마: " + THEMES.find(t => t[0] === view.theme)[1];
  try { localStorage.setItem("ohmymanual.view", JSON.stringify(view)); } catch (e) { /* 무시 */ }
}

document.getElementById("themeBtn").onclick = () => {
  const i = THEMES.findIndex(t => t[0] === view.theme);
  view.theme = THEMES[(i + 1) % THEMES.length][0];
  applyView();
};
loadView();
applyView();

Storage.getAttachRoots().then(list => { state.attachRoots = list; });
Storage.lastFolderName().then(name => { state.lastFolderName = name; if (!Storage.hasFolder()) renderCanvas(); });
render();
