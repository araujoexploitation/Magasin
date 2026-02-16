<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<title>Store Master Cloud v25</title>

<script type="module">
  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
  import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

  // --- CONFIGURATION FIREBASE (À REMPLIR) ---
  const firebaseConfig = {
    apiKey: "VOTRE_API_KEY",
    authDomain: "VOTRE_PROJET.firebaseapp.com",
    projectId: "VOTRE_PROJET_ID",
    storageBucket: "VOTRE_PROJET.appspot.com",
    messagingSenderId: "VOTRE_SENDER_ID",
    appId: "VOTRE_APP_ID"
  };

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const docRef = doc(db, "magasin", "data_globale");

  // Initialisation DB locale
  window.db_local = {
    frais: [], reception: [], pvp: [], salad: [], trace: [], temp_log: [],
    checklist_answers: {}, cleaning_log: {},
    cleaning: [
        {id:1, name:"Cuisine", tasks:[{n:"Sol", days:[0,1,2,3,4,5,6], freq:1}]},
        {id:2, name:"Magasin", tasks:[{n:"Tapis Caisse", days:[0,1,2,3,4,5,6], freq:1}]}
    ],
    config: {
        trace: ["Croissants", "Pains"], suppliers: ["Scapalsace"],
        frigos: ["Mural", "Réserve"], pvp: ["Baguette"], salad: ["Tomates"],
        questions: ["Rideau fermé ?"]
    }
  };

  // Sauvegarde Cloud
  window.saveToCloud = async () => {
    await setDoc(docRef, window.db_local);
  };

  // Synchro Temps Réel
  onSnapshot(docRef, (snap) => {
    if (snap.exists()) {
      window.db_local = snap.data();
      refreshUI();
    }
  });
</script>

<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
<style>
  :root { --bg:#f1f5f9; --blue:#2563eb; --red:#ef4444; --green:#10b981; --radius:16px; }
  body { margin:0; background:#cbd5e1; font-family: system-ui; display:flex; justify-content:center; }
  #app-container { width:100%; max-width:600px; background:var(--bg); min-height:100vh; position:relative; padding-bottom:100px; }
  header { padding:15px; background:white; display:flex; justify-content:space-between; align-items:center; position:sticky; top:0; z-index:100; border-bottom:1px solid #ddd; }
  .grid-menu { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; padding: 16px; }
  .module-card { background: white; border-radius: 20px; padding: 20px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.05); cursor: pointer; }
  .module-card i { font-size:30px; margin-bottom:10px; color:var(--blue); }
  .card { background:white; padding:20px; border-radius:var(--radius); margin:15px; box-shadow:0 2px 5px rgba(0,0,0,0.1); position:relative; }
  .hidden { display:none !important; }
  .btn-main { width:100%; padding:15px; border-radius:12px; border:none; background:var(--blue); color:white; font-weight:bold; cursor:pointer; }
  .list-row { display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #eee; }
  .item-img { width:50px; height:50px; border-radius:8px; object-fit:cover; margin-right:10px; background:#eee; }
  .body-admin .adm-tools { display:inline-flex !important; }
  .adm-tools { display:none; gap:5px; }
  nav { position:fixed; bottom:0; width:100%; max-width:600px; background:white; display:flex; padding:10px 0; border-top:1px solid #ddd; }
  .nav-item { flex:1; text-align:center; font-size:12px; color:gray; cursor:pointer; }
  .nav-item.active { color:var(--blue); }
  input, select { width:100%; padding:12px; margin:8px 0; border-radius:10px; border:1px solid #ddd; font-size:16px; }
  
  /* Checklist Buttons */
  .chk-actions { display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:5px; }
  .chk-btn { padding:10px; border-radius:8px; text-align:center; background:#eee; cursor:pointer; font-weight:bold; color:#666; }
  .chk-btn.active-yes { background:var(--green); color:white; }
  .chk-btn.active-no { background:var(--red); color:white; }

  /* Progress Bar */
  .progress-wrap { background:#e2e8f0; border-radius:10px; height:10px; overflow:hidden; margin:10px 0; }
  .progress-bar { height:100%; background:var(--green); width:0%; transition:0.3s; }
</style>
</head>

<body>
<div id="app-container">
  <header>
    <div style="font-weight:900; color:var(--blue)">CARREFOUR EXPRESS <span style="font-size:10px; color:gray">CLOUD</span></div>
    <button id="lock-btn" onclick="toggleAdmin()" style="border:none; background:#f1f5f9; padding:10px; border-radius:8px"><i class="fas fa-lock"></i></button>
  </header>

  <div id="scr-home" class="screen">
    <div style="display:flex; gap:10px; padding:15px">
        <div style="flex:1; background:white; padding:20px; border-radius:16px; text-align:center">
          <b id="kpi-alert" style="color:var(--red); font-size:24px">0</b><br><small>Urgents</small>
        </div>
        <div style="flex:1; background:white; padding:20px; border-radius:16px; text-align:center">
          <b id="kpi-clean" style="color:var(--green); font-size:24px">0%</b><br><small>Ménage</small>
        </div>
    </div>
    <div class="grid-menu">
      <div class="module-card" onclick="openModule('trace')"><i class="fas fa-box-open"></i><h4>Traçabilité</h4></div>
      <div class="module-card" onclick="openModule('frais')"><i class="fas fa-barcode"></i><h4>DLC / Frais</h4></div>
      <div class="module-card" onclick="openModule('reception')"><i class="fas fa-truck"></i><h4>Réception</h4></div>
      <div class="module-card" onclick="openModule('checklist')"><i class="fas fa-check-double"></i><h4>Checklist</h4></div>
      <div class="module-card" onclick="openModule('clean')"><i class="fas fa-pump-soap"></i><h4>Nettoyage</h4></div>
      <div class="module-card" onclick="openModule('pvp')"><i class="fas fa-bread-slice"></i><h4>PVP</h4></div>
      <div class="module-card" onclick="openModule('salad')"><i class="fas fa-leaf"></i><h4>Salade</h4></div>
      <div class="module-card" onclick="openModule('temp')"><i class="fas fa-temperature-low"></i><h4>Frigos</h4></div>
    </div>
  </div>

  <div id="scr-modules" class="screen hidden">
    <div onclick="go('home')" style="padding:15px; color:var(--blue); font-weight:bold; cursor:pointer"><i class="fas fa-arrow-left"></i> RETOUR</div>
    
    <div id="mod-trace" class="hidden">
      <div class="card">
        <h3>Traçabilité (Cartons)</h3>
        <select id="trace-name"></select>
        <input type="file" id="trace-img" accept="image/*" capture="environment">
        <button class="btn-main" onclick="addTrace()">Ouvrir Carton</button>
      </div>
      <div class="card"><h4>Ouverts</h4><div id="list-trace"></div></div>
    </div>

    <div id="mod-clean" class="hidden">
      <div class="card">
        <h3>Ménage du Jour</h3>
        <div class="progress-wrap"><div class="progress-bar" id="clean-bar"></div></div>
        <div id="list-clean"></div>
      </div>
    </div>

    <div id="mod-checklist" class="hidden">
      <div class="card">
        <h3>Contrôles Quotidiens</h3>
        <div id="list-checklist"></div>
      </div>
    </div>

    <div id="mod-pvp" class="hidden">
      <div class="card">
        <h3>PVP Boulangerie</h3>
        <select id="pvp-name"></select>
        <input type="file" id="pvp-img" accept="image/*" capture="environment">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px">
          <button class="btn-main" onclick="addTimed('pvp', 24)">24H</button>
          <button class="btn-main" onclick="addTimed('pvp', 48)">48H</button>
        </div>
      </div>
      <div class="card"><h4>En cours</h4><div id="list-pvp"></div></div>
    </div>
  </div>

  <nav>
    <div class="nav-item active" onclick="go('home')"><i class="fas fa-home"></i><br>Bord</div>
    <div class="nav-item" onclick="openModule('clean')"><i class="fas fa-broom"></i><br>Nettoyage</div>
    <div class="nav-item" onclick="toggleAdmin()"><i class="fas fa-user-shield"></i><br>Admin</div>
  </nav>
</div>

<script>
  let isAdmin = false;

  function toggleAdmin() {
    let c = isAdmin ? null : prompt("Code 2008 ?");
    if(isAdmin || c==="2008") {
      isAdmin = !isAdmin;
      document.body.classList.toggle('body-admin', isAdmin);
      refreshUI();
    }
  }

  function go(scr) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('scr-'+scr).classList.remove('hidden');
  }

  function openModule(mod) {
    go('modules');
    document.querySelectorAll('#scr-modules > div').forEach(d => d.classList.add('hidden'));
    document.getElementById('mod-'+mod).classList.remove('hidden');
    refreshUI();
  }

  // --- LOGIQUE METIER ---
  async function addTimed(type, hours) {
    let name = document.getElementById(type+'-name').value;
    let imgInput = document.getElementById(type+'-img');
    let img = "";
    if(imgInput.files[0]) {
      const reader = new FileReader(); reader.readAsDataURL(imgInput.files[0]);
      await new Promise(r => reader.onload = r); img = reader.result;
    }
    let now = new Date();
    let exp = new Date(); exp.setHours(exp.getHours() + hours);
    window.db_local[type].push({ id:Date.now(), name, start:now.toISOString(), exp:exp.toISOString(), img });
    window.saveToCloud();
  }

  async function addTrace() {
    let name = document.getElementById('trace-name').value;
    let imgInput = document.getElementById('trace-img');
    if(!imgInput.files[0]) return alert("Photo obligatoire !");
    const reader = new FileReader(); reader.readAsDataURL(imgInput.files[0]);
    await new Promise(r => reader.onload = r);
    window.db_local.trace.push({ id:Date.now(), name, start:new Date().toISOString(), end:null, img:reader.result });
    window.saveToCloud();
  }

  function toggleClean(zid, tname, slot) {
    let date = new Date().toISOString().split('T')[0];
    let key = `${date}_${zid}_${tname}_${slot}`;
    if(window.db_local.cleaning_log[key]) delete window.db_local.cleaning_log[key];
    else window.db_local.cleaning_log[key] = true;
    window.saveToCloud();
  }

  function setCheck(q, val) {
    let date = new Date().toISOString().split('T')[0];
    if(!window.db_local.checklist_answers[date]) window.db_local.checklist_answers[date] = {};
    window.db_local.checklist_answers[date][q] = val;
    window.saveToCloud();
  }

  function refreshUI() {
    if(!window.db_local) return;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const dayIdx = now.getDay();

    // PVP List
    document.getElementById('pvp-name').innerHTML = window.db_local.config.pvp.map(p => `<option>${p}</option>`).join('');
    document.getElementById('list-pvp').innerHTML = window.db_local.pvp.filter(i => new Date(i.exp) > now).map(i => `
      <div class="list-row">
        <img src="${i.img}" class="item-img">
        <div><b>${i.name}</b><br><small>Fin: ${new Date(i.exp).toLocaleTimeString()}</small></div>
        <button onclick="delItem('pvp', ${i.id})" style="border:none;color:red">X</button>
      </div>
    `).join('');

    // Cleaning List
    let totalC = 0, doneC = 0;
    document.getElementById('list-clean').innerHTML = window.db_local.cleaning.map(z => {
      let tasks = z.tasks.filter(t => t.days.includes(dayIdx)).map(t => {
        let slots = "";
        for(let i=0; i<t.freq; i++) {
          let ok = window.db_local.cleaning_log[`${todayStr}_${z.id}_${t.n}_${i}`];
          totalC++; if(ok) doneC++;
          slots += `<span onclick="toggleClean(${z.id},'${t.n}',${i})" style="padding:5px 10px; margin:2px; border:1px solid #ddd; border-radius:5px; background:${ok?'#dcfce7':'white'}">${i+1}</span>`;
        }
        return `<div style="padding:10px 0; border-bottom:1px solid #eee"><b>${t.n}</b><br>${slots}</div>`;
      }).join('');
      return `<div style="margin-top:10px; border-top:2px solid #eee"><b>${z.name}</b>${tasks}</div>`;
    }).join('');
    let pct = totalC===0?100:Math.round((doneC/totalC)*100);
    document.getElementById('clean-bar').style.width = pct+"%";
    document.getElementById('kpi-clean').innerText = pct+"%";

    // Checklist
    const answers = window.db_local.checklist_answers[todayStr] || {};
    document.getElementById('list-checklist').innerHTML = window.db_local.config.questions.map(q => {
      let v = answers[q];
      return `<div class="list-row">
        <span>${q}</span>
        <div class="chk-actions">
          <div class="chk-btn ${v==='yes'?'active-yes':''}" onclick="setCheck('${q}','yes')">OUI</div>
          <div class="chk-btn ${v==='no'?'active-no':''}" onclick="setCheck('${q}','no')">NON</div>
        </div>
      </div>`;
    }).join('');

    // Trace
    document.getElementById('trace-name').innerHTML = window.db_local.config.trace.map(t => `<option>${t}</option>`).join('');
    document.getElementById('list-trace').innerHTML = window.db_local.trace.filter(i => !i.end).map(i => `
      <div class="list-row">
        <img src="${i.img}" class="item-img">
        <div><b>${i.name}</b><br><small>Ouvert: ${new Date(i.start).toLocaleDateString()}</small></div>
        <button onclick="closeTrace(${i.id})" style="background:red; color:white; border:none; padding:5px; border-radius:5px">Fin</button>
      </div>
    `).join('');
  }

  function delItem(type, id) { window.db_local[type] = window.db_local[type].filter(i => i.id !== id); window.saveToCloud(); }
  function closeTrace(id) { window.db_local.trace.find(i=>i.id===id).end = new Date().toISOString(); window.saveToCloud(); }
</script>
</body>
</html>
