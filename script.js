// Supabase Yapılandırması
const SUPABASE_URL = 'https://daruffqlidfrhbwswopn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_8CQ-97MUtgaTGkgOo2xFcg_3ZijKORD';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SESSION_TIME = 10 * 60; // 10 Dakika
let remainingTime = SESSION_TIME;
let countdownInterval, rawData = [], sakinlerData = [];

const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

// Başlatıcı
(async () => {
    checkSession();
})();

// Oturum Yönetimi
async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const isOk = !!session;
    
    document.getElementById('loginDiv').style.display = isOk ? 'none' : 'flex';
    document.getElementById('timerDisplay').style.display = isOk ? 'flex' : 'none';
    document.getElementById('tabButtons').style.display = isOk ? 'flex' : 'none';
    document.getElementById('adminDiv').style.display = isOk ? 'block' : 'none';
    
    await loadSakinlerData();
    if(isOk) { startTimer(); setToday(); }
    fetchData();
}

function startTimer() {
    clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
        remainingTime--;
        let m = Math.floor(remainingTime / 60), s = remainingTime % 60;
        document.getElementById('countdown').innerText = `${m}:${s < 10 ? '0' : ''}${s}`;
        if (remainingTime <= 0) logout();
    }, 1000);
}

function setToday() { document.getElementById('islemTarihi').value = new Date().toISOString().split('T')[0]; }

// Veri Çekme
async function fetchData() {
    const { data } = await supabaseClient.from('veriler').select('*').order('created_at', { ascending: false });
    rawData = data || [];
    listeleVeriler();
    renderPaymentTable();
}

// Filtreleme ve Arayüz
window.listeleVeriler = () => {
    const search = document.getElementById('searchFilter').value.toLowerCase();
    const daire = document.getElementById('daireFilter').value;
    const year = document.getElementById('yearFilter').value;
    const type = document.getElementById('typeFilter').value;
    const wallet = document.getElementById('walletFilter').value;
    
    let filtered = rawData.filter(item => {
        const d = item.islem_tarihi ? new Date(item.islem_tarihi) : null;
        const itemYear = d ? d.getFullYear().toString() : "all";
        
        return (item.baslik.toLowerCase().includes(search) || item.aciklama.toLowerCase().includes(search)) &&
               (daire === 'all' || item.daire_no == daire.replace('Daire ','')) &&
               (year === 'all' || itemYear === year) &&
               (type === 'all' || item.kategori === type) &&
               (wallet === 'all' || item.aciklama.includes(`[${wallet}]`));
    });
    renderUI(filtered);
}

function renderUI(data) {
    let b = 0, n = 0;
    const liste = document.getElementById('veriListesi');
    liste.innerHTML = '';
    const isVisible = document.getElementById('adminDiv').style.display === 'block';

    rawData.forEach(item => {
        const t = parseFloat(item.aciklama) || 0;
        const isGelir = item.baslik.includes('Aidat') || item.kategori === 'Aidat';
        const isBanka = item.aciklama.includes('[Havale/EFT]');
        if (isGelir) { if(isBanka) b += t; else n += t; } else { if(isBanka) b -= t; else n -= t; }
    });

    data.forEach(item => {
        const isGelir = item.kategori === 'Aidat';
        const isBanka = item.aciklama.includes('[Havale/EFT]');
        const itemColor = isBanka ? '#6366f1' : '#f59e0b';
        const sysDate = new Date(item.created_at).toLocaleDateString('tr-TR');
        const islemTarihi = item.islem_tarihi ? item.islem_tarihi.split('-').reverse().join('.') : "---";

        const actionButtons = isVisible ? `
            <button class="edit-btn" onclick="editItem(${item.id})">✎</button>
            <button class="del-btn" onclick="deleteItem(${item.id})">✖</button>` : '';

        liste.innerHTML += `
            <li style="border-left: 6px solid ${itemColor}">
                <div>
                    <span class="date-badge islem-date">📅 İşlem: ${islemTarihi}</span>
                    <span class="date-badge kayit-date">📝 Kayıt: ${sysDate}</span><br>
                    <strong style="color:${isGelir?'#10b981':'#ef4444'}">${item.baslik.split(' | ').slice(1).join(' | ')}</strong><br>
                    <small>${item.aciklama}</small>
                </div>
                <div class="item-actions">
                    <span style="font-weight:800;">${parseFloat(item.aciklama).toLocaleString()} TL</span>
                    ${actionButtons}
                </div>
            </li>`;
    });
    
    document.getElementById('totalBanka').innerText = b.toLocaleString('tr-TR', {minimumFractionDigits:2}) + " TL";
    document.getElementById('totalNakit').innerText = n.toLocaleString('tr-TR', {minimumFractionDigits:2}) + " TL";
    document.getElementById('totalGenel').innerText = (b + n).toLocaleString('tr-TR', {minimumFractionDigits:2}) + " TL";
}

// ÖDEME TABLOSU (Detaylı Görünüm: Tarih + Tutar)
function renderPaymentTable() {
    const seciliYil = document.getElementById('tableYearFilter').value;
    const thead = document.getElementById('tableHead');
    const tbody = document.getElementById('tableBody');
    if(!thead || !tbody) return;

    // Başlıkları oluştur
    thead.innerHTML = '<th>Daire / Sakin</th>' + AYLAR.map(ay => `<th>${ay}</th>`).join('');
    tbody.innerHTML = '';

    sakinlerData.forEach(sakin => {
        let row = `<tr><td><strong>Daire ${sakin.daire_no}</strong><br><small>${sakin.ad_soyad}</small></td>`;
        
        for (let ay = 1; ay <= 12; ay++) {
            // İlgili aya ait aidat kaydını bul
            const odeme = rawData.find(item => {
                if (!item.islem_tarihi || item.kategori !== 'Aidat') return false;
                const d = new Date(item.islem_tarihi);
                return item.daire_no == sakin.daire_no && 
                       (d.getMonth() + 1) === ay && 
                       d.getFullYear().toString() === seciliYil;
            });

            if (odeme) {
                // Tutarı aciklama içinden çek (Örn: "250 TL [Havale/EFT]..." -> "250 TL")
                const tutar = odeme.aciklama.split(' [')[0]; 
                // Tarihi formatla (YYYY-MM-DD -> DD.MM)
                const günAy = odeme.islem_tarihi.split('-').reverse().slice(0,2).join('.');
                
                // Hücreye hem tarih hem tutar yaz
                row += `<td class="paid-cell">
                            <div style="font-size: 10px; opacity: 0.8;">${günAy}</div>
                            <div style="font-size: 11px;">${tutar}</div>
                        </td>`;
            } else {
                row += `<td></td>`;
            }
        }
        row += '</tr>';
        tbody.innerHTML += row;
    });
}

// YENİ İŞLEM EKLE (YENİ SÜTUNLARLA)
document.getElementById('ekleBtn').onclick = async () => {
    const t = document.getElementById('tutar').value;
    const tarih = document.getElementById('islemTarihi').value;
    const detay = document.getElementById('detay').value;
    const sakinTxt = document.getElementById('sakinSecici').value;
    const kategori = document.getElementById('kategori').value;
    const kasa = document.getElementById('kasaTipi').value;

    if(!t || !tarih) return alert("Eksik bilgi!");

    const daireNo = sakinTxt.match(/Daire (\d+)/) ? parseInt(sakinTxt.match(/Daire (\d+)/)[1]) : null;
    const trTarih = tarih.split('-').reverse().join('.');

    await supabaseClient.from('veriler').insert([{ 
        baslik: `${trTarih} | ${sakinTxt} | ${kategori}`, 
        aciklama: `${t} TL [${kasa}] - ${detay}`,
        islem_tarihi: tarih,
        daire_no: daireNo,
        kategori: kategori
    }]);

    document.getElementById('tutar').value = '';
    document.getElementById('detay').value = '';
    fetchData();
};

// SAKİN YÖNETİMİ
async function loadSakinlerData() {
    const { data } = await supabaseClient.from('sakinler').select('*').order('daire_no');
    sakinlerData = data || [];
    const sel = document.getElementById('sakinSecici');
    const fil = document.getElementById('daireFilter');
    const list = document.getElementById('sakinListesi');
    
    if(!sel) return;
    sel.innerHTML = '<option value="Genel">Apartman Ortak</option>';
    fil.innerHTML = '<option value="all">Tüm Daireler</option>';
    list.innerHTML = '';

    sakinlerData.forEach(s => {
        const txt = `Daire ${s.daire_no} - ${s.ad_soyad}`;
        sel.innerHTML += `<option value="${txt}">${txt}</option>`;
        fil.innerHTML += `<option value="Daire ${s.daire_no}">Daire ${s.daire_no}</option>`;
        const isVisible = document.getElementById('adminDiv').style.display === 'block';
        const actionBtns = isVisible ? `<div class="item-actions"><button class="edit-btn" onclick="editSakin(${s.id}, '${s.ad_soyad}', ${s.daire_no})">✎</button><button class="del-btn" onclick="deleteSakin(${s.id})">✖</button></div>` : '';
        list.innerHTML += `<li><span>${txt}</span>${actionBtns}</li>`;
    });
}

document.getElementById('sakinKaydetBtn').onclick = async () => {
    const no = document.getElementById('inputDaireNo').value;
    const ad = document.getElementById('inputAdSoyad').value;
    if(no && ad) {
        await supabaseClient.from('sakinler').insert([{ daire_no: no, ad_soyad: ad }]);
        document.getElementById('inputDaireNo').value = '';
        document.getElementById('inputAdSoyad').value = '';
        await loadSakinlerData();
        renderPaymentTable();
    }
}

// YARDIMCI FONKSİYONLAR
window.deleteItem = async (id) => { if(confirm("Silinsin mi?")) { await supabaseClient.from('veriler').delete().eq('id', id); fetchData(); } }
window.editItem = async (id) => {
    const val = prompt("Yeni tutar:");
    if(val && !isNaN(val)) {
        const item = rawData.find(x => x.id === id);
        const yeniAciklama = item.aciklama.replace(parseFloat(item.aciklama), val);
        await supabaseClient.from('veriler').update({ aciklama: yeniAciklama }).eq('id', id);
        fetchData();
    }
}

window.showTab = (n) => {
    ['kayitlarTab','sakinlerTab','odeme-tablosuTab'].forEach(x => document.getElementById(x).style.display='none');
    ['tab-kayitlar','tab-sakinler','tab-odeme-tablosu'].forEach(x => document.getElementById(x).classList.remove('active'));
    document.getElementById(n+'Tab').style.display='block';
    document.getElementById('tab-'+n).classList.add('active');
    if(n === 'odeme-tablosu') renderPaymentTable();
}

document.getElementById('loginBtn').onclick = async () => {
    await supabaseClient.auth.signInWithPassword({ email: document.getElementById('email').value, password: document.getElementById('password').value });
    checkSession();
}

async function logout() { await supabaseClient.auth.signOut(); location.reload(); }
document.getElementById('topLogoutBtn').onclick = logout;