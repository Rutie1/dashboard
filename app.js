/* 铁胖的个人空间 v6 — 暖纸重设计版（Supabase 登录后可见） */
var SUPABASE_URL = 'https://arvpykrfraabwbnwlgje.supabase.co';
var SUPABASE_KEY = 'sb_publishable_TjINRMrM7lD8E-BIcaOlRg_-gJznHwL'; // 公开钥匙，数据靠登录 + RLS 保护
var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
var UID = null;

var KIND_LABEL = { weight: '体重', workout: '运动', meal: '饮食', other: '其他', steps: '步数', sleep: '睡眠', heartrate: '心率' };

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function toast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('show'); }, 2200);
}
function todayStr() {
  var n = new Date(), p = function (x) { return (x < 10 ? '0' : '') + x; };
  return n.getFullYear() + '-' + p(n.getMonth() + 1) + '-' + p(n.getDate());
}
function daysUntil(dateStr) {
  if (!dateStr) return null;
  var m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  var target = new Date(+m[1], +m[2] - 1, +m[3]);
  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86400000);
}
function fmtDate(d) {
  if (!d) return '';
  var m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? (m[1] + '-' + m[2] + '-' + m[3]) : String(d).slice(0, 10);
}
function loadingHTML() { return '<div class="empty">加载中…</div>'; }
/* 把数字里的小数四舍五入成整数，保留原单位文字 */
function roundNums(s) {
  return String(s == null ? '' : s).replace(/,/g, '').replace(/(\d+\.\d+)/g, function (m) {
    return String(Math.round(parseFloat(m)));
  });
}

/* ---------- 已阅：本地隐藏，看过的不再打扰 ---------- */
var DISMISS_KEY = 'dz_dismissed_v1';
var mailSig = {}, todoSig = {};
function getDismissed() {
  try { return JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}'); }
  catch (e) { return {}; }
}
function saveDismissed(d) { try { localStorage.setItem(DISMISS_KEY, JSON.stringify(d)); } catch (e) {} }
/* 签名：内容变了就视为新信息，重新出现 */
function sigMail(x) { return (x.mail_date || '') + '|' + (x.subject || ''); }
function sigTodo(x) { return (x.title || '') + '|' + (x.due_date || '') + '|' + (x.done ? '1' : '0'); }
function isDismissed(kind, id, sig) {
  var d = getDismissed();
  return !!(d[kind] && d[kind][id] === sig);
}
function dismissItem(kind, id, sig) {
  var d = getDismissed();
  d[kind] = d[kind] || {};
  d[kind][id] = sig;
  saveDismissed(d);
}
function undismissKind(kind) {
  var d = getDismissed();
  delete d[kind];
  saveDismissed(d);
}
function dismissFoot(kind, n) {
  return '<div class="dismiss-foot">已隐藏 ' + n + ' 条已阅 · <a href="javascript:void(0)" id="undismiss-' + kind + '">恢复显示</a></div>';
}

/* ---------- 登录 ---------- */
async function checkSession() {
  var r = await sb.auth.getSession();
  var s = r.data && r.data.session;
  if (s && s.user) { enterApp(s.user.id); }
  else {
    document.getElementById('login-view').hidden = false;
    document.getElementById('app-view').hidden = true;
  }
}
function tickClock() {
  var d = new Date(), p = function (x) { return (x < 10 ? '0' : '') + x; };
  var el = document.getElementById('hero-clock');
  if (el) el.textContent = p(d.getHours()) + ':' + p(d.getMinutes());
}
async function enterApp(uid) {
  UID = uid;
  document.getElementById('login-view').hidden = true;
  document.getElementById('app-view').hidden = false;
  var d = new Date();
  var hr = d.getHours();
  var greet = hr < 6 ? '夜深了' : hr < 12 ? '早上好' : hr < 14 ? '中午好' : hr < 18 ? '下午好' : '晚上好';
  document.getElementById('greeting').textContent = greet + '，Rudy';
  document.getElementById('today-date').textContent =
    d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 · 星期' + '日一二三四五六'[d.getDay()];
  document.getElementById('health-date').value = todayStr();
  tickClock();
  setInterval(tickClock, 15000);
  loadToday(); loadTrips(); loadTodos(); loadHealth(); loadMarket(); loadMail(); loadLinks(); loadPhotos();
}
document.getElementById('login-btn').addEventListener('click', async function () {
  var email = document.getElementById('login-email').value.trim();
  var pass = document.getElementById('login-pass').value;
  var errBox = document.getElementById('login-err');
  errBox.hidden = true;
  if (!email || !pass) { errBox.textContent = '请填写邮箱和密码'; errBox.hidden = false; return; }
  var r = await sb.auth.signInWithPassword({ email: email, password: pass });
  if (r.error) { errBox.textContent = '登录失败：' + r.error.message; errBox.hidden = false; return; }
  enterApp(r.data.user.id);
});
document.getElementById('login-pass').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') document.getElementById('login-btn').click();
});
document.getElementById('logout-btn').addEventListener('click', async function () {
  await sb.auth.signOut();
  location.reload();
});

/* ---------- tabs ---------- */
document.querySelectorAll('#tabs button').forEach(function (btn) {
  btn.addEventListener('click', function () {
    document.querySelectorAll('#tabs button').forEach(function (b) { b.classList.remove('active'); });
    document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
    window.scrollTo(0, 0);
  });
});
function switchTab(id) {
  document.querySelectorAll('#tabs button').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === id); });
  document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.toggle('active', p.id === id); });
  window.scrollTo(0, 0);
}

/* ---------- 今日：hero + 数据条 + bento ---------- */
function statCard(k, v, s, cls) {
  return '<div class="stat"><div class="k">' + esc(k) + '</div><div class="v num ' + (cls || '') + '">' + v + '</div><div class="s">' + esc(s) + '</div></div>';
}
function bentoCard(sec, title, tabId, bodyHtml, size) {
  return '<div class="bento-card sec-' + sec + (size ? ' ' + size : '') + '">' +
    '<div class="bento-head"><span class="dot"></span><h3>' + esc(title) + '</h3>' +
    '<a class="more" href="javascript:void(0)" onclick="switchTab(\'' + tabId + '\')">查看全部 →</a></div>' +
    '<div>' + bodyHtml + '</div></div>';
}
function bentoRow(main, sub) {
  return '<div class="bento-row"><div>' + main + '</div>' + (sub ? '<div class="meta">' + sub + '</div>' : '') + '</div>';
}

async function loadToday() {
  var t = todayStr();
  try {
    var rs = await Promise.all([
      sb.from('dash_trips').select('*').eq('user_id', UID).gte('end_date', t).order('start_date', { ascending: true }).limit(1),
      sb.from('dash_todos').select('*').eq('user_id', UID).eq('done', false).order('due_date', { ascending: true, nullsFirst: false }).limit(50),
      sb.from('dash_headlines').select('*').eq('user_id', UID).order('headline_date', { ascending: false }).order('sort', { ascending: true }).limit(5),
      sb.from('dash_mail').select('*').eq('user_id', UID).order('mail_date', { ascending: false }).order('sort', { ascending: true }).limit(30),
      sb.from('dash_health').select('*').eq('user_id', UID).in('kind', ['steps', 'sleep', 'weight']).order('log_date', { ascending: false }).limit(12),
      sb.from('dash_links').select('*').eq('user_id', UID).order('group_name', { ascending: true }).order('sort', { ascending: true }).limit(8)
    ]);
    var trips = rs[0].data || [], todos = rs[1].data || [], heads = rs[2].data || [],
        mails = rs[3].data || [], healths = rs[4].data || [], links = rs[5].data || [];
    if (rs[0].error) throw rs[0].error;

    /* 已阅过滤：只看还没看过的 */
    todoSig = {}; mailSig = {};
    todos.forEach(function (x) { todoSig[x.id] = sigTodo(x); });
    mails.forEach(function (x) { mailSig[x.id] = sigMail(x); });
    var visTodos = todos.filter(function (x) { return !isDismissed('todos', x.id, todoSig[x.id]); });
    var visMails = mails.filter(function (x) { return !isDismissed('mail', x.id, mailSig[x.id]); });

    /* --- hero 焦点 --- */
    var focus = '', trip = trips[0] || null, tripDays = trip ? daysUntil(trip.start_date) : null;
    var overdue = visTodos.filter(function (x) { return x.due_date && x.due_date < t; });
    var dueToday = visTodos.filter(function (x) { return x.due_date === t; });
    if (trip && tripDays !== null && tripDays >= 0 && tripDays <= 30) {
      focus = esc(trip.title) + '还有 ' + tripDays + ' 天';
    } else if (overdue.length) {
      focus = '有 ' + overdue.length + ' 件待办已逾期，先清掉吧';
    } else if (dueToday.length) {
      focus = '今天还有 ' + dueToday.length + ' 件事要做';
    } else if (visTodos.length) {
      focus = '还有 ' + visTodos.length + ' 件待办，加油';
    } else {
      focus = '今天暂无安排，好好享受生活';
    }
    var fe = document.getElementById('hero-focus');
    fe.textContent = focus; fe.hidden = false;

    /* --- 数据条 --- */
    var steps = healths.filter(function (x) { return x.kind === 'steps'; })[0];
    var sleep = healths.filter(function (x) { return x.kind === 'sleep'; })[0];
    var stats = '';
    stats += statCard('待办', String(visTodos.length),
      overdue.length ? overdue.length + ' 件已逾期' : (visTodos.length ? '继续保持' : '全部搞定'),
      overdue.length ? 'bad' : 'c-todos');
    stats += statCard('步数', steps ? esc(roundNums(steps.value_text)) : '—',
      steps ? fmtDate(steps.log_date) : '暂无数据', 'c-health');
    stats += statCard('睡眠', sleep ? esc(sleep.value_text) : '—',
      sleep ? fmtDate(sleep.log_date) : '暂无数据', 'c-health');
    stats += statCard('邮件', String(visMails.length), visMails.length ? '待看摘要' : '都看完了', 'c-mail');
    document.getElementById('stat-strip').innerHTML = stats;

    /* --- bento 预览 --- */
    var bento = '';
    // 待办事项（含行程）
    var todoBody = '';
    if (trip) {
      todoBody += bentoRow('<b>' + esc(trip.title) + '</b> · <span class="num" style="color:var(--c-trips);font-weight:800;">' +
        (tripDays > 0 ? tripDays + ' 天后出发' : (tripDays === 0 ? '今天出发' : '进行中')) + '</span>',
        esc(fmtDate(trip.start_date)) + ' → ' + esc(fmtDate(trip.end_date)));
    }
    todoBody += visTodos.length ?
      visTodos.slice(0, 3).map(function (x) {
        var over = x.due_date && x.due_date < t;
        return bentoRow(esc(x.title),
          (over ? '<span style="color:var(--red);font-weight:700;">已逾期 · </span>' : '') + (x.due_date ? esc(fmtDate(x.due_date)) : '无截止'));
      }).join('') + (visTodos.length > 3 ? '<div class="bento-empty">还有 ' + (visTodos.length - 3) + ' 件…</div>' : '')
      : (trip ? '' : '<div class="bento-empty">今天没有待办，挺好。</div>');
    bento += bentoCard('todos', '待办事项', 'tab-todos', todoBody, 'full');
    // 健康
    var weight = healths.filter(function (x) { return x.kind === 'weight'; })[0];
    var healthBody = '';
    if (steps) healthBody += bentoRow('步数 <b class="num">' + esc(roundNums(steps.value_text)) + '</b>', esc(fmtDate(steps.log_date)));
    if (sleep) healthBody += bentoRow('睡眠 <b class="num">' + esc(sleep.value_text) + '</b>', esc(fmtDate(sleep.log_date)));
    if (weight) healthBody += bentoRow('体重 <b class="num">' + esc(weight.value_text) + '</b>', esc(fmtDate(weight.log_date)));
    bento += bentoCard('health', '健康', 'tab-health',
      healthBody || '<div class="bento-empty">还没有记录。</div>', '', 'narrow');
    // 市场
    bento += bentoCard('market', '市场', 'tab-market', heads.length ?
      heads.slice(0, 3).map(function (x) {
        return bentoRow(esc(x.title), x.source ? esc(x.source) : '');
      }).join('')
      : '<div class="bento-empty">暂无新闻，每天 7:50 自动更新。</div>', 'wide');
    // 邮箱
    bento += bentoCard('mail', '邮箱', 'tab-mail', visMails.length ?
      visMails.slice(0, 3).map(function (x) {
        return bentoRow('<b>' + esc(x.subject) + '</b>', x.sender ? '来自：' + esc(x.sender) : '');
      }).join('')
      : '<div class="bento-empty">还没有邮件摘要。</div>');
    // 链接
    bento += bentoCard('links', '链接', 'tab-links', links.length ?
      '<div class="link-grid" style="margin-top:4px;">' + links.map(function (x) {
        return '<a class="link-btn" style="margin-top:0;padding:7px 14px;font-size:13px;" href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.label) + '</a>';
      }).join('') + '</div>'
      : '<div class="bento-empty">还没有链接。</div>', '');
    document.getElementById('today-bento').innerHTML = bento;
  } catch (e) {
    document.getElementById('today-bento').innerHTML = '<div class="empty">加载失败：' + esc(e.message) + '</div>';
  }
}

/* ---------- 生活剪影：私密桶照片 ---------- */
async function loadPhotos() {
  try {
    var files = ['couple-park.jpg', 'niagara-family.jpg', 'beach-couple.jpg', 'family-everglades.jpg'];
    var urls = [];
    for (var i = 0; i < files.length; i++) {
      var r = await sb.storage.from('private-photos').createSignedUrl(files[i], 7200);
      if (r.data && r.data.signedUrl) urls.push(r.data.signedUrl);
    }
    if (!urls.length) return;
    var bento = document.getElementById('today-bento');
    var card = document.createElement('div');
    card.className = 'bento-card photo-card';
    card.style.gridColumn = 'span 6';
    card.innerHTML = '<div class="bento-head"><span class="dot" style="background:var(--brand);"></span><h3>生活剪影</h3></div>' +
      '<div class="photo-grid">' + urls.map(function (u) {
        return '<img src="' + u + '" alt="" loading="lazy">';
      }).join('') + '</div>';
    bento.appendChild(card);
  } catch (e) { /* 照片加载失败就静默跳过，不打扰 */ }
}

/* ---------- 行程 ---------- */
async function loadTrips() {
  var box = document.getElementById('trips-list');
  box.innerHTML = loadingHTML();
  try {
    var r = await sb.from('dash_trips').select('*').eq('user_id', UID).order('start_date', { ascending: true });
    if (r.error) throw r.error;
    var rows = r.data || [];
    box.innerHTML = rows.length ? rows.map(function (x) {
      var d = daysUntil(x.start_date);
      var cd = d === null ? '' : (d > 0 ? '<div class="countdown">' + d + ' <small>天后出发</small></div>' : (d === 0 ? '<div class="countdown">今天出发</div>' : '<div class="meta">进行中</div>'));
      var notesHtml = x.notes ? '<div class="trip-detail" hidden>' + esc(x.notes).replace(/\n/g, '<br>') + '</div>' : '';
      var toggleBtn = x.notes ? '<button class="mini-btn trip-toggle">展开详情</button>' : '';
      return '<div class="card trip-card"><h3>' + esc(x.title) + '</h3>' + cd +
        '<div class="meta">' + esc(fmtDate(x.start_date)) + ' → ' + esc(fmtDate(x.end_date)) + '</div>' +
        notesHtml + '<div style="margin-top:8px;">' + toggleBtn +
        (x.link_url ? ' <a class="link-btn" href="' + esc(x.link_url) + '" target="_blank" rel="noopener">' + esc(x.link_label || '打开') + '</a>' : '') + '</div></div>';
    }).join('') : '<div class="empty">还没有行程，来计划一次远方吧。</div>';
    box.querySelectorAll('.trip-toggle').forEach(function (b) {
      b.addEventListener('click', function () {
        var detail = b.closest('.trip-card').querySelector('.trip-detail');
        var open = detail.hidden;
        detail.hidden = !open;
        b.textContent = open ? '收起详情' : '展开详情';
      });
    });
  } catch (e) { box.innerHTML = '<div class="empty">加载失败：' + esc(e.message) + '</div>'; }
}
/* ---------- 待办（含行程） ---------- */
async function loadTodos() {
  var box = document.getElementById('todos-list');
  box.innerHTML = loadingHTML();
  try {
    var r = await sb.from('dash_todos').select('*').eq('user_id', UID).order('done', { ascending: true }).order('due_date', { ascending: true, nullsFirst: false });
    if (r.error) throw r.error;
    var rows = r.data || [], t = todayStr();
    todoSig = {};
    var visible = rows.filter(function (x) {
      var s = sigTodo(x); todoSig[x.id] = s;
      return !isDismissed('todos', x.id, s);
    });
    var hiddenN = rows.length - visible.length;
    box.innerHTML = visible.length ? visible.map(function (x) {
      var over = !x.done && x.due_date && x.due_date < t;
      return '<div class="todo-row' + (x.done ? ' done' : '') + '">' +
        '<input type="checkbox" data-todo-toggle="' + esc(x.id) + '"' + (x.done ? ' checked' : '') + '>' +
        '<div class="grow"><div class="t-title">' + esc(x.title) + '</div>' +
        (x.due_date ? '<span class="tag' + (over ? ' overdue' : ' tone-todos') + '">' + (over ? '已逾期 · ' : '') + esc(fmtDate(x.due_date)) + '</span>' : '') + '</div>' +
        '<button class="mini-btn" data-dt="' + esc(x.id) + '">已阅</button>' +
        '<button class="mini-btn" data-todo-del="' + esc(x.id) + '">删除</button></div>';
    }).join('') + (hiddenN ? dismissFoot('todos', hiddenN) : '')
      : '<div class="empty">' + (rows.length ? '都处理完啦，喝杯水吧。' : '没有待办，加一条吧。') + '</div>' + (hiddenN ? dismissFoot('todos', hiddenN) : '');
    box.querySelectorAll('[data-dt]').forEach(function (b) {
      b.addEventListener('click', function () { dismissItem('todos', b.dataset.dt, todoSig[b.dataset.dt]); loadTodos(); loadToday(); });
    });
    var unT = document.getElementById('undismiss-todos');
    if (unT) unT.addEventListener('click', function () { undismissKind('todos'); loadTodos(); loadToday(); });
    box.querySelectorAll('[data-todo-toggle]').forEach(function (c) {
      c.addEventListener('change', function () { toggleTodo(c.dataset.todoToggle, c.checked); });
    });
    box.querySelectorAll('[data-todo-del]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!confirm('删除这条待办？')) return;
        var del = await sb.from('dash_todos').delete().eq('id', b.dataset.todoDel).eq('user_id', UID);
        if (del.error) toast('删除失败：' + del.error.message);
        else { toast('已删除'); loadTodos(); loadToday(); }
      });
    });
  } catch (e) { box.innerHTML = '<div class="empty">加载失败：' + esc(e.message) + '</div>'; }
}
async function toggleTodo(id, done) {
  var r = await sb.from('dash_todos').update({ done: done }).eq('id', id).eq('user_id', UID);
  if (r.error) toast('更新失败：' + r.error.message);
  loadTodos(); loadToday();
}
document.getElementById('todo-form').addEventListener('submit', async function (ev) {
  ev.preventDefault();
  var fd = new FormData(ev.target);
  var title = (fd.get('title') || '').trim();
  if (!title) { toast('写点什么吧'); return; }
  var r = await sb.from('dash_todos').insert({
    user_id: UID, title: title,
    due_date: (fd.get('due_date') || '').trim() || null, done: false
  });
  if (r.error) toast('添加失败：' + r.error.message);
  else { toast('已添加'); ev.target.reset(); loadTodos(); loadToday(); }
});
document.getElementById('todos-refresh').addEventListener('click', loadTodos);

/* ---------- 健康 ---------- */
async function loadHealth() {
  var box = document.getElementById('health-list');
  box.innerHTML = loadingHTML();
  try {
    var r = await sb.from('dash_health').select('*').eq('user_id', UID).order('log_date', { ascending: false }).order('created_at', { ascending: false }).limit(60);
    if (r.error) throw r.error;
    var rows = r.data || [];
    var w = rows.filter(function (x) { return x.kind === 'weight'; })[0];
    var html = w ? '<div class="card" style="margin-bottom:12px;"><h2 style="font-size:13px;letter-spacing:.2em;color:var(--ink-3);">最近体重</h2><div style="font-size:26px;font-weight:800;color:var(--c-health);" class="num">' + esc(w.value_text) + '</div><div class="meta">' + esc(fmtDate(w.log_date)) + '</div></div>' : '';
    html += rows.length ? rows.map(function (x) {
      return '<div class="health-row"><div class="grow"><div class="t-title">' + esc(x.value_text || '') + '</div>' +
        '<span class="tag tone-health">' + esc(KIND_LABEL[x.kind] || x.kind) + '</span>' +
        '<span class="tag">' + esc(fmtDate(x.log_date)) + '</span>' +
        (x.note ? '<div class="meta">' + esc(x.note) + '</div>' : '') + '</div>' +
        '<button class="mini-btn" data-h-del="' + esc(x.id) + '">删除</button></div>';
    }).join('') : '<div class="empty">还没有记录。</div>';
    box.innerHTML = html;
    box.querySelectorAll('[data-h-del]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!confirm('删除这条记录？')) return;
        var del = await sb.from('dash_health').delete().eq('id', b.dataset.hDel).eq('user_id', UID);
        if (del.error) toast('删除失败：' + del.error.message);
        else { toast('已删除'); loadHealth(); }
      });
    });
  } catch (e) { box.innerHTML = '<div class="empty">加载失败：' + esc(e.message) + '</div>'; }
}
document.getElementById('health-form').addEventListener('submit', async function (ev) {
  ev.preventDefault();
  var fd = new FormData(ev.target);
  var r = await sb.from('dash_health').insert({
    user_id: UID, kind: fd.get('kind'), log_date: (fd.get('log_date') || '').trim() || todayStr(),
    value_text: (fd.get('value_text') || '').trim()
  });
  if (r.error) toast('记录失败：' + r.error.message);
  else { toast('已记录'); ev.target.reset(); document.getElementById('health-date').value = todayStr(); loadHealth(); }
});
document.getElementById('health-refresh').addEventListener('click', loadHealth);

/* ---------- 市场 ---------- */
async function loadMarket() {
  var box = document.getElementById('market-list');
  box.innerHTML = loadingHTML();
  try {
    var r = await sb.from('dash_headlines').select('*').eq('user_id', UID).order('headline_date', { ascending: false }).order('sort', { ascending: true }).limit(60);
    if (r.error) throw r.error;
    var rows = r.data || [];
    if (!rows.length) { box.innerHTML = '<div class="empty">暂无新闻，每天 7:50 自动更新后显示在这里。</div>'; return; }
    var byDate = {}, order = [];
    rows.forEach(function (x) {
      if (!byDate[x.headline_date]) { byDate[x.headline_date] = []; order.push(x.headline_date); }
      byDate[x.headline_date].push(x);
    });
    box.innerHTML = order.map(function (dt) {
      return '<div class="news-date">' + esc(fmtDate(dt)) + '</div>' +
        byDate[dt].map(function (x) {
          var srcHtml = '';
          if (x.source) {
            srcHtml = x.source_url
              ? '<div class="meta">来源：<a href="' + esc(x.source_url) + '" target="_blank" rel="noopener" style="color:var(--c-market);text-decoration:none;font-weight:600;">' + esc(x.source) + ' →</a></div>'
              : '<div class="meta">来源：' + esc(x.source) + '</div>';
          }
          return '<div class="card news-item"><h3>' + esc(x.title) + '</h3>' +
            (x.summary ? '<p>' + esc(x.summary) + '</p>' : '') + srcHtml + '</div>';
        }).join('');
    }).join('');
  } catch (e) { box.innerHTML = '<div class="empty">加载失败：' + esc(e.message) + '</div>'; }
}
document.getElementById('market-refresh').addEventListener('click', loadMarket);

/* ---------- 链接 ---------- */
async function loadLinks() {
  var box = document.getElementById('links-list');
  box.innerHTML = loadingHTML();
  try {
    var r = await sb.from('dash_links').select('*').eq('user_id', UID).order('group_name', { ascending: true }).order('sort', { ascending: true });
    if (r.error) throw r.error;
    var rows = r.data || [];
    if (!rows.length) { box.innerHTML = '<div class="empty">还没有链接。</div>'; return; }
    var groups = {}, order = [];
    rows.forEach(function (x) {
      var g = x.group_name || '常用';
      if (!groups[g]) { groups[g] = []; order.push(g); }
      groups[g].push(x);
    });
    box.innerHTML = order.map(function (g) {
      return '<div class="link-group"><h3>' + esc(g) + '</h3><div class="link-grid">' +
        groups[g].map(function (x) {
          return '<a class="link-btn" href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.label) + '</a>';
        }).join('') + '</div></div>';
    }).join('');
  } catch (e) { box.innerHTML = '<div class="empty">加载失败：' + esc(e.message) + '</div>'; }
}
document.getElementById('links-refresh').addEventListener('click', loadLinks);

/* ---------- 邮箱 ---------- */
async function loadMail() {
  var box = document.getElementById('mail-list');
  box.innerHTML = loadingHTML();
  try {
    var r = await sb.from('dash_mail').select('*').eq('user_id', UID).order('mail_date', { ascending: false }).order('sort', { ascending: true }).limit(60);
    if (r.error) throw r.error;
    var rows = r.data || [];
    mailSig = {};
    var visible = rows.filter(function (x) {
      var s = sigMail(x); mailSig[x.id] = s;
      return !isDismissed('mail', x.id, s);
    });
    var hiddenN = rows.length - visible.length;
    if (!visible.length) {
      box.innerHTML = '<div class="empty">' + (rows.length ? '邮件都看完啦。' : '还没有邮件摘要。每天自动扫描后显示在这里。') + '</div>' +
        (hiddenN ? dismissFoot('mail', hiddenN) : '');
    } else {
      var byDate = {}, order = [];
      visible.forEach(function (x) {
        if (!byDate[x.mail_date]) { byDate[x.mail_date] = []; order.push(x.mail_date); }
        byDate[x.mail_date].push(x);
      });
      box.innerHTML = order.map(function (dt) {
        return '<div class="news-date">' + esc(fmtDate(dt)) + '</div>' +
          byDate[dt].map(function (x) {
            var gmailUrl = x.gmail_id ? 'https://mail.google.com/mail/u/0/#all/' + esc(x.gmail_id) : '';
            return '<div class="card mail-row"><div class="grow">' +
              '<div class="mail-subject">' + esc(x.subject) + '</div>' +
              (x.sender ? '<div class="mail-meta">来自：' + esc(x.sender) + '</div>' : '') +
              (x.summary ? '<p>' + esc(x.summary) + '</p>' : '') +
              '<div class="mail-actions">' +
              (gmailUrl ? '<a class="mail-link" href="' + gmailUrl + '" target="_blank" rel="noopener">查看原邮件 →</a>' : '') +
              '<button class="mini-btn" data-dm="' + esc(x.id) + '">已阅</button></div>' +
              '</div></div>';
          }).join('');
      }).join('') + (hiddenN ? dismissFoot('mail', hiddenN) : '');
    }
    box.querySelectorAll('[data-dm]').forEach(function (b) {
      b.addEventListener('click', function () { dismissItem('mail', b.dataset.dm, mailSig[b.dataset.dm]); loadMail(); loadToday(); });
    });
    var unM = document.getElementById('undismiss-mail');
    if (unM) unM.addEventListener('click', function () { undismissKind('mail'); loadMail(); loadToday(); });
  } catch (e) { box.innerHTML = '<div class="empty">加载失败：' + esc(e.message) + '</div>'; }
}
document.getElementById('mail-refresh').addEventListener('click', loadMail);

/* ---------- 启动 ---------- */
checkSession();
