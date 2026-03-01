import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,doc,setDoc,getDoc,collection,addDoc,getDocs,deleteDoc,
  query,where,orderBy,limit,doc as fDoc,onSnapshot,serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut,
  sendPasswordResetEmail,createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getStorage,ref as sRef,uploadString,getDownloadURL,deleteObject
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const FB={
  apiKey:"AIzaSyA0ffa4Nfa7kGLyaEcAocU9YzIhzmx3SkA",
  authDomain:"araujo-exploitation.firebaseapp.com",
  projectId:"araujo-exploitation",
  storageBucket:"araujo-exploitation.firebasestorage.app",
  messagingSenderId:"292878114487",
  appId:"1:292878114487:web:2a450227310e970ce1b732"
};
const appFb=initializeApp(FB);
const db=getFirestore(appFb);
const auth=getAuth(appFb);
const storage=getStorage(appFb);
const sec=initializeApp(FB,"Secondary");
const secAuth=getAuth(sec);

const docUsers=doc(db,"store_master","DATA_USERS");
const docFrais=doc(db,"store_master","DATA_FRAIS");
const docPVP  =doc(db,"store_master","DATA_PVP");
const docSalad=doc(db,"store_master","DATA_SALAD");
const docFrigo=doc(db,"store_master","DATA_FRIGO");
const docTodo =doc(db,"store_master","DATA_TODO");
const colTodoLogs=collection(db,"todo_logs");
// Expose for chat module
window._db=db;
window._fbChat={collection,query,orderBy,limit,onSnapshot,addDoc,serverTimestamp,where,getDocs,deleteDoc,doc,setDoc,getDoc};
const colReception=collection(db,"reception_logs");
const TRACE_PREFIX={salad:"salad_traca",pvp:"pvp_traca"};
const colTraceFor=(mod,pid)=>collection(db,TRACE_PREFIX[mod],String(pid),"items");
// ── APP VERSION & CHANGELOG ──
const APP_VERSION="2.1.0";
const APP_LAST_UPDATE="01/06/2025 à 14h30";
const APP_CHANGELOG=[
  {v:"2.1.0",date:"01/06/2025",items:["Reset besoins PVP à 23h automatique","Fix erreur sauvegarde Salad Bar","DLC du jour en rouge en tête de liste","Badge nombre de DLC sur DLC Frais","Étiquette DLC dans DLC Frais","Too Good To Go regroupé dans DLC Frais","Écran connexion : version + date MAJ + changelog","Tri amélioré par famille + date DLC"]},
  {v:"2.0.0",date:"15/05/2025",items:["Module Salad Bar complet","Module Planning avec gestion des équipes","Portail Too Good To Go","Compteur de températures frigo","Export CSV inspection + traçabilités"]},
  {v:"1.5.0",date:"20/04/2025",items:["Gestion des DLC frais avec scan code-barres","Besoins PVP avec objectifs par jour","Module chat interne par canal","Gestion des rôles et permissions"]},
  {v:"1.0.0",date:"01/03/2025",items:["Lancement de l'app Araujo Exploitation","Connexion Firebase sécurisée","Navigation multi-modules","Gestion équipe basique"]}
];
const codeReader=new ZXing.BrowserMultiFormatReader();

// ── ZONE COLOR PALETTE ──
const ZONE_COLORS=[
  "#7c3aed","#1d4ed8","#0891b2","#15803d",
  "#d97706","#dc2626","#db2777","#475569"
];

// ── FRENCH DAY LABELS (getDay() = 0=Sun) ──
const DAY_LABELS=["D","L","M","M","J","V","S"];
const DAY_FULL  =["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];

// ── DATE UTILITIES ──
const todayStr=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const tsToInput=ts=>{const d=new Date(ts),l=new Date(d.getTime()-d.getTimezoneOffset()*60000);return l.toISOString().slice(0,16);};
const inputToTs=v=>{if(!v)return Date.now();const t=new Date(v).getTime();return isNaN(t)?Date.now():t;};
const formatDate=ts=>{const d=new Date(ts);if(isNaN(d.getTime()))return "--/--";return `${d.getDate()}/${d.getMonth()+1} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;};
const dayBounds=ts=>{const d=new Date(ts||Date.now()),s=new Date(d.getFullYear(),d.getMonth(),d.getDate(),0,0,0,0).getTime(),e=new Date(d.getFullYear(),d.getMonth(),d.getDate(),23,59,59,999).getTime();return{start:s,end:e};};

// ── TOAST / UI HELPERS ──
const toast=(msg,type='info',dur=3200)=>{
  const icons={ok:'circle-check',err:'circle-xmark',warn:'triangle-exclamation',info:'circle-info'};
  const el=document.createElement('div');
  el.className=`toast ${type}`;
  el.innerHTML=`<i class="fas fa-${icons[type]||'circle-info'}"></i><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(()=>{el.classList.add('toast-out');setTimeout(()=>el.remove(),220);},dur);
};
const spin=s=>document.getElementById('spinner-overlay').classList.toggle('hidden',!s);
const dlgConfirm=(title,msg,danger=true)=>new Promise(r=>{
  const m=document.getElementById('modal-confirm');
  const ok=document.getElementById('dlg-ok');
  const can=document.getElementById('dlg-cancel');
  document.getElementById('dlg-title').textContent=title;
  document.getElementById('dlg-msg').textContent=msg;
  ok.className=`btn ${danger?'danger':'success'}`;ok.style.margin='0';
  m.classList.remove('hidden');
  const done=v=>{m.classList.add('hidden');ok.onclick=null;can.onclick=null;r(v);};
  ok.onclick=()=>done(true);can.onclick=()=>done(false);
});
const dlgPrompt=(title,def='',type='text')=>new Promise(r=>{
  const m=document.getElementById('modal-prompt');
  const inp=document.getElementById('pmt-input');
  const ok=document.getElementById('pmt-ok');
  const can=document.getElementById('pmt-cancel');
  document.getElementById('pmt-title').textContent=title;
  inp.type=type;inp.value=def||'';
  m.classList.remove('hidden');
  setTimeout(()=>inp.focus(),120);
  const done=v=>{m.classList.add('hidden');ok.onclick=null;can.onclick=null;inp.onkeydown=null;r(v);};
  ok.onclick=()=>done(inp.value);
  can.onclick=()=>done(null);
  inp.onkeydown=e=>{if(e.key==='Enter')done(inp.value);if(e.key==='Escape')done(null);};
});

// ── SALAD DEFAULTS ──
const SALAD_DEF=[
  {family:"SALADE",name:"Batavia",hours:48},{family:"SALADE",name:"Mâche",hours:48},{family:"SALADE",name:"Melange Gourmand",hours:48},{family:"SALADE",name:"Iceberg",hours:48},
  {family:"BASE",name:"Penne au basilic",hours:48},{family:"BASE",name:"Garganelli et graines de lin",hours:48},{family:"BASE",name:"Quinoa Boulgour,Tomates mi-séches,feves de soja",hours:48},{family:"BASE",name:"Boulgour et lentilles",hours:48},{family:"BASE",name:"Farfalles au pesto",hours:48},
  {family:"LEGUMES ET FRUITS",name:"Tomates cerise marinées",hours:48},{family:"LEGUMES ET FRUITS",name:"Légumes Grillées",hours:48},{family:"LEGUMES ET FRUITS",name:"Duo de carrotes",hours:48},{family:"LEGUMES ET FRUITS",name:"Betrave",hours:48},{family:"LEGUMES ET FRUITS",name:"Pois Chiches",hours:48},{family:"LEGUMES ET FRUITS",name:"Avocat",hours:24},
  {family:"PROTEINE",name:"Œufs durs",hours:48},{family:"PROTEINE",name:"Poulet émincé",hours:48},{family:"PROTEINE",name:"Jambon Cuit",hours:48},{family:"PROTEINE",name:"Thon",hours:48},
  {family:"FROMAGES",name:"Billes mozzarella",hours:48},{family:"FROMAGES",name:"Emmental",hours:48},
  {family:"FECULENTS",name:"Boulgour",hours:48},{family:"FECULENTS",name:"Riz sauvage",hours:48},
  {family:"TOPPING",name:"Crumble Salé",hours:168},{family:"TOPPING",name:"Sauce Balsamique",hours:1920},{family:"TOPPING",name:"Sauce Caesar",hours:1920}
].map(x=>({...x,id:null}));

window.app={
  me:null,
  data:{
    frais:[],users:[],pvpLib:[],pvpStock:[],checkedNeeds:[],
    saladLib:[],saladStock:[],
    frigo:{perDay:2,fridges:[],logs:[]},
    todo:{zones:[],tasks:[]},
    todoLogs:[], // today's completions
    reception:[] // reception logs in memory (last 30 days)
  },
  viewHistory:[],closed:new Set(),debounceTimer:null,saveTimers:{},

  // ── TOASTS / HELPERS ──
  ok:m=>toast(m,'ok'),err:m=>toast(m,'err',5000),warn:m=>toast(m,'warn'),info:m=>toast(m,'info'),

  // ── OFFLINE ──
  initOffline(){
    const b=document.getElementById('offline-banner');
    window.addEventListener('offline',()=>b.classList.add('show'));
    window.addEventListener('online', ()=>b.classList.remove('show'));
    if(!navigator.onLine)b.classList.add('show');
  },

  // ── AUTH ──
  auth:{
    login:async function(){
      const e=(document.getElementById('login-email').value||'').trim();
      const p=(document.getElementById('login-pass').value||'').trim();
      const box=document.getElementById('login-error');
      box.style.display='none';
      if(!e||!p){box.style.display='block';box.textContent='Email et mot de passe requis.';return;}
      const btn=document.getElementById('login-btn');
      btn.disabled=true;btn.innerHTML='<i class="fas fa-spinner fa-spin"></i>';
      try{await signInWithEmailAndPassword(auth,e,p);document.getElementById('login-pass').value='';}
      catch(err){box.style.display='block';box.textContent='Connexion refusée. Vérifie l\'email / mot de passe.';}
      finally{btn.disabled=false;btn.innerHTML='<i class="fas fa-right-to-bracket"></i> CONNEXION';}
    },
    forgot:async function(){
      const e=(document.getElementById('login-email').value||'').trim();
      const box=document.getElementById('login-error');
      if(!e){box.style.display='block';box.textContent='Tape ton email puis clique "Mot de passe oublié".';return;}
      try{await sendPasswordResetEmail(auth,e);toast('Email de réinitialisation envoyé.','ok');}
      catch(err){box.style.display='block';box.textContent='Impossible d\'envoyer le reset.';}
    },
    logout:async function(){
      if(window.app._todoUnsubscribe){try{window.app._todoUnsubscribe();}catch(e){}}
      try{await signOut(auth);}catch(e){}
    }
  },

  saveDebounced(sec,delay=350){
    if(this.saveTimers[sec])clearTimeout(this.saveTimers[sec]);
    this.saveTimers[sec]=setTimeout(async()=>{try{await this.save(sec);}catch(e){}},delay);
  },

  loadAll:async function(){
    const[uS,fS,pS,sS,frS,tdS]=await Promise.all([
      getDoc(docUsers),getDoc(docFrais),getDoc(docPVP),getDoc(docSalad),getDoc(docFrigo),getDoc(docTodo)
    ]);
    this.data.users=uS.exists()?(uS.data().list||[]):[];
    this.data.frais=fS.exists()?(fS.data().list||[]):[];
    if(pS.exists()){const d=pS.data();this.data.pvpLib=d.lib||[];this.data.pvpStock=d.stock||[];this.data.checkedNeeds=d.needs||[];}
    else{this.data.pvpLib=[];this.data.pvpStock=[];this.data.checkedNeeds=[];}
    if(sS.exists()){const d=sS.data();this.data.saladLib=d.lib||[];this.data.saladStock=d.stock||[];}
    else{this.data.saladLib=[];this.data.saladStock=[];}
    if(frS.exists()){const d=frS.data()||{};this.data.frigo.perDay=Number(d.perDay||2);this.data.frigo.fridges=d.fridges||[];this.data.frigo.logs=d.logs||[];}
    else{this.data.frigo={perDay:2,fridges:[],logs:[]};}
    if(tdS.exists()){const d=tdS.data()||{};this.data.todo.zones=d.zones||[];this.data.todo.tasks=d.tasks||[];}
    else{this.data.todo={zones:[],tasks:[]};}
  },

  _todoUnsubscribe:null,

  // ── PVP BESOINS: auto-reset à minuit ──
  _startPvpMidnightReset(){
    if(this._pvpResetTimer)clearTimeout(this._pvpResetTimer);
    const now=new Date();
    const reset23h=new Date(now.getFullYear(),now.getMonth(),now.getDate(),23,0,5);
if(reset23h<=now) reset23h.setDate(reset23h.getDate()+1);
const msToReset=(reset23h-now);
    this._pvpResetTimer=setTimeout(async ()=>{
      if(this.data.checkedNeeds?.length){
        this.data.checkedNeeds=[];
        try{await this.save('pvp');}catch(e){}
        const el=document.getElementById('pvp-calc');if(el&&!el.classList.contains('hidden'))this.pvp.render?.();
        toast('✅ Besoins PVP réinitialisés (minuit)','info',4000);
      }
      this._startPvpMidnightReset();
    },msToMidnight);
  },

  _startTodoSync(){
    if(this._todoUnsubscribe){try{this._todoUnsubscribe();}catch(e){}}
    const today=todayStr();
    try{
      const q=query(colTodoLogs,where("date","==",today));
      this._todoUnsubscribe=onSnapshot(q,snap=>{
        this.data.todoLogs=[];
        snap.forEach(d=>this.data.todoLogs.push({_id:d.id,...d.data()}));
        this.todo.renderToday();
        this.updateHomeBadges();
      },err=>{/* silently ignore permission errors */});
    }catch(e){}
  },

  loadReceptionLogs:async function(){
    try{
      const cutoff=new Date();cutoff.setDate(cutoff.getDate()-30);
      const cutTs=cutoff.getTime();
      const q=query(colReception,where("ts",">=",cutTs),orderBy("ts","desc"),limit(200));
      const snap=await getDocs(q);
      this.data.reception=[];
      snap.forEach(d=>this.data.reception.push({_id:d.id,...d.data()}));
    }catch(e){this.data.reception=[];}
  },

  loadTodoLogs:async function(){
    // Load today's completions
    const today=todayStr();
    try{
      const q=query(colTodoLogs,where("date","==",today));
      const snap=await getDocs(q);
      this.data.todoLogs=[];
      snap.forEach(d=>this.data.todoLogs.push({_id:d.id,...d.data()}));
    }catch(e){this.data.todoLogs=[];}
  },

  save:async function(sec){
    if(!auth.currentUser)throw new Error("Not logged");
    if(sec==='users')await setDoc(docUsers,{list:this.data.users});
    if(sec==='frais')await setDoc(docFrais,{list:this.data.frais});
    if(sec==='pvp')  await setDoc(docPVP,  {lib:this.data.pvpLib,stock:this.data.pvpStock,needs:this.data.checkedNeeds});
    if(sec==='salad')await setDoc(docSalad,{lib:this.data.saladLib,stock:this.data.saladStock});
    if(sec==='frigo')await setDoc(docFrigo,{perDay:Number(this.data.frigo.perDay||2),fridges:this.data.frigo.fridges||[],logs:this.data.frigo.logs||[]});
    if(sec==='todo') await setDoc(docTodo, {zones:this.data.todo.zones||[],tasks:this.data.todo.tasks||[]});
  },

  afterLoginBootstrap:async function(){
    spin(true);
    try{
      await this.loadAll();
      if(!this.data.users.length){
        const email=auth.currentUser.email||"";
        const name=(email.split("@")[0]||"ADMIN").toUpperCase();
        this.data.users=[{uid:auth.currentUser.uid,email,name,role:"admin"}];
        await this.save("users");
      }
      if(!this.data.saladLib.length){
        this.data.saladLib=SALAD_DEF.map(x=>({id:Date.now()+Math.floor(Math.random()*1000000),family:x.family,name:x.name,hours:x.hours}));
        await this.save("salad");
      }
      this.me=this.data.users.find(u=>u.uid===auth.currentUser.uid)||null;
      if(!this.me){toast('Compte non autorisé.','err');await signOut(auth);return;}

      // Check conseiller expiry
      if(this.me.role==='conseiller'&&this.me.conseillerExpiry){
        if(Date.now()>this.me.conseillerExpiry){
          toast('Votre accès conseiller a expiré. Contactez l\'administrateur.','err',8000);
          await signOut(auth);return;
        }
      }

      // Load channels config from Firestore
      try{
        const chDoc=await getDoc(doc(db,'store_master','CHANNELS'));
        if(chDoc.exists()){
          const saved=chDoc.data().list||[];
          saved.forEach(sc=>{const ch=this.chat._channels.find(c=>c.id===sc.id);if(ch){ch.name=sc.name;if(sc.allowedUsers!==undefined)ch.allowedUsers=sc.allowedUsers;}});
        }
      }catch(e){}

      await this.loadTodoLogs();
      await this.loadReceptionLogs();

      // Start real-time sync for today's todo logs
      this._startTodoSync();
      this._startPvpMidnightReset();

      document.getElementById('login-overlay').classList.add('hidden');
      document.getElementById('app-header').classList.remove('hidden');
      document.getElementById('app-nav').classList.remove('hidden');
      document.getElementById('user-badge').innerText=this.me.name||(this.me.email||"USER");
      const isAdmin=this.me.role==='admin';
      const isConseiller=this.me.role==='conseiller';
      if(isAdmin)document.getElementById('btn-team').classList.remove('hidden');
      else document.getElementById('btn-team').classList.add('hidden');
      // Bouton flottant paramètres
      const floatSettings=document.getElementById('float-settings-btn');
      if(floatSettings)floatSettings.style.display=isAdmin?'flex':'none';
      // Bannière bleue lecture seule pour conseiller
      const cb=document.getElementById('conseiller-banner');
      if(cb)cb.classList.toggle('show',isConseiller);
      // Masquer le bouton de réorganisation si pas admin
      const reorgBtn=document.getElementById('home-reorder-btn');
      if(reorgBtn)reorgBtn.style.display=isAdmin?'flex':'none';

      // Show/hide create buttons based on permissions
      const pvpCreateBtn=document.getElementById('pvp-create-btn');
      if(pvpCreateBtn)pvpCreateBtn.style.display=this.canDo('pvpLib')?'':'none';
      const saladCreateBtn=document.getElementById('salad-create-btn');
      if(saladCreateBtn)saladCreateBtn.style.display=this.canDo('saladLib')?'':'none';

      this.updateUI();
      // Init notifications
      await this.notif.init();
      // Check DLC alerts via notification (after 3s)
      setTimeout(()=>this.notif.checkDlcAlerts(),3000);
    }finally{spin(false);}
  },

  updateUI(){
    this.frais.render();this.pvp.render();this.salad.render();
    this.frigo.render();this.todo.renderToday();
    this.team.renderUsers();this.team.renderConseilleurs();this.team.renderChannelsConfig();this.checkAlerts();this.updateHomeBadges();
  },

  updateDlcBadges(){
    // Count frais DLC today
    const today=new Date();today.setHours(0,0,0,0);
    const fraisCount=window.app.data.frais.filter(i=>{const d=new Date(i.date);return!isNaN(d.getTime())&&d<=today;}).length;
    const fb=document.getElementById('badge-frais-dlc');
    if(fb){fb.style.display=fraisCount>0?'inline-block':'none';fb.textContent=fraisCount+' à DLC';}
    // Count PVP expired today
    const pvpCount=window.app.data.pvpStock.filter(i=>new Date(i.end)<new Date()).length;
    const pb=document.getElementById('badge-pvp-dlc');
    if(pb){pb.style.display=pvpCount>0?'inline-block':'none';pb.textContent=pvpCount+' à jeter';}
  },

  updateHomeBadges(){
    // Frais
    const today=new Date();today.setHours(0,0,0,0);
    const fraisCnt=this.data.frais.filter(i=>{const d=new Date(i.date);return !isNaN(d.getTime())&&d<=today;}).length;
    const bf=document.getElementById('badge-frais');
    if(bf){bf.textContent=fraisCnt;bf.classList.toggle('hidden',fraisCnt===0);}
    const chip=document.getElementById('frais-today-chip');
    if(chip)chip.innerHTML=`<i class="fas fa-calendar-day"></i> ${fraisCnt}`;

    // Frigo
    const frigoRem=this.frigo.remainingTodayTotal();
    const bfr=document.getElementById('badge-frigo');
    if(bfr){bfr.textContent=frigoRem;bfr.classList.toggle('hidden',frigoRem===0);}
    const frigoChip=document.getElementById('frigo-remaining-chip');
    if(frigoChip)frigoChip.innerHTML=`<i class="fas fa-list-check"></i> ${frigoRem}`;
    const frigoLabel=document.getElementById('frigo-perday-label');
    if(frigoLabel)frigoLabel.textContent=this.data.frigo.perDay||2;

    // Todo
    const todayTasks=this.todo.todayTaskList();
    const doneTodayIds=new Set(this.data.todoLogs.map(l=>String(l.taskId)));
    const pending=todayTasks.filter(t=>!doneTodayIds.has(String(t.id))).length;
    const bt=document.getElementById('badge-todo');
    if(bt){bt.textContent=pending;bt.classList.toggle('hidden',pending===0);}
  },

  nav(v,saveHistory=true){
    if(this.frais&&this.frais.scanning)this.frais.toggleScan();
    if(this.frais&&this.frais.tgtgScanning)this.frais.tgtgToggleScan();
    const cur=document.querySelector('main > div:not(.hidden)');
    if(saveHistory&&cur)this.viewHistory.push(cur.id.replace('view-',''));
    document.querySelectorAll('main > div').forEach(e=>e.classList.add('hidden'));
    const el=document.getElementById('view-'+v);
    if(el)el.classList.remove('hidden');
    if(v==='dlc'){this.updateDlcBadges();this.checkAlerts();}
    if(v==='todo'){this.todo.renderToday();this.todo.tab('today');}
    if(v==='reception'){this.reception.init();this.reception.tab('new');}
    if(v==='inspection'){this.inspection.render();}
    if(v==='etiquettes'){this.etiquettes.loadProducts();}
    if(v==='planning'){this.planning.switchTab(this.planning._currentTab||'grid');}
    if(v==='chat'){this.chat.render();}
    if(v==='team'){this.team.renderConseilleurs();this.team.renderChannelsConfig();}
    if(v==='home'){this._maybeShowInstallPrompt();this.pointeuse&&this.pointeuse._renderClock&&this.pointeuse._renderClock();}
  },
  goBack(){if(this.viewHistory.length)this.nav(this.viewHistory.pop(),false);else this.nav('home',false);},
  toggleFam(id){if(this.closed.has(id))this.closed.delete(id);else this.closed.add(id);this.updateUI();},
  checkAlerts(){
    const a=this.data.frais.some(i=>{const d=new Date(i.date);return!isNaN(d.getTime())&&(d-new Date())/(1000*60*60*24)<1;});
    const box=document.getElementById('alert-box');
    if(box)box.style.display=a?'block':'none';
    // Badge rouge sur le bouton DLC de l'accueil
    const bf=document.getElementById('badge-frais');
    if(bf){const cnt=this.data.frais.filter(i=>{const d=new Date(i.date);return!isNaN(d.getTime())&&d<=new Date();}).length;bf.textContent=cnt;bf.classList.toggle('hidden',cnt===0);}
  },

  common:{
    showBarcode(ean,name,imgUrl=null){
      document.getElementById('modal-barcode').classList.remove('hidden');
      document.getElementById('bc-name').innerText=name||"";
      const imgEl=document.getElementById('bc-img-display');
      if(imgUrl){imgEl.src=imgUrl;imgEl.style.display='block';}else{imgEl.style.display='none';}
      if(ean){try{JsBarcode("#barcode",ean,{format:"EAN13",height:80,displayValue:true});}catch(e){try{JsBarcode("#barcode",ean,{format:"CODE128",height:80,displayValue:true});}catch(e2){}}}
      else{try{document.querySelector("#barcode").innerHTML="";}catch(e){}}
    },
    parseDateLocal(dateStr){if(!dateStr)return null;const p=dateStr.split('-');return new Date(p[0],p[1]-1,p[2],12,0,0).getTime();},
    dateToInputLocal(ts){if(!ts)return"";const d=new Date(ts);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;},
    tsToInput,formatDate,inputToTs,dayBounds,
    calculateEnd(startTs,hours){
      const h=parseInt(hours||0,10);
      if(h===0){
        // JOURNÉE → fin du jour courant à 22:00
        const d=new Date(startTs);
        return new Date(d.getFullYear(),d.getMonth(),d.getDate(),22,0,0,0).getTime();
      }
      // Calcul en millisecondes pur — fiable quelle que soit la durée
      return startTs + h * 3600 * 1000;
    },
    cleanName(name){return(name||"").toUpperCase().replace(/^[\d\s\.,xX]+(G|KG|ML|CL|L|P)?\s*/g,'');},
    randPwd(len=14){const c="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";let o="";for(let i=0;i<len;i++)o+=c[Math.floor(Math.random()*c.length)];return o;},
    compressImg(file,callback){const r=new FileReader();r.readAsDataURL(file);r.onload=e=>{const img=new Image();img.src=e.target.result;img.onload=()=>{const c=document.createElement('canvas');const ctx=c.getContext('2d');const mx=600;let w=img.width,h=img.height;if(w>h){if(w>mx){h*=mx/w;w=mx;}}else{if(h>mx){w*=mx/h;h=mx;}}c.width=w;c.height=h;ctx.drawImage(img,0,0,w,h);callback(c.toDataURL('image/jpeg',0.7));};};},
    isASaisir(dlcTs){if(!dlcTs)return false;const dlc=new Date(dlcTs);if(isNaN(dlc.getTime()))return false;const thr=new Date(dlc.getFullYear(),dlc.getMonth(),dlc.getDate()-1,18,0,0,0).getTime();const eod=new Date(dlc.getFullYear(),dlc.getMonth(),dlc.getDate(),23,59,59,999).getTime();const now=Date.now();return now>=thr&&now<=eod;}
  },

  // ── PERMISSIONS ──
  // Définition de toutes les permissions disponibles
  PERMS:{
    saladLib:    {label:'Modifier bibliothèque Salad Bar', icon:'fa-leaf',           group:'DLC'},
    saladStock:  {label:'Saisir stock Salad Bar',         icon:'fa-bowl-food',       group:'DLC'},
    pvpLib:      {label:'Modifier bibliothèque PVP',      icon:'fa-store',           group:'DLC'},
    pvpStock:    {label:'Saisir stock PVP',               icon:'fa-boxes-stacked',   group:'DLC'},
    fraisEdit:   {label:'Modifier / supprimer Frais',     icon:'fa-calendar-xmark',  group:'DLC'},
    frigoConfig: {label:'Configurer les frigos',          icon:'fa-temperature-low', group:'TEMPÉRATURES'},
    frigoSaisie: {label:'Saisir relevés frigo',           icon:'fa-pen-to-square',   group:'TEMPÉRATURES'},
    todoConfig:  {label:'Configurer la check-list',       icon:'fa-list-check',      group:'CHECK-LIST'},
    todoSaisie:  {label:'Valider tâches check-list',      icon:'fa-circle-check',    group:'CHECK-LIST'},
    dynacad:     {label:'Accès Dynacad',                  icon:'fa-store',           group:'CARREFOUR'},
    meti:        {label:'Accès METI (VPN Carrefour)',     icon:'fa-laptop',          group:'CARREFOUR'},
    planning:    {label:'Accès Planning RH',              icon:'fa-calendar-days',   group:'GESTION MAGASIN'},
    mytravis:    {label:'Suivi camion MyTravis',          icon:'fa-truck',           group:'RÉCEPTION'},
  },

  // Vérifie si l'utilisateur courant peut faire une action
  // admin = tout par défaut, staff = selon permissions
  canDo(perm){
    const me=this.me;
    if(!me)return false;
    if(me.role==='admin')return true;
    if(me.role==='conseiller')return false; // lecture seule — jamais de modification
    if(me.permissions&&me.permissions[perm]===true)return true;
    return false;
  },

  // ── TEAM ──
  team:{
    ensureAdmin(){if(!window.app.me||window.app.me.role!=='admin'){toast('Accès admin requis.','err');return false;}return true;},
    createStaff:async function(){
      if(!this.ensureAdmin())return;
      const name=(document.getElementById('new-u-name').value||'').trim().toUpperCase();
      const email=(document.getElementById('new-u-email').value||'').trim().toLowerCase();
      const role=document.getElementById('new-u-role').value||'staff';
      if(!name||!email)return toast('Nom + email requis.','warn');
      if(window.app.data.users.some(u=>(u.email||'').toLowerCase()===email))return toast('Email déjà présent.','warn');
      spin(true);
      try{
        const tmp=window.app.common.randPwd();
        const cred=await createUserWithEmailAndPassword(secAuth,email,tmp);
        window.app.data.users.push({uid:cred.user.uid,email,name,role});
        await window.app.save('users');
        await sendPasswordResetEmail(secAuth,email);
        try{await signOut(secAuth);}catch(e){}
        document.getElementById('new-u-name').value='';document.getElementById('new-u-email').value='';
        toast('Compte créé + email reset envoyé.','ok');this.renderUsers();this.renderConseilleurs();this.renderChannelsConfig();
      }catch(e){
        const code=String(e?.code||'');
        if(code.includes('email-already-in-use'))toast('Email déjà utilisé.','err');
        else if(code.includes('invalid-email'))toast('Email invalide.','err');
        else toast('Erreur création compte.','err');
        try{await signOut(secAuth);}catch(err){}
      }finally{spin(false);}
    },
    resetPwd:async function(email){if(!this.ensureAdmin())return;if(!email)return;try{await sendPasswordResetEmail(auth,email);toast('Reset envoyé.','ok');}catch(e){toast('Impossible d\'envoyer le reset.','err');}},
    setRole:async function(uid,role){if(!this.ensureAdmin())return;const u=window.app.data.users.find(x=>x.uid===uid);if(!u)return;u.role=role;await window.app.save('users');this.renderUsers();},
    setName:async function(uid){if(!this.ensureAdmin())return;const u=window.app.data.users.find(x=>x.uid===uid);if(!u)return;const n=await dlgPrompt('Nom :',u.name||'');if(!n)return;u.name=n.trim().toUpperCase();await window.app.save('users');this.renderUsers();},
    renderUsers(){
      const wrap=document.getElementById('user-list');if(!wrap)return;
      const users=(window.app.data.users||[]).slice().sort((a,b)=>(a.role||'').localeCompare(b.role||'')||(a.name||'').localeCompare(b.name||''));
      if(!users.length){wrap.innerHTML=`<div class="empty-state"><i class="fas fa-users-slash"></i>Aucun utilisateur.</div>`;return;}
      wrap.innerHTML=users.map(u=>{
        const chip=u.role==='admin'?`<span class="chip admin">ADMIN</span>`:`<span class="chip staff">STAFF</span>`;
        const permsBlock=u.role==='staff'?`
          <div style="margin-top:10px;">
            <div style="font-size:11px;font-weight:950;text-transform:uppercase;color:#64748b;margin-bottom:8px;">Permissions par module</div>
            ${(() => {
              const grouped = {};
              Object.entries(window.app.PERMS).forEach(([key,def]) => {
                const g = def.group || 'AUTRES';
                if(!grouped[g]) grouped[g] = [];
                grouped[g].push({key, ...def});
              });
              return Object.entries(grouped).map(([grp, perms]) => `
                <div style="margin-bottom:10px;">
                  <div style="font-size:10px;font-weight:950;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;padding:4px 8px;background:#f8fafc;border-radius:6px;">${grp}</div>
                  <div class="perm-grid">
                    ${perms.map(({key:k,label,icon}) => `
                    <div class="perm-toggle">
                      <label for="perm-${u.uid}-${k}"><i class="fas ${icon}" style="margin-right:5px;color:#64748b;"></i>${label}</label>
                      <input type="checkbox" id="perm-${u.uid}-${k}" ${(u.permissions||{})[k]?'checked':''} onchange="app.team.togglePerm('${u.uid}','${k}',this.checked)">
                    </div>`).join('')}
                  </div>
                </div>`).join('');
            })()}
          </div>`:'<div class="small" style="margin-top:6px;color:var(--muted);">Admin : accès complet à tout.</div>';
        return `<div style="padding:12px;border-bottom:1px solid #eee;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
            <div style="min-width:0;"><div style="font-weight:950;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${u.name||"(Sans nom)"} ${chip}</div><div class="small" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${u.email||""}</div></div>
            <div style="display:flex;gap:8px;flex-shrink:0;">
              <button class="qty-btn" onclick="app.team.setName('${u.uid}')"><i class="fas fa-pen"></i></button>
              <button class="qty-btn" onclick="app.team.resetPwd('${u.email||''}')"><i class="fas fa-unlock-keyhole"></i></button>
            </div>
          </div>
          <div style="margin-top:10px;">
            <select onchange="app.team.setRole('${u.uid}',this.value)" style="margin:0;padding:10px;font-size:14px;">
              <option value="staff" ${u.role==='staff'?'selected':''}>staff</option>
              <option value="conseiller" ${u.role==='conseiller'?'selected':''}>conseiller (lecture seule)</option>
              <option value="admin" ${u.role==='admin'?'selected':''}>admin</option>
            </select>
            ${u.role==='conseiller'?`<button onclick="app.team.setConseillerExpiry('${u.uid}')" style="background:#0891b2;color:#fff;border:none;border-radius:8px;padding:8px 12px;font-weight:900;font-size:12px;cursor:pointer;margin-top:6px;width:100%;"><i class="fas fa-clock"></i> Expiration accès : ${u.conseillerExpiry?new Date(u.conseillerExpiry).toLocaleDateString('fr'):'Illimité'}</button>`:''}
          </div>
          ${permsBlock}
        </div>`;
      }).join('');
    },

    togglePerm:async function(uid,perm,val){
      if(!this.ensureAdmin())return;
      const u=window.app.data.users.find(x=>x.uid===uid);if(!u)return;
      if(!u.permissions)u.permissions={};
      u.permissions[perm]=val;
      try{await window.app.save('users');toast(val?'Permission accordée.':'Permission retirée.','ok');}
      catch(e){toast('Erreur sauvegarde.','err');}
    },

    setConseillerExpiry:async function(uid){
      if(!this.ensureAdmin())return;
      const u=window.app.data.users.find(x=>x.uid===uid);if(!u)return;
      const current=u.conseillerExpiry?new Date(u.conseillerExpiry).toISOString().slice(0,10):'';
      const v=await dlgPrompt('Date d\'expiration accès conseiller (JJ/MM/AAAA ou vide = illimité):',current,'date');
      if(v===null)return;
      if(!v){u.conseillerExpiry=null;toast('Accès illimité.','ok');}
      else{
        const d=new Date(v);if(isNaN(d.getTime()))return toast('Date invalide.','err');
        u.conseillerExpiry=d.getTime();
        toast('Expiration définie : '+d.toLocaleDateString('fr'),'ok');
      }
      try{await window.app.save('users');this.renderUsers();this.renderConseilleurs();}
      catch(e){toast('Erreur sauvegarde.','err');}
    },

    renderConseilleurs(){
      const wrap=document.getElementById('conseiller-list');if(!wrap)return;
      const conseillers=(window.app.data.users||[]).filter(u=>u.role==='conseiller');
      if(!conseillers.length){wrap.innerHTML='<div class="small" style="color:#64748b;">Aucun conseiller créé.</div>';return;}
      wrap.innerHTML=conseillers.map(u=>{
        const exp=u.conseillerExpiry?new Date(u.conseillerExpiry):'';
        const isExpired=exp&&exp<new Date();
        const expStr=exp?`<span style="color:${isExpired?'#dc2626':'#059669'};font-weight:900;">${isExpired?'⚠️ Expiré':'✓ Valide jusqu\'au'} ${exp.toLocaleDateString('fr')}</span>`:'<span style="color:#64748b;">Illimité</span>';
        return `<div style="padding:10px;background:${isExpired?'#fff5f5':'#f0fdf4'};border-radius:10px;margin-bottom:8px;border:1.5px solid ${isExpired?'#fca5a5':'#bbf7d0'};">
          <div style="font-weight:950;">${u.name||u.email}</div>
          <div class="small" style="margin-top:2px;">${expStr}</div>
          <button onclick="app.team.setConseillerExpiry('${u.uid}')" style="background:#0891b2;color:#fff;border:none;border-radius:8px;padding:6px 12px;font-weight:900;font-size:12px;cursor:pointer;margin-top:8px;"><i class="fas fa-clock"></i> Modifier expiration</button>
        </div>`;
      }).join('');
    },

    // ── GESTION DES CANAUX ──
    renderChannelsConfig(){
      const wrap=document.getElementById('channels-config-list');if(!wrap)return;
      const channels=window.app.chat._channels;
      const users=(window.app.data.users||[]).filter(u=>u.role!=='admin');
      wrap.innerHTML=channels.map((c,idx)=>{
        const userChecks=users.map(u=>{
          const allowed=!c.allowedUsers||(c.allowedUsers||[]).includes(u.uid);
          return `<label style="display:inline-flex;align-items:center;gap:4px;background:${allowed?'#dbeafe':'#f8fafc'};border-radius:20px;padding:4px 10px;font-size:12px;font-weight:800;cursor:pointer;border:1.5px solid ${allowed?'#93c5fd':'#e2e8f0'};">
            <input type="checkbox" ${allowed?'checked':''} onchange="app.team.toggleChannelUser(${idx},'${u.uid}',this.checked)" style="width:14px;height:14px;cursor:pointer;">
            ${u.name||u.email}
          </label>`;
        }).join('');
        return `<div class="channel-config-row">
          <div class="ch-header">
            <i class="fas ${c.icon}" style="color:${c.color};font-size:18px;flex-shrink:0;"></i>
            <input class="ch-name-input" value="${c.name}" onchange="app.team.renameChannel(${idx},this.value)" placeholder="Nom du canal">
            <span style="font-size:11px;font-weight:800;color:#64748b;white-space:nowrap;">${c.adminOnly?'🔒 Admin':'👥 Tous'}</span>
          </div>
          <div style="font-size:11px;font-weight:950;color:#64748b;margin-bottom:6px;text-transform:uppercase;">Accès staff (décocher = restreindre) :</div>
          <div class="channel-access-grid">${users.length?userChecks:'<span class="small">Aucun staff créé.</span>'}</div>
        </div>`;
      }).join('');
    },

    renameChannel(idx,name){
      if(!name.trim())return;
      window.app.chat._channels[idx].name=name.trim();
      // Persist to Firestore
      this._saveChannels();
    },

    toggleChannelUser(channelIdx,uid,allowed){
      const c=window.app.chat._channels[channelIdx];
      const users=(window.app.data.users||[]).filter(u=>u.role!=='admin').map(u=>u.uid);
      if(!c.allowedUsers)c.allowedUsers=[...users]; // init with all
      if(allowed){if(!c.allowedUsers.includes(uid))c.allowedUsers.push(uid);}
      else{c.allowedUsers=c.allowedUsers.filter(id=>id!==uid);}
      this._saveChannels();
    },

    _saveChannels:async function(){
      try{
        const{doc,setDoc}=window._fbChat;
        await setDoc(doc(window._db,'store_master','CHANNELS'),{
          list:window.app.chat._channels.map(c=>({id:c.id,name:c.name,icon:c.icon,color:c.color,adminOnly:c.adminOnly||false,allowedUsers:c.allowedUsers||null}))
        });
        toast('Canaux sauvegardés.','ok');
      }catch(e){toast('Erreur sauvegarde canaux.','err');}
    }
  },

  // ── TRACE ──
  trace:{
    ctx:null,imgData:'',
    open:async function(mod,pid,name){
      document.getElementById('trace-file').value='';
      this.ctx={moduleKey:mod,productId:String(pid),productName:name||''};
      this.imgData='';
      document.getElementById('trace-preview').style.display='none';document.getElementById('trace-preview').src='';
      document.getElementById('trace-title').textContent=name||'';
      const h3=document.getElementById('trace-h3');
      const bp=document.getElementById('trace-btn-pick');
      const bs=document.getElementById('trace-btn-save');
      if(mod==='salad'){h3.style.color='var(--salad)';bp.className='btn salad';bs.className='btn salad';}
      else{h3.style.color='var(--pvp)';bp.className='btn pvp';bs.className='btn pvp';}
      document.getElementById('modal-trace').classList.remove('hidden');
      await this.loadHistory(true);
    },
    close(){document.getElementById('modal-trace').classList.add('hidden');this.ctx=null;this.imgData='';document.getElementById('trace-file').value='';},
    loadHistory:async function(cleanup=false){
      const wrap=document.getElementById('trace-history');wrap.textContent='Chargement…';
      const ctx=this.ctx;if(!ctx)return(wrap.textContent='—');
      const cutoff=Date.now()-(180*24*60*60*1000);
      if(cleanup){try{const qOld=query(colTraceFor(ctx.moduleKey,ctx.productId),where("createdAt","<",cutoff),limit(50));const s=await getDocs(qOld);const dels=[];s.forEach(d=>dels.push(deleteDoc(d.ref)));if(dels.length)await Promise.allSettled(dels);}catch(e){}}
      try{
        const q=query(colTraceFor(ctx.moduleKey,ctx.productId),orderBy("createdAt","desc"),limit(15));
        const snap=await getDocs(q);const rows=[];
        snap.forEach(d=>{const dt=d.data();if((dt.createdAt||0)>=cutoff)rows.push({_docId:d.id,...dt});});
        if(!rows.filter(r=>r.path).length){wrap.innerHTML="<div class='small'>Aucune photo récente.</div>";return;}
        wrap.innerHTML=rows.filter(r=>r.path).map(r=>{
          const when=formatDate(r.createdAt);
          const sp=(r.path||'').replace(/'/g,"\\'");const si=(r._docId||'').replace(/'/g,"\\'");
          return `<div style="padding:10px;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;gap:10px;">
            <div style="min-width:0;"><div style="font-weight:900;">${when}</div><div class="small" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.path||''}</div></div>
            <div style="display:flex;gap:8px;flex-shrink:0;">
              <button class="icon-btn dark" onclick="app.trace.view('${sp}')"><i class="fas fa-eye"></i></button>
              <button class="icon-btn red"  onclick="app.trace.delOne('${si}','${sp}')"><i class="fas fa-trash"></i></button>
            </div>
          </div>`;
        }).join('');
      }catch(e){wrap.innerHTML="<div class='small'>Impossible de charger (Firestore rules).</div>";}
    },
    view:async function(path){if(!path)return;try{const url=await getDownloadURL(sRef(storage,path));window.app.common.showBarcode("","Tracabilité",url);}catch(e){toast('Photo introuvable.','err');}},
    delOne:async function(docId,path){
      const ctx=this.ctx;if(!ctx||!docId)return;
      const ok=await dlgConfirm('Supprimer photo','Supprimer cette tracabilité ?');if(!ok)return;
      try{await deleteDoc(doc(db,TRACE_PREFIX[ctx.moduleKey],String(ctx.productId),"items",String(docId)));}catch(e){}
      try{if(path)await deleteObject(sRef(storage,path));}catch(e){}
      await this.loadHistory(false);
    },
    save:async function(){
      const ctx=this.ctx;if(!ctx)return;if(!this.imgData)return toast('Aucune photo.','warn');
      const ts=Date.now();const d=new Date(ts);
      const ym=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const sid=String(ctx.productId).replace(/[^a-zA-Z0-9_-]/g,'_');
      const path=`${TRACE_PREFIX[ctx.moduleKey]}/${sid}/${ym}/${ts}.jpg`;
      spin(true);
      try{
        await uploadString(sRef(storage,path),this.imgData,'data_url');
        await addDoc(colTraceFor(ctx.moduleKey,ctx.productId),{productId:String(ctx.productId),productName:ctx.productName,createdAt:ts,path});
        toast('Tracabilité enregistrée.','ok');
        this.imgData='';document.getElementById('trace-preview').style.display='none';document.getElementById('trace-preview').src='';document.getElementById('trace-file').value='';
        await this.loadHistory(true);
      }catch(e){toast('Erreur tracabilité.','err');}
      finally{spin(false);}
    }
  },

  // ── FRAIS ──
  frais:{
    scanning:false,tgtgScanning:false,imgUrl:'',
    tab(t){
      document.querySelectorAll('#view-frais .tab').forEach(e=>e.classList.remove('active'));
      const tabMap={scan:'tf-1',tgtg:'tf-3',list:'tf-2'};
      document.getElementById(tabMap[t]).classList.add('active');
      ['frais-scan','frais-tgtg','frais-list'].forEach(id=>document.getElementById(id).classList.add('hidden'));
      document.getElementById('frais-'+t).classList.remove('hidden');
      if(t==='list'){this.render();}
      if(t==='tgtg'){this.renderTgtg();}
    },
    toggleScan(){
      if(this.scanning){this.scanning=false;document.getElementById('scanner-box').style.display='none';try{codeReader.reset();}catch(e){}}
      else{this.scanning=true;document.getElementById('scanner-box').style.display='block';codeReader.decodeFromVideoDevice(null,'video',(r)=>{if(r){this.handleInput(r.text);this.toggleScan();}});}
    },
    tgtgToggleScan(){
      if(this.tgtgScanning){this.tgtgScanning=false;document.getElementById('tgtg-scanner-box').style.display='none';try{codeReader.reset();}catch(e){}}
      else{this.tgtgScanning=true;document.getElementById('tgtg-scanner-box').style.display='block';codeReader.decodeFromVideoDevice(null,'tgtg-video',(r)=>{if(r){this.tgtgHandleScan(r.text);this.tgtgToggleScan();}});}
    },
    tgtgHandleScan(ean){
      // Find product by EAN in frais list and deduct qty
      const match=window.app.data.frais.find(i=>String(i.ean||'')===String(ean));
      if(match){this.tgtgAskMotif(match.id);}
      else{document.getElementById('tgtg-search').value=ean;this.renderTgtg();}
    },

    tgtgAskMotif(id){
      // Show motif selection overlay
      let m=document.getElementById('modal-tgtg-motif');
      if(!m){
        m=document.createElement('div');m.id='modal-tgtg-motif';
        m.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:99000;display:flex;align-items:center;justify-content:center;padding:20px;';
        m.innerHTML=`<div style="background:#fff;border-radius:20px;padding:22px;max-width:340px;width:100%;text-align:center;">
          <div style="font-weight:950;font-size:16px;margin-bottom:6px;color:#006B3C;"><i class="fas fa-tag"></i> Motif de retrait</div>
          <div style="font-size:13px;color:#64748b;margin-bottom:18px;">Pourquoi ce produit est-il retiré ?</div>
          <button id="tgtg-motif-tgtg" style="display:block;width:100%;background:#006B3C;color:#fff;border:none;border-radius:14px;padding:14px;font-size:15px;font-weight:950;cursor:pointer;margin-bottom:10px;">
            🛍️ Too Good To Go
          </button>
          <button id="tgtg-motif-50" style="display:block;width:100%;background:#d97706;color:#fff;border:none;border-radius:14px;padding:14px;font-size:15px;font-weight:950;cursor:pointer;margin-bottom:10px;">
            🏷️ Promotion –50%
          </button>
          <button onclick="document.getElementById('modal-tgtg-motif').style.display='none'" style="display:block;width:100%;background:#f1f5f9;color:#475569;border:none;border-radius:14px;padding:10px;font-size:14px;font-weight:900;cursor:pointer;">
            Annuler
          </button>
        </div>`;
        document.body.appendChild(m);
      }
      m.style.display='flex';
      m._productId=id;
      document.getElementById('tgtg-motif-tgtg').onclick=()=>{m.style.display='none';this.tgtgDeduct(m._productId,false,'tgtg');};
      document.getElementById('tgtg-motif-50').onclick=()=>{m.style.display='none';this.tgtgDeduct(m._productId,false,'promo50');};
    },

    tgtgDeduct:async function(id,fromScan=false,motif='tgtg'){
      const idx=window.app.data.frais.findIndex(x=>x.id==id);
      if(idx<0)return;
      const item=window.app.data.frais[idx];
      const currentQty=Number(item.qty||0);
      const motifLabel=motif==='promo50'?'Promo –50%':'Too Good To Go';
      if(currentQty<=1){
        // Remove completely
        window.app.data.frais.splice(idx,1);
        toast(`${item.name} retiré du stock (${motifLabel})`,fromScan?'ok':'info',3000);
      } else {
        window.app.data.frais[idx].qty=currentQty-1;
        toast(`[${motifLabel}] ${item.name} : ${currentQty}→${currentQty-1}`,'ok',2500);
      }
      spin(true);try{await window.app.save('frais');}catch(e){toast('Erreur synchro.','err');}finally{spin(false);}
      this.renderTgtg();this.render();window.app.updateHomeBadges();
    },
    renderTgtg(){
      const wrap=document.getElementById('tgtg-result-list');if(!wrap)return;
      const q=(document.getElementById('tgtg-search')?.value||'').toLowerCase().trim();
      const today=new Date();today.setHours(0,0,0,0);
      // Show products expiring today or with search
      const items=window.app.data.frais.filter(i=>{
        if(q){return(i.name||'').toLowerCase().includes(q)||(i.ean||'').includes(q);}
        const d=new Date(i.date);return!isNaN(d.getTime())&&d<=today;
      }).sort((a,b)=>new Date(a.date)-new Date(b.date));
      if(!items.length){
        wrap.innerHTML=`<div class="empty-state" style="padding:20px 0;"><i class="fas fa-check-circle" style="color:#006B3C;"></i>${q?'Aucun résultat':'Aucun produit à retirer aujourd\'hui 🎉'}</div>`;
        return;
      }
      wrap.innerHTML=items.map(i=>{
        const d=new Date(i.date);const dateStr=!isNaN(d.getTime())?d.toLocaleDateString('fr'):'?';
        return`<div class="list-item" style="border-left:4px solid #006B3C;">
          <div style="flex:1;min-width:0;">
            <div style="font-weight:900;font-size:14px;">${i.name||''}</div>
            <div class="small">x${i.qty||0} • DLC: ${dateStr} • ${i.fam||''}</div>
          </div>
          <button onclick="app.frais.tgtgAskMotif(${i.id})" style="background:#006B3C;color:#fff;border:none;border-radius:10px;padding:10px 14px;font-weight:900;cursor:pointer;white-space:nowrap;"><i class="fas fa-minus"></i> -1</button>
        </div>`;
      }).join('');
    },
    handleInput(val){
      const clean=String(val||'').replace(/\D/g,'').slice(0,13);
      document.getElementById('frais-ean').value=clean;
      if(window.app.debounceTimer)clearTimeout(window.app.debounceTimer);
      window.app.debounceTimer=setTimeout(()=>{if(clean.length===13)this.api(clean);},250);
    },
    api:async function(ean){try{const r=await fetch(`https://world.openfoodfacts.org/api/v0/product/${ean}.json`);const d=await r.json();if(d.status==1){document.getElementById('frais-name').value=d.product.product_name_fr||'';this.imgUrl=d.product.image_front_small_url||'';}}catch(e){}},
    add:async function(){
      const dateVal=document.getElementById('frais-date').value;
      const name=document.getElementById('frais-name').value;
      if(!name||!dateVal){toast('Nom et date requis.','warn');return;}
      const o={id:Date.now(),ean:document.getElementById('frais-ean').value,fam:document.getElementById('frais-fam').value,name,qty:document.getElementById('frais-qty').value,date:window.app.common.parseDateLocal(dateVal),img:this.imgUrl};
      window.app.data.frais.push(o);
      spin(true);try{await window.app.save('frais');toast('Produit ajouté.','ok');}catch(e){toast('Erreur sauvegarde.','err');}finally{spin(false);}
      this.imgUrl='';document.getElementById('frais-name').value='';document.getElementById('frais-ean').value='';
      window.app.updateHomeBadges();
    },
    render(){
      const div=document.getElementById('frais-list-items');if(!div)return;
      const q=(document.getElementById('frais-search')?.value||'').toLowerCase().trim();
      const grp={};
      const filtered=q?window.app.data.frais.filter(i=>(i.name||'').toLowerCase().includes(q)||(i.fam||'').toLowerCase().includes(q)||(i.ean||'').includes(q)):window.app.data.frais;
      filtered.slice().sort((a,b)=>(a.fam||'').localeCompare(b.fam||'')||(a.date||0)-(b.date||0)).forEach(i=>{if(!grp[i.fam])grp[i.fam]=[];grp[i.fam].push(i);});
      if(!Object.keys(grp).length){div.innerHTML=`<div class="empty-state"><i class="fas fa-box-open"></i>Aucun produit frais.</div>`;return;}
      const parts=[];
      for(const f in grp){
        const id='F-'+f;const c=window.app.closed.has(id);
        parts.push(`<div class="group-header" onclick="app.toggleFam('${id}')"><span>${f}</span><i class="fas fa-chevron-${c?'right':'down'}"></i></div>`);
        if(c)continue;
        grp[f].forEach(i=>{
          const d=new Date(i.date);let badge='bg-grey';
          const todayMidnight=new Date();todayMidnight.setHours(0,0,0,0);
          const isToday=!isNaN(d.getTime())&&d.getTime()===todayMidnight.getTime();
          if(!isNaN(d.getTime())){const diff=(d-new Date())/(1000*60*60*24);badge=diff<0?'bg-red':(diff<2?'bg-orange':'bg-green');}
          const sn=(i.name||'').replace(/'/g,' ');
          const img=i.img?`<img src="${i.img}" class="item-img" onclick="event.stopPropagation();app.common.showBarcode('${i.ean||''}','${sn}','${i.img}')">`:`<div class="item-img" onclick="event.stopPropagation();app.common.showBarcode('${i.ean||''}','${sn}')"><i class="fas fa-barcode"></i></div>`;
          const sc=window.app.common.isASaisir(i.date)?`<span class="chip warn"><i class="fas fa-triangle-exclamation"></i> À SAISIR</span>`:'';
          const todayStyle=isToday?'border-left:4px solid #ef4444;background:linear-gradient(135deg,#fff5f5,#fff);':badge==='bg-red'?'border-left:4px solid #ef4444;':'';
          parts.push(`<div class="swipe-wrapper"><div class="swipe-content" style="${todayStyle}" onclick="app.frais.openEdit(${i.id})">
            <div style="display:flex;align-items:center;flex:1;min-width:0;gap:12px;">${img}<div class="item-info"><div class="item-title" style="${isToday?'color:#dc2626;font-weight:950;':''}">${i.name||''}${isToday?' <span style="font-size:11px;background:#ef4444;color:#fff;border-radius:8px;padding:2px 6px;margin-left:4px;">AUJOURD\'HUI</span>':''}</div><div class="item-sub">x${i.qty||0} • ${i.ean||'EAN ?'} ${sc}</div></div></div>
            <div class="right-col"><div class="date-badge ${badge}"><span>${!isNaN(d.getTime())?d.getDate():'?'}</span><span style="font-size:10px;">${!isNaN(d.getTime())?d.toLocaleString('fr',{month:'short'}):'Err'}</span></div></div>
          </div></div>`);
        });
      }
      div.innerHTML=parts.join('');
    },
    openEdit(id){
      if(!window.app.canDo('fraisEdit')){toast('Permission refusée.','err');return;}
      const i=window.app.data.frais.find(x=>x.id==id);
      document.getElementById('modal-edit-frais').classList.remove('hidden');
      document.getElementById('edit-id').value=id;document.getElementById('edit-famille').value=i.fam;
      document.getElementById('edit-qty').value=i.qty;document.getElementById('edit-name').value=i.name;
      document.getElementById('edit-ean').value=i.ean;document.getElementById('edit-date').value=window.app.common.dateToInputLocal(i.date);
    },
    saveEdit:async function(){
      const id=document.getElementById('edit-id').value;
      const idx=window.app.data.frais.findIndex(x=>String(x.id)===String(id));
      if(idx>-1){
        window.app.data.frais[idx].fam=document.getElementById('edit-famille').value;
        window.app.data.frais[idx].qty=document.getElementById('edit-qty').value;
        window.app.data.frais[idx].name=document.getElementById('edit-name').value;
        window.app.data.frais[idx].ean=document.getElementById('edit-ean').value;
        window.app.data.frais[idx].date=window.app.common.parseDateLocal(document.getElementById('edit-date').value);
        spin(true);try{await window.app.save('frais');}catch(e){toast('Erreur.','err');}finally{spin(false);}
        document.getElementById('modal-edit-frais').classList.add('hidden');
        this.render();window.app.checkAlerts();window.app.updateHomeBadges();toast('Modifié.','ok');
      }
    },
    del:async function(){
      const ok=await dlgConfirm('Supprimer','Supprimer ce produit ?');if(!ok)return;
      const id=document.getElementById('edit-id').value;
      window.app.data.frais=window.app.data.frais.filter(x=>String(x.id)!==String(id));
      spin(true);try{await window.app.save('frais');toast('Supprimé.','ok');}catch(e){toast('Erreur.','err');}finally{spin(false);}
      document.getElementById('modal-edit-frais').classList.add('hidden');
      this.render();window.app.checkAlerts();window.app.updateHomeBadges();
    }
  },

  // ── PVP ──
  pvp:{
    tab(t){
      document.querySelectorAll('#view-pvp .tab').forEach(e=>e.classList.remove('active-pvp'));
      document.getElementById(t==='stock'?'tp-1':(t==='bib'?'tp-2':'tp-3')).classList.add('active-pvp');
      ['pvp-stock','pvp-bib','pvp-calc'].forEach(id=>document.getElementById(id).classList.add('hidden'));
      document.getElementById('pvp-'+t).classList.remove('hidden');
    },
    toggleFamInput(){const v=document.getElementById('lib-fam-select').value;document.getElementById('lib-fam-new').classList.toggle('hidden',v!=='new');},
    openLib(id=null){
      if(!window.app.canDo('pvpLib')){toast('Permission refusée.','err');return;}
      document.getElementById('modal-pvp-lib').classList.remove('hidden');
      const uF=[...new Set(window.app.data.pvpLib.map(i=>i.family||'DIVERS'))].sort();
      document.getElementById('lib-fam-select').innerHTML=uF.map(f=>`<option value="${f}">${f}</option>`).join('')+`<option value="new">+ Créer...</option>`;
      if(id){const i=window.app.data.pvpLib.find(x=>x.id==id);document.getElementById('lib-id').value=id;document.getElementById('lib-name').value=i.name;document.getElementById('lib-ean').value=i.ean||'';document.getElementById('lib-days').value=i.days||0;document.getElementById('lib-img-data').value=i.img||'';document.getElementById('img-preview').src=i.img||'';document.getElementById('img-preview').style.display=i.img?'block':'none';document.getElementById('lib-fam-select').value=i.family||'DIVERS';for(let k=0;k<7;k++)document.getElementById('t-'+k).value=(i.targets||{})[k]||'';}
      else{document.getElementById('lib-id').value='';document.getElementById('lib-name').value='';document.getElementById('lib-ean').value='';document.getElementById('lib-img-data').value='';document.getElementById('img-preview').style.display='none';for(let k=0;k<7;k++)document.getElementById('t-'+k).value='';}
    },
    saveLib:async function(){
      if(!document.getElementById('lib-name').value.trim())return toast('Nom requis.','warn');
      const id=document.getElementById('lib-id').value;
      const fam=document.getElementById('lib-fam-select').value==='new'?(document.getElementById('lib-fam-new').value||'DIVERS').toUpperCase():document.getElementById('lib-fam-select').value;
      const o={id:id?Number(id):Date.now(),family:fam,name:document.getElementById('lib-name').value,ean:document.getElementById('lib-ean').value,img:document.getElementById('lib-img-data').value,days:document.getElementById('lib-days').value,targets:{}};
      for(let k=0;k<7;k++)o.targets[k]=document.getElementById('t-'+k).value;
      if(id){const idx=window.app.data.pvpLib.findIndex(x=>String(x.id)===String(id));if(idx>-1)window.app.data.pvpLib[idx]=o;}else window.app.data.pvpLib.push(o);
      spin(true);try{await window.app.save('pvp');toast('Enregistré.','ok');}catch(e){toast('Erreur.','err');}finally{spin(false);}
      document.getElementById('modal-pvp-lib').classList.add('hidden');this.render();
    },
    delLib:async function(){
      const ok=await dlgConfirm('Supprimer produit','Supprimer ce produit de la bibliothèque ?');if(!ok)return;
      const id=document.getElementById('lib-id').value;
      window.app.data.pvpLib=window.app.data.pvpLib.filter(x=>String(x.id)!==String(id));
      spin(true);try{await window.app.save('pvp');toast('Supprimé.','ok');}catch(e){toast('Erreur.','err');}finally{spin(false);}
      document.getElementById('modal-pvp-lib').classList.add('hidden');this.render();
    },
    addStock:async function(libId){
      if(!window.app.canDo('pvpStock')){toast('Permission refusée.','err');return;}
      const l=window.app.data.pvpLib.find(x=>x.id==libId);
      const q=await dlgPrompt('Quantité ?','1','number');
      if(q===null)return;
      const n=Number(q||0);if(n<=0)return toast('Quantité invalide.','warn');
      const now=Date.now();
      const end=window.app.common.calculateEnd(now,l.days);
      const entry={id:now,libId,name:l.name,ean:l.ean,qty:n,out:now,end,days:l.days};
      window.app.data.pvpStock.push(entry);
      this.render();
      spin(true);
      try{await window.app.save('pvp');toast(`${n}× ${l.name} sorti — fin: ${formatDate(end)}`,'ok',4000);}
      catch(e){toast('Erreur sauvegarde.','err');}
      finally{spin(false);}
    },
    openEditStock(id){
      const i=window.app.data.pvpStock.find(x=>x.id==id);
      document.getElementById('modal-pvp-stock').classList.remove('hidden');
      document.getElementById('stock-id').value=id;document.getElementById('stock-name').innerText=i.name;
      document.getElementById('stock-qty').value=i.qty;document.getElementById('stock-start').value=tsToInput(i.out);document.getElementById('stock-end').value=tsToInput(i.end);
    },
    saveStock:async function(){
      const idx=window.app.data.pvpStock.findIndex(x=>String(x.id)===String(document.getElementById('stock-id').value));if(idx<0)return;
      const qty=Number(document.getElementById('stock-qty').value||0);
      const out=new Date(document.getElementById('stock-start').value).getTime();
      const end=new Date(document.getElementById('stock-end').value).getTime();
      if(!isFinite(qty)||qty<0)return toast('Quantité invalide.','warn');
      if(isNaN(out)||isNaN(end))return toast('Dates invalides.','warn');
      window.app.data.pvpStock[idx].qty=qty;window.app.data.pvpStock[idx].out=out;window.app.data.pvpStock[idx].end=end;
      document.getElementById('modal-pvp-stock').classList.add('hidden');
      this.render();
      spin(true);try{await window.app.save('pvp');toast('Mis à jour.','ok');}catch(e){toast('Erreur.','err');}finally{spin(false);}
    },
    delStock:async function(){
      const ok=await dlgConfirm('Retirer','Retirer ce produit du rayon ?');if(!ok)return;
      const id=document.getElementById('stock-id').value;
      window.app.data.pvpStock=window.app.data.pvpStock.filter(x=>String(x.id)!==String(id));
      document.getElementById('modal-pvp-stock').classList.add('hidden');
      this.render();
      spin(true);try{await window.app.save('pvp');toast('Retiré.','ok');}catch(e){toast('Erreur.','err');}finally{spin(false);}
    },
    changeQty:async function(id,delta){
      const idx=window.app.data.pvpStock.findIndex(x=>x.id==id);
      if(idx>-1){
        const n=Number(window.app.data.pvpStock[idx].qty||0)+delta;
        if(n<=0)window.app.data.pvpStock.splice(idx,1);else window.app.data.pvpStock[idx].qty=n;
        this.render();
        try{await window.app.save('pvp');}catch(e){toast('Erreur synchro.','err');}
      }
    },
    toggleNeed:async function(libId){
      const idx=window.app.data.checkedNeeds.indexOf(libId);
      if(idx>-1)window.app.data.checkedNeeds.splice(idx,1);else window.app.data.checkedNeeds.push(libId);
      this.render();try{await window.app.save('pvp');}catch(e){}
    },
    render(){
      const bib=document.getElementById('lib-list');
      if(bib){
        const q=(document.getElementById('pvp-search')?.value||'').toLowerCase().trim();
        const allLib=window.app.data.pvpLib.slice().sort((a,b)=>window.app.common.cleanName(a.name).localeCompare(window.app.common.cleanName(b.name)));
        const filtered=q?allLib.filter(l=>(l.name||'').toLowerCase().includes(q)||(l.family||'').toLowerCase().includes(q)||(l.ean||'').includes(q)):allLib;

        if(!window.app.data.pvpLib.length){bib.innerHTML=`<div class="empty-state"><i class="fas fa-bread-slice"></i>Bibliothèque vide.</div>`;}
        else if(!filtered.length){bib.innerHTML=`<div class="search-no-result"><i class="fas fa-magnifying-glass" style="font-size:28px;opacity:.3;display:block;margin-bottom:8px;"></i>Aucun résultat pour "<b>${q}</b>"</div>`;}
        else{
          const canEdit=window.app.canDo('pvpLib');
          const canStock=window.app.canDo('pvpStock');
          if(q){
            // En mode recherche : liste plate sans groupes
            bib.innerHTML=filtered.map(l=>{
              const img=l.img?`<img src="${l.img}" class="item-img">`:`<div class="item-img"><i class="fas fa-bread-slice"></i></div>`;
              const sn=(l.name||'').replace(/'/g,' ');
              const fam=`<span class="chip" style="background:#f1f5f9;color:#475569;">${l.family||'DIVERS'}</span>`;
              return `<div class="list-item" onclick="app.common.showBarcode('${l.ean||''}','${sn}','${l.img||''}')">
                <div style="display:flex;align-items:center;min-width:0;gap:12px;">${img}<div style="min-width:0;"><div class="item-title">${l.name}</div><div class="item-sub">${l.days||0}h • ${fam}</div></div></div>
                <div class="right-col">
                  ${canEdit?`<button class="icon-btn pvp" onclick="event.stopPropagation();app.pvp.openLib(${l.id})"><i class="fas fa-pen"></i></button>`:''}
                  <button class="icon-btn dark" onclick="event.stopPropagation();app.trace.open('pvp','${l.id}','${sn}')"><i class="fas fa-camera"></i></button>
                  ${canStock?`<button class="icon-btn pvp" onclick="event.stopPropagation();app.pvp.addStock(${l.id})"><i class="fas fa-plus"></i></button>`:''}
                </div>
              </div>`;
            }).join('');
          } else {
            // Mode normal : groupé par famille
            const gL={};filtered.forEach(l=>{const f=l.family||'DIVERS';if(!gL[f])gL[f]=[];gL[f].push(l);});
            const parts=[];Object.keys(gL).sort().forEach(f=>{
              const id='L-'+f;const c=window.app.closed.has(id);
              parts.push(`<div class="group-header" onclick="app.toggleFam('${id}')"><span>${f}</span><i class="fas fa-chevron-${c?'right':'down'}"></i></div>`);
              if(c)return;
              gL[f].forEach(l=>{
                const img=l.img?`<img src="${l.img}" class="item-img">`:`<div class="item-img"><i class="fas fa-bread-slice"></i></div>`;
                const sn=(l.name||'').replace(/'/g,' ');
                parts.push(`<div class="list-item" onclick="app.common.showBarcode('${l.ean||''}','${sn}','${l.img||''}')">
                  <div style="display:flex;align-items:center;min-width:0;gap:12px;">${img}<div style="min-width:0;"><div class="item-title">${l.name}</div><div class="item-sub">${l.days||0}h • ${l.ean||'EAN ?'}</div></div></div>
                  <div class="right-col">
                    ${canEdit?`<button class="icon-btn pvp" onclick="event.stopPropagation();app.pvp.openLib(${l.id})"><i class="fas fa-pen"></i></button>`:''}
                    <button class="icon-btn dark" onclick="event.stopPropagation();app.trace.open('pvp','${l.id}','${sn}')"><i class="fas fa-camera"></i></button>
                    ${canStock?`<button class="icon-btn pvp" onclick="event.stopPropagation();app.pvp.addStock(${l.id})"><i class="fas fa-plus"></i></button>`:''}
                  </div>
                </div>`);
              });
            });
            bib.innerHTML=parts.join('');
          }
        }
      }
      const st=document.getElementById('pvp-stock');
      if(st){
        const now=new Date();
        const expired=window.app.data.pvpStock.filter(i=>new Date(i.end)<now);
        const expiredBadge=expired.length>0?`<div style="background:#fee2e2;border-left:5px solid #ef4444;border-radius:12px;padding:12px 14px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;"><div style="font-weight:950;color:#991b1b;"><i class="fas fa-triangle-exclamation"></i> ${expired.length} produit(s) à retirer du rayon aujourd'hui</div></div>`:'';
        if(!window.app.data.pvpStock.length){st.innerHTML=`<div class="empty-state"><i class="fas fa-store-slash"></i>Rayon vide.</div>`;return;}
        const gS={};window.app.data.pvpStock.slice().sort((a,b)=>(a.end||0)-(b.end||0)).forEach(s=>{const l=window.app.data.pvpLib.find(x=>x.id==s.libId);const f=l?l.family:'DIVERS';if(!gS[f])gS[f]=[];gS[f].push(s);});
        const parts=[expiredBadge];Object.keys(gS).sort().forEach(f=>{const id='S-'+f;const c=window.app.closed.has(id);parts.push(`<div class="group-header" style="background:var(--pvp)" onclick="app.toggleFam('${id}')"><span>${f}</span><i class="fas fa-chevron-${c?'right':'down'}"></i></div>`);if(c)return;gS[f].forEach(i=>{const dS=formatDate(i.out);const dE=formatDate(i.end);const isExp=new Date(i.end)<now;const l=window.app.data.pvpLib.find(x=>x.id==i.libId);const img=l?.img?`<img src="${l.img}" class="item-img" onclick="event.stopPropagation();app.common.showBarcode('${i.ean||''}','${(i.name||'').replace(/'/g,' ')}','${l.img}')">`:`<div class="item-img" onclick="event.stopPropagation();app.common.showBarcode('${i.ean||''}','${(i.name||'').replace(/'/g,' ')}')"><i class="fas fa-bread-slice"></i></div>`;parts.push(`<div class="swipe-wrapper"><div class="swipe-content ${isExp?'style="border-left:4px solid #ef4444;"':''}"><div style="display:flex;align-items:center;flex:1;min-width:0;gap:12px;">${img}<div style="min-width:0;"><div class="item-title">${i.name}</div><div class="qty-ctrl"><button class="qty-btn" onclick="app.pvp.changeQty(${i.id},-1)">-</button><b>${i.qty}</b><button class="qty-btn" onclick="app.pvp.changeQty(${i.id},1)">+</button></div></div></div><div class="right-col"><button class="icon-btn frigo" onclick="app.trace.open('pvp','${i.libId}','${(i.name||'').replace(/'/g,' ')}')"><i class="fas fa-camera"></i></button><div class="date-col" onclick="app.pvp.openEditStock(${i.id})" style="cursor:pointer;"><div class="d-lbl">Sortie: ${dS}</div><div class="d-val ${isExp?'expired':''}">FIN: ${dE} <i class="fas fa-pen" style="font-size:10px;"></i></div></div></div></div></div>`);});});
        st.innerHTML=parts.join('');
      }
      const cl=document.getElementById('pvp-calc');
      if(cl){
        const tom=new Date();tom.setDate(tom.getDate()+1);const tn=new Date(tom.getFullYear(),tom.getMonth(),tom.getDate(),12,0,0,0).getTime();
        const gT={};let doneH='';let hasNeeds=false;const avail={};
        window.app.data.pvpStock.forEach(s=>{if((s.end||0)>=tn)avail[s.libId]=(avail[s.libId]||0)+Number(s.qty||0);});
        window.app.data.pvpLib.forEach(l=>{const target=Number((l.targets||{})[tom.getDay()]||0);if(target<=0)return;const av=Number(avail[l.id]||0);const need=Math.max(0,target-av);if(need<=0)return;hasNeeds=true;const isC=window.app.data.checkedNeeds.includes(l.id);const img=l.img?`<img src="${l.img}" class="item-img">`:`<div class="item-img"><i class="fas fa-bread-slice"></i></div>`;const h=`<div class="list-item ${isC?'item-done':''}" style="border-left:5px solid var(--pvp);"><div style="display:flex;align-items:center;flex:1;min-width:0;gap:12px;">${img}<div style="min-width:0;"><div class="item-title">${l.name}</div><div style="color:var(--pvp);font-weight:950;">À SORTIR : ${need} <span class="small">(objectif ${target} • dispo ${av})</span></div></div></div><div class="todo-check ${isC?'checked':''}" onclick="app.pvp.toggleNeed(${l.id})"><i class="fas fa-check"></i></div></div>`;if(isC)doneH+=h;else{const f=l.family||'DIVERS';if(!gT[f])gT[f]=[];gT[f].push(h);}});
        const parts=[`<h4 style="text-align:center;color:var(--primary);">À SORTIR DEMAIN</h4>`];
        if(!hasNeeds)parts.push(`<div class="empty-state"><i class="fas fa-check-circle"></i>Rien de prévu</div>`);
        else Object.keys(gT).sort().forEach(f=>{const id='N-'+f;const c=window.app.closed.has(id);parts.push(`<div class="group-header" style="background:var(--primary)" onclick="app.toggleFam('${id}')"><span>${f}</span><i class="fas fa-chevron-${c?'right':'down'}"></i></div>`);if(!c)parts.push(gT[f].join(''));});
        parts.push(`<h4 style="text-align:center;color:#64748b;margin-top:20px;">TERMINÉ</h4>`);
        parts.push(doneH||`<div class="empty-state" style="padding:20px;"><i class="fas fa-hourglass-start"></i>Rien de fait</div>`);
        cl.innerHTML=parts.join('');
      }
    }
  },

  // ── SALAD ──
  salad:{
    tab(t){document.querySelectorAll('#view-salad .tab').forEach(e=>e.classList.remove('active-salad'));document.getElementById(t==='stock'?'ts-1':'ts-2').classList.add('active-salad');document.getElementById('salad-stock').classList.add('hidden');document.getElementById('salad-bib').classList.add('hidden');document.getElementById('salad-'+t).classList.remove('hidden');},
    openLib(id=null){if(!window.app.canDo('saladLib')){toast('Permission refusée.','err');return;}document.getElementById('modal-salad-lib').classList.remove('hidden');if(id){const i=window.app.data.saladLib.find(x=>x.id==id);document.getElementById('sal-lib-id').value=i.id;document.getElementById('sal-lib-fam').value=i.family||'DIVERS';document.getElementById('sal-lib-name').value=i.name||'';document.getElementById('sal-lib-hours').value=String(i.hours||48);}else{document.getElementById('sal-lib-id').value='';document.getElementById('sal-lib-fam').value='SALADE';document.getElementById('sal-lib-name').value='';document.getElementById('sal-lib-hours').value='48';}},
    saveLib:async function(){if(!window.app.canDo('saladLib')){toast('Permission refusée.','err');return;}const id=document.getElementById('sal-lib-id').value;const name=(document.getElementById('sal-lib-name').value||'').trim();if(!name)return toast('Nom requis.','warn');const o={id:id?Number(id):Date.now(),family:document.getElementById('sal-lib-fam').value||'DIVERS',name,hours:Number(document.getElementById('sal-lib-hours').value||48)};if(id){const idx=window.app.data.saladLib.findIndex(x=>String(x.id)===String(id));if(idx>-1)window.app.data.saladLib[idx]=o;}else window.app.data.saladLib.push(o);document.getElementById('modal-salad-lib').classList.add('hidden');this.render();spin(true);try{await window.app.save('salad');toast('Enregistré.','ok');}catch(e){toast('Erreur.','err');}finally{spin(false);};},
    delLib:async function(){if(!window.app.canDo('saladLib')){toast('Permission refusée.','err');return;}const ok=await dlgConfirm('Supprimer','Supprimer ce produit ?');if(!ok)return;const id=document.getElementById('sal-lib-id').value;window.app.data.saladLib=window.app.data.saladLib.filter(x=>String(x.id)!==String(id));document.getElementById('modal-salad-lib').classList.add('hidden');this.render();spin(true);try{await window.app.save('salad');toast('Supprimé.','ok');}catch(e){toast('Erreur.','err');}finally{spin(false);};},
    addStock:async function(libId){
      if(!window.app.canDo('saladStock')){toast('Permission refusée.','err');return;}
      const l=window.app.data.saladLib.find(x=>x.id==libId);
      if(!l)return toast('Produit introuvable.','err');
      const q=await dlgPrompt('Quantité ?','1','number');
      if(q===null)return;
      const n=Number(q||0);
      if(n<=0)return toast('Quantité invalide.','warn');
      const now=Date.now();
      const entry={id:now,libId,name:l.name,qty:n,out:now,end:window.app.common.calculateEnd(now,l.hours),hours:l.hours};
      window.app.data.saladStock.push(entry);
      spin(true);
      try{
        await window.app.save('salad');
        toast(`${n}× ${l.name} sorti — fin: ${formatDate(entry.end)}`,'ok',4000);
        this.render();
      }catch(e){
        // Rollback on error
        window.app.data.saladStock=window.app.data.saladStock.filter(x=>x.id!==entry.id);
        toast('Erreur sauvegarde.','err');
      }finally{spin(false);}
    },
    changeQty:async function(id,delta){
      const idx=window.app.data.saladStock.findIndex(x=>x.id==id);
      if(idx>-1){
        const n=Number(window.app.data.saladStock[idx].qty||0)+delta;
        if(n<=0)window.app.data.saladStock.splice(idx,1);
        else window.app.data.saladStock[idx].qty=n;
        this.render();
        try{await window.app.save('salad');}catch(e){toast('Erreur synchro.','err');}
      }
    },
    openEditStock:async function(id){
      const i=window.app.data.saladStock.find(x=>x.id==id);
      const q=await dlgPrompt('Quantité :',String(i.qty||0),'number');
      if(q===null)return;
      const n=Number(q||0);
      if(n<=0)window.app.data.saladStock=window.app.data.saladStock.filter(x=>x.id!==id);
      else i.qty=n;
      this.render();
      try{await window.app.save('salad');}catch(e){toast('Erreur synchro.','err');}
    },
    render(){
      const bib=document.getElementById('salad-lib-list');
      if(bib){
        const q=(document.getElementById('salad-search')?.value||'').toLowerCase().trim();
        const allLib=window.app.data.saladLib.slice().sort((a,b)=>window.app.common.cleanName(a.name).localeCompare(window.app.common.cleanName(b.name)));
        const filtered=q?allLib.filter(l=>(l.name||'').toLowerCase().includes(q)||(l.family||'').toLowerCase().includes(q)):allLib;

        if(!window.app.data.saladLib.length){bib.innerHTML=`<div class="empty-state"><i class="fas fa-bowl-food"></i>Bibliothèque vide.</div>`;}
        else if(!filtered.length){bib.innerHTML=`<div class="search-no-result"><i class="fas fa-magnifying-glass" style="font-size:28px;opacity:.3;display:block;margin-bottom:8px;"></i>Aucun résultat pour "<b>${q}</b>"</div>`;}
        else{
          const canEdit=window.app.canDo('saladLib');
          const canStock=window.app.canDo('saladStock');
          if(q){
            bib.innerHTML=filtered.map(l=>{
              const sn=(l.name||'').replace(/'/g,' ');
              const fam=`<span class="chip" style="background:#f1f5f9;color:#475569;">${l.family||'DIVERS'}</span>`;
              return `<div class="list-item">
                <div style="display:flex;align-items:center;min-width:0;gap:12px;"><div class="item-img"><i class="fas fa-bowl-food"></i></div><div style="min-width:0;"><div class="item-title">${l.name}</div><div class="item-sub">${l.hours||48}h • ${fam}</div></div></div>
                <div class="right-col">
                  ${canEdit?`<button class="icon-btn salad" onclick="app.salad.openLib(${l.id})"><i class="fas fa-pen"></i></button>`:''}
                  <button class="icon-btn dark" onclick="app.trace.open('salad','${l.id}','${sn}')"><i class="fas fa-camera"></i></button>
                  ${canStock?`<button class="icon-btn salad" onclick="app.salad.addStock(${l.id})"><i class="fas fa-plus"></i></button>`:''}
                </div>
              </div>`;
            }).join('');
          } else {
            const gL={};filtered.forEach(l=>{const f=l.family||'DIVERS';if(!gL[f])gL[f]=[];gL[f].push(l);});
            const parts=[];Object.keys(gL).sort().forEach(f=>{
              const id='SL-'+f;const c=window.app.closed.has(id);
              parts.push(`<div class="group-header" style="background:var(--salad)" onclick="app.toggleFam('${id}')"><span>${f}</span><i class="fas fa-chevron-${c?'right':'down'}"></i></div>`);
              if(c)return;
              gL[f].forEach(l=>{
                const sn=(l.name||'').replace(/'/g,' ');
                parts.push(`<div class="list-item">
                  <div style="display:flex;align-items:center;min-width:0;gap:12px;"><div class="item-img"><i class="fas fa-bowl-food"></i></div><div style="min-width:0;"><div class="item-title">${l.name}</div><div class="item-sub">${l.hours||48}h</div></div></div>
                  <div class="right-col">
                    ${canEdit?`<button class="icon-btn salad" onclick="app.salad.openLib(${l.id})"><i class="fas fa-pen"></i></button>`:''}
                    <button class="icon-btn dark" onclick="app.trace.open('salad','${l.id}','${sn}')"><i class="fas fa-camera"></i></button>
                    ${canStock?`<button class="icon-btn salad" onclick="app.salad.addStock(${l.id})"><i class="fas fa-plus"></i></button>`:''}
                  </div>
                </div>`);
              });
            });
            bib.innerHTML=parts.join('');
          }
        }
      }
      const st=document.getElementById('salad-stock');
      if(st){
        if(!window.app.data.saladStock.length){st.innerHTML=`<div class="empty-state"><i class="fas fa-store-slash"></i>Rayon vide.</div>`;return;}
        const gS={};window.app.data.saladStock.slice().sort((a,b)=>(a.end||0)-(b.end||0)).forEach(s=>{const l=window.app.data.saladLib.find(x=>x.id==s.libId);const f=l?l.family:'DIVERS';if(!gS[f])gS[f]=[];gS[f].push(s);});
        const parts=[];Object.keys(gS).sort().forEach(f=>{const id='SS-'+f;const c=window.app.closed.has(id);parts.push(`<div class="group-header" style="background:var(--salad)" onclick="app.toggleFam('${id}')"><span>${f}</span><i class="fas fa-chevron-${c?'right':'down'}"></i></div>`);if(c)return;gS[f].forEach(i=>{const dS=formatDate(i.out);const dE=formatDate(i.end);const isExp=new Date(i.end)<new Date();const sn=(i.name||'').replace(/'/g,' ');parts.push(`<div class="swipe-wrapper" style="background:#0b4f4a;"><div class="swipe-content"><div style="display:flex;align-items:center;flex:1;min-width:0;gap:12px;"><div class="item-img"><i class="fas fa-bowl-food"></i></div><div style="min-width:0;"><div class="item-title" onclick="app.salad.openEditStock(${i.id})">${i.name}</div><div class="qty-ctrl"><button class="qty-btn" onclick="app.salad.changeQty(${i.id},-1)">-</button><b>${i.qty}</b><button class="qty-btn" onclick="app.salad.changeQty(${i.id},1)">+</button></div></div></div><div class="right-col"><button class="icon-btn dark" onclick="app.trace.open('salad','${i.libId}','${sn}')"><i class="fas fa-camera"></i></button><div class="date-col"><div class="d-lbl">Sortie: ${dS}</div><div class="d-val ${isExp?'expired':''}">FIN: ${dE}</div></div></div></div></div>`);});});
        st.innerHTML=parts.join('');
      }
    }
  },

  // ── FRIGO ──
  frigo:{
    tab(t){document.querySelectorAll('#view-frigo .tab').forEach(e=>e.classList.remove('active-frigo'));document.getElementById(t==='take'?'tfr-1':(t==='fridges'?'tfr-2':'tfr-3')).classList.add('active-frigo');['frigo-take','frigo-fridges','frigo-history'].forEach(id=>document.getElementById(id).classList.add('hidden'));document.getElementById('frigo-'+t).classList.remove('hidden');},
    remainingTodayTotal(){const pd=Number(window.app.data.frigo.perDay||2);const{start,end}=dayBounds();const today=(window.app.data.frigo.logs||[]).filter(l=>(l.ts||0)>=start&&(l.ts||0)<=end);let tot=0;(window.app.data.frigo.fridges||[]).forEach(fr=>{const done=today.filter(l=>String(l.fridgeId)===String(fr.id)).length;tot+=Math.max(0,pd-done);});return tot;},
    remainingForFridgeToday(fid){const pd=Number(window.app.data.frigo.perDay||2);const{start,end}=dayBounds();const done=(window.app.data.frigo.logs||[]).filter(l=>String(l.fridgeId)===String(fid)&&(l.ts||0)>=start&&(l.ts||0)<=end).length;return Math.max(0,pd-done);},
    setPerDay:async function(v){if(!window.app.canDo('frigoConfig')){toast('Permission refusée.','err');this.render();return;}window.app.data.frigo.perDay=Number(v||2);await window.app.save('frigo');this.render();window.app.updateHomeBadges();},
    addFridge:async function(){if(!window.app.canDo('frigoConfig')){toast('Permission refusée.','err');return;}const n=await dlgPrompt('Nom du frigo :',`FRIGO ${(window.app.data.frigo.fridges||[]).length+1}`);if(!n)return;window.app.data.frigo.fridges.push({id:Date.now(),name:n.trim().toUpperCase()});await window.app.save('frigo');this.render();window.app.updateHomeBadges();},
    renameFridge:async function(id){if(!window.app.canDo('frigoConfig')){toast('Permission refusée.','err');return;}const f=(window.app.data.frigo.fridges||[]).find(x=>String(x.id)===String(id));if(!f)return;const n=await dlgPrompt('Renommer :',f.name||'');if(!n)return;f.name=n.trim().toUpperCase();await window.app.save('frigo');this.render();},
    delFridge:async function(id){if(!window.app.canDo('frigoConfig')){toast('Permission refusée.','err');return;}const f=(window.app.data.frigo.fridges||[]).find(x=>String(x.id)===String(id));if(!f)return;const ok=await dlgConfirm(`Supprimer ${f.name}`,`Supprimer ce frigo ? Les relevés restent en historique.`);if(!ok)return;window.app.data.frigo.fridges=window.app.data.frigo.fridges.filter(x=>String(x.id)!==String(id));await window.app.save('frigo');this.render();window.app.updateHomeBadges();},
    openLogModal(fid=null){if(!window.app.canDo('frigoSaisie')){toast('Permission refusée.','err');return;}const sel=document.getElementById('frigo-log-fridge');sel.innerHTML=(window.app.data.frigo.fridges||[]).map(fr=>`<option value="${fr.id}">${fr.name||"FRIGO"}</option>`).join('');if(fid)sel.value=String(fid);document.getElementById('frigo-log-temp').value='';document.getElementById('frigo-log-time').value=tsToInput(Date.now());document.getElementById('modal-frigo-log').classList.remove('hidden');},
    saveLog:async function(){
      const fid=document.getElementById('frigo-log-fridge').value;const fr=(window.app.data.frigo.fridges||[]).find(x=>String(x.id)===String(fid));
      const temp=Number(document.getElementById('frigo-log-temp').value);const ts=inputToTs(document.getElementById('frigo-log-time').value);
      if(!fr)return toast('Frigo invalide.','warn');if(isNaN(temp))return toast('Température invalide.','warn');
      window.app.data.frigo.logs.push({id:Date.now(),fridgeId:fr.id,fridgeName:fr.name||'',temp,ts,user:window.app.me?.name||window.app.me?.email||'USER'});
      const cutoff=Date.now()-(90*24*60*60*1000);window.app.data.frigo.logs=window.app.data.frigo.logs.filter(l=>(l.ts||0)>=cutoff);
      spin(true);try{await window.app.save('frigo');toast('Relevé enregistré.','ok');}catch(e){toast('Erreur.','err');}finally{spin(false);}
      document.getElementById('modal-frigo-log').classList.add('hidden');this.render();window.app.updateHomeBadges();
    },
    editLog:async function(id,currentTemp){
      const newTemp=await dlgPrompt('Modifier la température :',String(currentTemp),'number');
      if(newTemp===null)return;
      const t=parseFloat(newTemp);if(isNaN(t))return toast('Température invalide.','warn');
      const idx=window.app.data.frigo.logs.findIndex(l=>String(l.id)===String(id));
      if(idx<0)return;
      window.app.data.frigo.logs[idx].temp=t;
      spin(true);try{await window.app.save('frigo');toast('Relevé modifié.','ok');}catch(e){toast('Erreur.','err');}finally{spin(false);}
      this.render();
    },
    deleteLog:async function(id){
      const ok=await dlgConfirm('Supprimer','Supprimer ce relevé de température ?');if(!ok)return;
      window.app.data.frigo.logs=window.app.data.frigo.logs.filter(l=>String(l.id)!==String(id));
      spin(true);try{await window.app.save('frigo');toast('Relevé supprimé.','ok');}catch(e){toast('Erreur.','err');}finally{spin(false);}
      this.render();window.app.updateHomeBadges();
    },
    render(){
      try{document.getElementById('frigo-perday').value=String(window.app.data.frigo.perDay||2);}catch(e){}
      const take=document.getElementById('frigo-take');
      if(take){
        const fridges=window.app.data.frigo.fridges||[];
        if(!fridges.length){take.innerHTML=`<div class="card"><b>Aucun frigo</b><div class="small">Créez des frigos dans l'onglet FRIGOS.</div></div>`;return;}
        take.innerHTML=fridges.map(fr=>{const rem=window.app.frigo.remainingForFridgeToday(fr.id);const done=(window.app.data.frigo.perDay||2)-rem;const chip=rem>0?`<span class="chip warn"><i class="fas fa-circle-exclamation"></i> ${rem} restant</span>`:`<span class="chip ok"><i class="fas fa-check"></i> OK</span>`;return`<div class="list-item" style="border-left:6px solid var(--frigo);"><div style="display:flex;align-items:center;gap:12px;min-width:0;flex:1;"><div class="item-img" style="color:var(--frigo)"><i class="fas fa-snowflake"></i></div><div style="min-width:0;"><div class="item-title">${fr.name||"FRIGO"}</div><div class="item-sub">${done}/${window.app.data.frigo.perDay||2} relevé(s) • ${chip}</div></div></div><div class="right-col"><button class="icon-btn frigo" onclick="app.frigo.openLogModal('${fr.id}')"><i class="fas fa-plus"></i></button></div></div>`;}).join('');
      }
      const list=document.getElementById('frigo-list');
      if(list){
        const fridges=window.app.data.frigo.fridges||[];
        const canCfg=window.app.canDo('frigoConfig');
        // Show/hide add fridge button
        const addBtn=document.querySelector('#view-frigo .btn.frigo');
        if(addBtn)addBtn.style.display=canCfg?'':'none';
        // Show/hide frequency config
        const paramCard=document.querySelector('#frigo-fridges .card');
        if(paramCard)paramCard.style.display=canCfg?'':'none';
        list.innerHTML=fridges.length?fridges.map(fr=>`<div class="list-item"><div style="display:flex;align-items:center;gap:12px;min-width:0;flex:1;"><div class="item-img" style="color:var(--frigo)"><i class="fas fa-snowflake"></i></div><div style="min-width:0;"><div class="item-title">${fr.name||"FRIGO"}</div><div class="item-sub">fréquence: ${window.app.data.frigo.perDay||2}/jour</div></div></div><div class="right-col">${canCfg?`<button class="icon-btn frigo" onclick="app.frigo.renameFridge('${fr.id}')"><i class="fas fa-pen"></i></button><button class="icon-btn red" onclick="app.frigo.delFridge('${fr.id}')"><i class="fas fa-trash"></i></button>`:''}</div></div>`).join(''):`<div class="empty-state"><i class="fas fa-snowflake"></i>Aucun frigo.</div>`;
      }
      const hist=document.getElementById('frigo-history');
      if(hist){
        const logs=(window.app.data.frigo.logs||[]).slice().sort((a,b)=>(b.ts||0)-(a.ts||0));
        const cutoff=Date.now()-(7*24*60*60*1000);const recent=logs.filter(l=>(l.ts||0)>=cutoff);
        if(!recent.length){hist.innerHTML=`<div class="card"><b>Aucun relevé récent</b><div class="small">Les 7 derniers jours s'affichent ici.</div></div>`;return;}
        const byDay={};recent.forEach(l=>{const d=new Date(l.ts);const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;if(!byDay[k])byDay[k]=[];byDay[k].push(l);});
        hist.innerHTML=Object.keys(byDay).sort().reverse().map(k=>{
          const d=new Date(k.replace(/-/g,'/'));const title=d.toLocaleDateString('fr',{weekday:'long',year:'numeric',month:'short',day:'numeric'});
          return`<div class="group-header" style="background:var(--frigo)"><span>${title}</span><span class="small" style="color:rgba(255,255,255,.8)">${byDay[k].length} relevé(s)</span></div>`
          +byDay[k].map(l=>`<div class="frigo-log-row">
            <div style="flex:1;min-width:0;">
              <div style="font-weight:950;">${l.fridgeName||'FRIGO'} • <span style="color:var(--frigo);">${l.temp}°C</span></div>
              <div class="small">${formatDate(l.ts)} • Par ${l.user||'USER'}</div>
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0;">
              <button class="icon-btn frigo" onclick="app.frigo.editLog('${l.id}',${l.temp})" title="Modifier"><i class="fas fa-pen"></i></button>
              <button class="icon-btn red" onclick="app.frigo.deleteLog('${l.id}')" title="Supprimer"><i class="fas fa-trash"></i></button>
            </div>
          </div>`).join('');
        }).join('');
      }
    }
  },

  // ══════════════════════════════════════════════════
  // ── TODO MODULE (with real-time sync) ──
  // ══════════════════════════════════════════════════
  todo:{
    _editingTaskDays: new Set(),
    _editingMonthDays: new Set(),
    _editingFreq: 'weekly',
    _unsubscribeLogs: null,

    tab(t){
      document.querySelectorAll('#view-todo .tab').forEach(e=>e.classList.remove('active-todo'));
      const tabMap={today:'tt-1',tomorrow:'tt-4',config:'tt-2',history:'tt-3'};
      if(document.getElementById(tabMap[t]))document.getElementById(tabMap[t]).classList.add('active-todo');
      ['todo-today','todo-tomorrow','todo-config','todo-history'].forEach(id=>{const el=document.getElementById(id);if(el)el.classList.add('hidden');});
      const panel=document.getElementById('todo-'+t);if(panel)panel.classList.remove('hidden');
      if(t==='today')this.renderToday();
      if(t==='tomorrow')this.renderTomorrow();
      if(t==='config'){
        if(!window.app.canDo('todoConfig')){
          document.getElementById('todo-config').innerHTML='<div class="empty-state"><i class="fas fa-lock"></i>Accès réservé aux administrateurs et aux utilisateurs autorisés.</div>';
          return;
        }
        this.renderConfig();
      }
      if(t==='history')this.renderHistory();
    },

    // Realtime listener for today's logs
    subscribeToday(){
      if(this._unsubscribeLogs){try{this._unsubscribeLogs();}catch(e){}}
      const {onSnapshot}=window._fsImports||{};
      if(!onSnapshot){return;}
      const today=todayStr();
      try{
        const q=window._fsQuery(colTodoLogs,window._fsWhere("date","==",today));
        this._unsubscribeLogs=onSnapshot(q,snap=>{
          window.app.data.todoLogs=[];
          snap.forEach(d=>window.app.data.todoLogs.push({_id:d.id,...d.data()}));
          this.renderToday();window.app.updateHomeBadges();
        });
      }catch(e){}
    },

    // Check if a task is applicable for a given date
    isTaskForDate(task, date){
      const freq=task.freq||'weekly';
      const dow=date.getDay();
      const dom=date.getDate();
      const month=date.getMonth()+1;
      if(freq==='daily') return true;
      if(freq==='weekly') return (task.days||[]).includes(dow);
      if(freq==='monthly') return (task.monthDays||[]).includes(dom);
      if(freq==='yearly'){
        const md=task.yearlyDate||'';if(!md)return false;
        const[d,m]=(md.split('/')).map(Number);
        return dom===d&&month===m;
      }
      return false;
    },

    todayTaskList(){
      const today=new Date();
      return (window.app.data.todo.tasks||[]).filter(t=>this.isTaskForDate(t,today));
    },

    tomorrowTaskList(){
      const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);
      return (window.app.data.todo.tasks||[]).filter(t=>this.isTaskForDate(t,tomorrow));
    },

    isDone(taskId){
      return window.app.data.todoLogs.some(l=>String(l.taskId)===String(taskId));
    },

    checkTask:async function(taskId){
      if(!window.app.canDo('todoSaisie')){toast('Permission refusée.','err');return;}
      if(this.isDone(taskId))return;
      const task=(window.app.data.todo.tasks||[]).find(t=>String(t.id)===String(taskId));
      const zone=(window.app.data.todo.zones||[]).find(z=>String(z.id)===String(task?.zoneId));
      const today=todayStr();
      const logEntry={taskId:String(taskId),taskName:task?.name||'',zoneId:String(task?.zoneId||''),zoneName:zone?.name||'',date:today,ts:Date.now(),user:window.app.me?.name||(window.app.me?.email||'USER')};
      try{
        const ref=await addDoc(colTodoLogs,logEntry);
        window.app.data.todoLogs.push({_id:ref.id,...logEntry});
        this.renderToday();window.app.updateHomeBadges();
        toast(`✓ ${task?.name||'Tâche'} effectuée !`,'ok',2000);
      }catch(e){toast('Erreur enregistrement.','err');}
    },

    uncheckTask:async function(taskId){
      const log=window.app.data.todoLogs.find(l=>String(l.taskId)===String(taskId));
      if(!log)return;
      try{
        await deleteDoc(fDoc(db,'todo_logs',log._id));
        window.app.data.todoLogs=window.app.data.todoLogs.filter(l=>l._id!==log._id);
        this.renderToday();window.app.updateHomeBadges();
        toast('Tâche décochée.','info',2000);
      }catch(e){toast('Erreur.','err');}
    },

    renderToday(){
      const wrap=document.getElementById('todo-today');if(!wrap)return;
      const zones=window.app.data.todo.zones||[];
      const tasks=this.todayTaskList();
      const now=new Date();
      const nowMin=now.getHours()*60+now.getMinutes();
      const dateLabel=now.toLocaleDateString('fr',{weekday:'long',day:'numeric',month:'long'});
      const done=tasks.filter(t=>this.isDone(t.id)).length;
      const pct=tasks.length>0?Math.round(done/tasks.length*100):0;

      if(!zones.length||!tasks.length){
        wrap.innerHTML=`
          <div style="text-align:center;padding:20px;">
            <div style="font-weight:950;font-size:18px;color:var(--todo);margin-bottom:4px;">${dateLabel}</div>
          </div>
          <div class="empty-state">
            <i class="fas fa-list-check"></i>
            ${!zones.length?'Créez des zones et des tâches dans l\'onglet <b>CONFIGURER</b>.':'Aucune tâche prévue aujourd\'hui.'}
          </div>`;
        return;
      }

      const parts=[`
        <div style="background:linear-gradient(135deg,var(--todo),#5b21b6);border-radius:18px;padding:18px;margin-bottom:16px;color:#fff;">
          <div style="font-weight:950;font-size:17px;">${dateLabel}</div>
          <div style="font-size:13px;opacity:.85;margin-bottom:12px;">${done} / ${tasks.length} tâche${tasks.length>1?'s':''}</div>
          <div style="background:rgba(255,255,255,.25);border-radius:999px;height:8px;overflow:hidden;">
            <div style="height:100%;border-radius:999px;background:#fff;width:${pct}%;transition:width .5s ease;"></div>
          </div>
          <div style="text-align:right;font-size:12px;margin-top:4px;opacity:.9;">${pct}%</div>
        </div>
      `];

      zones.forEach(z=>{
        const zoneTasks=tasks.filter(t=>String(t.zoneId)===String(z.id)).sort((a,b)=>(a.time||'00:00').localeCompare(b.time||'00:00'));
        if(!zoneTasks.length)return;
        const zDone=zoneTasks.filter(t=>this.isDone(t.id)).length;
        const zPct=zoneTasks.length>0?Math.round(zDone/zoneTasks.length*100):0;
        parts.push(`
          <div style="background:${z.color||'var(--todo)'};border-radius:14px;padding:14px 16px;margin-bottom:4px;color:#fff;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
              <div style="font-weight:950;font-size:15px;text-transform:uppercase;">${z.name||'ZONE'}</div>
              <div style="font-size:12px;opacity:.9;">${zDone}/${zoneTasks.length}</div>
            </div>
            <div style="height:5px;border-radius:3px;background:rgba(255,255,255,.3);margin-top:8px;overflow:hidden;">
              <div style="height:100%;border-radius:3px;background:#fff;width:${zPct}%;transition:width .5s;"></div>
            </div>
          </div>
        `);
        zoneTasks.forEach(t=>{
          const done=this.isDone(t.id);
          const log=done?window.app.data.todoLogs.find(l=>String(l.taskId)===String(t.id)):null;
          let taskMin=Infinity;
          if(t.time){const[h,m]=(t.time||'00:00').split(':').map(Number);taskMin=h*60+(m||0);}
          const overdue=!done&&taskMin!==Infinity&&nowMin>taskMin+15;
          const cardClass=done?'done':(overdue?'overdue':'');
          const freqLabel=t.freq==='monthly'?'mensuel':t.freq==='yearly'?'annuel':t.freq==='daily'?'quotidien':'';
          parts.push(`
            <div class="task-card ${cardClass}" style="border-left-color:${z.color||'var(--todo)'};${done?'border-left-color:var(--success);':''}${overdue?'border-left-color:var(--danger);':''}">
              ${t.time?`<span class="time-chip ${done?'done':(overdue?'overdue':'')}">${t.time}</span>`:''}
              <div style="flex:1;min-width:0;">
                <div style="font-weight:900;font-size:14px;${done?'text-decoration:line-through;color:#94a3b8;':''}">${t.name||''}${freqLabel?` <span class="chip" style="background:#f1f5f9;color:#64748b;font-size:10px;">${freqLabel}</span>`:''}</div>
                ${t.notes?`<div class="small" style="margin-top:2px;">${t.notes}</div>`:''}
                ${done&&log?`<div class="small" style="margin-top:3px;color:var(--success);"><i class="fas fa-check-circle"></i> ${log.user} • ${formatDate(log.ts)}</div>`:''}
                ${overdue?`<div class="small" style="color:var(--danger);margin-top:2px;"><i class="fas fa-clock"></i> En retard</div>`:''}
              </div>
              <div class="todo-check ${done?'checked':''}" onclick="app.todo.${done?'uncheckTask':'checkTask'}('${t.id}')">
                <i class="fas fa-check"></i>
              </div>
            </div>
          `);
        });
        parts.push('<div style="margin-bottom:8px;"></div>');
      });

      const unzonedTasks=tasks.filter(t=>!zones.find(z=>String(z.id)===String(t.zoneId))).sort((a,b)=>(a.time||'00:00').localeCompare(b.time||'00:00'));
      if(unzonedTasks.length){
        parts.push(`<div style="background:#475569;border-radius:14px;padding:14px 16px;margin-bottom:4px;color:#fff;"><div style="font-weight:950;">SANS ZONE</div></div>`);
        unzonedTasks.forEach(t=>{
          const done=this.isDone(t.id);
          const log=done?window.app.data.todoLogs.find(l=>String(l.taskId)===String(t.id)):null;
          parts.push(`<div class="task-card ${done?'done':''}"><div style="flex:1;min-width:0;"><div style="font-weight:900;${done?'text-decoration:line-through;color:#94a3b8;':''}">${t.name||''}</div>${done&&log?`<div class="small" style="color:var(--success);"><i class="fas fa-check-circle"></i> ${log.user}</div>`:''}${t.notes?`<div class="small">${t.notes}</div>`:''}</div><div class="todo-check ${done?'checked':''}" onclick="app.todo.${done?'uncheckTask':'checkTask'}('${t.id}')"><i class="fas fa-check"></i></div></div>`);
        });
      }
      wrap.innerHTML=parts.join('');
    },

    renderTomorrow(){
      const wrap=document.getElementById('todo-tomorrow');if(!wrap)return;
      const zones=window.app.data.todo.zones||[];
      const tasks=this.tomorrowTaskList();
      const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);
      const dateLabel=tomorrow.toLocaleDateString('fr',{weekday:'long',day:'numeric',month:'long'});
      const FREQ_LABELS={daily:'Quotidien',weekly:'Hebdo',monthly:'Mensuel',yearly:'Annuel'};

      if(!tasks.length){
        wrap.innerHTML=`
          <div style="text-align:center;padding:20px;">
            <div style="font-weight:950;font-size:18px;color:var(--todo);margin-bottom:4px;">${dateLabel}</div>
          </div>
          <div class="empty-state"><i class="fas fa-calendar-check"></i>Aucune tâche prévue demain.</div>`;
        return;
      }

      const parts=[`
        <div style="background:linear-gradient(135deg,#475569,#334155);border-radius:18px;padding:18px;margin-bottom:16px;color:#fff;">
          <div style="font-weight:950;font-size:17px;">${dateLabel}</div>
          <div style="font-size:13px;opacity:.85;margin-top:4px;">${tasks.length} tâche${tasks.length>1?'s':''} prévue${tasks.length>1?'s':''}</div>
        </div>
      `];

      zones.forEach(z=>{
        const zoneTasks=tasks.filter(t=>String(t.zoneId)===String(z.id)).sort((a,b)=>(a.time||'00:00').localeCompare(b.time||'00:00'));
        if(!zoneTasks.length)return;
        parts.push(`<div style="background:${z.color||'var(--todo)'};border-radius:14px;padding:14px 16px;margin-bottom:4px;color:#fff;"><div style="font-weight:950;font-size:15px;">${z.name||'ZONE'}</div></div>`);
        zoneTasks.forEach(t=>{
          const freqLabel=FREQ_LABELS[t.freq||'weekly']||'';
          parts.push(`<div class="task-card">
            ${t.time?`<span class="time-chip">${t.time}</span>`:''}
            <div style="flex:1;min-width:0;">
              <div style="font-weight:900;font-size:14px;">${t.name||''} <span class="chip" style="background:#f1f5f9;color:#64748b;font-size:10px;">${freqLabel}</span></div>
              ${t.notes?`<div class="small" style="margin-top:2px;">${t.notes}</div>`:''}
            </div>
            <div style="width:32px;height:32px;border-radius:50%;background:#e2e8f0;display:flex;align-items:center;justify-content:center;color:#94a3b8;"><i class="fas fa-clock"></i></div>
          </div>`);
        });
        parts.push('<div style="margin-bottom:8px;"></div>');
      });

      const unzoned=tasks.filter(t=>!zones.find(z=>String(z.id)===String(t.zoneId)));
      if(unzoned.length){
        parts.push(`<div style="background:#475569;border-radius:14px;padding:14px 16px;margin-bottom:4px;color:#fff;"><div style="font-weight:950;">SANS ZONE</div></div>`);
        unzoned.forEach(t=>{parts.push(`<div class="task-card"><div style="flex:1;font-weight:900;">${t.name||''}</div></div>`);});
      }
      wrap.innerHTML=parts.join('');
    },

    renderConfig(){
      const wrap=document.getElementById('todo-config');if(!wrap)return;
      const zones=window.app.data.todo.zones||[];
      const tasks=window.app.data.todo.tasks||[];
      const FREQ_LABELS={daily:'Quotidien',weekly:'Hebdo',monthly:'Mensuel',yearly:'Annuel'};
      const parts=[`<button class="btn todo" style="margin-bottom:15px;" onclick="app.todo.openZone()"><i class="fas fa-plus"></i> Créer une zone</button>`];
      if(!zones.length){
        parts.push(`<div class="empty-state"><i class="fas fa-map-marker-alt"></i>Aucune zone créée.<br><span class="small">Une zone = un espace physique (Réserve, Rayon, Caisse…)</span></div>`);
      } else {
        zones.forEach(z=>{
          const zt=tasks.filter(t=>String(t.zoneId)===String(z.id));
          parts.push(`
            <div class="card" style="border-left:5px solid ${z.color||'var(--todo)'};">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;">
                <div>
                  <div style="font-weight:950;font-size:16px;color:${z.color||'var(--todo)'};">${z.name||'Zone'}</div>
                  <div class="small">${zt.length} tâche${zt.length>1?'s':''}</div>
                </div>
                <div style="display:flex;gap:8px;">
                  <button class="icon-btn todo" onclick="app.todo.openZone('${z.id}')"><i class="fas fa-pen"></i></button>
                  <button class="icon-btn todo" onclick="app.todo.openTask(null,'${z.id}')" title="Ajouter tâche"><i class="fas fa-plus"></i></button>
                </div>
              </div>
          `);
          if(zt.length){
            zt.sort((a,b)=>(a.time||'').localeCompare(b.time||'')).forEach(t=>{
              const freqLabel=FREQ_LABELS[t.freq||'weekly']||'Hebdo';
              let schedLabel='';
              if(!t.freq||t.freq==='weekly')schedLabel=(t.days||[]).map(d=>DAY_LABELS[d]).join(' ');
              else if(t.freq==='daily')schedLabel='Tous les jours';
              else if(t.freq==='monthly')schedLabel='Jours: '+(t.monthDays||[]).join(', ');
              else if(t.freq==='yearly')schedLabel=t.yearlyDate||'?/?';
              parts.push(`
                <div class="list-item" style="min-height:60px;border-left:3px solid ${z.color||'var(--todo)'};">
                  <div style="flex:1;min-width:0;">
                    <div style="font-weight:900;font-size:14px;">${t.time?`<span class="time-chip" style="font-size:11px;margin-right:6px;">${t.time}</span>`:''}${t.name||''}</div>
                    <div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap;align-items:center;">
                      <span class="chip" style="background:#ede9fe;color:#5b21b6;">${freqLabel}</span>
                      <span class="small">${schedLabel}</span>
                    </div>
                    ${t.notes?`<div class="small" style="margin-top:3px;">${t.notes}</div>`:''}
                  </div>
                  <button class="icon-btn todo" style="flex-shrink:0;" onclick="app.todo.openTask('${t.id}')"><i class="fas fa-pen"></i></button>
                </div>
              `);
            });
          } else {
            parts.push(`<div class="small" style="text-align:center;padding:10px;color:#cbd5e1;">Aucune tâche — <span style="color:var(--todo);cursor:pointer;" onclick="app.todo.openTask(null,'${z.id}')">+ ajouter</span></div>`);
          }
          parts.push('</div>');
        });
      }
      wrap.innerHTML=parts.join('');
    },

    renderHistory:async function(){
      const wrap=document.getElementById('todo-history');if(!wrap)return;
      wrap.innerHTML=`<div style="text-align:center;padding:20px;"><i class="fas fa-spinner fa-spin" style="font-size:30px;color:var(--todo);"></i></div>`;
      try{
        const sevenDaysAgo=new Date();sevenDaysAgo.setDate(sevenDaysAgo.getDate()-6);
        const cutStr=`${sevenDaysAgo.getFullYear()}-${String(sevenDaysAgo.getMonth()+1).padStart(2,'0')}-${String(sevenDaysAgo.getDate()).padStart(2,'0')}`;
        const q=query(colTodoLogs,where("date",">=",cutStr),orderBy("date","desc"),limit(500));
        const snap=await getDocs(q);
        const logs=[];snap.forEach(d=>logs.push({_id:d.id,...d.data()}));
        if(!logs.length){wrap.innerHTML=`<div class="empty-state"><i class="fas fa-clock-rotate-left"></i>Aucun historique cette semaine.</div>`;return;}
        const byDay={};
        logs.forEach(l=>{if(!byDay[l.date])byDay[l.date]=[];byDay[l.date].push(l);});
        const parts=[];
        Object.keys(byDay).sort().reverse().forEach(day=>{
          const d=new Date(day+'T12:00:00');
          const label=d.toLocaleDateString('fr',{weekday:'long',day:'numeric',month:'short'});
          const dl=byDay[day];
          const byZone={};dl.forEach(l=>{const k=l.zoneName||'Sans zone';if(!byZone[k])byZone[k]=[];byZone[k].push(l);});
          parts.push(`<div class="group-header" style="background:var(--todo)"><span>${label}</span><span class="small" style="color:rgba(255,255,255,.8)">${dl.length} tâche${dl.length>1?'s':''}</span></div>`);
          Object.keys(byZone).sort().forEach(zn=>{
            parts.push(`<div style="padding:4px 0 4px 10px;font-weight:800;font-size:12px;color:var(--todo);text-transform:uppercase;">${zn}</div>`);
            byZone[zn].sort((a,b)=>(a.ts||0)-(b.ts||0)).forEach(l=>{
              parts.push(`<div style="padding:8px 10px;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between;">
                <div><div style="font-weight:900;font-size:13px;">${l.taskName||''}</div><div class="small"><i class="fas fa-user"></i> ${l.user||''}</div></div>
                <div class="small" style="white-space:nowrap;color:var(--todo);font-weight:800;">${formatDate(l.ts)}</div>
              </div>`);
            });
          });
        });
        wrap.innerHTML=parts.join('');
      }catch(e){wrap.innerHTML=`<div class="empty-state"><i class="fas fa-circle-exclamation"></i>Impossible de charger l'historique.</div>`;}
    },

    // ── ZONE MODAL ──
    openZone(id=null){
      const m=document.getElementById('modal-todo-zone');m.classList.remove('hidden');
      document.getElementById('todo-zone-modal-title').innerHTML=id?'<i class="fas fa-pen"></i> Modifier Zone':'<i class="fas fa-plus"></i> Créer une Zone';
      document.getElementById('tz-del-btn').style.display=id?'block':'none';
      document.getElementById('tz-id').value=id||'';
      const grid=document.getElementById('tz-color-grid');
      const cur=id?(window.app.data.todo.zones||[]).find(z=>String(z.id)===String(id))?.color||ZONE_COLORS[0]:ZONE_COLORS[0];
      grid.innerHTML=ZONE_COLORS.map(c=>`<div class="color-swatch ${c===cur?'selected':''}" style="background:${c};" onclick="app.todo._selectColor('${c}',this)"></div>`).join('');
      document.getElementById('tz-color').value=cur;
      if(id){const z=(window.app.data.todo.zones||[]).find(x=>String(x.id)===String(id));document.getElementById('tz-name').value=z?.name||'';}
      else{document.getElementById('tz-name').value='';}
      document.getElementById('err-tz-name').classList.remove('show');document.getElementById('tz-name').classList.remove('invalid');
    },
    _selectColor(color,el){
      document.querySelectorAll('.color-swatch').forEach(s=>s.classList.remove('selected'));
      el.classList.add('selected');document.getElementById('tz-color').value=color;
    },
    saveZone:async function(){
      const name=(document.getElementById('tz-name').value||'').trim().toUpperCase();
      if(!name){document.getElementById('tz-name').classList.add('invalid');document.getElementById('err-tz-name').classList.add('show');return;}
      const id=document.getElementById('tz-id').value;
      const color=document.getElementById('tz-color').value||ZONE_COLORS[0];
      const o={id:id?Number(id):Date.now(),name,color};
      if(id){const idx=(window.app.data.todo.zones||[]).findIndex(z=>String(z.id)===String(id));if(idx>-1)window.app.data.todo.zones[idx]=o;}
      else{if(!window.app.data.todo.zones)window.app.data.todo.zones=[];window.app.data.todo.zones.push(o);}
      spin(true);try{await window.app.save('todo');toast('Zone enregistrée.','ok');}catch(e){toast('Erreur.','err');}finally{spin(false);}
      document.getElementById('modal-todo-zone').classList.add('hidden');this.renderConfig();this.renderToday();
    },
    delZone:async function(){
      const id=document.getElementById('tz-id').value;if(!id)return;
      const ok=await dlgConfirm('Supprimer zone','Supprimer cette zone ? Les tâches de cette zone seront aussi supprimées.');if(!ok)return;
      window.app.data.todo.zones=(window.app.data.todo.zones||[]).filter(z=>String(z.id)!==String(id));
      window.app.data.todo.tasks=(window.app.data.todo.tasks||[]).filter(t=>String(t.zoneId)!==String(id));
      spin(true);try{await window.app.save('todo');toast('Zone supprimée.','ok');}catch(e){toast('Erreur.','err');}finally{spin(false);}
      document.getElementById('modal-todo-zone').classList.add('hidden');this.renderConfig();this.renderToday();
    },

    // ── FREQUENCY HELPERS ──
    _setFreq(freq){
      this._editingFreq=freq;
      ['daily','weekly','monthly','yearly'].forEach(f=>{
        document.getElementById(`freq-${f}-tab`).classList.toggle('active',f===freq);
        document.getElementById(`freq-panel-${f}`).classList.toggle('active',f===freq);
      });
    },
    _renderMonthDaysGrid(){
      const grid=document.getElementById('tt-month-days-grid');if(!grid)return;
      let html='';
      for(let d=1;d<=31;d++){
        const on=this._editingMonthDays.has(d);
        html+=`<button type="button" class="month-day-btn ${on?'on':''}" onclick="app.todo._toggleMonthDay(${d})">${d}</button>`;
      }
      grid.innerHTML=html;
    },
    _toggleMonthDay(d){
      if(this._editingMonthDays.has(d))this._editingMonthDays.delete(d);else this._editingMonthDays.add(d);
      this._renderMonthDaysGrid();
    },

    // ── TASK MODAL ──
    openTask(id=null,defaultZoneId=null){
      const m=document.getElementById('modal-todo-task');m.classList.remove('hidden');
      document.getElementById('todo-task-modal-title').innerHTML=id?'<i class="fas fa-pen"></i> Modifier Tâche':'<i class="fas fa-plus"></i> Créer une Tâche';
      document.getElementById('tt-del-btn').style.display=id?'block':'none';
      document.getElementById('tt-id').value=id||'';
      const zSel=document.getElementById('tt-zone');
      zSel.innerHTML=(window.app.data.todo.zones||[]).map(z=>`<option value="${z.id}">${z.name||'Zone'}</option>`).join('');
      if(id){
        const t=(window.app.data.todo.tasks||[]).find(x=>String(x.id)===String(id));
        if(t){
          zSel.value=String(t.zoneId||'');
          document.getElementById('tt-name').value=t.name||'';
          document.getElementById('tt-time').value=t.time||'';
          document.getElementById('tt-notes').value=t.notes||'';
          const freq=t.freq||'weekly';
          this._editingFreq=freq;
          this._editingTaskDays=new Set((t.days||[]).map(d=>Number(d)));
          this._editingMonthDays=new Set((t.monthDays||[]).map(d=>Number(d)));
          document.getElementById('tt-yearly-date').value=t.yearlyDate||'';
          this._setFreq(freq);
        }
      } else {
        document.getElementById('tt-name').value='';document.getElementById('tt-time').value='';document.getElementById('tt-notes').value='';
        document.getElementById('tt-yearly-date').value='';
        if(defaultZoneId)zSel.value=String(defaultZoneId);
        this._editingFreq='weekly';
        this._editingTaskDays=new Set([1,2,3,4,5]);
        this._editingMonthDays=new Set();
        this._setFreq('weekly');
      }
      this._renderDayPills();
      this._renderMonthDaysGrid();
      document.getElementById('err-tt-name').classList.remove('show');
      document.getElementById('tt-name').classList.remove('invalid');
    },
    _renderDayPills(){
      const row=document.getElementById('tt-days-row');if(!row)return;
      const order=[1,2,3,4,5,6,0];
      row.innerHTML=order.map(d=>{
        const on=this._editingTaskDays.has(d);
        return`<span class="day-pill ${on?'on':'off'}" onclick="app.todo._toggleDay(${d})">${DAY_LABELS[d]}</span>`;
      }).join('');
    },
    _toggleDay(d){
      if(this._editingTaskDays.has(d))this._editingTaskDays.delete(d);else this._editingTaskDays.add(d);
      this._renderDayPills();
    },
    saveTask:async function(){
      const name=(document.getElementById('tt-name').value||'').trim();
      if(!name){document.getElementById('tt-name').classList.add('invalid');document.getElementById('err-tt-name').classList.add('show');return;}
      const freq=this._editingFreq||'weekly';
      // Validate
      if(freq==='weekly'&&!this._editingTaskDays.size){document.getElementById('err-tt-days').classList.add('show');return;}
      if(freq==='monthly'&&!this._editingMonthDays.size){document.getElementById('err-tt-days-m').classList.add('show');return;}
      const id=document.getElementById('tt-id').value;
      const o={
        id:id?Number(id):Date.now(),
        zoneId:Number(document.getElementById('tt-zone').value)||0,
        name,
        time:document.getElementById('tt-time').value||'',
        freq,
        days:freq==='weekly'?[...this._editingTaskDays].sort():[],
        monthDays:freq==='monthly'?[...this._editingMonthDays].sort():[],
        yearlyDate:freq==='yearly'?(document.getElementById('tt-yearly-date').value||''):'',
        notes:(document.getElementById('tt-notes').value||'').trim()
      };
      if(id){const idx=(window.app.data.todo.tasks||[]).findIndex(t=>String(t.id)===String(id));if(idx>-1)window.app.data.todo.tasks[idx]=o;}
      else{if(!window.app.data.todo.tasks)window.app.data.todo.tasks=[];window.app.data.todo.tasks.push(o);}
      spin(true);try{await window.app.save('todo');toast('Tâche enregistrée.','ok');}catch(e){toast('Erreur.','err');}finally{spin(false);}
      document.getElementById('modal-todo-task').classList.add('hidden');this.renderConfig();this.renderToday();window.app.updateHomeBadges();
    },
    delTask:async function(){
      const id=document.getElementById('tt-id').value;if(!id)return;
      const ok=await dlgConfirm('Supprimer tâche','Supprimer cette tâche ?');if(!ok)return;
      window.app.data.todo.tasks=(window.app.data.todo.tasks||[]).filter(t=>String(t.id)!==String(id));
      spin(true);try{await window.app.save('todo');toast('Tâche supprimée.','ok');}catch(e){toast('Erreur.','err');}finally{spin(false);}
      document.getElementById('modal-todo-task').classList.add('hidden');this.renderConfig();this.renderToday();window.app.updateHomeBadges();
    }
  },

  // ══════════════════════════════════════════════════
  // ── RÉCEPTION MODULE ──
  // ══════════════════════════════════════════════════
  reception:{
    _photoData:'',
    _currentSupplierCode:null,
    _currentType:null,

    // Supplier catalog — each can have multiple types
    SUPPLIERS:{
      '011':{name:'COLOMIERS 011', types:['sec','frais','surgele']},
      '392':{name:'PLAISANCE 392', types:['frais','surgele','sec']},
      '032':{name:'ST GILES 032',  types:['surgele','frais','sec']}
    },
    TYPE_CONFIG:{
      frais:   {label:'FRAIS',    icon:'fa-snowflake',    tempMin:0,  tempMax:4,   color:'#065f46', bg:'#d1fae5'},
      surgele: {label:'SURGELÉ',  icon:'fa-temperature-arrow-down', tempMin:-23,tempMax:-18,color:'#1e3a8a', bg:'#dbeafe'},
      sec:     {label:'SEC',      icon:'fa-box',          tempMin:null,tempMax:null,color:'#92400e', bg:'#fef3c7'}
    },

    // Planning des livraisons extrait du fichier logistique
    PLANNING:{
      0:{ // Dimanche
        livraisons:[]
      },
      1:{ // Lundi
        livraisons:[
          {sup:'011',name:'COLOMIERS 011',type:'sec',  label:'Livraison Sec/Épicerie',heure:'09H00-11H00',info:'CDE Mercredi → LIV Lundi'},
          {sup:'032',name:'ST GILES 032', type:'surgele',label:'Livraison Surgelés',heure:'08H30-09H30',info:'CDE Mercredi → LIV Lundi'},
        ]
      },
      2:{ // Mardi
        livraisons:[
          {sup:'011',name:'COLOMIERS 011',type:'sec',  label:'Livraison Sec/Bazar',  heure:'09H00-11H00',info:'CDE Lundi → LIV Mardi a.m'},
          {sup:'392',name:'PLAISANCE 392',type:'frais',label:'Livraison Produits Frais',heure:'7H',       info:'CDE Samedi → LIV Mardi'},
        ]
      },
      3:{ // Mercredi
        livraisons:[
          {sup:'032',name:'ST GILES 032', type:'surgele',label:'Livraison Surgelés', heure:'08H30-09H30',info:'CDE Lundi → LIV Mercredi'},
        ]
      },
      4:{ // Jeudi
        livraisons:[
          {sup:'011',name:'COLOMIERS 011',type:'sec',  label:'Livraison Sec/Épicerie',heure:'09H00-11H00',info:'CDE Mercredi → LIV Jeudi a.m'},
          {sup:'392',name:'PLAISANCE 392',type:'frais',label:'Livraison Produits Frais',heure:'7H',       info:'CDE Mardi → LIV Jeudi'},
        ]
      },
      5:{ // Vendredi
        livraisons:[
          {sup:'032',name:'ST GILES 032', type:'surgele',label:'Livraison Surgelés', heure:'08H30-09H30',info:'CDE Mercredi → LIV Vendredi'},
        ]
      },
      6:{ // Samedi
        livraisons:[
          {sup:'392',name:'PLAISANCE 392',type:'frais',label:'Livraison Produits Frais',heure:'7H',      info:'CDE Mardi → LIV Samedi'},
        ]
      }
    },

    init(){
      const inp=document.getElementById('rec-datetime');
      if(inp)inp.value=tsToInput(Date.now());
      const fi=document.getElementById('rec-photo-input');
      if(fi&&!fi._wired){fi._wired=true;fi.addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;window.app.common.compressImg(f,b64=>{window.app.reception._photoData=b64;const prev=document.getElementById('rec-photo-preview');prev.src=b64;prev.style.display='block';});});}
    },

    selectSupplier(code){
      this._currentSupplierCode=code;
      this._currentType=null;
      // Highlight supplier button
      document.querySelectorAll('.supplier-select-btn').forEach(b=>b.classList.remove('selected'));
      const btn=document.getElementById('sup-btn-'+code);if(btn)btn.classList.add('selected');
      // Hide final selection display, show type grid
      document.getElementById('rec-selected-supplier').style.display='none';
      document.getElementById('rec-temp-section').style.display='none';
      document.getElementById('rec-type-section').style.display='block';
      // Build type buttons
      const sup=this.SUPPLIERS[code];
      const grid=document.getElementById('rec-type-grid');
      grid.innerHTML=sup.types.map(t=>{
        const tc=this.TYPE_CONFIG[t];
        return`<div class="sup-type-btn ${t}" onclick="app.reception.selectType('${t}')" style="border-color:${tc.bg};">
          <i class="fas ${tc.icon}" style="font-size:18px;color:${tc.color};display:block;margin-bottom:4px;"></i>
          <div style="color:${tc.color};font-size:11px;">${tc.label}</div>
        </div>`;
      }).join('');
    },

    selectType(type){
      this._currentType=type;
      const code=this._currentSupplierCode;
      const sup=this.SUPPLIERS[code];
      const tc=this.TYPE_CONFIG[type];
      // Mark type button active
      document.querySelectorAll('.sup-type-btn').forEach(b=>b.classList.remove('on'));
      document.querySelectorAll(`.sup-type-btn.${type}`).forEach(b=>b.classList.add('on'));
      // Hide type grid, show summary
      setTimeout(()=>{
        document.getElementById('rec-type-section').style.display='none';
        document.getElementById('rec-selected-supplier').style.display='block';
        document.getElementById('rec-sup-label').textContent=sup.name+' • '+tc.label;
        let typeLabel='';
        if(type==='sec')typeLabel='SEC — Pas de contrôle température';
        else typeLabel=`${tc.label} — Plage: ${tc.tempMin}°C à ${tc.tempMax}°C`;
        document.getElementById('rec-sup-type-label').textContent=typeLabel;
        // Show/hide temp
        const ts=document.getElementById('rec-temp-section');
        if(type==='sec'){ts.style.display='none';if(document.getElementById('rec-temp'))document.getElementById('rec-temp').value='';}
        else{
          ts.style.display='block';
          document.getElementById('rec-temp-range-label').textContent=`Plage acceptée : ${tc.tempMin}°C à ${tc.tempMax}°C`;
          document.getElementById('rec-temp').placeholder=type==='frais'?'Ex: 2.5':'Ex: -20';
          document.getElementById('rec-temp-status').innerHTML='';
        }
      },120);
    },

    clearSupplier(){
      this._currentSupplierCode=null;this._currentType=null;
      document.querySelectorAll('.supplier-select-btn').forEach(b=>b.classList.remove('selected'));
      document.getElementById('rec-selected-supplier').style.display='none';
      document.getElementById('rec-type-section').style.display='none';
      document.getElementById('rec-temp-section').style.display='none';
    },

    _updateTempStatus(){
      const type=this._currentType;if(!type||type==='sec')return;
      const tc=this.TYPE_CONFIG[type];
      const v=parseFloat(document.getElementById('rec-temp').value);
      const div=document.getElementById('rec-temp-status');
      if(isNaN(v)){div.innerHTML='';return;}
      const ok=v>=tc.tempMin&&v<=tc.tempMax;
      div.innerHTML=ok
        ?`<div style="background:#d1fae5;color:#065f46;padding:10px;border-radius:10px;font-weight:900;margin-bottom:8px;"><i class="fas fa-check-circle"></i> ${v}°C — DANS LA NORME (${tc.tempMin}°C à ${tc.tempMax}°C)</div>`
        :`<div style="background:#fee2e2;color:#991b1b;padding:10px;border-radius:10px;font-weight:900;margin-bottom:8px;"><i class="fas fa-triangle-exclamation"></i> ${v}°C — HORS NORME ! (${tc.tempMin}°C à ${tc.tempMax}°C)</div>`;
    },

    tab(t){
      document.querySelectorAll('#view-reception .tab').forEach(e=>e.classList.remove('active'));
      const tabMap={new:'trec-1',history:'trec-2',planning:'trec-3',tracking:'trec-4'};
      if(document.getElementById(tabMap[t]))document.getElementById(tabMap[t]).classList.add('active');
      document.getElementById('reception-new').classList.toggle('hidden',t!=='new');
      document.getElementById('reception-history').classList.toggle('hidden',t!=='history');
      document.getElementById('reception-planning').classList.toggle('hidden',t!=='planning');
      const trackEl=document.getElementById('reception-tracking');
      if(trackEl)trackEl.classList.toggle('hidden',t!=='tracking');
      if(t==='history')this.renderHistory();
      if(t==='planning')this.renderPlanning();
    },

    renderPlanning(){
      const wrap=document.getElementById('reception-planning');if(!wrap)return;
      const now=new Date();const today=now.getDay();
      const jours=['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
      const TYPE_COLORS={sec:'sec',frais:'frais',surgele:'surgele'};
      const parts=[`
        <div class="card" style="border-left:5px solid var(--reception);margin-bottom:16px;">
          <div style="font-weight:950;font-size:15px;color:var(--reception);margin-bottom:4px;"><i class="fas fa-calendar-alt"></i> Planning des livraisons</div>
          <div class="small">Magasin Express Purpan • Code 32364</div>
          <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px;">
            <span class="sup-badge-sm sup-badge-sec">SEC 09H00-11H00</span>
            <span class="sup-badge-sm sup-badge-frais">FRAIS 07H00</span>
            <span class="sup-badge-sm sup-badge-surgele">SURGELÉ 08H30-09H30</span>
          </div>
        </div>
      `];
      // Show from today cycling through the week
      for(let offset=0;offset<7;offset++){
        const dow=(today+offset)%7;
        const plan=this.PLANNING[dow];
        if(!plan||!plan.livraisons.length)continue;
        const isToday=offset===0;
        const dateLabel=isToday?'Aujourd\'hui':offset===1?'Demain':jours[dow];
        parts.push(`<div class="planning-card${isToday?' today-highlight':''}">
          <div class="planning-day-header">
            ${isToday?'<span style="background:var(--reception);color:#fff;border-radius:6px;padding:2px 8px;font-size:12px;">AUJOURD\'HUI</span>':''}
            <span>${dateLabel}</span>
          </div>`);
        plan.livraisons.forEach(l=>{
          const tc=this.TYPE_CONFIG[l.type]||{};
          parts.push(`<div class="planning-delivery">
            <span class="sup-badge-sm sup-badge-${l.type}">${(tc.label||l.type).toUpperCase()}</span>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:900;font-size:13px;">${l.name}</div>
              <div class="small">${l.label} • ⏰ ${l.heure}</div>
              <div class="small" style="color:#94a3b8;">${l.info}</div>
            </div>
            <button onclick="app.reception.tab('new');setTimeout(()=>app.reception.selectSupplier('${l.sup}'),100);" style="background:var(--reception);color:#fff;border:none;border-radius:8px;padding:6px 10px;font-weight:900;cursor:pointer;font-size:11px;"><i class="fas fa-check"></i></button>
          </div>`);
        });
        parts.push('</div>');
      }
      wrap.innerHTML=parts.join('');
    },

    save:async function(conform){
      const code=this._currentSupplierCode;const type=this._currentType;
      if(!code||!type)return toast('Sélectionnez un fournisseur et un type.','warn');
      const sup=this.SUPPLIERS[code];const tc=this.TYPE_CONFIG[type];
      const product=(document.getElementById('rec-product').value||'').trim();
      if(!product)return toast('Produit requis.','warn');
      const ts=inputToTs(document.getElementById('rec-datetime').value)||Date.now();
      let temp=null;let tempOk=true;
      if(type!=='sec'){
        const tv=document.getElementById('rec-temp').value;
        if(tv===''||isNaN(parseFloat(tv)))return toast('Température requise.','warn');
        temp=parseFloat(tv);tempOk=temp>=tc.tempMin&&temp<=tc.tempMax;
        if(!tempOk&&conform){const ok=await dlgConfirm('Température hors norme','Hors norme. Confirmer quand même CONFORME ?');if(!ok)return;}
      }
      const entry={ts,date:todayStr(),supplier:sup.name,supplierCode:code,supplierType:type,product,temp,tempMin:tc.tempMin,tempMax:tc.tempMax,tempOk,conform,notes:(document.getElementById('rec-notes').value||'').trim(),photo:this._photoData||'',user:window.app.me?.name||(window.app.me?.email||'USER')};
      spin(true);
      try{
        const ref=await addDoc(colReception,entry);
        window.app.data.reception.unshift({_id:ref.id,...entry});
        document.getElementById('rec-product').value='';document.getElementById('rec-notes').value='';
        if(document.getElementById('rec-temp'))document.getElementById('rec-temp').value='';
        document.getElementById('rec-temp-status').innerHTML='';
        document.getElementById('rec-photo-preview').style.display='none';
        document.getElementById('rec-datetime').value=tsToInput(Date.now());
        document.getElementById('rec-photo-input').value='';this._photoData='';
        toast(conform?`✓ ${sup.name} (${tc.label}) — Conforme`:`⚠ ${sup.name} — NON CONFORME`,'ok',4000);
      }catch(e){toast('Erreur sauvegarde.','err');}finally{spin(false);}
    },

    renderHistory(){
      const wrap=document.getElementById('reception-history');if(!wrap)return;
      const logs=(window.app.data.reception||[]).slice().sort((a,b)=>(b.ts||0)-(a.ts||0));
      if(!logs.length){wrap.innerHTML=`<div class="empty-state"><i class="fas fa-truck-ramp-box"></i>Aucun contrôle enregistré.</div>`;return;}
      const byDay={};logs.forEach(l=>{const d=l.date||todayStr();if(!byDay[d])byDay[d]=[];byDay[d].push(l);});
      const parts=[];
      Object.keys(byDay).sort().reverse().forEach(day=>{
        const d=new Date(day+'T12:00:00');
        const label=d.toLocaleDateString('fr',{weekday:'long',day:'numeric',month:'short',year:'numeric'});
        parts.push(`<div class="group-header" style="background:var(--reception)"><span>${label}</span><span class="small" style="color:rgba(255,255,255,.8)">${byDay[day].length} contrôle(s)</span></div>`);
        byDay[day].forEach(l=>{
          const conformBadge=l.conform?`<span class="chip ok"><i class="fas fa-check"></i> CONFORME</span>`:`<span class="chip warn"><i class="fas fa-triangle-exclamation"></i> NON CONFORME</span>`;
          const tc=this.TYPE_CONFIG[l.supplierType]||{color:'#475569'};
          const tempInfo=l.temp!==null&&l.temp!==undefined?`<span style="font-weight:950;color:${l.tempOk!==false?'#10b981':'#ef4444'};font-size:16px;">${l.temp}°C</span> <span class="small">(${l.tempMin??'?'}°C à ${l.tempMax??'?'}°C)</span>`:'<span class="small">Sec — pas de temp.</span>';
          parts.push(`<div class="reception-card">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px;">
              <div style="font-weight:950;font-size:15px;color:${tc.color};">${l.supplier||''} <span class="small">${l.supplierType||''}</span></div>${conformBadge}
            </div>
            <div style="font-size:14px;font-weight:700;margin-bottom:6px;">${l.product||''}</div>
            <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:4px;">${tempInfo}<span class="small">${formatDate(l.ts)}</span><span class="small"><i class="fas fa-user"></i> ${l.user||''}</span></div>
            ${l.notes?`<div class="small" style="margin-top:4px;color:#475569;font-style:italic;">${l.notes}</div>`:''}
            ${l.photo?`<img src="${l.photo}" style="width:100%;max-height:140px;object-fit:contain;border-radius:10px;margin-top:8px;">`:''}</div>`);
        });
      });
      wrap.innerHTML=parts.join('');
    }
  },

  // ══════════════════════════════════════════════════
  // ── INSPECTION MODULE ──
  // ══════════════════════════════════════════════════
  inspection:{
    render:async function(){
      const wrap=document.getElementById('inspection-content');if(!wrap)return;
      wrap.innerHTML=`<div style="text-align:center;padding:30px;"><i class="fas fa-spinner fa-spin" style="font-size:30px;color:var(--primary);"></i></div>`;
      try{
        const today=new Date();today.setHours(0,0,0,0);const todayTs=today.getTime();
        const weekAgo=todayTs-(7*24*60*60*1000);const monthAgo=todayTs-(30*24*60*60*1000);
        const todoLogs=window.app.data.todoLogs||[];const todayTasks=window.app.todo.todayTaskList();
        const todoDone=todoLogs.length;const todoTotal=todayTasks.length;const todoPct=todoTotal>0?Math.round(todoDone/todoTotal*100):0;
        const frigoRem=window.app.frigo.remainingTodayTotal();const frigoTotal=(window.app.data.frigo.fridges||[]).length*(window.app.data.frigo.perDay||2);const frigoDone=frigoTotal-frigoRem;
        const recLogs=(window.app.data.reception||[]).filter(r=>(r.ts||0)>=monthAgo);const recConform=recLogs.filter(r=>r.conform).length;const recNonConform=recLogs.filter(r=>!r.conform).length;
        const fraisAlerts=window.app.data.frais.filter(i=>{const d=new Date(i.date);return!isNaN(d.getTime())&&d<=today;}).length;
        const users=window.app.data.users||[];const frigoLogs7=(window.app.data.frigo.logs||[]).filter(l=>(l.ts||0)>=weekAgo);
        const parts=[];
        parts.push(`<div class="kpi-grid"><div class="kpi-card" style="background:linear-gradient(135deg,var(--todo),#5b21b6);color:#fff;"><div class="kpi-val">${todoPct}%</div><div class="kpi-lbl">CHECK-LIST</div></div><div class="kpi-card" style="background:linear-gradient(135deg,var(--frigo),#0369a1);color:#fff;"><div class="kpi-val">${frigoDone}/${frigoTotal}</div><div class="kpi-lbl">RELEVÉS FRIGO</div></div><div class="kpi-card" style="background:linear-gradient(135deg,var(--reception),#047857);color:#fff;"><div class="kpi-val">${recConform}</div><div class="kpi-lbl">CONF. (30J)</div></div><div class="kpi-card" style="background:linear-gradient(135deg,${recNonConform>0?'#ef4444,#b91c1c':'#6b7280,#374151'});color:#fff;"><div class="kpi-val">${recNonConform}</div><div class="kpi-lbl">NON CONF. (30J)</div></div></div>${fraisAlerts>0?`<div style="background:#fee2e2;border-left:5px solid #ef4444;border-radius:12px;padding:14px;margin-bottom:12px;font-weight:900;color:#991b1b;"><i class="fas fa-triangle-exclamation"></i> ${fraisAlerts} produit(s) frais à DLC !</div>`:''}`);
        parts.push(`<div class="inspection-section"><h4><i class="fas fa-users"></i> Équipe (${users.length})</h4>${users.map(u=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;"><div style="font-weight:800;">${u.name||u.email||'?'} ${u.role==='admin'?'<span class="chip admin">ADMIN</span>':'<span class="chip staff">STAFF</span>'}</div><div class="small">${u.email||''}</div></div>`).join('')}</div>`);
        if(frigoLogs7.length){const avgTemp=(frigoLogs7.reduce((s,l)=>s+(l.temp||0),0)/frigoLogs7.length).toFixed(1);const maxTemp=Math.max(...frigoLogs7.map(l=>l.temp||0)).toFixed(1);const minTemp=Math.min(...frigoLogs7.map(l=>l.temp||0)).toFixed(1);parts.push(`<div class="inspection-section"><h4><i class="fas fa-temperature-half" style="color:var(--frigo);"></i> Températures (7 jours)</h4><div class="kpi-grid"><div class="kpi-card" style="background:#f0f9ff;"><div class="kpi-val" style="color:var(--frigo);font-size:22px;">${avgTemp}°C</div><div class="kpi-lbl" style="color:#0369a1;">MOYENNE</div></div><div class="kpi-card" style="background:#f0f9ff;"><div class="kpi-val" style="color:#ef4444;font-size:22px;">${maxTemp}°C</div><div class="kpi-lbl" style="color:#0369a1;">MAX</div></div></div><div class="small">Min: ${minTemp}°C • ${frigoLogs7.length} relevé(s)</div></div>`);}
        const recNC=(window.app.data.reception||[]).filter(r=>!r.conform&&(r.ts||0)>=monthAgo);
        if(recNC.length){parts.push(`<div class="inspection-section" style="border-left:4px solid #ef4444;"><h4 style="color:#ef4444;"><i class="fas fa-triangle-exclamation"></i> Non-conformités (30J)</h4>${recNC.slice(0,5).map(r=>`<div style="padding:8px 0;border-bottom:1px solid #fee2e2;"><div style="font-weight:800;">${r.supplier||'?'} — ${r.product||'?'}</div><div class="small">${formatDate(r.ts)} • ${r.temp}°C (lim. ${r.tempLimit}°C) • ${r.user||''}</div>${r.notes?`<div class="small" style="color:#7f1d1d;">${r.notes}</div>`:''}</div>`).join('')}${recNC.length>5?`<div class="small" style="text-align:center;margin-top:8px;">+ ${recNC.length-5} autre(s)</div>`:''}</div>`);}
        parts.push(`<div class="inspection-section"><h4><i class="fas fa-file-export"></i> Exporter</h4><button class="export-btn" style="background:linear-gradient(135deg,#0ea5e9,#0369a1);color:#fff;margin-bottom:10px;" onclick="app.inspection.exportCSV('frigo')"><i class="fas fa-temperature-half"></i> Export températures (CSV)</button><button class="export-btn" style="background:linear-gradient(135deg,var(--reception),#047857);color:#fff;margin-bottom:10px;" onclick="app.inspection.exportCSV('reception')"><i class="fas fa-truck-ramp-box"></i> Export réceptions (CSV)</button><button class="export-btn" style="background:linear-gradient(135deg,var(--todo),#5b21b6);color:#fff;margin-bottom:10px;" onclick="app.inspection.exportCSV('todo')"><i class="fas fa-list-check"></i> Export check-list (CSV)</button><button class="export-btn" style="background:linear-gradient(135deg,var(--pvp),#b45309);color:#fff;margin-bottom:10px;" onclick="app.inspection.exportCSV('tracabilite')"><i class="fas fa-camera"></i> Export traçabilités PVP+Salad (CSV)</button></div>`);
        wrap.innerHTML=parts.join('');
      }catch(e){wrap.innerHTML=`<div class="empty-state"><i class="fas fa-circle-exclamation"></i>Erreur de chargement.</div>`;}
    },
    exportCSV(type){
      let rows=[];let filename='';
      if(type==='frigo'){filename='temperatures.csv';rows=[['Frigo','Temperature','Date','Heure','Operateur']];(window.app.data.frigo.logs||[]).slice().sort((a,b)=>(b.ts||0)-(a.ts||0)).forEach(l=>{const d=new Date(l.ts||0);rows.push([l.fridgeName||'',l.temp||'',d.toLocaleDateString('fr'),d.toLocaleTimeString('fr'),l.user||'']);});}
      else if(type==='reception'){filename='receptions.csv';rows=[['Date','Heure','Fournisseur','Produit','Temperature','Limite','Conforme','Operateur','Observations']];(window.app.data.reception||[]).slice().sort((a,b)=>(b.ts||0)-(a.ts||0)).forEach(l=>{const d=new Date(l.ts||0);rows.push([d.toLocaleDateString('fr'),d.toLocaleTimeString('fr'),l.supplier||'',l.product||'',l.temp||'',l.tempLimit||'',l.conform?'OUI':'NON',l.user||'',l.notes||'']);});}
      else if(type==='todo'){filename='checklist.csv';rows=[['Date','Zone','Tache','Operateur','Heure']];(window.app.data.todoLogs||[]).forEach(l=>{const d=new Date(l.ts||0);rows.push([l.date||'',l.zoneName||'',l.taskName||'',l.user||'',d.toLocaleTimeString('fr')]);});}
      else if(type==='tracabilite'){
        filename='tracabilites_pvp_salad.csv';
        rows=[['Module','Produit','Date','Heure','Operateur','Photo URL']];
        // We don't have local trace data — explain
        toast('Les traçabilités sont stockées dans Firebase Storage. Utilisez l\'interface web Firebase pour un export complet.','info',6000);
        rows.push(['INFO','Les photos de traçabilité sont dans Firebase Storage > pvp_trace / salad_trace','','','','']);
        // Export the list of pvp/salad stock items with names as reference
        window.app.data.pvpStock.forEach(s=>{rows.push(['PVP',s.name||'',new Date(s.out||0).toLocaleDateString('fr'),new Date(s.out||0).toLocaleTimeString('fr'),'','Voir Firebase Storage > pvp_trace/'+s.libId]);});
        window.app.data.saladStock.forEach(s=>{rows.push(['SALAD BAR',s.name||'',new Date(s.out||0).toLocaleDateString('fr'),new Date(s.out||0).toLocaleTimeString('fr'),'','Voir Firebase Storage > salad_trace/'+s.libId]);});
      }
      const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(';')).join('\n');
      const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
      const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);
      toast('Export CSV téléchargé.','ok');
    }
  },

  // ══════════════════════════════════════════════════
  // ── ÉTIQUETTES MODULE (Brother TD-2120N) ──
  // ══════════════════════════════════════════════════
  etiquettes:{
    _items:[],

    loadProducts(){
      const today=new Date();today.setHours(23,59,59,999);
      const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);yesterday.setHours(23,59,59,999);
      this._items=window.app.data.frais
        .filter(i=>{const d=new Date(i.date);return!isNaN(d.getTime())&&d<=today;})
        .map(i=>({fraisId:i.id,name:i.name,fam:i.fam||'',qty:Number(i.qty||0),date:i.date,price:'',pct:50,printQty:1,selected:true}));
      this.renderProductList();
    },

    renderProductList(){
      const wrap=document.getElementById('etiq-product-list');if(!wrap)return;
      if(!this._items.length){
        wrap.innerHTML=`<div style="text-align:center;padding:20px;color:#9333ea;"><i class="fas fa-check-circle" style="font-size:30px;margin-bottom:8px;display:block;"></i><div style="font-weight:900;">Aucun produit à DLC aujourd\'hui 🎉</div></div>`;
        document.getElementById('etiq-config-card').style.display='none';
        return;
      }
      wrap.innerHTML=this._items.map((it,idx)=>`
        <div class="etiq-product-row ${it.selected?'selected':''}">
          <div class="etiq-check ${it.selected?'on':''}" onclick="app.etiquettes.toggleItem(${idx})">
            <i class="fas fa-check" style="${it.selected?'':'opacity:0'}"></i>
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:900;font-size:14px;">${it.name}</div>
            <div class="small">${it.fam} • x${it.qty} • DLC: ${new Date(it.date).toLocaleDateString('fr')}</div>
          </div>
        </div>
      `).join('');
      document.getElementById('etiq-config-card').style.display='block';
      this.renderConfigSection();
    },

    toggleItem(idx){this._items[idx].selected=!this._items[idx].selected;this.renderProductList();},

    renderConfigSection(){
      const wrap=document.getElementById('etiq-items-config');if(!wrap)return;
      const selected=this._items.filter(it=>it.selected);
      if(!selected.length){wrap.innerHTML=`<div class="small" style="text-align:center;padding:10px;color:var(--muted);">Sélectionnez des produits ci-dessus</div>`;return;}
      wrap.innerHTML=selected.map(it=>{
        const realIdx=this._items.indexOf(it);
        const prixOrig=parseFloat(it.price||0);
        const prixReduit=it.price?(prixOrig*(1-it.pct/100)).toFixed(2):'';
        return`<div style="background:#faf5ff;border-radius:14px;padding:14px;margin-bottom:12px;border:2px solid #e9d5ff;">
          <div style="font-weight:950;font-size:15px;color:#9333ea;margin-bottom:10px;"><i class="fas fa-tag"></i> ${it.name}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
            <div>
              <label style="font-size:12px;font-weight:800;color:#6b21a8;display:block;margin-bottom:4px;">Prix original (€)</label>
              <input type="number" step="0.01" min="0" placeholder="Ex: 4.90" value="${it.price}" oninput="app.etiquettes.setPrice(${realIdx},this.value)" style="margin:0;padding:10px;border-radius:8px;border:1.5px solid #d8b4fe;font-size:14px;">
            </div>
            <div>
              <label style="font-size:12px;font-weight:800;color:#6b21a8;display:block;margin-bottom:4px;">Réduction %</label>
              <input type="number" min="1" max="99" value="${it.pct}" oninput="app.etiquettes.setPct(${realIdx},this.value)" style="margin:0;padding:10px;border-radius:8px;border:1.5px solid #d8b4fe;font-size:14px;">
            </div>
          </div>
          <div style="margin-bottom:10px;">
            <label style="font-size:12px;font-weight:800;color:#6b21a8;display:block;margin-bottom:4px;">Nb d'étiquettes à imprimer</label>
            <div class="etiq-qty-ctrl">
              <button onclick="app.etiquettes.setPrintQty(${realIdx},${it.printQty-1})">−</button>
              <span style="font-weight:950;font-size:20px;min-width:36px;text-align:center;">${it.printQty}</span>
              <button onclick="app.etiquettes.setPrintQty(${realIdx},${it.printQty+1})">+</button>
              <span class="small" style="margin-left:4px;">/ 50 max</span>
            </div>
          </div>
          ${it.price?`<div class="etiq-label-preview">
            <div class="etiq-name">${it.name}</div>
            <div class="etiq-prix-original">${prixOrig.toFixed(2)} €</div>
            <div class="etiq-prix-reduit">${prixReduit} €</div>
            <div class="etiq-pct">-${it.pct}%</div>
            <div style="font-size:11px;margin-top:6px;opacity:.85;">DLC: ${new Date(it.date).toLocaleDateString('fr')} • TOO GOOD TO GO • ${it.printQty} étiquette(s)</div>
          </div>`:`<div class="small" style="text-align:center;color:#9333ea;opacity:.6;padding:8px;">Entrez un prix pour voir l'aperçu</div>`}
        </div>`;
      }).join('');
    },

    setPrice(idx,v){this._items[idx].price=v;this.renderConfigSection();},
    setPct(idx,v){this._items[idx].pct=Math.max(1,Math.min(99,parseInt(v)||50));this.renderConfigSection();},
    setPrintQty(idx,v){this._items[idx].printQty=Math.max(1,Math.min(50,parseInt(v)||1));this.renderConfigSection();},

    buildZpl(it){
      const prixOrig=parseFloat(it.price||0).toFixed(2);
      const prixReduit=(parseFloat(it.price||0)*(1-it.pct/100)).toFixed(2);
      const dlcStr=new Date(it.date).toLocaleDateString('fr');
      const nameLine1=(it.name||'').substring(0,22);
      const nameLine2=(it.name||'').length>22?(it.name||'').substring(22,44):'';
      // ZPL for Brother TD-2120N 62mm width, 203dpi
      return `^XA^MMT
^PW480
^LL320
^CF0,30^FO15,10^FD${nameLine1}^FS
${nameLine2?`^CF0,30^FO15,45^FD${nameLine2}^FS`:''}
^FO15,${nameLine2?85:55}^GB450,3,3^FS
^CF0,60^FO15,${nameLine2?95:65}^FD${prixReduit} EUR^FS
^CF0,22^FO250,${nameLine2?105:75}^FDau lieu de ${prixOrig} EUR^FS
^FO15,${nameLine2?160:130}^GB450,3,3^FS
^CF0,48^FO15,${nameLine2?170:140}^FD-${it.pct}%^FS
^CF0,22^FO110,${nameLine2?183:153}^FDTOO GOOD TO GO^FS
^CF0,18^FO15,${nameLine2?225:195}^FDDLC: ${dlcStr}^FS
^XZ`;
    },

    printAll:async function(){
      const toprint=this._items.filter(it=>it.selected&&it.price&&parseFloat(it.price)>0);
      if(!toprint.length)return toast('Sélectionnez des produits avec un prix valide.','warn');
      const ip=(document.getElementById('etiq-printer-ip')?.value||'').trim();
      const port=parseInt(document.getElementById('etiq-printer-port')?.value||'9100');
      let allZpl='';
      toprint.forEach(it=>{for(let i=0;i<it.printQty;i++)allZpl+=this.buildZpl(it)+'\n';});
      const totalLabels=toprint.reduce((s,it)=>s+it.printQty,0);

      if(!ip){
        toast(`Pas d'IP configurée — téléchargement ZPL (${totalLabels} étiquettes).`,'warn',5000);
        this._downloadZpl(allZpl,totalLabels);return;
      }
      toast(`Envoi de ${totalLabels} étiquette(s) vers ${ip}:${port}…`,'info',3000);
      try{
        const resp=await fetch(`http://${ip}/print`,{method:'POST',headers:{'Content-Type':'text/plain','Accept':'*/*'},body:allZpl,signal:AbortSignal.timeout(10000)});
        if(resp.ok){toast(`✓ ${totalLabels} étiquette(s) imprimée(s) !`,'ok',4000);}
        else{throw new Error('HTTP '+resp.status);}
      }catch(e){
        toast('Connexion imprimante échouée — téléchargement ZPL.','warn',4000);
        this._downloadZpl(allZpl,totalLabels);
      }
    },

    _downloadZpl(zpl,n){
      const blob=new Blob([zpl],{type:'application/octet-stream'});
      const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`etiquettes_${n}x.zpl`;a.click();URL.revokeObjectURL(url);
    },

    testPrinter:async function(){
      const ip=(document.getElementById('etiq-printer-ip')?.value||'').trim();
      if(!ip)return toast('Entrez l\'IP de l\'imprimante.','warn');
      const port=parseInt(document.getElementById('etiq-printer-port')?.value||'9100');
      const status=document.getElementById('etiq-printer-status');
      status.textContent='Test en cours…';status.style.color='#f59e0b';
      try{
        const r=await fetch(`http://${ip}/`,{method:'HEAD',mode:'no-cors',signal:AbortSignal.timeout(4000)});
        status.textContent=`✓ Imprimante accessible — ${ip}:${port}`;status.style.color='#10b981';
        toast('Imprimante accessible !','ok');
      }catch(e){
        status.textContent=`✗ Non accessible — vérifiez IP et réseau`;status.style.color='#ef4444';
        toast('Imprimante non accessible. Vérifiez l\'IP et le réseau Wi-Fi.','warn',5000);
      }
    }
  },

  // ══════════════════════════════════════════════════
  // ── PLANNING RH MODULE — V10 ──
  // ══════════════════════════════════════════════════
  planning:{
    _weekOffset:0,
    _employees:[],
    _currentTab:'grid',
    _postColors:{
      CAISSE:'#3b82f6',RAYON:'#10b981',RÉCEPTION:'#f59e0b',MANAGE:'#8b5cf6',
      MÉNAGE:'#64748b',FERMETURE:'#ef4444',OUVERTURE:'#0891b2',AUTRE:'#475569'
    },

    // ── MODÈLES RH LÉGAUX (inviolables, basés Code du travail) ──
    HR_LEGAL:{
      'Apprenti Mineur':{
        label:'Apprenti Mineur',icon:'👶',color:'#7c3aed',
        maxHoursDay:8,maxHoursWeek:35,minRestHours:12,minRestWeekHours:48,
        breakAfterH:4.5,breakMinutes:30,maxRestDaysWeek:2,
        nightBan:{start:'22:00',end:'06:00'},
        desc:'Code trav. L3163 — Max 8h/j · 35h/sem · Repos 12h · Interdit 22h–6h'
      },
      'Apprenti Majeur':{
        label:'Apprenti Majeur',icon:'🎓',color:'#0891b2',
        maxHoursDay:10,maxHoursWeek:48,minRestHours:11,minRestWeekHours:35,
        breakAfterH:6,breakMinutes:20,maxRestDaysWeek:2,
        desc:'Code trav. L3121-16 — Max 10h/j · 48h/sem · Pause 20min après 6h'
      },
      'CDI Temps Partiel':{
        label:'CDI Temps Partiel',icon:'🕐',color:'#d97706',
        maxHoursDay:10,maxHoursWeek:44,minRestHours:11,minRestWeekHours:35,
        breakAfterH:6,breakMinutes:20,minContractH:24,maxRestDaysWeek:2,
        desc:'Code trav. L3123 — Min 24h/sem · Heures compl. +10% (>10%) +25% (>1/10)'
      },
      'CDI Temps Complet':{
        label:'CDI Temps Complet',icon:'⭐',color:'#059669',
        maxHoursDay:10,maxHoursWeek:48,minRestHours:11,minRestWeekHours:35,
        breakAfterH:6,breakMinutes:20,refH:35,overtimeThreshold:35,maxRestDaysWeek:2,
        desc:'Code trav. L3121 — Réf. 35h · H.sup: +25% (≤43h) · +50% (>43h)'
      }
    },

    _hrProfiles:{},
    _docRef:null,
    _rhSaveTimer:null,

    // ── LOAD / SAVE ──
    async _load(){
      try{
        const{doc,getDoc}=window._fbChat;
        const ref=doc(window._db,'store_master','PLANNING_RH');
        this._docRef=ref;
        const snap=await getDoc(ref);
        if(snap.exists()){
          const d=snap.data();
          this._employees=d.employees||[];
          this._hrProfiles=d.hrProfiles||JSON.parse(JSON.stringify(this.HR_LEGAL));
        } else {
          this._hrProfiles=JSON.parse(JSON.stringify(this.HR_LEGAL));
        }
      }catch(e){
        try{const s=JSON.parse(localStorage.getItem('planning_employees')||'[]');if(s.length)this._employees=s;}catch(e2){}
        try{this._hrProfiles=JSON.parse(localStorage.getItem('planning_hrprofiles')||'null')||JSON.parse(JSON.stringify(this.HR_LEGAL));}catch(e2){this._hrProfiles=JSON.parse(JSON.stringify(this.HR_LEGAL));}
      }
    },
    async _save(){
      const data={employees:this._employees,hrProfiles:this._hrProfiles,updatedAt:Date.now()};
      try{localStorage.setItem('planning_employees',JSON.stringify(this._employees));localStorage.setItem('planning_hrprofiles',JSON.stringify(this._hrProfiles));}catch(e){}
      try{const{doc,setDoc}=window._fbChat;const ref=doc(window._db,'store_master','PLANNING_RH');await setDoc(ref,data);}catch(e){}
    },

    // ── DATES ──
    getWeekDates(offset){
      const o=offset!==undefined?offset:this._weekOffset;
      const now=new Date();const day=now.getDay();
      const mondayOffset=day===0?-6:1-day;
      const monday=new Date(now);monday.setDate(now.getDate()+mondayOffset+o*7);monday.setHours(0,0,0,0);
      const dates=[];for(let i=0;i<7;i++){const d=new Date(monday);d.setDate(monday.getDate()+i);dates.push(d);}
      return dates;
    },
    prevWeek(){this._weekOffset--;this.render();},
    nextWeek(){this._weekOffset++;this.render();},

    // ── HOURS ──
    getShiftHours(shift){
      if(!shift||shift.type==='rest'||shift.type==='leave'||!shift.start||!shift.end)return 0;
      const[sh,sm]=shift.start.split(':').map(Number);const[eh,em]=shift.end.split(':').map(Number);
      let h=(eh*60+em-sh*60-sm)/60;if(h<0)h+=24;return Math.max(0,h);
    },
    _autoBreak(h,profile){
      if(h<=0)return 0;
      if(profile&&profile.breakAfterH&&h>=profile.breakAfterH)return profile.breakMinutes||20;
      if(h>=6)return 20;
      return 0;
    },

    // ── VALIDATE ──
    validateSchedule(emp){
      const dates=this.getWeekDates();const warnings=[];let totalHours=0;let restDays=0;
      const profile=emp.hrProfile?this._hrProfiles[emp.hrProfile]:null;
      const maxDay=profile?profile.maxHoursDay:10;
      const maxWeek=profile?profile.maxHoursWeek:48;
      dates.forEach(date=>{
        const key=date.toISOString().slice(0,10);const shift=emp.schedule?.[key];
        if(!shift||shift.type==='rest'||shift.type==='leave'){restDays++;return;}
        const h=this.getShiftHours(shift);
        if(h>maxDay)warnings.push(`${date.toLocaleDateString('fr',{weekday:'short'})}: >${maxDay}h`);
        if(profile?.nightBan&&shift.start&&shift.end){
          if(shift.start<'06:00'||shift.start>='22:00'||shift.end>'22:00')warnings.push(`Nuit interdit ${date.toLocaleDateString('fr',{weekday:'short'})}`);
        }
        if(emp.workFrom&&shift.start&&shift.start<emp.workFrom)warnings.push(`${date.toLocaleDateString('fr',{weekday:'short'})}: avant ${emp.workFrom}`);
        if(emp.workTo&&shift.end&&shift.end>emp.workTo)warnings.push(`${date.toLocaleDateString('fr',{weekday:'short'})}: après ${emp.workTo}`);
        totalHours+=h;
      });
      if(restDays<2)warnings.push(`${restDays} repos (min 2)`);
      if(totalHours>maxWeek)warnings.push(`${totalHours.toFixed(0)}h > ${maxWeek}h max`);
      return{totalHours,restDays,warnings};
    },

    // ── TABS ──
    switchTab(t){
      this._currentTab=t;
      ['grid','recap','rh'].forEach(tab=>{
        document.getElementById('plan-panel-'+tab)?.classList.toggle('hidden',tab!==t);
        const btn=document.getElementById('plan-tab-'+tab);
        if(btn){btn.classList.toggle('active',tab===t);}
      });
      if(t==='grid')this.render();
      else if(t==='recap')this.renderRecap('week');
      else if(t==='rh')this.renderRH();
    },

    // ══ RENDER GRILLE ══
    render:async function(){
      if(!this._employees.length&&!this._loaded){this._loaded=true;await this._load();}
      const dates=this.getWeekDates();
      const labelEl=document.getElementById('plan-week-label');
      if(labelEl){const opts={day:'2-digit',month:'2-digit'};labelEl.textContent=`${dates[0].toLocaleDateString('fr',opts)} – ${dates[6].toLocaleDateString('fr',opts)}`;}
      const wrap=document.getElementById('plan-employees');if(!wrap)return;
      const DAY_SHORT=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
      const today=new Date().toISOString().slice(0,10);

      if(!this._employees.length){
        wrap.innerHTML=`<div class="empty-state"><i class="fas fa-users-slash"></i><br>Aucun employé.<br>Cliquez <b>+</b> pour ajouter.</div>`;
        document.getElementById('plan-summary').style.display='none';return;
      }

      const headerHtml=`<div class="plan-grid-row plan-header-row">
        <div class="plan-emp-col"></div>
        ${dates.map((d,i)=>{const isT=d.toISOString().slice(0,10)===today;return`<div class="plan-day-header ${isT?'today':''}"><div class="plan-day-name">${DAY_SHORT[i]}</div><div class="plan-day-num">${d.getDate()}</div></div>`;}).join('')}
        <div class="plan-total-col">Total</div>
      </div>`;

      const rowsHtml=this._employees.map(emp=>{
        const{totalHours,restDays,warnings}=this.validateSchedule(emp);
        const col=emp.color||'#003896';
        const initials=(emp.name||'?').split(' ').map(x=>x[0]||'').join('').toUpperCase().slice(0,2);
        const profile=emp.hrProfile?this._hrProfiles[emp.hrProfile]:null;

        const cells=dates.map(date=>{
          const key=date.toISOString().slice(0,10);const isT=key===today;
          const shift=emp.schedule?.[key];
          const isVac=this._isVacation(emp,key);
          if(isVac&&(!shift||shift.type==='rest')){
            return`<div class="plan-cell leave ${isT?'today':''}" data-emp="${emp.id}" data-key="${key}">
              <span style="font-size:14px;">🌴</span><span style="font-size:8px;color:#9d174d;font-weight:900;">CONGÉ</span>
            </div>`;
          }
          if(!shift||shift.type==='rest'){
            return`<div class="plan-cell rest ${isT?'today':''}" data-emp="${emp.id}" data-key="${key}">
              <span class="plan-rest-label">—</span>
            </div>`;
          }
          if(shift.type==='leave'){
            const ll={CP:'🌴CP',RTT:'📅RTT',MALADIE:'🏥',SANS_SOLDE:'💸',FORMATION:'📚'};
            return`<div class="plan-cell leave ${isT?'today':''}" data-emp="${emp.id}" data-key="${key}">
              <span style="font-size:12px;">${ll[shift.leaveType]||'🌴'}</span>
              <span style="font-size:8px;color:#9d174d;font-weight:900;">${shift.leaveType||'CONGÉ'}</span>
            </div>`;
          }
          const h=this.getShiftHours(shift);
          const c=this._postColors[shift.post||'AUTRE']||'#475569';
          const brk=shift.breakMin!==undefined?shift.breakMin:this._autoBreak(h,profile);
          return`<div class="plan-cell work ${isT?'today':''}" style="--shift-color:${c};" data-emp="${emp.id}" data-key="${key}" data-movable="1">
            <div class="plan-shift-post" style="background:${c}20;color:${c};">${shift.post||'TRAVAIL'}</div>
            <div class="plan-shift-times">${shift.start}–${shift.end}</div>
            <div class="plan-shift-h">${h.toFixed(1)}h${brk?` ☕${brk}'`:''}</div>
          </div>`;
        }).join('');

        const profileChip=profile
          ?`<span class="hr-profile-chip" onclick="event.stopPropagation();app.planning.openEmpSettings('${emp.id}')">${profile.icon} ${profile.label}</span>`
          :`<span class="hr-profile-chip" onclick="event.stopPropagation();app.planning.openEmpSettings('${emp.id}')"><i class='fas fa-gear' style='font-size:9px;'></i> Paramètres</span>`;

        return`<div class="plan-grid-row ${warnings.length?'has-warn':''}">
          <div class="plan-emp-col" style="cursor:pointer;" onclick="app.planning.openEmpSettings('${emp.id}')">
            <div class="plan-avatar" style="background:${col};">${initials}</div>
            <div class="plan-emp-info">
              <div class="plan-emp-name">${emp.name}</div>
              <div class="plan-emp-contract" style="font-size:10px;">${emp.rate?emp.rate+'€/h · ':''}${emp.contract||''}</div>
              ${profileChip}
            </div>
          </div>
          ${cells}
          <div class="plan-total-col">
            <div class="plan-total-h" style="color:${totalHours>40?'#dc2626':totalHours>35?'#d97706':'#059669'}">${totalHours.toFixed(0)}h</div>
            <div class="plan-rest-badge ${restDays>=2?'ok':'warn'}">${restDays}R</div>
          </div>
        </div>
        ${warnings.length?`<div class="plan-warn-row"><i class="fas fa-triangle-exclamation"></i> ${warnings.join(' · ')}</div>`:''}`;
      }).join('');

      const dayTotals=dates.map(date=>{
        const key=date.toISOString().slice(0,10);
        const tot=this._employees.reduce((s,e)=>{const sh=e.schedule?.[key];return s+(sh?.type==='work'?this.getShiftHours(sh):0);},0);
        const cnt=this._employees.filter(e=>e.schedule?.[key]?.type==='work').length;
        return`<div class="plan-day-footer"><div class="plan-day-count">${cnt}p</div><div class="plan-day-hours">${tot.toFixed(0)}h</div></div>`;
      }).join('');
      const footerHtml=`<div class="plan-grid-row plan-footer-row">
        <div class="plan-emp-col" style="font-size:10px;font-weight:900;color:#64748b;text-align:center;">PAR JOUR</div>
        ${dayTotals}
        <div class="plan-total-col"></div>
      </div>`;

      wrap.innerHTML=headerHtml+rowsHtml+footerHtml;
      this._bindCells(wrap);

      const tw=this._employees.reduce((s,e)=>s+this.validateSchedule(e).totalHours,0);
      const se=document.getElementById('plan-summary'),sc=document.getElementById('plan-summary-content');
      if(se&&sc){se.style.display='block';
        const costTotal=this._employees.reduce((s,e)=>s+this.validateSchedule(e).totalHours*(e.rate||0),0);
        sc.innerHTML=`<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
          <div style="background:#eff6ff;border-radius:10px;padding:10px;text-align:center;"><div style="font-size:22px;font-weight:950;color:#0891b2;">${this._employees.length}</div><div style="font-size:11px;color:#64748b;">Employés</div></div>
          <div style="background:#f0fdf4;border-radius:10px;padding:10px;text-align:center;"><div style="font-size:22px;font-weight:950;color:#059669;">${tw.toFixed(0)}h</div><div style="font-size:11px;color:#64748b;">Total sem.</div></div>
          <div style="background:#fdf4ff;border-radius:10px;padding:10px;text-align:center;"><div style="font-size:20px;font-weight:950;color:#7c3aed;">${costTotal.toFixed(0)}€</div><div style="font-size:11px;color:#64748b;">Coût brut</div></div>
        </div>`;
      }
    },

    // ── BIND CELLS: tap + touch drag + context menu ──
    _bindCells(wrap){
      let dragEl=null,dragEmpId=null,dragKey=null,ghost=null,overEl=null;

      // Context menu div
      let ctxMenu=document.getElementById('plan-ctx-menu');
      if(!ctxMenu){
        ctxMenu=document.createElement('div');ctxMenu.id='plan-ctx-menu';
        ctxMenu.style.cssText='position:fixed;z-index:99999;background:#fff;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.2);padding:8px;min-width:180px;display:none;';
        document.body.appendChild(ctxMenu);
        document.addEventListener('click',()=>{ctxMenu.style.display='none';},{passive:true});
      }

      wrap.querySelectorAll('.plan-cell').forEach(el=>{
        // Tap to edit
        el.addEventListener('click',()=>{
          if(el._dragged){el._dragged=false;return;}
          const empId=el.dataset.emp;const key=el.dataset.key;
          if(empId&&key)this.editShift(empId,key);
        });

        // Right-click context menu
        el.addEventListener('contextmenu',(e)=>{
          e.preventDefault();
          const empId=el.dataset.emp;const key=el.dataset.key;
          if(!empId||!key)return;
          const shift=this._employees.find(emp=>String(emp.id)===String(empId))?.schedule?.[key];
          const isWork=shift?.type==='work';
          ctxMenu.innerHTML=`
            <div style="font-size:11px;font-weight:900;color:#94a3b8;padding:4px 10px 8px;">Actions rapides</div>
            <div class="ctx-item" onclick="app.planning.editShift('${empId}','${key}');document.getElementById('plan-ctx-menu').style.display='none'" style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;cursor:pointer;font-weight:800;font-size:13px;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
              <i class="fas fa-pen" style="color:#0891b2;width:16px;"></i> Modifier
            </div>
            ${isWork?`<div class="ctx-item" onclick="app.planning._duplicateShiftDirect('${empId}','${key}');document.getElementById('plan-ctx-menu').style.display='none'" style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;cursor:pointer;font-weight:800;font-size:13px;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
              <i class="fas fa-clone" style="color:#059669;width:16px;"></i> Dupliquer
            </div>`:'' }
            <div class="ctx-item" onclick="app.planning._deleteShiftDirect('${empId}','${key}');document.getElementById('plan-ctx-menu').style.display='none'" style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;cursor:pointer;font-weight:800;font-size:13px;" onmouseover="this.style.background='#fff1f2'" onmouseout="this.style.background='transparent'">
              <i class="fas fa-trash" style="color:#ef4444;width:16px;"></i> Supprimer
            </div>`;
          const x=Math.min(e.clientX,window.innerWidth-200);
          const y=Math.min(e.clientY,window.innerHeight-200);
          ctxMenu.style.left=x+'px';ctxMenu.style.top=y+'px';ctxMenu.style.display='block';
          e.stopPropagation();
        });

        // Touch drag for movable cells
        if(!el.dataset.movable)return;
        let longPress=null;
        el.addEventListener('touchstart',(e)=>{
          longPress=setTimeout(()=>{
            dragEl=el;dragEmpId=el.dataset.emp;dragKey=el.dataset.key;
            const t=e.touches[0];
            ghost=el.cloneNode(true);
            ghost.style.cssText=`position:fixed;opacity:.85;pointer-events:none;z-index:99999;border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.35);width:${el.offsetWidth}px;transform:scale(1.05);`;
            document.body.appendChild(ghost);
            ghost.style.left=(t.clientX-el.offsetWidth/2)+'px';ghost.style.top=(t.clientY-50)+'px';
            el.classList.add('dragging');
            navigator.vibrate?.(40);
          },400);
        },{passive:true});

        el.addEventListener('touchmove',(e)=>{
          clearTimeout(longPress);longPress=null;
          if(!ghost||!dragEl)return;
          e.preventDefault();
          const t=e.touches[0];
          ghost.style.left=(t.clientX-ghost.offsetWidth/2)+'px';
          ghost.style.top=(t.clientY-60)+'px';
          if(overEl)overEl.classList.remove('drag-over');
          const hit=document.elementFromPoint(t.clientX,t.clientY);
          overEl=hit?.closest?.('.plan-cell');
          if(overEl&&overEl!==dragEl)overEl.classList.add('drag-over');
        },{passive:false});

        el.addEventListener('touchend',()=>{
          clearTimeout(longPress);longPress=null;
          if(ghost){ghost.remove();ghost=null;}
          if(dragEl){dragEl.classList.remove('dragging');dragEl._dragged=!!overEl&&overEl!==dragEl;}
          if(overEl)overEl.classList.remove('drag-over');
          if(dragEl&&overEl&&overEl!==dragEl){
            const toEmpId=overEl.dataset.emp;const toKey=overEl.dataset.key;
            if(toEmpId&&toKey)this._swapShifts(dragEmpId,dragKey,toEmpId,toKey);
          }
          dragEl=null;dragEmpId=null;dragKey=null;overEl=null;
        },{passive:true});
      });
    },

    async _swapShifts(fromEmpId,fromKey,toEmpId,toKey){
      const fromEmp=this._employees.find(e=>String(e.id)===String(fromEmpId));
      const toEmp=this._employees.find(e=>String(e.id)===String(toEmpId));
      if(!fromEmp||!toEmp)return;
      const fromShift=fromEmp.schedule?.[fromKey];if(!fromShift||fromShift.type!=='work')return;
      const toShift=toEmp.schedule?.[toKey];
      if(!fromEmp.schedule)fromEmp.schedule={};if(!toEmp.schedule)toEmp.schedule={};
      toEmp.schedule[toKey]={...fromShift};
      if(toShift&&toShift.type==='work'){fromEmp.schedule[fromKey]={...toShift};}
      else{fromEmp.schedule[fromKey]={type:'rest'};}
      await this._save();this.render();
      toast('Shift déplacé ✓','ok',2000);
    },

    _isVacation(emp,key){
      if(!emp.vacances?.length)return false;
      return emp.vacances.some(v=>v.from&&v.to&&key>=v.from&&key<=v.to);
    },

    // ── EDIT SHIFT ──
    editShift(empId,dateKey){
      const emp=this._employees.find(e=>String(e.id)===String(empId));if(!emp)return;
      if(!emp.schedule)emp.schedule={};
      const shift=emp.schedule[dateKey];
      const isVac=this._isVacation(emp,dateKey);
      if(isVac&&(!shift||shift.type==='rest')){
        toast('🌴 Date bloquée par congés. Modifiez les paramètres employé pour changer.','warn',3500);return;
      }
      const isRest=!shift||shift.type==='rest';
      const isLeave=shift?.type==='leave';
      const dateLabel=new Date(dateKey+'T12:00:00').toLocaleDateString('fr',{weekday:'long',day:'numeric',month:'long'});
      const profile=emp.hrProfile?this._hrProfiles[emp.hrProfile]:null;

      document.getElementById('shift-modal-emp').textContent=emp.name+' — '+dateLabel;
      document.getElementById('shift-modal-rest').checked=isRest&&!isLeave;
      document.getElementById('shift-modal-leave').checked=isLeave;
      document.getElementById('shift-leave-type').classList.toggle('hidden',!isLeave);
      if(isLeave)document.getElementById('shift-modal-leave-type').value=shift.leaveType||'CP';
      document.getElementById('shift-modal-fields').style.display=(isRest||isLeave)?'none':'block';
      document.getElementById('shift-modal-start').value=shift?.start||emp.workFrom||'09:00';
      document.getElementById('shift-modal-end').value=shift?.end||emp.workTo||'17:00';
      const h=this.getShiftHours(shift);
      const brk=shift?.breakMin!==undefined?shift.breakMin:this._autoBreak(h,profile);
      document.getElementById('shift-modal-break').value=brk>0?brk:'';
      this.updateBreakHint();

      const currentPost=shift?.post||'RAYON';
      document.getElementById('shift-modal-post').value=currentPost;
      const postGrid=document.getElementById('shift-post-grid');
      if(postGrid){
        postGrid.innerHTML=Object.entries(this._postColors).map(([p,c])=>`
          <div class="plan-post-btn ${p===currentPost?'selected':''}" style="color:${c};border-color:${p===currentPost?c:'#e2e8f0'};"
            onclick="this.closest('#shift-post-grid').querySelectorAll('.plan-post-btn').forEach(b=>{b.classList.remove('selected');b.style.borderColor='#e2e8f0';});this.classList.add('selected');this.style.borderColor='${c}';document.getElementById('shift-modal-post').value='${p}';">
            ${p}
          </div>`).join('');
      }
      const modal=document.getElementById('modal-shift-editor');
      modal.classList.remove('hidden');modal._empId=empId;modal._dateKey=dateKey;
    },

    onRestToggle(checked){
      document.getElementById('shift-modal-fields').style.display=checked?'none':'block';
      if(checked){document.getElementById('shift-modal-leave').checked=false;document.getElementById('shift-leave-type').classList.add('hidden');}
    },
    onLeaveToggle(checked){
      document.getElementById('shift-leave-type').classList.toggle('hidden',!checked);
      document.getElementById('shift-modal-fields').style.display=checked?'none':'block';
      if(checked)document.getElementById('shift-modal-rest').checked=false;
    },
    updateBreakHint(){
      const s=document.getElementById('shift-modal-start')?.value;
      const e=document.getElementById('shift-modal-end')?.value;
      const hint=document.getElementById('shift-break-hint');if(!hint||!s||!e)return;
      const[sh,sm]=s.split(':').map(Number);const[eh,em]=e.split(':').map(Number);
      let h=(eh*60+em-sh*60-sm)/60;if(h<0)h+=24;
      const auto=h>=6?20:0;
      hint.textContent=auto?`⚠️ Minimum légal: ${auto} min pour ${h.toFixed(1)}h de travail`:'Aucune pause légale obligatoire (moins de 6h)';
      hint.style.color=auto?'#d97706':'#94a3b8';
    },

    saveShift:async function(){
      const modal=document.getElementById('modal-shift-editor');
      const empId=modal._empId;const dateKey=modal._dateKey;
      const emp=this._employees.find(e=>String(e.id)===String(empId));if(!emp)return;
      if(!emp.schedule)emp.schedule={};
      const isRest=document.getElementById('shift-modal-rest').checked;
      const isLeave=document.getElementById('shift-modal-leave').checked;
      if(isLeave){
        emp.schedule[dateKey]={type:'leave',leaveType:document.getElementById('shift-modal-leave-type').value};
      } else if(isRest){
        emp.schedule[dateKey]={type:'rest'};
      } else {
        const start=document.getElementById('shift-modal-start').value;
        const end=document.getElementById('shift-modal-end').value;
        const post=document.getElementById('shift-modal-post').value;
        const breakMin=parseInt(document.getElementById('shift-modal-break').value)||0;
        if(!start||!end)return toast('Heure de début et de fin requises.','warn');
        const profile=emp.hrProfile?this._hrProfiles[emp.hrProfile]:null;
        if(profile?.nightBan&&(start<'06:00'||start>='22:00'||end>'22:00')){
          const ok=await dlgConfirm('Nuit interdite','Ce profil interdit le travail de nuit (22h–6h). Forcer quand même ?',true);if(!ok)return;
        }
        if(emp.workFrom&&start<emp.workFrom||emp.workTo&&end>emp.workTo){
          const ok=await dlgConfirm('Hors plage autorisée','Ce shift dépasse la plage horaire configurée pour cet employé. Continuer ?',false);if(!ok)return;
        }
        emp.schedule[dateKey]={type:'work',start,end,post,breakMin:breakMin||undefined};
      }
      modal.classList.add('hidden');await this._save();this.render();
    },

    deleteShift:async function(){
      const modal=document.getElementById('modal-shift-editor');
      const empId=modal._empId;const dateKey=modal._dateKey;
      const emp=this._employees.find(e=>String(e.id)===String(empId));if(!emp)return;
      if(emp.schedule?.[dateKey])delete emp.schedule[dateKey];
      modal.classList.add('hidden');await this._save();this.render();
      toast('Shift supprimé','ok',2000);
    },

    duplicateShift:async function(){
      const modal=document.getElementById('modal-shift-editor');
      const empId=modal._empId;const dateKey=modal._dateKey;
      const emp=this._employees.find(e=>String(e.id)===String(empId));if(!emp)return;
      const shift=emp.schedule?.[dateKey];if(!shift||shift.type!=='work')return toast('Aucun shift à dupliquer.','warn');
      const dates=this.getWeekDates();
      const idx=dates.findIndex(d=>d.toISOString().slice(0,10)===dateKey);
      let targetKey=null;
      for(let i=idx+1;i<dates.length;i++){
        const k=dates[i].toISOString().slice(0,10);
        if(!this._isVacation(emp,k)&&(!emp.schedule?.[k]||emp.schedule[k].type==='rest')){targetKey=k;break;}
      }
      if(!targetKey)return toast('Aucun jour libre cette semaine.','warn');
      emp.schedule[targetKey]={...shift};
      modal.classList.add('hidden');await this._save();this.render();
      toast(`Shift dupliqué ✓`,'ok',2000);
    },

    closeShiftModal(){document.getElementById('modal-shift-editor').classList.add('hidden');},

    _deleteShiftDirect:async function(empId,dateKey){
      const emp=this._employees.find(e=>String(e.id)===String(empId));if(!emp)return;
      if(!emp.schedule)emp.schedule={};
      emp.schedule[dateKey]={type:'rest'};
      await this._save();this.render();
      toast('Shift supprimé','ok',1500);
    },

    _duplicateShiftDirect:async function(empId,dateKey){
      const emp=this._employees.find(e=>String(e.id)===String(empId));if(!emp)return;
      const shift=emp.schedule?.[dateKey];if(!shift||shift.type!=='work')return;
      const dates=this.getWeekDates();
      const idx=dates.findIndex(d=>d.toISOString().slice(0,10)===dateKey);
      let targetKey=null;
      for(let i=idx+1;i<dates.length;i++){
        const k=dates[i].toISOString().slice(0,10);
        if(!this._isVacation(emp,k)&&(!emp.schedule?.[k]||emp.schedule[k].type==='rest')){targetKey=k;break;}
      }
      if(!targetKey)return toast('Aucun jour libre cette semaine.','warn');
      emp.schedule[targetKey]={...shift};
      await this._save();this.render();
      toast('Shift dupliqué ✓','ok',1500);
    },

    // ══ PARAMÈTRES EMPLOYÉ ══
    openEmpSettings(empId){
      const emp=this._employees.find(e=>String(e.id)===String(empId));if(!emp)return;
      const modal=document.getElementById('modal-emp-settings');
      modal._empId=empId;
      document.getElementById('emp-set-name').value=emp.name||'';
      document.getElementById('emp-set-contract').value=emp.contract||'';
      document.getElementById('emp-set-rate').value=emp.rate||'';
      document.getElementById('emp-set-from').value=emp.workFrom||'06:00';
      document.getElementById('emp-set-to').value=emp.workTo||'22:00';
      const sel=document.getElementById('emp-set-profile');
      sel.innerHTML='<option value="">— Aucun profil —</option>'+
        Object.keys(this._hrProfiles).map(k=>`<option value="${k}" ${emp.hrProfile===k?'selected':''}>${this._hrProfiles[k].icon} ${k}</option>`).join('');
      this._renderVacancesList(emp.vacances||[]);
      modal.classList.remove('hidden');
    },

    _renderVacancesList(vacances){
      const wrap=document.getElementById('emp-vacances-list');if(!wrap)return;
      if(!vacances.length){wrap.innerHTML=`<div style="font-size:12px;color:#94a3b8;font-style:italic;">Aucune période définie</div>`;return;}
      wrap.innerHTML=vacances.map((v,i)=>`
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;background:#fce7f3;border-radius:8px;padding:8px;">
          <span style="font-size:12px;font-weight:800;flex:1;">🌴 ${v.from} → ${v.to}${v.label?' ('+v.label+')':''}</span>
          <button onclick="app.planning.removeVacance(${i})" style="background:#dc2626;color:#fff;border:none;border-radius:6px;padding:4px 8px;font-weight:900;font-size:11px;cursor:pointer;">✕</button>
        </div>`).join('');
    },

    addVacance(){
      const modal=document.getElementById('modal-emp-settings');
      const empId=modal?._empId;
      const emp=this._employees.find(e=>String(e.id)===String(empId));if(!emp)return;
      if(!emp.vacances)emp.vacances=[];
      const fromStr=prompt('Date de début (AAAA-MM-JJ) :');if(!fromStr?.match(/^\d{4}-\d{2}-\d{2}$/))return toast('Format invalide (ex: 2025-08-01)','warn');
      const toStr=prompt('Date de fin (AAAA-MM-JJ) :');if(!toStr?.match(/^\d{4}-\d{2}-\d{2}$/))return toast('Format invalide','warn');
      const label=prompt('Libellé (optionnel, ex: Été 2025) :')||'';
      emp.vacances.push({from:fromStr,to:toStr,label});
      this._renderVacancesList(emp.vacances);
    },

    removeVacance(idx){
      const modal=document.getElementById('modal-emp-settings');
      const empId=modal?._empId;
      const emp=this._employees.find(e=>String(e.id)===String(empId));if(!emp||!emp.vacances)return;
      emp.vacances.splice(idx,1);
      this._renderVacancesList(emp.vacances);
    },

    saveEmpSettings:async function(){
      const modal=document.getElementById('modal-emp-settings');
      const empId=modal._empId;
      const emp=this._employees.find(e=>String(e.id)===String(empId));if(!emp)return;
      emp.name=(document.getElementById('emp-set-name').value||emp.name).toUpperCase().trim()||emp.name;
      emp.contract=document.getElementById('emp-set-contract').value.trim();
      emp.rate=parseFloat(document.getElementById('emp-set-rate').value)||undefined;
      emp.workFrom=document.getElementById('emp-set-from').value||'06:00';
      emp.workTo=document.getElementById('emp-set-to').value||'22:00';
      emp.hrProfile=document.getElementById('emp-set-profile').value||undefined;
      modal.classList.add('hidden');
      await this._save();this.render();
      toast(`${emp.name} mis à jour ✓`,'ok',2000);
    },

    deleteEmployee:async function(){
      const modal=document.getElementById('modal-emp-settings');
      const empId=modal._empId;
      const emp=this._employees.find(e=>String(e.id)===String(empId));if(!emp)return;
      const ok=await dlgConfirm('Supprimer '+emp.name,'Toutes les données de planification seront perdues.',true);if(!ok)return;
      this._employees=this._employees.filter(e=>String(e.id)!==String(empId));
      modal.classList.add('hidden');await this._save();this.render();
    },

    // ══ RÉSUMÉ HEURES ══
    renderRecap(period='week'){
      ['day','week','month'].forEach(p=>{
        const btn=document.getElementById('recap-btn-'+p);if(!btn)return;
        btn.style.background=p===period?'#0891b2':'#fff';
        btn.style.color=p===period?'#fff':'#334155';
      });
      const wrap=document.getElementById('plan-recap-content');if(!wrap)return;
      const today=new Date();
      let dates=[];
      if(period==='day'){dates=[new Date(today)];}
      else if(period==='week'){dates=this.getWeekDates();}
      else if(period==='month'){
        const y=today.getFullYear(),m=today.getMonth();
        for(let d=new Date(y,m,1);d<=new Date(y,m+1,0);d.setDate(d.getDate()+1))dates.push(new Date(d));
      }
      const ptseData=window.app.pointeuse?._logs||{};
      const rows=this._employees.map(emp=>{
        let plannedH=0,workedH=0,leaveDays=0;
        dates.forEach(date=>{
          const key=date.toISOString().slice(0,10);
          const shift=emp.schedule?.[key];
          if(shift?.type==='work'){plannedH+=this.getShiftHours(shift);}
          if(shift?.type==='leave'){leaveDays++;}
          const ptDay=ptseData[key];
          if(ptDay){const pt=ptDay[emp.name]||ptDay[emp.id];if(pt?.total)workedH+=pt.total/3600;}
        });
        const profile=emp.hrProfile?this._hrProfiles[emp.hrProfile]:null;
        const refH=profile?.refH||(period==='week'?35:period==='day'?7:151.67);
        const overtimeH=Math.max(0,(workedH||plannedH)-refH);
        const diff=workedH-plannedH;
        const diffColor=diff>0.25?'#059669':diff<-0.25?'#dc2626':'#64748b';
        const col=emp.color||'#003896';
        const init=(emp.name||'?').split(' ').map(x=>x[0]||'').join('').toUpperCase().slice(0,2);
        return`<div style="background:#fff;border-radius:14px;padding:14px;margin-bottom:10px;box-shadow:0 2px 8px rgba(0,0,0,.05);">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
            <div style="width:36px;height:36px;border-radius:50%;background:${col};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:950;font-size:13px;">${init}</div>
            <div style="flex:1;">
              <div style="font-weight:950;font-size:14px;">${emp.name}</div>
              <div style="font-size:11px;color:#64748b;">${emp.contract||''}${emp.rate?' · '+emp.rate+'€/h':''}</div>
            </div>
            <button onclick="app.planning.openEmpSettings('${emp.id}')" style="background:#f1f5f9;border:none;border-radius:8px;padding:6px 10px;cursor:pointer;font-size:12px;font-weight:900;color:#334155;"><i class="fas fa-gear"></i></button>
          </div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:8px;">
            <div style="background:#eff6ff;border-radius:8px;padding:8px;text-align:center;">
              <div style="font-size:18px;font-weight:950;color:#0891b2;">${plannedH.toFixed(1)}</div>
              <div style="font-size:10px;color:#64748b;">h planif.</div>
            </div>
            <div style="background:#f0fdf4;border-radius:8px;padding:8px;text-align:center;">
              <div style="font-size:18px;font-weight:950;color:#059669;">${workedH>0?workedH.toFixed(1):'—'}</div>
              <div style="font-size:10px;color:#64748b;">h réelles</div>
            </div>
            <div style="background:${Math.abs(diff)>0.25?'#fffbeb':'#f8fafc'};border-radius:8px;padding:8px;text-align:center;">
              <div style="font-size:18px;font-weight:950;color:${diffColor};">${workedH>0?(diff>=0?'+':'')+diff.toFixed(1):'—'}</div>
              <div style="font-size:10px;color:#64748b;">écart</div>
            </div>
            <div style="background:${leaveDays?'#fdf2f8':'#f8fafc'};border-radius:8px;padding:8px;text-align:center;">
              <div style="font-size:18px;font-weight:950;color:#db2777;">${leaveDays||'—'}</div>
              <div style="font-size:10px;color:#64748b;">j congés</div>
            </div>
          </div>
          ${emp.rate&&plannedH>0?`<div style="background:#f1f5f9;border-radius:8px;padding:8px;font-size:12px;font-weight:800;color:#334155;">
            💰 Planifié: <span style="color:#059669;">${(plannedH*emp.rate).toFixed(2)}€</span>
            ${overtimeH>0?` · H.sup: <span style="color:#d97706;">+${overtimeH.toFixed(1)}h</span>`:''}
            ${workedH>0?` · Réel: <span style="color:#0891b2;">${(workedH*emp.rate).toFixed(2)}€</span>`:''}
          </div>`:''}
        </div>`;
      }).join('');

      const lblPeriod=period==='day'?`Aujourd'hui — ${today.toLocaleDateString('fr',{weekday:'long',day:'numeric',month:'long'})}`:
        period==='week'?`Semaine du ${dates[0].toLocaleDateString('fr',{day:'2-digit',month:'2-digit'})} au ${dates[6].toLocaleDateString('fr',{day:'2-digit',month:'2-digit'})}`:
        `${today.toLocaleDateString('fr',{month:'long',year:'numeric'})}`;

      wrap.innerHTML=`<div style="background:linear-gradient(135deg,#0891b2,#0369a1);border-radius:14px;padding:14px;margin-bottom:14px;color:#fff;">
        <div style="font-weight:950;font-size:15px;"><i class="fas fa-chart-bar"></i> ${lblPeriod}</div>
        <div style="font-size:12px;opacity:.8;margin-top:2px;">Heures planifiées vs réelles (pointeuse)</div>
      </div>${rows||'<div class="empty-state"><i class="fas fa-users-slash"></i><br>Aucun employé.</div>'}`;
    },

    // ══ POLITIQUE RH ══
    renderRH(){
      const wrap=document.getElementById('plan-rh-content');if(!wrap)return;
      wrap.innerHTML=`
        <div style="background:linear-gradient(135deg,#7c3aed,#6d28d9);border-radius:14px;padding:14px;margin-bottom:14px;color:#fff;">
          <div style="font-weight:950;font-size:15px;"><i class="fas fa-scale-balanced"></i> Politique RH & Profils</div>
          <div style="font-size:12px;opacity:.8;margin-top:4px;">Modifiez les règles · Chaque profil peut être personnalisé</div>
        </div>
        <div id="rh-profiles-list"></div>
        <button onclick="app.planning.resetRHToLegal()" style="width:100%;background:#fef2f2;color:#dc2626;border:2px solid #fca5a5;border-radius:12px;padding:12px;font-weight:900;font-size:13px;cursor:pointer;margin-top:10px;">
          <i class="fas fa-rotate-left"></i> Remettre les valeurs légales (Code du travail)
        </button>`;
      this._renderRHProfiles();
    },

    _renderRHProfiles(){
      const wrap=document.getElementById('rh-profiles-list');if(!wrap)return;
      wrap.innerHTML=Object.entries(this._hrProfiles).map(([key,p])=>{
        const legal=this.HR_LEGAL[key];
        return`<div style="background:#fff;border-radius:14px;padding:14px;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,0,0,.06);border-left:4px solid ${p.color||'#7c3aed'};">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <div style="font-weight:950;font-size:14px;">${p.icon} ${p.label}</div>
            <span style="font-size:10px;background:#f0f9ff;color:#0369a1;border-radius:6px;padding:3px 8px;font-weight:800;cursor:pointer;" onclick="app.planning.assignProfileToEmp('${key}')"><i class="fas fa-user-plus"></i> Attribuer</span>
          </div>
          <div style="font-size:11px;color:#64748b;margin-bottom:10px;line-height:1.6;">📜 ${legal?.desc||p.desc||''}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
            <div><label style="font-size:11px;color:#64748b;display:block;margin-bottom:2px;">Max h/jour</label>
              <input type="number" value="${p.maxHoursDay}" style="margin:0;padding:8px;font-size:14px;" oninput="app.planning._updateProfile('${key}','maxHoursDay',parseFloat(this.value))"></div>
            <div><label style="font-size:11px;color:#64748b;display:block;margin-bottom:2px;">Max h/semaine</label>
              <input type="number" value="${p.maxHoursWeek}" style="margin:0;padding:8px;font-size:14px;" oninput="app.planning._updateProfile('${key}','maxHoursWeek',parseFloat(this.value))"></div>
            <div><label style="font-size:11px;color:#64748b;display:block;margin-bottom:2px;">Repos min entre shifts (h)</label>
              <input type="number" value="${p.minRestHours}" style="margin:0;padding:8px;font-size:14px;" oninput="app.planning._updateProfile('${key}','minRestHours',parseFloat(this.value))"></div>
            <div><label style="font-size:11px;color:#64748b;display:block;margin-bottom:2px;">Pause après (h)</label>
              <input type="number" value="${p.breakAfterH}" style="margin:0;padding:8px;font-size:14px;" oninput="app.planning._updateProfile('${key}','breakAfterH',parseFloat(this.value))"></div>
            <div><label style="font-size:11px;color:#64748b;display:block;margin-bottom:2px;">Durée pause (min)</label>
              <input type="number" value="${p.breakMinutes}" style="margin:0;padding:8px;font-size:14px;" oninput="app.planning._updateProfile('${key}','breakMinutes',parseInt(this.value))"></div>
            <div><label style="font-size:11px;color:#64748b;display:block;margin-bottom:2px;">Interdit la nuit</label>
              <select style="margin:0;padding:8px;font-size:12px;" onchange="app.planning._updateProfile('${key}','nightBan',this.value?{start:'22:00',end:'06:00'}:null)">
                <option value="" ${!p.nightBan?'selected':''}>Non</option>
                <option value="1" ${p.nightBan?'selected':''}>Oui (22h–6h)</option>
              </select>
            </div>
          </div>
          ${legal?`<div style="font-size:10px;color:#94a3b8;background:#f8fafc;border-radius:6px;padding:5px 8px;"><i class="fas fa-shield-halved"></i> Référence légale — ${legal.desc}</div>`:''}
          <div style="font-size:11px;color:#94a3b8;margin-top:6px;">Employés avec ce profil: ${this._employees.filter(e=>e.hrProfile===key).map(e=>e.name).join(', ')||'aucun'}</div>
        </div>`;
      }).join('');
    },

    _updateProfile(key,field,val){
      if(!this._hrProfiles[key])return;
      this._hrProfiles[key][field]=val;
      clearTimeout(this._rhSaveTimer);
      this._rhSaveTimer=setTimeout(()=>this._save(),1500);
    },

    assignProfileToEmp:async function(profileKey){
      if(!this._employees.length)return toast('Aucun employé dans le planning.','warn');
      // Clickable modal
      let m=document.getElementById('modal-assign-profile');
      if(!m){
        m=document.createElement('div');m.id='modal-assign-profile';
        m.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:90001;display:flex;align-items:flex-end;justify-content:center;padding:16px;';
        document.body.appendChild(m);
      }
      const p=this._hrProfiles[profileKey];
      const empHtml=this._employees.map(e=>{
        const hasP=e.hrProfile===profileKey;
        return`<div style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:10px;margin-bottom:6px;background:${hasP?'#ede9fe':'#f8fafc'};border:2px solid ${hasP?'#a78bfa':'#e2e8f0'};cursor:pointer;"
          onclick="app.planning._setProfileDirectly('${e.id}','${profileKey}')">
          <div style="width:34px;height:34px;border-radius:50%;background:${e.color||'#003896'};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:950;font-size:12px;">${(e.name||'?').slice(0,2)}</div>
          <div style="flex:1;">
            <div style="font-weight:950;font-size:13px;">${e.name}</div>
            <div style="font-size:11px;color:#64748b;">${e.contract||'Pas de contrat défini'}</div>
          </div>
          ${hasP?`<span style="color:#7c3aed;font-weight:900;font-size:11px;">✓ Actif</span>`:'<span style="font-size:11px;color:#94a3b8;">Cliquer</span>'}
        </div>`;
      }).join('');
      m.innerHTML=`<div style="background:#fff;border-radius:20px;padding:20px;max-width:420px;width:100%;max-height:80vh;display:flex;flex-direction:column;">
        <div style="font-weight:950;font-size:16px;margin-bottom:4px;">${p?.icon||'👤'} Attribuer profil "${profileKey}"</div>
        <div style="font-size:12px;color:#64748b;margin-bottom:14px;">Cliquez sur un employé pour lui attribuer ce profil.</div>
        <div style="overflow-y:auto;flex:1;margin-bottom:14px;">${empHtml}</div>
        <button onclick="document.getElementById('modal-assign-profile').style.display='none'" style="background:#f1f5f9;color:#475569;border:none;border-radius:12px;padding:12px;font-weight:950;cursor:pointer;width:100%;">Fermer</button>
      </div>`;
      m.style.display='flex';
    },

    _setProfileDirectly:async function(empId,profileKey){
      const emp=this._employees.find(e=>String(e.id)===String(empId));if(!emp)return;
      emp.hrProfile=emp.hrProfile===profileKey?undefined:profileKey;
      await this._save();
      document.getElementById('modal-assign-profile')?.remove();
      this.render();this.renderRH();
      toast(`Profil ${emp.hrProfile?'attribué':'retiré'} ✓`,'ok',2000);
    },

    resetRHToLegal:async function(){
      const ok=await dlgConfirm('Réinitialiser','Remettre tous les profils aux valeurs légales du Code du travail ?',true);if(!ok)return;
      this._hrProfiles=JSON.parse(JSON.stringify(this.HR_LEGAL));
      await this._save();this._renderRHProfiles();
      toast('Profils RH réinitialisés ✓','ok',3000);
    },

    // ══ AUTRES ACTIONS ══
    addEmployee:async function(){
      const name=await dlgPrompt('Prénom + Nom :');if(!name?.trim())return;
      const colors=['#003896','#0891b2','#059669','#7c3aed','#dc2626','#d97706','#0f766e','#db2777'];
      const id=Date.now()+Math.random();
      this._employees.push({id,name:name.trim().toUpperCase(),contract:'',color:colors[this._employees.length%colors.length],schedule:{},vacances:[]});
      await this._save();this.render();
      setTimeout(()=>this.openEmpSettings(id),300);
    },

    importFromUsers:async function(){
      const users=window.app.data?.users||[];
      if(!users.length)return toast('Aucun utilisateur trouvé dans l\'appli.','warn');
      // Show clickable selection modal
      let m=document.getElementById('modal-import-users');
      if(!m){
        m=document.createElement('div');m.id='modal-import-users';
        m.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:90000;display:flex;align-items:flex-end;justify-content:center;padding:16px;';
        document.body.appendChild(m);
      }
      const toImport=new Set();
      const alreadyIn=new Set(this._employees.map(e=>e.name));
      const userHtml=users.map(u=>{
        const name=(u.name||u.displayName||u.email||'').toUpperCase().trim();
        if(!name)return'';
        const isIn=alreadyIn.has(name);
        return`<div id="imp-user-${u.uid}" style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:10px;margin-bottom:6px;background:${isIn?'#f0fdf4':'#f8fafc'};border:2px solid ${isIn?'#86efac':'#e2e8f0'};cursor:${isIn?'default':'pointer'};"
          ${!isIn?`onclick="this.classList.toggle('selected-imp');this.style.background=this.classList.contains('selected-imp')?'#dbeafe':'#f8fafc';this.style.borderColor=this.classList.contains('selected-imp')?'#93c5fd':'#e2e8f0';"`:''}
          >
          <div style="width:36px;height:36px;border-radius:50%;background:${u.role==='admin'?'#003896':u.role==='conseiller'?'#7c3aed':'#0891b2'};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:950;font-size:13px;">${name.slice(0,2)}</div>
          <div style="flex:1;">
            <div style="font-weight:950;font-size:13px;">${name}</div>
            <div style="font-size:11px;color:#64748b;">${u.role||'staff'} • ${u.email||''}</div>
          </div>
          ${isIn?`<span style="font-size:11px;color:#059669;font-weight:900;">✓ Déjà dans le planning</span>`:'<span style="font-size:10px;color:#64748b;">Cliquer pour sélectionner</span>'}
        </div>`;
      }).filter(Boolean).join('');
      m.innerHTML=`<div style="background:#fff;border-radius:20px;padding:20px;max-width:420px;width:100%;max-height:80vh;display:flex;flex-direction:column;">
        <div style="font-weight:950;font-size:16px;margin-bottom:4px;color:#059669;"><i class="fas fa-users-gear"></i> Importer des utilisateurs</div>
        <div style="font-size:12px;color:#64748b;margin-bottom:14px;">Sélectionnez les utilisateurs à ajouter au planning</div>
        <div style="overflow-y:auto;flex:1;margin-bottom:14px;">${userHtml}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <button onclick="app.planning._doImportSelected()" style="background:#059669;color:#fff;border:none;border-radius:12px;padding:12px;font-weight:950;cursor:pointer;"><i class="fas fa-check"></i> Importer</button>
          <button onclick="document.getElementById('modal-import-users').style.display='none'" style="background:#f1f5f9;color:#475569;border:none;border-radius:12px;padding:12px;font-weight:950;cursor:pointer;">Annuler</button>
        </div>
      </div>`;
      m.style.display='flex';
    },

    _doImportSelected:async function(){
      const m=document.getElementById('modal-import-users');
      if(!m)return;
      const selected=m.querySelectorAll('.selected-imp');
      if(!selected.length){toast('Aucun utilisateur sélectionné.','warn');return;}
      let added=0;
      const colors=['#003896','#0891b2','#059669','#7c3aed','#dc2626','#d97706','#0f766e','#db2777'];
      selected.forEach(el=>{
        const name=el.querySelector('div > div')?.textContent?.trim();
        if(!name)return;
        if(this._employees.some(e=>e.name===name))return;
        this._employees.push({id:Date.now()+Math.random(),name,contract:'',color:colors[this._employees.length%colors.length],schedule:{},vacances:[]});
        added++;
      });
      m.style.display='none';
      if(!added){toast('Tous les utilisateurs sont déjà dans le planning.','info');return;}
      await this._save();this.render();toast(`${added} employé(s) importé(s) ✓`,'ok');
    },

    copyWeek:async function(){
      const dates=this.getWeekDates();
      const choix=await dlgPrompt('Copier:\n1. Cette semaine → semaine suivante\n2. Semaine précédente → cette semaine\n\nEntrez 1 ou 2 :');
      if(!choix)return;const dir=parseInt(choix);
      if(dir===1){
        const ok=await dlgConfirm('Copier','Copier ce planning sur la semaine suivante ?',false);if(!ok)return;
        this._employees.forEach(emp=>{
          if(!emp.schedule)emp.schedule={};
          dates.forEach(date=>{
            const key=date.toISOString().slice(0,10);
            const nk=new Date(date);nk.setDate(date.getDate()+7);
            const nextKey=nk.toISOString().slice(0,10);
            if(emp.schedule[key])emp.schedule[nextKey]={...emp.schedule[key]};else delete emp.schedule[nextKey];
          });
        });
        await this._save();toast('Semaine copiée ✓','ok');
      } else if(dir===2){
        const ok=await dlgConfirm('Importer','Remplacer cette semaine par la semaine précédente ?',true);if(!ok)return;
        this._employees.forEach(emp=>{
          if(!emp.schedule)emp.schedule={};
          dates.forEach(date=>{
            const pk=new Date(date);pk.setDate(date.getDate()-7);
            const key=date.toISOString().slice(0,10);
            const prevKey=pk.toISOString().slice(0,10);
            if(emp.schedule[prevKey])emp.schedule[key]={...emp.schedule[prevKey]};else delete emp.schedule[key];
          });
        });
        await this._save();this.render();toast('Semaine précédente importée ✓','ok');
      }
    },

    exportCSV(){
      const dates=this.getWeekDates();const dN=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
      const header=['Employé','Contrat','Profil RH','€/h',...dates.map((d,i)=>`${dN[i]} ${d.toLocaleDateString('fr')}`),'Total h','Coût brut'];
      const rows=[header];
      this._employees.forEach(emp=>{
        const{totalHours}=this.validateSchedule(emp);
        const row=[emp.name,emp.contract||'',emp.hrProfile||'',emp.rate||'',...dates.map(d=>{
          const key=d.toISOString().slice(0,10);const s=emp.schedule?.[key]||{type:'rest'};
          if(s.type==='leave')return`CONGÉ-${s.leaveType||''}`;
          return s.type==='rest'?'Repos':`${s.start}-${s.end} ${s.post||''}${s.breakMin?` pause:${s.breakMin}min`:''}`;
        }),totalHours.toFixed(1)+'h',emp.rate?(totalHours*emp.rate).toFixed(2)+'€':''];
        rows.push(row);
      });
      const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(';')).join('\n');
      const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
      const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`planning_${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);
      toast('Planning exporté.','ok');
    },

    printWeek(){
      const dates=this.getWeekDates();
      const DAY=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
      const today=new Date().toISOString().slice(0,10);
      const opts={day:'2-digit',month:'2-digit'};
      const lbl=`${dates[0].toLocaleDateString('fr',opts)} – ${dates[6].toLocaleDateString('fr',opts)}`;
      const headers=DAY.map((d,i)=>{const isT=dates[i].toISOString().slice(0,10)===today;return`<th style="${isT?'background:#0891b2;':''}">${d} ${dates[i].getDate()}</th>`;}).join('');
      const rows=this._employees.map(emp=>{
        const{totalHours,restDays,warnings}=this.validateSchedule(emp);
        const profile=emp.hrProfile?this._hrProfiles[emp.hrProfile]:null;
        const cells=dates.map(d=>{
          const key=d.toISOString().slice(0,10);const s=emp.schedule?.[key];
          const isVac=this._isVacation(emp,key);
          if(isVac&&(!s||s.type==='rest'))return`<td style="background:#fce7f3;color:#9d174d;font-size:9px;font-weight:900;">🌴 CONGÉ</td>`;
          if(!s||s.type==='rest')return`<td class="p-rest">Repos</td>`;
          if(s.type==='leave')return`<td class="p-rest">🌴 ${s.leaveType||'CP'}</td>`;
          const h=this.getShiftHours(s);
          const brk=s.breakMin!==undefined?s.breakMin:this._autoBreak(h,profile);
          return`<td class="p-work">${s.start}–${s.end}<br><span style="font-size:8px;">${s.post||''} · ${h.toFixed(1)}h${brk?` ☕${brk}'`:''}</span>`;
        }).join('');
        const cost=emp.rate&&totalHours?` · ${(totalHours*emp.rate).toFixed(0)}€`:'';
        return`<tr>
          <td><strong>${emp.name}</strong><br><small>${emp.contract||''}${profile?' · '+profile.icon+profile.label:''}</small>${warnings.length?`<br><span style="color:#dc2626;font-size:9px;">⚠ ${warnings[0]}</span>`:''}</td>
          ${cells}
          <td class="p-total">${totalHours.toFixed(1)}h${cost}<br>${restDays}R</td>
        </tr>`;
      }).join('');
      const dayTot=dates.map(d=>{
        const key=d.toISOString().slice(0,10);
        const tot=this._employees.reduce((s,e)=>{const sh=e.schedule?.[key];return s+(sh?.type==='work'?this.getShiftHours(sh):0);},0);
        const cnt=this._employees.filter(e=>e.schedule?.[key]?.type==='work').length;
        return`<td style="font-size:9px;">${cnt}p · ${tot.toFixed(0)}h</td>`;
      }).join('');
      const totBrut=this._employees.reduce((s,e)=>s+this.validateSchedule(e).totalHours*(e.rate||0),0);
      const html=`<h2>📅 Planning — ${lbl}</h2>
      <p style="text-align:center;font-size:11px;color:#64748b;">Express Purpan · Édité le ${new Date().toLocaleDateString('fr')} · Coût brut total: ${totBrut.toFixed(0)}€</p>
      <table>
        <thead><tr><th>Employé</th>${headers}<th>Total</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td><strong>Par jour</strong></td>${dayTot}<td></td></tr></tfoot>
      </table>`;
      const wrap=document.getElementById('print-planning-wrap');
      if(wrap){wrap.innerHTML=html;wrap.style.display='block';}
      setTimeout(()=>{window.print();if(wrap)wrap.style.display='none';},200);
    }
  },

  // ══════════════════════════════════════════════════
  // ── NOTIFICATIONS MODULE ──
  // ══════════════════════════════════════════════════
  notif:{
    _permission:'default',
    _sw:null,

    async init(){
      if(!('Notification' in window))return;
      this._permission=Notification.permission;
      // Register service worker for push (fallback to local)
      if('serviceWorker' in navigator){
        try{
          this._sw=await navigator.serviceWorker.register('/sw-notif.js').catch(()=>null);
        }catch(e){}
      }
      this._updateBtnState();
    },

    _updateBtnState(){
      const btn=document.getElementById('notif-toggle-btn');
      if(!btn)return;
      if(!('Notification' in window)){btn.style.display='none';return;}
      btn.style.display='flex';
      if(this._permission==='granted'){
        btn.innerHTML='<i class="fas fa-bell" style="color:#10b981;"></i>';
        btn.title='Notifications activées';
      }else if(this._permission==='denied'){
        btn.innerHTML='<i class="fas fa-bell-slash" style="color:#ef4444;"></i>';
        btn.title='Notifications bloquées dans les paramètres navigateur';
      }else{
        btn.innerHTML='<i class="fas fa-bell" style="color:#f59e0b;"></i>';
        btn.title='Activer les notifications';
      }
    },

    async requestPermission(){
      if(!('Notification' in window))return toast('Notifications non disponibles sur cet appareil.','warn');
      if(this._permission==='denied'){
        toast('Notifications bloquées. Autorisez-les dans les paramètres de votre navigateur.','warn',6000);return;
      }
      try{
        this._permission=await Notification.requestPermission();
        this._updateBtnState();
        if(this._permission==='granted'){
          toast('✓ Notifications activées !','ok');
          this.sendLocal('Express Purpan','Notifications activées 🔔 Vous serez alerté des DLC urgentes.');
        }else{toast('Notifications refusées.','warn');}
      }catch(e){toast('Erreur activation notifications.','err');}
    },

    sendLocal(title,body,icon=''){
      if(this._permission!=='granted')return;
      try{new Notification(title,{body,icon:icon||'https://raw.githubusercontent.com/araujoexploitation/Magasin/main/LOGO.png',badge:'https://raw.githubusercontent.com/araujoexploitation/Magasin/main/LOGO.png',vibrate:[200,100,200]});}
      catch(e){}
    },

    checkDlcAlerts(){
      if(this._permission!=='granted')return;
      const today=new Date();today.setHours(23,59,59,999);
      const urgent=window.app.data.frais.filter(i=>{const d=new Date(i.date);return!isNaN(d.getTime())&&d<=today;});
      if(urgent.length){
        const names=urgent.slice(0,3).map(i=>i.name).join(', ');
        this.sendLocal('⚠️ DLC Urgentes — '+urgent.length+' produit(s)',names+(urgent.length>3?' et '+(urgent.length-3)+' autres…':''));
      }
    }
  },



  // ══════════════════════════════════════════════════
  // ── HOME MODULE REORDER (drag-and-drop touch+mouse) ──
  // ══════════════════════════════════════════════════
  homeOrder:{
    _editing:false,
    _drag:null, // {el, startX, startY, origIdx, clone, lastTarget}

    startEdit(){
      this._editing=true;
      const bar=document.getElementById('home-edit-bar');
      const reorgBtn=document.getElementById('home-reorder-btn');
      if(bar)bar.style.display='block';
      if(reorgBtn)reorgBtn.style.display='none';
      const grid=document.getElementById('home-grid');
      if(!grid)return;
      // Add visual cues to every module button
      grid.querySelectorAll('.home-btn').forEach(btn=>{
        btn.classList.add('reorder-mode');
        // Add grip icon if not already there
        if(!btn.querySelector('.grip-icon')){
          const g=document.createElement('div');
          g.className='grip-icon';
          g.innerHTML='<i class="fas fa-grip-vertical"></i>';
          btn.prepend(g);
        }
        // Wire drag events
        btn.addEventListener('touchstart',this._onTouchStart.bind(this),{passive:false});
        btn.addEventListener('mousedown',this._onMouseDown.bind(this));
      });
    },

    stopEdit(){
      this._editing=false;
      const bar=document.getElementById('home-edit-bar');
      const reorgBtn=document.getElementById('home-reorder-btn');
      if(bar)bar.style.display='none';
      if(reorgBtn)reorgBtn.style.display='flex';
      const grid=document.getElementById('home-grid');
      if(!grid)return;
      grid.querySelectorAll('.home-btn').forEach(btn=>{
        btn.classList.remove('reorder-mode','drag-over');
        btn.querySelectorAll('.grip-icon').forEach(e=>e.remove());
        // Remove event listeners by cloning
        const newBtn=btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn,btn);
      });
      this._saveOrder();
      toast('✓ Ordre enregistré','ok',2000);
    },

    _saveOrder(){
      try{
        const ids=Array.from(document.querySelectorAll('#home-grid .home-btn')).map(b=>b.dataset.mid||b.textContent.trim().slice(0,20));
        localStorage.setItem('home_order',JSON.stringify(ids));
      }catch(e){}
    },

    _getPos(e){
      const t=e.touches?e.touches[0]:e;
      return{x:t.clientX,y:t.clientY};
    },

    _onTouchStart(e){
      if(!this._editing)return;
      e.preventDefault();
      const btn=e.currentTarget;
      this._startDrag(btn,e.touches[0].clientX,e.touches[0].clientY);
      const move=ev=>{ev.preventDefault();this._moveDrag(ev.touches[0].clientX,ev.touches[0].clientY);};
      const end=()=>{this._endDrag();document.removeEventListener('touchmove',move);document.removeEventListener('touchend',end);};
      document.addEventListener('touchmove',move,{passive:false});
      document.addEventListener('touchend',end);
    },

    _onMouseDown(e){
      if(!this._editing)return;
      this._startDrag(e.currentTarget,e.clientX,e.clientY);
      const move=ev=>this._moveDrag(ev.clientX,ev.clientY);
      const end=()=>{this._endDrag();document.removeEventListener('mousemove',move);document.removeEventListener('mouseup',end);};
      document.addEventListener('mousemove',move);
      document.addEventListener('mouseup',end);
    },

    _startDrag(btn,x,y){
      btn.classList.add('dragging');
      // Create ghost clone
      const r=btn.getBoundingClientRect();
      const clone=btn.cloneNode(true);
      clone.style.cssText=`position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;opacity:.85;pointer-events:none;z-index:99999;transform:scale(1.04);box-shadow:0 12px 40px rgba(0,0,0,.3);transition:none;border-radius:18px;`;
      document.body.appendChild(clone);
      btn.style.opacity='.3';
      this._drag={el:btn,x,y,ox:r.left,oy:r.top,clone,lastTarget:null};
    },

    _moveDrag(x,y){
      if(!this._drag)return;
      const d=this._drag;
      const dx=x-d.x, dy=y-d.y;
      d.clone.style.left=(parseFloat(d.clone.style.left)+dx)+'px';
      d.clone.style.top=(parseFloat(d.clone.style.top)+dy)+'px';
      d.x=x; d.y=y;
      // Find element under pointer
      d.clone.style.display='none';
      const under=document.elementFromPoint(x,y);
      d.clone.style.display='';
      const target=under&&under.closest('.home-btn');
      if(target&&target!==d.el&&target!==d.lastTarget){
        const grid=document.getElementById('home-grid');
        const btns=Array.from(grid.querySelectorAll('.home-btn'));
        const fromIdx=btns.indexOf(d.el);
        const toIdx=btns.indexOf(target);
        if(fromIdx>-1&&toIdx>-1){
          if(fromIdx<toIdx)grid.insertBefore(d.el,target.nextSibling);
          else grid.insertBefore(d.el,target);
        }
        d.lastTarget=target;
      }
    },

    _endDrag(){
      if(!this._drag)return;
      const{el,clone}=this._drag;
      el.style.opacity='';
      el.classList.remove('dragging');
      clone.remove();
      this._drag=null;
    }
  },

  // ══════════════════════════════════════════════════
  // ── POINTEUSE ──
  // ══════════════════════════════════════════════════
  pointeuse:{
    _tab:'clock',
    _timer:null,
    _clockTimer:null,
    _weekOffset:0,
    _unsub:null,
    _state:null, // {clockIn, pauseStart, totalPauseMs, active}

    colRef(){return collection(window._db,'pointeuse_logs');},

    _fmtDur(ms){
      if(!ms||ms<0)return'0h00';
      const tot=Math.floor(ms/1000);
      const h=Math.floor(tot/3600);const m=Math.floor((tot%3600)/60);
      return`${h}h${String(m).padStart(2,'0')}`;
    },
    _fmtTime(ts){
      if(!ts)return'--:--';
      const d=new Date(ts);
      return`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    },
    _todayStr(){const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;},
    _weekStart(offset=0){
      const d=new Date();
      const day=d.getDay();
      const diff=day===0?-6:1-day;
      d.setDate(d.getDate()+diff+offset*7);
      d.setHours(0,0,0,0);
      return d;
    },

    open(){
      document.getElementById('pointeuse-overlay').classList.remove('hidden');
      document.getElementById('ptse-date-label').textContent=new Date().toLocaleDateString('fr',{weekday:'long',day:'numeric',month:'long'});
      this.showTab('clock');
      this._loadState();
      this._listenLogs();
    },

    close(){
      document.getElementById('pointeuse-overlay').classList.add('hidden');
      if(this._clockTimer)clearInterval(this._clockTimer);
      if(this._unsub){try{this._unsub();}catch(e){}}
    },

    showTab(tab){
      this._tab=tab;
      document.getElementById('ptse-tab-clock').classList.toggle('hidden',tab!=='clock');
      document.getElementById('ptse-tab-logs').classList.toggle('hidden',tab!=='logs');
      document.getElementById('ptse-tab-timesheet').classList.toggle('hidden',tab!=='timesheet');
      if(tab==='timesheet')this._renderTimesheet();
      if(tab==='logs')this._renderLogs();
    },

    async _loadState(){
      const me=window.app.me;
      if(!me)return;
      if(this._clockTimer)clearInterval(this._clockTimer);
      try{
        const today=this._todayStr();
        const{query,where,orderBy,getDocs}=window._fbChat;
        const q=query(this.colRef(),where('userId','==',me.uid),where('date','==',today),orderBy('ts','asc'));
        const snap=await getDocs(q);
        const logs=[];snap.forEach(d=>logs.push({_id:d.id,...d.data()}));
        this._processState(logs);
      }catch(e){this._processState([]);}
    },

    _processState(logs){
      const ins=logs.filter(l=>l.type==='in').sort((a,b)=>a.ts-b.ts);
      const outs=logs.filter(l=>l.type==='out').sort((a,b)=>a.ts-b.ts);
      const pauseStarts=logs.filter(l=>l.type==='pause_start').sort((a,b)=>a.ts-b.ts);
      const pauseEnds=logs.filter(l=>l.type==='pause_end').sort((a,b)=>a.ts-b.ts);

      const lastIn=ins.length?ins[ins.length-1]:null;
      const lastOut=outs.length?outs[outs.length-1]:null;
      const lastPauseStart=pauseStarts.length?pauseStarts[pauseStarts.length-1]:null;
      const lastPauseEnd=pauseEnds.length?pauseEnds[pauseEnds.length-1]:null;

      // Active if last 'in' is after last 'out' (or no out)
      const isActive=lastIn&&(!lastOut||lastIn.ts>lastOut.ts);
      const isPaused=isActive&&lastPauseStart&&(!lastPauseEnd||lastPauseStart.ts>lastPauseEnd.ts);

      // Compute total pause ms
      let totalPauseMs=0;
      for(let i=0;i<pauseStarts.length;i++){
        const ps=pauseStarts[i].ts;
        const pe=pauseEnds[i]?pauseEnds[i].ts:null;
        if(pe)totalPauseMs+=(pe-ps);
      }
      if(isPaused&&lastPauseStart)totalPauseMs+=(Date.now()-lastPauseStart.ts);

      // Compute total worked ms today
      let totalWorkedMs=0;
      for(let i=0;i<ins.length;i++){
        const inTs=ins[i].ts;
        const outTs=outs[i]?outs[i].ts:isActive&&i===ins.length-1?Date.now():null;
        if(outTs)totalWorkedMs+=(outTs-inTs);
      }
      // Subtract pauses already computed
      const pausedMs=logs.filter(l=>l.type==='pause_end').reduce((acc,pe,idx)=>{
        const ps=pauseStarts[idx];return ps?acc+(pe.ts-ps.ts):acc;
      },0);

      this._state={isActive,isPaused,clockIn:lastIn?lastIn.ts:null,pauseStart:lastPauseStart&&isPaused?lastPauseStart.ts:null,totalPauseMs,logs};
      this._renderClock();
      this._startClockTimer();
      this._renderTodayPunches(logs);
    },

    _startClockTimer(){
      if(this._clockTimer)clearInterval(this._clockTimer);
      this._clockTimer=setInterval(()=>this._tickClock(),1000);
      this._tickClock();
    },

    _tickClock(){
      const s=this._state;
      if(!s){document.getElementById('ptse-timer').textContent='00:00:00';return;}
      let elapsed=0;
      if(s.isActive&&s.clockIn){
        elapsed=Date.now()-s.clockIn-s.totalPauseMs;
        if(s.isPaused&&s.pauseStart){elapsed-=(Date.now()-s.pauseStart);}
      }
      if(elapsed<0)elapsed=0;
      const tot=Math.floor(elapsed/1000);
      const h=Math.floor(tot/3600);const m=Math.floor((tot%3600)/60);const sec=tot%60;
      document.getElementById('ptse-timer').textContent=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
      // Update total label
      const lbl=document.getElementById('ptse-total-label');
      if(lbl&&elapsed>0)lbl.textContent=`Temps travaillé : ${this._fmtDur(elapsed)}`;
    },

    _renderClock(){
      const s=this._state||{};
      const chip=document.getElementById('ptse-status-chip');
      const statusTxt=document.getElementById('ptse-status-text');
      const btn=document.getElementById('ptse-main-btn');
      const icon=document.getElementById('ptse-main-icon');
      const lbl=document.getElementById('ptse-main-label');
      const pauseBtn=document.getElementById('ptse-pause-btn');
      const pauseIcon=document.getElementById('ptse-pause-icon');
      const pauseLbl=document.getElementById('ptse-pause-label');

      if(s.isActive){
        chip.className='pointeuse-status-chip on';
        if(s.isPaused){
          statusTxt.textContent='En pause';
          chip.className='pointeuse-status-chip'+('; background:rgba(251,191,36,.2);color:#fbbf24;border:1.5px solid rgba(251,191,36,.3);');
          chip.style.cssText='background:rgba(251,191,36,.15);color:#fbbf24;border:1.5px solid rgba(251,191,36,.3);';
        }else{
          statusTxt.textContent='En service depuis '+this._fmtTime(s.clockIn);
          chip.style.cssText='';
        }
        btn.className='pointeuse-main-btn btn-out';
        icon.className='fas fa-stop';
        lbl.textContent='POINTER LA SORTIE';
        pauseBtn.style.display='block';
        if(s.isPaused){pauseIcon.className='fas fa-play';pauseLbl.textContent='Fin de pause';}
        else{pauseIcon.className='fas fa-mug-hot';pauseLbl.textContent='Commencer la pause';}
      }else{
        chip.className='pointeuse-status-chip off';
        chip.style.cssText='';
        statusTxt.textContent='Non pointé';
        btn.className='pointeuse-main-btn btn-in';
        icon.className='fas fa-play';
        lbl.textContent="POINTER L'ARRIVÉE";
        pauseBtn.style.display='none';
      }

      // Home badge
      const hb=document.getElementById('badge-pointeuse');
      if(hb){
        if(s.isActive&&!s.isPaused){hb.textContent='EN POSTE';hb.classList.remove('hidden');}
        else{hb.classList.add('hidden');}
      }
    },

    _renderTodayPunches(logs){
      const sec=document.getElementById('ptse-today-section');
      const wrap=document.getElementById('ptse-today-punches');
      if(!wrap)return;
      if(!logs||!logs.length){sec.style.display='none';return;}
      sec.style.display='block';
      const sorted=[...logs].sort((a,b)=>a.ts-b.ts);
      const labels={in:'Arrivée',out:'Départ',pause_start:'Début pause',pause_end:'Fin pause'};
      wrap.innerHTML=sorted.map(l=>`
        <div class="punch-log">
          <div>
            <div class="punch-time">${this._fmtTime(l.ts)}</div>
            <div class="punch-label ${l.type==='in'?'in':l.type==='out'?'out':'pause'}">${labels[l.type]||l.type}</div>
          </div>
          <div class="punch-dur">${new Date(l.ts).toLocaleDateString('fr')}</div>
        </div>`).join('');
    },

    _listenLogs(){
      if(this._unsub){try{this._unsub();}catch(e){}}
      const me=window.app.me;
      if(!me)return;
      try{
        const today=this._todayStr();
        const{query,where,orderBy,onSnapshot}=window._fbChat;
        const q=query(this.colRef(),where('userId','==',me.uid),where('date','==',today),orderBy('ts','asc'));
        this._unsub=onSnapshot(q,snap=>{
          const logs=[];snap.forEach(d=>logs.push({_id:d.id,...d.data()}));
          this._processState(logs);
        },()=>{});
      }catch(e){}
    },

    async _punch(type){
      const me=window.app.me;
      if(!me)return toast('Connexion requise','err');
      const now=Date.now();
      const{addDoc,serverTimestamp}=window._fbChat;
      try{
        await addDoc(this.colRef(),{
          type,userId:me.uid,userName:me.name||me.email||'USER',
          ts:now,date:this._todayStr(),serverTs:serverTimestamp()
        });
      }catch(e){toast('Erreur de pointage','err');}
    },

    async toggle(){
      const s=this._state||{};
      if(s.isActive){
        const ok=await dlgConfirm('Pointer la sortie ?','Confirmer la fin de service.',false);
        if(!ok)return;
        await this._punch('out');
        toast('Bonne journée ! Sortie enregistrée.','ok');
      }else{
        await this._punch('in');
        toast('Bienvenue ! Arrivée enregistrée.','ok');
      }
    },

    async togglePause(){
      const s=this._state||{};
      if(s.isPaused){
        await this._punch('pause_end');
        toast('Fin de pause ✓','ok');
      }else{
        if(!s.isActive)return toast('Vous n\'êtes pas en service.','warn');
        // Check: how long worked without break?
        const elapsed=(Date.now()-s.clockIn-s.totalPauseMs)/3600000;// hours
        // Get employee HR profile break rule
        const me=window.app.me;
        const planEmp=window.app.planning?._employees?.find(e=>
          e.name===me?.name||(me?.name&&e.name.includes(me.name.split(' ')[0]))
        );
        const profile=planEmp?.hrProfile?window.app.planning._hrProfiles?.[planEmp.hrProfile]:null;
        const maxWithoutBreak=profile?.breakAfterH||6;
        const minBreak=profile?.breakMinutes||20;
        if(elapsed>=maxWithoutBreak){
          toast(`⚠️ Pause obligatoire ! Vous avez travaillé ${elapsed.toFixed(1)}h sans pause (max ${maxWithoutBreak}h).`,'warn',5000);
        }
        await this._punch('pause_start');
        toast('Pause enregistrée ☕','info');
      }
    },

    async _renderLogs(){
      const wrap=document.getElementById('ptse-logs-list');
      if(!wrap)return;
      wrap.innerHTML='<div style="color:rgba(255,255,255,.4);text-align:center;padding:20px;"><i class="fas fa-spinner fa-spin"></i></div>';
      try{
        const today=this._todayStr();
        const{query,where,orderBy,getDocs}=window._fbChat;
        const q=query(this.colRef(),where('date','==',today),orderBy('ts','asc'));
        const snap=await getDocs(q);
        const logs=[];snap.forEach(d=>logs.push({_id:d.id,...d.data()}));
        if(!logs.length){wrap.innerHTML='<div style="color:rgba(255,255,255,.3);text-align:center;padding:20px;">Aucun pointage aujourd\'hui</div>';return;}
        const byUser={};
        logs.forEach(l=>{
          if(!byUser[l.userId])byUser[l.userId]={name:l.userName,logs:[]};
          byUser[l.userId].logs.push(l);
        });
        const labels={in:'Arrivée',out:'Départ',pause_start:'Début pause',pause_end:'Fin pause'};
        wrap.innerHTML=Object.values(byUser).map(u=>`
          <div style="margin-bottom:16px;">
            <div style="font-weight:950;color:rgba(255,255,255,.7);font-size:12px;text-transform:uppercase;margin-bottom:6px;">${u.name}</div>
            ${u.logs.sort((a,b)=>a.ts-b.ts).map(l=>`
              <div class="punch-log">
                <div><div class="punch-time">${this._fmtTime(l.ts)}</div>
                <div class="punch-label ${l.type==='in'?'in':l.type==='out'?'out':'pause'}">${labels[l.type]||l.type}</div></div>
              </div>`).join('')}
          </div>`).join('');
      }catch(e){wrap.innerHTML='<div style="color:#f87171;text-align:center;padding:20px;">Erreur de chargement</div>';}
    },

    prevWeek(){this._weekOffset--;this._renderTimesheet();},
    nextWeek(){this._weekOffset++;this._renderTimesheet();},

    async _renderTimesheet(){
      const wrap=document.getElementById('ptse-timesheet-content');
      const wlbl=document.getElementById('ptse-week-label');
      if(!wrap)return;
      const ws=this._weekStart(this._weekOffset);
      const we=new Date(ws);we.setDate(we.getDate()+6);we.setHours(23,59,59,999);
      const fmtDay=d=>d.toLocaleDateString('fr',{day:'numeric',month:'short'});
      if(wlbl)wlbl.textContent=`${fmtDay(ws)} – ${fmtDay(we)}`;
      wrap.innerHTML='<div style="color:rgba(255,255,255,.4);text-align:center;padding:20px;"><i class="fas fa-spinner fa-spin"></i></div>';
      try{
        const{query,where,orderBy,getDocs}=window._fbChat;
        const q=query(this.colRef(),where('ts','>=',ws.getTime()),where('ts','<=',we.getTime()),orderBy('ts','asc'));
        const snap=await getDocs(q);
        const logs=[];snap.forEach(d=>logs.push({_id:d.id,...d.data()}));
        if(!logs.length){wrap.innerHTML='<div style="color:rgba(255,255,255,.3);text-align:center;padding:20px;">Aucune donnée pour cette semaine</div>';return;}

        // Group by user then by date
        const byUser={};
        logs.forEach(l=>{
          if(!byUser[l.userId])byUser[l.userId]={name:l.userName,byDate:{}};
          const d=l.date||(new Date(l.ts).toISOString().slice(0,10));
          if(!byUser[l.userId].byDate[d])byUser[l.userId].byDate[d]=[];
          byUser[l.userId].byDate[d].push(l);
        });

        const computeWorked=(dayLogs)=>{
          const ins=dayLogs.filter(l=>l.type==='in').sort((a,b)=>a.ts-b.ts);
          const outs=dayLogs.filter(l=>l.type==='out').sort((a,b)=>a.ts-b.ts);
          let ms=0;
          ins.forEach((inL,i)=>{const outL=outs[i];if(outL)ms+=(outL.ts-inL.ts);});
          // Subtract pauses
          const ps=dayLogs.filter(l=>l.type==='pause_start').sort((a,b)=>a.ts-b.ts);
          const pe=dayLogs.filter(l=>l.type==='pause_end').sort((a,b)=>a.ts-b.ts);
          ps.forEach((p,i)=>{if(pe[i])ms-=(pe[i].ts-p.ts);});
          return Math.max(0,ms);
        };

        wrap.innerHTML=Object.values(byUser).map(u=>{
          let totalMs=0;
          const days=[];
          for(let i=0;i<7;i++){
            const d=new Date(ws);d.setDate(ws.getDate()+i);
            const dstr=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            const dayLogs=u.byDate[dstr]||[];
            const ms=computeWorked(dayLogs);totalMs+=ms;
            const ins=dayLogs.filter(l=>l.type==='in').sort((a,b)=>a.ts-b.ts);
            const outs=dayLogs.filter(l=>l.type==='out').sort((a,b)=>a.ts-b.ts);
            const inStr=ins.length?this._fmtTime(ins[0].ts):'—';
            const outStr=outs.length?this._fmtTime(outs[outs.length-1].ts):'—';
            const dayNames=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
            days.push(`<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(255,255,255,.03);border-radius:10px;margin-bottom:4px;">
              <div style="color:rgba(255,255,255,.5);font-size:12px;width:32px;font-weight:900;">${dayNames[i]}</div>
              <div style="color:#fff;font-size:13px;font-weight:800;">${ins.length?inStr+' → '+outStr:'Repos'}</div>
              <div style="color:#a5b4fc;font-weight:900;font-size:13px;">${ms?this._fmtDur(ms):''}</div>
            </div>`);
          }
          return`<div class="pointeuse-section">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
              <div style="font-weight:950;color:#fff;font-size:15px;">${u.name}</div>
              <div style="font-size:20px;font-weight:950;color:#a5b4fc;">${this._fmtDur(totalMs)}</div>
            </div>
            ${days.join('')}
          </div>`;
        }).join('');
      }catch(e){wrap.innerHTML='<div style="color:#f87171;text-align:center;padding:20px;">Erreur de chargement</div>';}
    }
  },

  // ══════════════════════════════════════════════════
  // ── CHAT MODULE ──
  // ══════════════════════════════════════════════════
  chat:{
    _channel:'general',
    _unsubscribe:null,
    _channels:[
      {id:'general',   name:'# général',       icon:'fa-hashtag',  color:'#003896'},
      {id:'dlc',       name:'# dates courtes',  icon:'fa-calendar-xmark', color:'#dc2626'},
      {id:'reception', name:'# réception',      icon:'fa-truck-ramp-box', color:'#059669'},
      {id:'planning',  name:'# planning',       icon:'fa-calendar-days',  color:'#0891b2'},
      {id:'direction', name:'🔒 direction',     icon:'fa-lock',     color:'#7c3aed', adminOnly:true},
    ],

    render(){
      const wrap=document.getElementById('chat-channel-list');
      const msgWrap=document.getElementById('chat-messages');
      if(!wrap||!msgWrap)return;

      // Render channel list
      const me=window.app.me||{};
      const channels=this._channels.filter(c=>{
        if(c.adminOnly&&me.role!=='admin')return false;
        if(me.role==='admin')return true;
        if(c.allowedUsers&&!c.allowedUsers.includes(me.uid))return false;
        return true;
      });
      wrap.innerHTML=channels.map(c=>`
        <div class="chat-channel-btn ${this._channel===c.id?'active':''}" onclick="app.chat.selectChannel('${c.id}')">
          <i class="fas ${c.icon}" style="color:${c.color};margin-right:8px;"></i>
          <span>${c.name}</span>
        </div>`).join('');

      this.loadMessages();
    },

    selectChannel(id){
      this._channel=id;
      if(this._unsubscribe){try{this._unsubscribe();}catch(e){}}
      this.render();
    },

    loadMessages(){
      const wrap=document.getElementById('chat-messages');
      if(!wrap)return;
      wrap.innerHTML='<div style="text-align:center;padding:20px;color:#94a3b8;font-size:14px;"><i class="fas fa-spinner fa-spin"></i> Chargement…</div>';

      try{
        const{collection,query,orderBy,limit,onSnapshot,addDoc,serverTimestamp}=window._fbChat;
        const colRef=collection(window._db,'chat_'+this._channel);
        const q=query(colRef,orderBy('ts','desc'),limit(50));
        this._unsubscribe=onSnapshot(q,snap=>{
          const msgs=[];snap.forEach(d=>msgs.push({id:d.id,...d.data()}));
          msgs.reverse();
          this._renderMessages(msgs);
          this._updateBadges(0);
        },()=>{wrap.innerHTML='<div style="text-align:center;padding:20px;color:#94a3b8;">Chargement impossible.</div>';});
      }catch(e){
        wrap.innerHTML='<div style="text-align:center;padding:20px;color:#94a3b8;">Firebase non disponible.</div>';
      }
    },

    _renderMessages(msgs){
      const wrap=document.getElementById('chat-messages');
      if(!wrap)return;
      const me=window.app.me||{};
      if(!msgs.length){
        wrap.innerHTML='<div style="text-align:center;padding:30px;color:#94a3b8;"><i class="fas fa-comment-slash" style="font-size:30px;margin-bottom:8px;display:block;opacity:.3;"></i>Aucun message dans ce canal.</div>';
        return;
      }
      wrap.innerHTML=msgs.map(m=>{
        const isMe=m.userId===me.uid;
        const ts=m.ts?new Date(m.ts.toMillis?m.ts.toMillis():(m.ts||0)):new Date();
        const timeStr=ts.toLocaleTimeString('fr',{hour:'2-digit',minute:'2-digit'});
        const dateStr=ts.toLocaleDateString('fr',{day:'numeric',month:'short'});
        const initials=(m.userName||'?').split(' ').map(x=>x[0]||'').join('').toUpperCase().slice(0,2);
        return`<div class="chat-msg-wrap ${isMe?'me':''}">
          ${!isMe?`<div class="chat-avatar">${initials}</div>`:''}
          <div class="chat-bubble ${isMe?'me':'other'}">
            ${!isMe?`<div class="chat-sender">${m.userName||'?'}</div>`:''}
            <div class="chat-text">${(m.text||'').replace(/</g,'&lt;').replace(/\n/g,'<br>')}</div>
            <div class="chat-time">${dateStr} ${timeStr}</div>
          </div>
          ${isMe?`<div class="chat-avatar me">${initials}</div>`:''}
        </div>`;
      }).join('');
      // Scroll to bottom
      wrap.scrollTop=wrap.scrollHeight;
    },

    send:async function(){
      const inp=document.getElementById('chat-input');
      const text=(inp?.value||'').trim();
      if(!text)return;
      const me=window.app.me;
      if(!me)return toast('Connexion requise.','err');
      inp.value='';
      try{
        const{collection,addDoc,serverTimestamp}=window._fbChat;
        await addDoc(collection(window._db,'chat_'+this._channel),{
          text,
          userId:me.uid,
          userName:me.name||me.email||'USER',
          ts:serverTimestamp(),
          channel:this._channel
        });
      }catch(e){toast('Erreur envoi message.','err');inp.value=text;}
    },

    sendOnEnter(e){if((e.key==='Enter')&&!e.shiftKey){e.preventDefault();this.send();}},

    _updateBadges(unread){
      const b=document.getElementById('badge-chat-gm');
      if(b){b.textContent=unread+' nouveau(x)';b.style.display=unread>0?'inline-block':'none';}
    }
  },

  // ══════════════════════════════════════════════════
  // ── PWA INSTALL PROMPT ──
  // ══════════════════════════════════════════════════
  _deferredInstallPrompt:null,

  _initInstallPrompt(){
    window.addEventListener('beforeinstallprompt',e=>{
      e.preventDefault();
      this._deferredInstallPrompt=e;
      // Show install banner
      setTimeout(()=>this._maybeShowInstallPrompt(),2000);
    });
    window.addEventListener('appinstalled',()=>{
      const b=document.getElementById('pwa-install-banner');
      if(b)b.style.display='none';
      toast('✓ Application installée avec succès !','ok',4000);
    });
  },

  _maybeShowInstallPrompt(){
    if(!this._deferredInstallPrompt)return;
    // Check if already installed
    if(window.matchMedia('(display-mode: fullscreen)').matches||
       window.matchMedia('(display-mode: standalone)').matches)return;
    const b=document.getElementById('pwa-install-banner');
    if(b)b.style.display='flex';
  },

  installPWA:async function(){
    const b=document.getElementById('pwa-install-banner');
    if(!this._deferredInstallPrompt){
      toast('Pour ajouter : utilisez le menu partage de votre navigateur → "Sur l\'écran d\'accueil".','info',6000);
      return;
    }
    this._deferredInstallPrompt.prompt();
    const{outcome}=await this._deferredInstallPrompt.userChoice;
    this._deferredInstallPrompt=null;
    if(b)b.style.display='none';
  }

};
globalThis.app = window.app;
window.app.initOffline();
window.app._initInstallPrompt();

// Wire photo inputs
document.getElementById('cam-input').addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;window.app.common.compressImg(f,b64=>{document.getElementById('img-preview').src=b64;document.getElementById('img-preview').style.display='block';document.getElementById('lib-img-data').value=b64;});});
document.getElementById('trace-file').addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;window.app.common.compressImg(f,b64=>{window.app.trace.imgData=b64;document.getElementById('trace-preview').src=b64;document.getElementById('trace-preview').style.display='block';});});

// Auth state
onAuthStateChanged(auth,async user=>{
  if(!user){
    document.getElementById('login-overlay').classList.remove('hidden');
    document.getElementById('app-header').classList.add('hidden');
    document.getElementById('app-nav').classList.add('hidden');
    window.app.me=null;
    window.app.data={frais:[],users:[],pvpLib:[],pvpStock:[],checkedNeeds:[],saladLib:[],saladStock:[],frigo:{perDay:2,fridges:[],logs:[]},todo:{zones:[],tasks:[]},todoLogs:[],reception:[]};
    return;
  }
  await window.app.afterLoginBootstrap();
});
