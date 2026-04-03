const SUPABASE_URL = 'https://daruffqlidfrhbwswopn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_8CQ-97MUtgaTGkgOo2xFcg_3ZijKORD';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SESSION_TIME = 5 * 60; 
let remainingTime = SESSION_TIME;
let inactivityTimer, countdownTimer;

// DOM Elemanları
const loginDiv = document.getElementById('loginDiv');
const adminDiv = document.getElementById('adminDiv');
const tabButtons = document.getElementById('tabButtons');
const sakinSecici = document.getElementById('sakinSecici');

checkSession();

// SEKME YÖNETİMİ
window.showTab = function(tabName) {
    document.getElementById('kayitlarTab').style.display = tabName === 'kayitlar' ? 'block' : 'none';
    document.getElementById('sakinlerTab').style.display = tabName === 'sakinler' ? 'block' : 'none';
    document.getElementById('tab-kayitlar').classList.toggle('active', tabName === 'kayitlar');
    document.getElementById('tab-sakinler').classList.toggle('active', tabName === 'sakinler');
}

async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const isLoggedIn = !!session;
    loginDiv.style.display = isLoggedIn ? 'none' : 'flex';
    document.getElementById('timerDisplay').style.display = isLoggedIn ? 'flex' : 'none';
    tabButtons.style.display = isLoggedIn ? 'flex' : 'none';
    adminDiv.style.display = isLoggedIn ? 'block' : 'none';
    if (isLoggedIn) { resetInactivityTimer(); loadSakinlerIntoSelect(); }
    listeleVeriler();
    listeleSakinler();
}

// SAKİN YÖNETİMİ
async function loadSakinlerIntoSelect() {
    const { data } = await supabaseClient.from('sakinler').select('*').order('daire_no');
    // En başa Ortak Alan seçeneğini ekliyoruz
    sakinSecici.innerHTML = '<option value="Ortak Alan / Apartman">Ortak Alan / Apartman</option>';
    data?.forEach(s => {
        const opt = document.createElement('option');
        opt.value = `Daire ${s.daire_no} - ${s.ad_soyad}`;
        opt.innerText = `Daire ${s.daire_no}: ${s.ad_soyad}`;
        sakinSecici.appendChild(opt);
    });
}

document.getElementById('sakinEkleBtn').onclick = async () => {
    const ad = document.getElementById('sakinAd').value.trim();
    const no = parseInt(document.getElementById('daireNo').value);
    if(!ad || isNaN(no)) return alert("İsim ve daire no giriniz!");
    if(no < 1 || no > 12) return alert("Daire 1-12 arası olmalı!");

    const { error } = await supabaseClient.from('sakinler').insert([{ ad_soyad: ad, daire_no: no.toString() }]);
    if (error) alert("Hata: " + error.message);
    else {
        document.getElementById('sakinAd').value = '';
        document.getElementById('daireNo').value = '';
        listeleSakinler(); loadSakinlerIntoSelect();
    }
};

async function listeleSakinler() {
    const { data } = await supabaseClient.from('sakinler').select('*').order('daire_no');
    const liste = document.getElementById('sakinListesi');
    liste.innerHTML = '';
    data?.forEach(s => {
        const li = document.createElement('li');
        li.innerHTML = `<div class="item-content"><b>Daire ${s.daire_no}</b>: ${s.ad_soyad}</div>
                        <button class="btn-delete" onclick="sakinSil(${s.id})">Sil</button>`;
        liste.appendChild(li);
    });
}

window.sakinSil = async (id) => {
    if(confirm("Silinsin mi?")) {
        await supabaseClient.from('sakinler').delete().eq('id', id);
        listeleSakinler(); loadSakinlerIntoSelect();
    }
};

// İŞLEM KAYITLARI (TUTAR VE DETAY AYRIMI)
document.getElementById('ekleBtn').onclick = async () => {
    const s = sakinSecici.value;
    const k = document.getElementById('kategori').value;
    const t = document.getElementById('tutar').value;
    const d = document.getElementById('detay').value;

    if(!k || !t || !d) return alert("Lütfen kategori, tutar ve detay alanlarını doldurun!");

    // Başlık ve Açıklamayı düzenliyoruz
    const tamBaslik = `${s} | ${k}`;
    const tamAciklama = `${t} TL - ${d}`;

    await supabaseClient.from('veriler').insert([{ baslik: tamBaslik, aciklama: tamAciklama }]);
    document.getElementById('tutar').value = '';
    document.getElementById('detay').value = '';
    listeleVeriler();
};

async function listeleVeriler() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const { data } = await supabaseClient.from('veriler').select('*').order('id', { ascending: false });
    document.getElementById('dataCount').innerText = `${data ? data.length : 0} Kayıt`;
    const liste = document.getElementById('veriListesi');
    liste.innerHTML = '';
    data?.forEach(item => {
        const li = document.createElement('li');
        // TL kısmını kalınlaştırarak gösteriyoruz
        li.innerHTML = `<div class="item-content">
                            <strong>${item.baslik}</strong><br>
                            <span style="color:#00b894; font-weight:bold;">${item.aciklama.split(' - ')[0]}</span> - ${item.aciklama.split(' - ')[1] || ''}
                        </div>`;
        if(!!session) li.innerHTML += `<button class="btn-delete" onclick="deleteItem(${item.id})">Sil</button>`;
        liste.appendChild(li);
    });
}

window.deleteItem = async (id) => {
    if(confirm('Silinsin mi?')) { await supabaseClient.from('veriler').delete().eq('id', id); listeleVeriler(); }
};

// GİRİŞ/ÇIKIŞ
document.getElementById('loginBtn').onclick = async () => {
    const e = document.getElementById('email').value;
    const p = document.getElementById('password').value;
    const { error } = await supabaseClient.auth.signInWithPassword({ email: e, password: p });
    if (error) alert("Hata: " + error.message); else checkSession();
};

document.getElementById('topLogoutBtn').onclick = async () => {
    await supabaseClient.auth.signOut(); location.reload();
};

function resetInactivityTimer() {
    stopTimers();
    remainingTime = SESSION_TIME;
    countdownTimer = setInterval(() => {
        remainingTime--;
        document.getElementById('countdown').innerText = Math.floor(remainingTime/60) + ":" + (remainingTime%60).toString().padStart(2,'0');
        if(remainingTime <= 0) location.reload();
    }, 1000);
    inactivityTimer = setTimeout(async () => { await supabaseClient.auth.signOut(); location.reload(); }, SESSION_TIME*1000);
}
function stopTimers() { clearTimeout(inactivityTimer); clearInterval(countdownTimer); }