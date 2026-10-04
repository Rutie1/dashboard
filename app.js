/* 个人助手 v2 - 私人驾驶舱（Supabase 登录后可见） */
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
async function enterApp(uid) {
  UID = uid;
  document.getElementById('login-view').hidden = true;
  document.getElementById('app-view').hidden = false;
  var d = new Date();
  var hr = d.getHours();
  var greet = hr < 6 ? '夜深了' : hr < 12 ? '早上好' : hr < 14 ? '中午好' : hr < 18 ? '下午好' : '晚上好';
  document.getElementById('greeting').innerHTML = greet + ' <span class="gold">·</span>';
  document.getElementById('today-date').textContent =
    d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 · 星期' + '日一二三四五六'[d.getDay()];
  document.getElementById('health-date').value = todayStr();
  loadToday(); loadTrips(); loadTodos(); loadHealth(); loadMarket(); loadMail(); loadLinks();
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

/* ---------- 今日 ---------- */
async function loadToday() {
  var box = document.getElementById('today-box');
  box.innerHTML = loadingHTML();
  try {
    var t = todayStr(), html = '';
    // 行程倒计时：最近的一次未来行程
    var tr = await sb.from('dash_trips').select('*').eq('user_id', UID).gte('end_date', t).order('start_date', { ascending: true }).limit(1);
    if (tr.error) throw tr.error;
    if (tr.data.length) {
      var trip = tr.data[0];
      var d = daysUntil(trip.start_date);
      var cd = d > 0 ? '还有 <span class="countdown">' + d + '</span> 天' : (d === 0 ? '就是 <span class="countdown">今天</span>' : '进行中');
      html += '<div class="today-sec"><h2>行程</h2><div><b>' + esc(trip.title) + '</b> · ' + cd + '</div>' +
        '<div class="meta">' + esc(fmtDate(trip.start_date)) + ' → ' + esc(fmtDate(trip.end_date)) + '</div></div>';
    }
    // 今日待办：逾期 + 今天到期，未完成
    var td = await sb.from('dash_todos').select('*').eq('user_id', UID).eq('done', false).lte('due_date', t).order('due_date', { ascending: true }).limit(5);
    if (td.error) throw td.error;
    html += '<div class="today-sec"><h2>今日待办</h2>';
    html += td.data.length ? td.data.map(function (x) {
      var over = x.due_date && x.due_date < t;
      return '<div class="todo-row"><input type="checkbox" data-todo-toggle="' + esc(x.id) + '">' +
        '<div class="grow"><div class="t-title">' + esc(x.title) + '</div>' +
        (x.due_date ? '<span class="tag' + (over ? ' overdue' : '') + '">' + (over ? '已逾期 · ' : '') + esc(fmtDate(x.due_date)) + '</span>' : '') + '</div></div>';
    }).join('') : '<div class="empty">今天没有待办，挺好。</div>';
    html += '</div>';
    // 最新市场新闻
    var mh = await sb.from('dash_headlines').select('*').eq('user_id', UID).order('headline_date', { ascending: false }).order('sort', { ascending: true }).limit(5);
    if (mh.error) throw mh.error;
    html += '<div class="today-sec"><h2>市场</h2>';
    html += mh.data.length ? '<div class="meta">' + esc(fmtDate(mh.data[0].headline_date)) + ' 更新</div>' +
      mh.data.map(function (x) { return '<div style="margin-top:8px;"><b>' + esc(x.title) + '</b></div>'; }).join('')
      : '<div class="empty">暂无新闻，每天 7:50 自动更新后显示在这里。</div>';
    html += '</div>';
    // 邮箱动态：最新 3 条
    var ml = await sb.from('dash_mail').select('*').eq('user_id', UID).order('mail_date', { ascending: false }).order('sort', { ascending: true }).limit(3);
    if (!ml.error && ml.data.length) {
      html += '<div class="today-sec"><h2>邮箱</h2>' +
        ml.data.map(function (x) {
          return '<div style="margin-top:8px;"><b>' + esc(x.subject) + '</b>' +
            (x.summary ? '<div class="meta">' + esc(x.summary) + '</div>' : '') + '</div>';
        }).join('') +
        '<div style="margin-top:10px;"><a href="javascript:void(0)" onclick="switchTab(\'tab-mail\')" style="color:var(--gold);font-size:13px;text-decoration:none;">查看全部 →</a></div></div>';
    }
    box.innerHTML = html;
    box.querySelectorAll('[data-todo-toggle]').forEach(function (c) {
      c.addEventListener('change', function () { toggleTodo(c.dataset.todoToggle, true); });
    });
  } catch (e) { box.innerHTML = '<div class="empty">加载失败：' + esc(e.message) + '</div>'; }
}

/* ---------- 行程 ---------- */
async function loadTrips() {
  var box = document.getElementById('trips-list');
  box.innerHTML = loadingHTML();
  try {
    var r = await sb.from('dash_trips').select('*').eq('user_id', UID).order('start_date', { ascending: true });
    if (r.error) throw r.error;
    var rows = r.data || [], t = todayStr();
    box.innerHTML = rows.length ? rows.map(function (x) {
      var d = daysUntil(x.start_date);
      var cd = d === null ? '' : (d > 0 ? '<div class="countdown">' + d + ' <small>天后</small></div>' : (d === 0 ? '<div class="countdown">今天出发</div>' : '<div class="meta">进行中</div>'));
      var notesHtml = x.notes ? '<div class="trip-detail" hidden>' + esc(x.notes).replace(/\n/g, '<br>') + '</div>' : '';
      var toggleBtn = x.notes ? '<button class="mini-btn trip-toggle">展开详情</button>' : '';
      return '<div class="card trip-card"><h3>' + esc(x.title) + '</h3>' + cd +
        '<div class="meta">' + esc(fmtDate(x.start_date)) + ' → ' + esc(fmtDate(x.end_date)) + '</div>' +
        notesHtml + '<div style="margin-top:8px;">' + toggleBtn +
        (x.link_url ? ' <a class="link-btn" href="' + esc(x.link_url) + '" target="_blank" rel="noopener">' + esc(x.link_label || '打开') + '</a>' : '') + '</div></div>';
    }).join('') : '<div class="empty">还没有行程。</div>';
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
document.getElementById('trips-refresh').addEventListener('click', loadTrips);

/* ---------- 待办 ---------- */
async function loadTodos() {
  var box = document.getElementById('todos-list');
  box.innerHTML = loadingHTML();
  try {
    var r = await sb.from('dash_todos').select('*').eq('user_id', UID).order('done', { ascending: true }).order('due_date', { ascending: true, nullsFirst: false });
    if (r.error) throw r.error;
    var rows = r.data || [], t = todayStr();
    box.innerHTML = rows.length ? rows.map(function (x) {
      var over = !x.done && x.due_date && x.due_date < t;
      return '<div class="todo-row' + (x.done ? ' done' : '') + '">' +
        '<input type="checkbox" data-todo-toggle="' + esc(x.id) + '"' + (x.done ? ' checked' : '') + '>' +
        '<div class="grow"><div class="t-title">' + esc(x.title) + '</div>' +
        (x.due_date ? '<span class="tag' + (over ? ' overdue' : '') + '">' + (over ? '已逾期 · ' : '') + esc(fmtDate(x.due_date)) + '</span>' : '') + '</div>' +
        '<button class="mini-btn" data-todo-del="' + esc(x.id) + '">删除</button></div>';
    }).join('') : '<div class="empty">没有待办，加一条吧。</div>';
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
    // 最新体重放前面展示
    var w = rows.filter(function (x) { return x.kind === 'weight'; })[0];
    var html = w ? '<div class="today-sec"><h2>最近体重</h2><div><b>' + esc(w.value_text) + '</b> <span class="meta">' + esc(fmtDate(w.log_date)) + '</span></div></div>' : '';
    html += rows.length ? rows.map(function (x) {
      return '<div class="health-row"><div class="grow"><div class="t-title">' + esc(x.value_text || '') + '</div>' +
        '<span class="tag">' + esc(KIND_LABEL[x.kind] || x.kind) + '</span>' +
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
          return '<div class="card news-item"><h3>' + esc(x.title) + '</h3>' +
            (x.summary ? '<p>' + esc(x.summary) + '</p>' : '') +
            (x.source ? '<div class="meta">来源：' + esc(x.source) + '</div>' : '') + '</div>';
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
    if (!rows.length) { box.innerHTML = '<div class="empty">还没有邮件摘要。每天自动扫描后显示在这里。</div>'; return; }
    var byDate = {}, order = [];
    rows.forEach(function (x) {
      if (!byDate[x.mail_date]) { byDate[x.mail_date] = []; order.push(x.mail_date); }
      byDate[x.mail_date].push(x);
    });
    box.innerHTML = order.map(function (dt) {
      return '<div class="news-date">' + esc(fmtDate(dt)) + '</div>' +
        byDate[dt].map(function (x) {
          return '<div class="card mail-row"><div class="grow">' +
            '<div class="mail-subject">' + esc(x.subject) + '</div>' +
            (x.sender ? '<div class="mail-meta">来自：' + esc(x.sender) + '</div>' : '') +
            (x.summary ? '<p>' + esc(x.summary) + '</p>' : '') + '</div></div>';
        }).join('');
    }).join('');
  } catch (e) { box.innerHTML = '<div class="empty">加载失败：' + esc(e.message) + '</div>'; }
}
document.getElementById('mail-refresh').addEventListener('click', loadMail);

/* ---------- 启动 ---------- */
checkSession();
