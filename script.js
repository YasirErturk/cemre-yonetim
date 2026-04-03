const SUPABASE_URL = 'https://daruffqlidfrhbwswopn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_8CQ-97MUtgaTGkgOo2xFcg_3ZijKORD';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SESSION_TIME = 10 * 60;
let remainingTime = SESSION_TIME;
let countdownInterval, rawData = [];

(async () => {
    checkSession();
})();

async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const isOk = !!session;
    
    document.getElementById('loginDiv').style.display = isOk ? 'none' : 'flex';
    document.getElementById('timerDisplay').style.display = isOk ? 'flex' : 'none';
    document.getElementById('tabButtons').style.display = isOk ? 'flex' : 'none';
    document.getElementById('adminDiv').style.display = isOk ? 'block' : 'none';
    
    if(isOk) {
        startTimer();
        loadSakinlerData();
        setToday();
    }
    fetchData();
}

function startTimer() {
    clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
        remainingTime--;
        let m = Math.floor(remainingTime / 60), s = remainingTime % 60;
        document.getElementById('countdown').innerText = `${m}:${s < 10 ? '0' : ''}${s}`;
        if (remainingTime <= 0) location.reload();
    }, 1000);
}

function setToday() {
    document.getElementById('islemTarihi').value = new Date().toISOString().split('T')[0];
}

async function fetchData() {
    const { data } = await supabaseClient.from('veriler').select('*').order('created_at', { ascending: false });
    rawData = data || [];
    listeleVeriler();
}

window.listeleVeriler = () => {
    const search = document.getElementById('searchFilter').value.toLowerCase();
    const daire = document.getElementById('daireFilter').value;
    const year = document.getElementById('yearFilter').value;
    const type = document.getElementById('typeFilter').value;
    const wallet = document.getElementById('walletFilter').value;
    
    let filtered = rawData.filter(item => {
        const itemYear = new Date(item.created_at).getFullYear().toString();
        const isGelir = item.baslik.includes('Aidat');
        return (item.baslik.toLowerCase().includes(search) || item.aciklama.toLowerCase().includes(search)) &&
               (daire === 'all' || item.baslik.includes(daire)) &&
               (year === 'all' || itemYear === year) &&
               (type === 'all' || (type === 'gelir' && isGelir) || (type === 'gider' && !isGelir)) &&
               (wallet === 'all' || item.aciklama.includes(`[${wallet}]`));
    });
    renderUI(filtered);
}

function renderUI(data) {
    let b = 0, n = 0;
    const liste = document.getElementById('veriListesi');
    liste.innerHTML = '';

    rawData.forEach(item => {
        const t = parseFloat(item.aciklama) || 0;
        const isGelir = item.baslik.includes('Aidat');
        const isBanka = item.aciklama.includes('[Banka]');
        if (isGelir) { if(isBanka) b += t; else n += t; } else { if(isBanka) b -= t; else n -= t; }
    });

    data.forEach(item => {
        const isGelir = item.baslik.includes('Aidat');
        const isBanka = item.aciklama.includes('[Banka]');
        const itemColor = isBanka ? '#6366f1' : '#f59e0b';
        const sysDate = new Date(item.created_at).toLocaleDateString('tr-TR');
        const parts = item.baslik.split(' | ');
        const islemTarihi = parts[0]; 
        const asilBaslik = parts.slice(1).join(' | ');

        liste.innerHTML += `
            <li style="border-left: 6px solid ${itemColor}">
                <div>
                    <span class="date-badge islem-date">📅 İşlem: ${islemTarihi}</span>
                    <span class="date-badge kayit-date">📝 Kayıt: ${sysDate}</span>
                    <br><strong style="color:${isGelir?'#10b981':'#ef4444'}">${asilBaslik}</strong><br>
                    <small>${item.aciklama}</small>
                </div>
                <div class="item-actions">
                    <span style="font-weight:800;">${parseFloat(item.aciklama).toLocaleString()} TL</span>
                    <button class="edit-btn" onclick="editItem(${item.id})">✎</button>
                    <button class="del-btn" onclick="deleteItem(${item.id})">✖</button>
                </div>
            </li>`;
    });
    
    document.getElementById('totalBanka').innerText = b.toLocaleString('tr-TR') + " TL";
    document.getElementById('totalNakit').innerText = n.toLocaleString('tr-TR') + " TL";
    document.getElementById('totalGenel').innerText = (b + n).toLocaleString('tr-TR') + " TL";
}

document.getElementById('ekleBtn').onclick = async () => {
    const t = document.getElementById('tutar').value;
    const tarih = document.getElementById('islemTarihi').value;
    const detay = document.getElementById('detay').value;
    if(!t || !tarih) return alert("Tutar ve Tarih girin!");

    const trTarih = tarih.split('-').reverse().join('.');
    await supabaseClient.from('veriler').insert([{ 
        baslik: `${trTarih} | ${document.getElementById('sakinSecici').value} | ${document.getElementById('kategori').value}`, 
        aciklama: `${t} TL [${document.getElementById('kasaTipi').value}] - ${detay}` 
    }]);

    document.getElementById('tutar').value = '';
    document.getElementById('detay').value = '';
    fetchData();
};

window.deleteItem = async (id) => { if(confirm("Silinsin mi?")) { await supabaseClient.from('veriler').delete().eq('id', id); fetchData(); } }

window.editItem = async (id) => {
    const val = prompt("Yeni tutarı girin:");
    if(val && !isNaN(val)) {
        const item = rawData.find(x => x.id === id);
        const yeniAciklama = item.aciklama.replace(parseFloat(item.aciklama), val);
        await supabaseClient.from('veriler').update({ aciklama: yeniAciklama }).eq('id', id);
        fetchData();
    }
}

// SAKİN İŞLEMLERİ
async function loadSakinlerData() {
    const { data } = await supabaseClient.from('sakinler').select('*').order('daire_no');
    const sel = document.getElementById('sakinSecici');
    const fil = document.getElementById('daireFilter');
    const list = document.getElementById('sakinListesi');
    
    sel.innerHTML = '<option value="Genel">Apartman Ortak</option>';
    fil.innerHTML = '<option value="all">Tüm Daireler</option>';
    list.innerHTML = '';

    data?.forEach(s => {
        const txt = `Daire ${s.daire_no} - ${s.ad_soyad}`;
        sel.innerHTML += `<option value="${txt}">${txt}</option>`;
        fil.innerHTML += `<option value="Daire ${s.daire_no}">Daire ${s.daire_no}</option>`;
        list.innerHTML += `
            <li>
                <span>${txt}</span>
                <div class="item-actions">
                    <button class="edit-btn" onclick="editSakin(${s.id}, '${s.ad_soyad}', ${s.daire_no})">✎</button>
                    <button class="del-btn" onclick="deleteSakin(${s.id})">✖</button>
                </div>
            </li>`;
    });
}

document.getElementById('sakinKaydetBtn').onclick = async () => {
    const no = document.getElementById('inputDaireNo').value;
    const ad = document.getElementById('inputAdSoyad').value;
    if(no && ad) {
        await supabaseClient.from('sakinler').insert([{ daire_no: no, ad_soyad: ad }]);
        document.getElementById('inputDaireNo').value = '';
        document.getElementById('inputAdSoyad').value = '';
        loadSakinlerData();
    }
}

window.editSakin = async (id, ad, no) => {
    const yeniAd = prompt("Yeni Ad Soyad:", ad);
    const yeniNo = prompt("Yeni Daire No:", no);
    if(yeniAd && yeniNo) {
        await supabaseClient.from('sakinler').update({ ad_soyad: yeniAd, daire_no: yeniNo }).eq('id', id);
        loadSakinlerData();
    }
}

window.deleteSakin = async (id) => { if(confirm("Sakini siliyorum?")) { await supabaseClient.from('sakinler').delete().eq('id', id); loadSakinlerData(); } }

window.showTab = (n) => {
    ['kayitlarTab','sakinlerTab'].forEach(x => document.getElementById(x).style.display='none');
    ['tab-kayitlar','tab-sakinler'].forEach(x => document.getElementById(x).classList.remove('active'));
    document.getElementById(n+'Tab').style.display='block';
    document.getElementById('tab-'+n).classList.add('active');
}

document.getElementById('loginBtn').onclick = async () => {
    await supabaseClient.auth.signInWithPassword({ email: document.getElementById('email').value, password: document.getElementById('password').value });
    checkSession();
}

document.getElementById('topLogoutBtn').onclick = async () => { await supabaseClient.auth.signOut(); location.reload(); };