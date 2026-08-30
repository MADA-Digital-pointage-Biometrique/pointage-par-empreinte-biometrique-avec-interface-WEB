<?php
session_start();
$initialMode = 'pointage';
$initialUserId = null;
try {
    $cfgDb = require __DIR__ . '/../config/database.php';
    $pdoMobile = new PDO('mysql:host='.$cfgDb['host'].';dbname='.$cfgDb['dbname'].';charset='.$cfgDb['charset'], $cfgDb['username'], $cfgDb['password']);
    $cfgMobile = $pdoMobile->query('SELECT mode, user_id FROM mobile_config WHERE id=1')->fetch(PDO::FETCH_ASSOC);
    if ($cfgMobile) { $initialMode = $cfgMobile['mode'] ?? 'pointage'; $initialUserId = $cfgMobile['user_id'] ?? null; }
} catch(Throwable $e){ $initialMode = 'pointage'; $initialUserId = null; }
$initialLabel = $initialMode==='enrolement' ? 'Mode : Enrôlement' : 'Mode : Pointage';
$initialTitle = $initialMode==='enrolement' ? 'Enrôlement' : 'Pointage';
$initialDesc = $initialMode==='enrolement' ? 'Empreinte à enrôler pour l\'utilisateur #'.($initialUserId??'') : 'Posez le doigt pour pointer (entrée/sortie)';
$initialBadgeClass = $initialMode==='enrolement' ? 'px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-white' : 'px-3 py-1 rounded-full text-xs font-bold bg-emerald-500 text-white';
$initialBtnLabel = $initialMode==='enrolement' ? 'Enrôler l\'empreinte' : 'Capturer pour pointer';
?>
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="theme-color" content="#F46A21">
<title>Capture Empreinte</title>
<script src="https://cdn.tailwindcss.com"></script>
<script src="assets/js/config.js"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@600;800&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined&display=block" rel="stylesheet">
<style>body{font-family:'Inter',sans-serif}</style>
</head>
<body class="bg-[#0F172A] text-white min-h-screen flex flex-col">
<header class="px-4 py-3 flex items-center justify-between border-b border-white/10">
  <div class="flex items-center gap-2"><div class="w-8 h-8 rounded-lg bg-gradient-to-br from-[#F46A21] to-[#F9AE3F] flex items-center justify-center"><span class="material-symbols-outlined">fingerprint</span></div><b>P.Biometrique</b></div>
  <div class="text-[11px] text-white/60">192.168.2.12 → 192.168.2.2:8080</div>
</header>
<main class="flex-1 flex flex-col items-center justify-center px-6 py-8 text-center max-w-md mx-auto w-full">
  <div id="mode-badge" class="<?= $initialBadgeClass ?>"><?= htmlspecialchars($initialLabel) ?></div>
  <div class="mt-4 w-28 h-28 rounded-full bg-white/5 border border-white/10 flex items-center justify-center" id="icon-wrap"><span class="material-symbols-outlined text-[56px] text-[#F9AE3F]">fingerprint</span></div>
  <h1 id="mode-title" class="mt-5 text-2xl font-extrabold"><?= htmlspecialchars($initialTitle) ?></h1>
  <p id="mode-desc" class="mt-2 text-sm text-white/60"><?= htmlspecialchars($initialDesc) ?></p>
  <button id="btn-capture" class="mt-8 w-full bg-gradient-to-r from-[#F46A21] to-[#F9AE3F] rounded-2xl py-4 font-extrabold text-lg shadow-lg flex items-center justify-center gap-2"><span class="material-symbols-outlined">touch_app</span><span id="btn-label"><?= htmlspecialchars($initialBtnLabel) ?></span></button>
  <p id="status" class="mt-3 text-xs font-mono text-white/50">Prêt • <?= htmlspecialchars($initialMode) ?></p>
</main>
<script src="assets/js/api.js?v=<?= time() ?>"></script>
<script src="assets/js/webauthn.js?v=<?= time() ?>"></script>
<script>
const PC_HOST = '192.168.2.2';
const PC_ORIGIN = 'http://' + PC_HOST + '/projet_Stage_MADA-Digital';
const WS_URL = 'ws://' + PC_HOST + ':8080';
AppConfig.setWsHost(PC_HOST);
WebAuthn.setRelyingParty(PC_HOST, 'P.Biometrique');
let currentMode = '<?= $initialMode ?>';
let currentUserId = <?= $initialUserId ? (int)$initialUserId : 'null' ?>;
const $ = s => document.getElementById(s);
// Toujours récupérer la valeur depuis la base via AJAX
function renderMode(cfg){
  if(!cfg) return;
  currentMode = cfg.mode;
  currentUserId = cfg.user_id;
  const badge=$('mode-badge'), title=$('mode-title'), desc=$('mode-desc'), btnLabel=$('btn-label');
  if(cfg.mode==='enrolement'){
    badge.textContent='Mode : Enrôlement'; badge.className='px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-white';
    title.textContent='Enrôlement';
    desc.textContent = cfg.user_id ? 'Empreinte à enrôler pour l\'utilisateur #' + cfg.user_id : 'En attente utilisateur...';
    btnLabel.textContent='Enrôler l\'empreinte';
  } else {
    badge.textContent='Mode : Pointage'; badge.className='px-3 py-1 rounded-full text-xs font-bold bg-emerald-500 text-white';
    title.textContent='Pointage';
    desc.textContent='Posez le doigt pour pointer (entrée/sortie)';
    btnLabel.textContent='Capturer pour pointer';
  }
  $('status').textContent = 'Sync DB: ' + cfg.mode + (cfg.user_id ? ' (#'+cfg.user_id+')' : '') + ' @ ' + new Date().toLocaleTimeString();
}
// AJAX pur : poll base toutes les 800ms, met à jour sans refresh
async function fetchMode(){
  try{
    const res = await fetch('../api/mobile_config.php?_=' + Date.now(), {cache:'no-store', headers:{'Cache-Control':'no-cache'}});
    const data = await res.json();
    if(data.ok && data.config) renderMode(data.config);
  }catch(e){ $('status').textContent = 'Erreur sync: ' + e.message; }
}
fetchMode();
setInterval(fetchMode, 800);
// Temps réel via WebSocket
try {
  const wsUrl = 'ws://192.168.2.2:8080';
  const ws = new WebSocket(wsUrl);
  ws.onopen = () => { log('WS connecté'); $('status').textContent = 'WS connecté • ' + currentMode; };
  ws.onmessage = (e) => {
    try {
      const d = JSON.parse(e.data);
      if (d.type === 'mobile_config' && d.config) {
        renderMode(d.config);
        log('Mode temps réel: ' + d.config.mode);
      }
    } catch {}
  };
  ws.onerror = () => log('WS erreur');
  ws.onclose = () => log('WS fermé');
} catch(e){ log('WS init erreur: '+e.message); }

$('btn-capture').onclick = async () => {
  const btn=$('btn-capture'); btn.disabled=true; $('status').textContent='Demande capteur...';
  try{
    if(currentMode==='enrolement'){
      if(!currentUserId){ log('Aucun utilisateur sélectionné par l\'admin','text-amber-400'); return; }
      log('Enrôlement: capteur...');
      const r = await WebAuthn.enroll(String(currentUserId), 'user'+currentUserId, 'User '+currentUserId);
      log('Enrôlé OK: '+r.credentialId,'text-emerald-400');
      $('status').textContent='Enrôlé OK';
    } else {
      // Pointage : on tente une vérification générique ; on récupère d'abord un challenge pour un user temporaire,
      // puis on laisse le serveur identifier via credentialId (1:N simplifié : on tente verify avec le user du challenge)
      // Pour le test, on fait un verify avec le dernier user enrôlé ou 1
      const uid = currentUserId || 1;
      log('Pointage: capteur...');
      const r = await WebAuthn.verify(String(uid));
      log('Pointage vérifié','text-emerald-400');
      $('status').textContent='Pointage OK';
    }
  }catch(e){ log('Échec: '+e.message,'text-rose-400'); $('status').textContent='Échec: '+e.message; }
  finally{ btn.disabled=false; }
};
log('Prêt. PC: '+PC_HOST+' WS: '+WS_URL);
</script>
</body>
</html>
