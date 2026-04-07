const SUPABASE_URL = 'https://daruffqlidfrhbwswopn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_8CQ-97MUtgaTGkgOo2xFcg_3ZijKORD';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SESSION_TIME = 10 * 60;
let remainingTime = SESSION_TIME, countdownInterval, rawData = [], sakinlerData = [], currentUserEmail = 'Bilinmiyor';
const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

(async () => { checkSession(); })();

async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const isOk = !!session;
    document.getElementById('loginDiv').style.display = isOk ? 'none' : 'flex';
    document.getElementById('timerDisplay').style.display = isOk ? 'flex' : 'none';
    document.getElementById('adminDiv').style.display = isOk ? 'block' : 'none';
    document.getElementById('sakinEkleDiv').style.display = isOk ? 'block' : 'none';
    if(isOk) { currentUserEmail = session.user.email; startTimer(); setToday(); }
    await loadSakinlerData(); fetchData();
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

// Veri çekerken tarih sütun ismindeki olası 'i' harfi farkını yönetmek için helper
const getTarih = (item) => item.islem_tarihi || item.islem_tarih;

async function fetchData() {
    // Hem islem_tarihi hem islem_tarih (DB'deki haline göre) sorgulamayı garantiye alıyoruz
    const { data } = await supabaseClient.from('veriler').select('*').order('islem_tarihi', { ascending: false }).order('created_at', { ascending: false });
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
        const itemSakin = item.sakin_bilgisi || (item.baslik ? item.baslik.split(' | ')[1] : '');
        const itemDetay = item.detay || item.aciklama || '';
        const itemKasa = item.kasa_tipi || (item.aciklama && item.aciklama.includes('Nakit') ? 'Nakit' : 'Havale/EFT');
        const dStr = getTarih(item);
        const d = dStr ? new Date(dStr) : null;
        const itemYear = d ? d.getFullYear().toString() : "all";
        return `${itemSakin} ${itemDetay} ${item.kategori}`.toLowerCase().includes(search) &&
               (daire === 'all' || item.daire_no == daire.replace('Daire ','')) &&
               (year === 'all' || itemYear === year) &&
               (type === 'all' || item.kategori === type) &&
               (wallet === 'all' || itemKasa === wallet);
    });
    renderUI(filtered);
}

function renderUI(data) {
    let b = 0, n = 0;
    const liste = document.getElementById('veriListesi');
    liste.innerHTML = '';
    const isAdmin = document.getElementById('timerDisplay').style.display === 'flex';

    rawData.forEach(item => {
        const valTutar = item.tutar !== null ? parseFloat(item.tutar) : (parseFloat(item.aciklama) || 0);
        const isGelir = item.kategori === 'Aidat';
        const isBanka = (item.kasa_tipi || (item.aciklama && item.aciklama.includes('Havale/EFT'))) === 'Havale/EFT';
        if (isGelir) { if(isBanka) b += valTutar; else n += valTutar; } 
        else { if(isBanka) b -= valTutar; else n -= valTutar; }
    });

    data.forEach(item => {
        const valTutar = item.tutar !== null ? parseFloat(item.tutar) : (parseFloat(item.aciklama) || 0);
        const valSakin = item.sakin_bilgisi || (item.baslik ? item.baslik.split(' | ')[1] : 'Bilinmiyor');
        const valKasa = item.kasa_tipi || (item.aciklama && item.aciklama.includes('Nakit') ? 'Nakit' : 'Havale/EFT');
        const valDetay = item.detay || (item.aciklama ? item.aciklama.split('] - ').slice(1).join('] - ') : '');
        const isGelir = item.kategori === 'Aidat';
        const borderCol = valKasa === 'Havale/EFT' ? '#6366f1' : '#f59e0b';
        const dStr = getTarih(item);

        liste.innerHTML += `
            <li style="border-left: 6px solid ${borderCol}; cursor: ${isAdmin?'pointer':'default'}" ${isAdmin?`ondblclick="openHareketModal(${item.id})"`:''}>
                <div style="flex:1;">
                    <span class="date-badge islem-date">${dStr ? dStr.split('-').reverse().join('.') : ''}</span>
                    <br><strong style="color:${isGelir?'#10b981':'#ef4444'}">${valSakin} | ${item.kategori}</strong><br>
                    <small><b>[${valKasa==='Havale/EFT'?'Banka':valKasa}]</b> - ${valDetay}</small>
                </div>
                <div style="font-weight:800; font-size:16px;">${valTutar.toLocaleString('tr-TR')} TL</div>
            </li>`;
    });
    
    document.getElementById('totalBanka').innerText = b.toLocaleString('tr-TR') + " TL";
    document.getElementById('totalNakit').innerText = n.toLocaleString('tr-TR') + " TL";
    document.getElementById('totalGenel').innerText = (b + n).toLocaleString('tr-TR') + " TL";
}

window.openBakiyeModal = (tip) => {
    const liste = document.getElementById('bakiyeListe');
    liste.innerHTML = '';
    document.getElementById('bakiyeModalTitle').innerText = tip === 'Genel' ? 'Genel Kasa İşlemleri' : (tip === 'Havale/EFT' ? 'Banka Hesabı İşlemleri' : 'Nakit İşlemleri');

    rawData.filter(item => {
        const itemKasa = item.kasa_tipi || (item.aciklama && item.aciklama.includes('Nakit') ? 'Nakit' : 'Havale/EFT');
        return tip === 'Genel' || itemKasa === tip;
    }).forEach(item => {
        const valTutar = item.tutar !== null ? parseFloat(item.tutar) : (parseFloat(item.aciklama) || 0);
        const isGelir = item.kategori === 'Aidat';
        const color = isGelir ? '#10b981' : '#ef4444';
        const dStr = getTarih(item);
        liste.innerHTML += `<li style="border-left:5px solid ${color}; background:#f8fafc; margin-bottom:5px; padding:10px; display:flex; justify-content:space-between; align-items:center;">
            <div style="flex:1;"><small>${dStr ? dStr.split('-').reverse().join('.') : ''}</small><br><strong>${item.sakin_bilgisi || 'Genel'}</strong></div>
            <div style="font-weight:800; color:${color}">${isGelir?'+':'-'}${valTutar.toLocaleString('tr-TR')} TL</div>
        </li>`;
    });
    document.getElementById('bakiyeModal').style.display = 'flex';
}

document.getElementById('ekleBtn').onclick = async () => {
    const v = {
        t: document.getElementById('tutar').value,
        d: document.getElementById('islemTarihi').value,
        det: document.getElementById('detay').value,
        sak: document.getElementById('sakinSecici').value,
        kat: document.getElementById('kategori').value,
        kas: document.getElementById('kasaTipi').value
    };
    if(!v.t || !v.d) return alert("Hata!");
    const dNo = v.sak.match(/Daire (\d+)/) ? parseInt(v.sak.match(/Daire (\d+)/)[1]) : null;
    await supabaseClient.from('veriler').insert([{ islem_tarihi: v.d, daire_no: dNo, kategori: v.kat, tutar: parseFloat(v.t), kasa_tipi: v.kas, detay: v.det, sakin_bilgisi: v.sak }]);
    document.getElementById('tutar').value = ''; document.getElementById('detay').value = ''; fetchData();
};

// YENİ SAKİN EKLEME BUTONU İŞLEVİ
document.getElementById('sakinKaydetBtn').onclick = async () => {
    const no = document.getElementById('inputDaireNo').value;
    const ad = document.getElementById('inputAdSoyad').value;
    
    if(!no || !ad) return alert("Daire No ve Ad Soyad boş bırakılamaz!");
    
    // Veritabanına kaydet
    await supabaseClient.from('sakinler').insert([{ daire_no: parseInt(no), ad_soyad: ad }]);
    
    // Kutucukları temizle
    document.getElementById('inputDaireNo').value = ''; 
    document.getElementById('inputAdSoyad').value = ''; 
    
    // Listeleri ve tabloyu güncelle
    await loadSakinlerData(); 
    renderPaymentTable();
};

async function loadSakinlerData() {
    const { data } = await supabaseClient.from('sakinler').select('*').order('daire_no');
    sakinlerData = data || [];
    const sel = document.getElementById('sakinSecici'), fil = document.getElementById('daireFilter'), list = document.getElementById('sakinListesi');
    if(!sel) return;
    sel.innerHTML = '<option value="Genel">Genel</option>';
    fil.innerHTML = '<option value="all">Tüm Daireler</option>';
    list.innerHTML = '';
    const isAdmin = document.getElementById('timerDisplay').style.display === 'flex';
    sakinlerData.forEach(s => {
        const t = `Daire ${s.daire_no} - ${s.ad_soyad}`;
        sel.innerHTML += `<option value="${t}">${t}</option>`;
        fil.innerHTML += `<option value="Daire ${s.daire_no}">Daire ${s.daire_no}</option>`;
        const dblClickAction = isAdmin ? `ondblclick="openSakinModal(${s.id}, '${s.ad_soyad}', ${s.daire_no})"` : '';
        list.innerHTML += `<li style="cursor: ${isAdmin?'pointer':'default'};" ${dblClickAction}><span>${t}</span></li>`;
    });
}

// ÖDEME TABLOSU (Tarih ve Tutar geri getirildi)
function renderPaymentTable() {
    const yil = document.getElementById('tableYearFilter').value;
    const thead = document.getElementById('tableHead'), tbody = document.getElementById('tableBody');
    thead.innerHTML = `<tr><th>Daire</th>${AYLAR.map(a => `<th>${a}</th>`).join('')}</tr>`;
    tbody.innerHTML = '';
    sakinlerData.forEach(s => {
        let r = `<tr><td>Daire ${s.daire_no}<br><small>${s.ad_soyad}</small></td>`;
        for(let m=1; m<=12; m++) {
            const o = rawData.find(i => {
                const dStr = getTarih(i);
                if (!dStr) return false;
                const d = new Date(dStr);
                return i.daire_no == s.daire_no && i.kategori === 'Aidat' && (d.getMonth() + 1) === m && d.getFullYear() == yil;
            });
            if (o) {
                const dStr = getTarih(o);
                const formatTarih = dStr ? dStr.split('-').reverse().join('.') : '';
                r += `<td class="paid-cell"><strong>${o.tutar || o.aciklama} TL</strong><br><small>${formatTarih}</small></td>`;
            } else {
                r += `<td></td>`;
            }
        }
        tbody.innerHTML += r + `</tr>`;
    });
}

// HAREKET MODAL
window.openHareketModal = (id) => {
    const i = rawData.find(x => x.id === id);
    document.getElementById('editHareketSakin').innerHTML = document.getElementById('sakinSecici').innerHTML;
    document.getElementById('editHareketId').value = id;
    document.getElementById('editHareketTarihi').value = getTarih(i);
    document.getElementById('editHareketSakin').value = i.sakin_bilgisi || 'Genel';
    document.getElementById('editHareketKategori').value = i.kategori;
    document.getElementById('editHareketKasa').value = i.kasa_tipi || 'Havale/EFT';
    document.getElementById('editHareketTutar').value = i.tutar || i.aciklama;
    document.getElementById('editHareketDetay').value = i.detay || '';
    document.getElementById('hareketModal').style.display = 'flex';
}

window.saveHareket = async () => {
    const id = document.getElementById('editHareketId').value;
    const dNo = document.getElementById('editHareketSakin').value.match(/Daire (\d+)/) ? parseInt(document.getElementById('editHareketSakin').value.match(/Daire (\d+)/)[1]) : null;
    await supabaseClient.from('veriler').update({
        islem_tarihi: document.getElementById('editHareketTarihi').value,
        daire_no: dNo,
        kategori: document.getElementById('editHareketKategori').value,
        tutar: parseFloat(document.getElementById('editHareketTutar').value),
        kasa_tipi: document.getElementById('editHareketKasa').value,
        detay: document.getElementById('editHareketDetay').value,
        sakin_bilgisi: document.getElementById('editHareketSakin').value
    }).eq('id', id);
    closeModal('hareketModal'); fetchData();
}

window.deleteHareket = async () => { if(confirm("Silinsin mi?")) { await supabaseClient.from('veriler').delete().eq('id', document.getElementById('editHareketId').value); closeModal('hareketModal'); fetchData(); } }

// SAKİN MODAL
window.openSakinModal = (id, ad, no) => {
    document.getElementById('editSakinId').value = id;
    document.getElementById('editSakinAd').value = ad;
    document.getElementById('editSakinNo').value = no;
    document.getElementById('sakinModal').style.display = 'flex';
}

window.saveSakin = async () => {
    const id = document.getElementById('editSakinId').value, ad = document.getElementById('editSakinAd').value, no = document.getElementById('editSakinNo').value;
    if(ad && no) { await supabaseClient.from('sakinler').update({ ad_soyad: ad, daire_no: no }).eq('id', id); closeModal('sakinModal'); await loadSakinlerData(); renderPaymentTable(); }
}

window.deleteSakinAction = async () => {
    const id = document.getElementById('editSakinId').value;
    if(confirm("Sakini sil?")) { await supabaseClient.from('sakinler').delete().eq('id', id); closeModal('sakinModal'); await loadSakinlerData(); renderPaymentTable(); }
}

window.closeModal = (m) => document.getElementById(m).style.display = 'none';

window.showTab = (t) => {
    ['kayitlar','sakinler','odeme-tablosu'].forEach(x => { document.getElementById(x+'Tab').style.display='none'; document.getElementById('tab-'+x).classList.remove('active'); });
    document.getElementById(t+'Tab').style.display='block'; document.getElementById('tab-'+t).classList.add('active');
    if(t==='odeme-tablosu') renderPaymentTable();
}

document.getElementById('loginBtn').onclick = async () => {
    const { error } = await supabaseClient.auth.signInWithPassword({ email: document.getElementById('email').value, password: document.getElementById('password').value });
    if(error) alert("Hata!"); else checkSession();
}
async function logout() { await supabaseClient.auth.signOut(); location.reload(); }
document.getElementById('topLogoutBtn').onclick = logout;