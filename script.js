(function() {
    const _0x511b = [
        '\x68\x74\x74\x70\x73\x3A\x2F\x2F\x64\x61\x72\x75\x66\x66\x71\x6C\x69\x64\x66\x72\x68\x62\x77\x73\x77\x6F\x70\x6E\x2E\x73\x75\x70\x61\x62\x61\x73\x65\x2E\x63\x6F', 
        '\x73\x62\x5F\x70\x75\x62\x6C\x69\x73\x68\x61\x62\x6C\x65\x5F\x38\x43\x51\x2D\x39\x37\x4D\x55\x74\x67\x61\x54\x47\x6B\x67\x4F\x6F\x32\x78\x46\x63\x67\x5F\x33\x5A\x69\x6A\x4B\x4F\x52\x44',
        '\x63\x72\x65\x61\x74\x65\x43\x6C\x69\x65\x6E\x74'
    ];

    const _0xURL = _0x511b[0];
    const _0xKEY = _0x511b[1];
    const _0xFUNC = _0x511b[2];
    window.supabaseClient = supabase[_0xFUNC](_0xURL, _0xKEY);
})();


const SESSION_TIME = 10 * 60;
let remainingTime = SESSION_TIME, countdownInterval, rawData = [], sakinlerData = [], currentUserEmail = 'Bilinmiyor';
const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

let serverNow = null; // Sunucu saati burada saklanacak

let aidatAyarlari = []; // Aylık aidat miktarları burada saklanacak

async function fetchAidatAyarlari() {
    const { data, error } = await supabaseClient
        .from('aidat_ayarlari')
        .select('*');
    if (!error && data) aidatAyarlari = data;
}



async function aidatKaydet() {
    const yeniMiktar = document.getElementById('aidatYeniMiktar').value;
    
    if (!yeniMiktar) {
        alert("Lütfen bir miktar giriniz.");
        return;
    }

    try {
        // 1. Veritabanını Güncelle (Supabase tablonuzun adı 'ayarlar' veya 'aidat_ayarları' ise)
        const { error } = await supabaseClient
            .from('aidat_ayarları') // Burayı kendi tablo adınızla değiştirin
            .update({ miktar: yeniMiktar })
            .eq('id', 1); // Genellikle tek bir satır olur

        if (error) throw error;

        // 2. Ekranı Güncelle
        document.getElementById('aidatMiktarGoster').innerText = yeniMiktar + " TL";
        
        // 3. Formu Kapat ve Tabloyu Yenile
        aidatDuzenleKapat();
        await fetchAidatAyarlari(); // Veriyi tekrar çekip tüm sistemi güncelle
        renderPaymentTable();
        
        alert('Aidat miktarı başarıyla güncellendi!');
    } catch (err) {
        console.error('Hata:', err);
        alert('Güncelleme sırasında bir hata oluştu.');
    }
}







async function fetchServerTime() {
    const { data, error } = await supabaseClient
        .rpc('get_server_time');
    if (!error && data) serverNow = new Date(data);
}

(async () => { checkSession(); })();

async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const isOk = !!session;

    document.getElementById('loginDiv').style.display = isOk ? 'none' : 'flex';
    document.getElementById('timerDisplay').style.display = isOk ? 'flex' : 'none';
    document.getElementById('adminDiv').style.display = isOk ? 'block' : 'none';
    document.getElementById('sakinEkleDiv').style.display = isOk ? 'block' : 'none';

    const adminAidatKontrol = document.getElementById('adminAidatKontrol');
    if (adminAidatKontrol) {
        adminAidatKontrol.style.display = isOk ? 'flex' : 'none';
    }

    daireSecicileriDoldur();
    yilFiltreleriniDoldur();

    if(isOk) { 
        currentUserEmail = session.user.email; 
        startTimer(); 
        setToday(); 
    }

    await fetchServerTime(); 
    await fetchAidatAyarlari(); 
    await loadSakinlerData(); 
    await fetchData();

    const currentHash = window.location.hash.replace('#', '');
    if (['kayitlar', 'sakinler', 'odeme-tablosu'].includes(currentHash)) {
        showTab(currentHash);
    }
}

function daireSecicileriDoldur() {
    const inputs = [document.getElementById('inputDaireNo'), document.getElementById('editSakinNo')];
    inputs.forEach(select => {
        if(!select) return;
        select.innerHTML = '<option value="">Daire Seçiniz</option>'; 
        for (let i = 1; i <= 12; i++) { // Sınırı 12 yaptık
            let no = i < 10 ? '0' + i : i.toString();
            // Ekranda "Daire 01" görünecek ama veritabanına "01" gidecek
            select.innerHTML += `<option value="${no}">Daire ${no}</option>`;
        }
    });
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

function setToday() {
    const today = new Date().toISOString().split('T')[0];
    const tarihInput = document.getElementById('islemTarihi');
    
    tarihInput.value = today; // Varsayılan olarak bugünü seç
    //tarihInput.max = today;   // Gelecek tarihlerin seçilmesini engelle
}

// Veri çekerken tarih sütun ismindeki olası 'i' harfi farkını yönetmek için helper
const getTarih = (item) => item.islem_tarihi || item.islem_tarih;

async function fetchData() {
    // Verileri önce tarihe göre, sonra en son eklenen en üstte olacak şekilde ID veya created_at'e göre sıralıyoruz
    const { data, error } = await supabaseClient
        .from('veriler')
        .select('*')
        .order('islem_tarihi', { ascending: false })
        .order('id', { ascending: false }); // ID her zaman eşsizdir, en yeni kayıt en üste gelir

    if (error) {
        console.error("Veri çekme hatası:", error.message);
        return;
    }

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
        const isGelir = item.kategori === 'Aidat' || item.kategori === 'Ekstra Gelir';
        const isBanka = (item.kasa_tipi || (item.aciklama && item.aciklama.includes('Havale/EFT'))) === 'Havale/EFT';
        if (isGelir) { if(isBanka) b += valTutar; else n += valTutar; } 
        else { if(isBanka) b -= valTutar; else n -= valTutar; }
    });

    data.forEach(item => {
        const valTutar = item.tutar !== null ? parseFloat(item.tutar) : (parseFloat(item.aciklama) || 0);
        const valSakin = item.sakin_bilgisi || (item.baslik ? item.baslik.split(' | ')[1] : 'Bilinmiyor');
        const valKasa = item.kasa_tipi || (item.aciklama && item.aciklama.includes('Nakit') ? 'Nakit' : 'Havale/EFT');
        const valDetay = item.detay || (item.aciklama ? item.aciklama.split('] - ').slice(1).join('] - ') : '');
        const isGelir = item.kategori === 'Aidat' || item.kategori === 'Ekstra Gelir';
        const borderCol = valKasa === 'Havale/EFT' ? '#6366f1' : '#f59e0b';
        const dStr = getTarih(item);

        // --- YENİ: DÜZENLEME ROZETİ KONTROLÜ ---
        const duzenlemeRozeti = item.duzenleyen 
        ? `<span class="edit-badge" 
                 onclick="event.stopPropagation(); alert('Düzenleyen: ${item.duzenleyen}\\nTarih: ${new Date(item.duzenleme_tarihi).toLocaleString('tr-TR')}\\n${item.eski_deger}')"
                 title="Düzenleyen: ${item.duzenleyen} | Tarih: ${new Date(item.duzenleme_tarihi).toLocaleString('tr-TR')} | ${item.eski_deger}">
                 ⚠ Düzenlendi
           </span>` 
        : '';
    
    // Yönetici ve Aidat kontrolü ile tutar gösterimi
    const bakiyeGosterim = (item.kategori === 'Aidat' && valTutar === 0) 
        ? `<span style="color:#6366f1; font-weight:800;">YÖNETİCİ</span>` 
        : `${valTutar.toLocaleString('tr-TR')} TL`;
    
    liste.innerHTML += `
        <li style="border-left: 6px solid ${borderCol}; cursor: ${isAdmin?'pointer':'default'}" ${isAdmin?`ondblclick="openHareketModal(${item.id})"`:''}>
            <div style="flex:1;">
                <span class="date-badge islem-date">${dStr ? dStr.split('-').reverse().join('.') : ''}</span>
                ${duzenlemeRozeti}
                <br><strong style="color:${isGelir?'#10b981':'#ef4444'}">${valSakin} | ${item.kategori}</strong><br>
                <small><b>[${valKasa==='Havale/EFT'?'Banka':valKasa}]</b> - ${valDetay}</small>
            </div>
            <div style="font-weight:800; font-size:16px;">${bakiyeGosterim}</div>
        </li>`;
    });
    
    document.getElementById('totalBanka').innerText = b.toLocaleString('tr-TR') + " TL";
    document.getElementById('totalNakit').innerText = n.toLocaleString('tr-TR') + " TL";
    document.getElementById('totalGenel').innerText = (b + n).toLocaleString('tr-TR') + " TL";
}


window.openBakiyeModal = async (tip) => {
    const liste = document.getElementById('bakiyeListe');
    const modal = document.getElementById('bakiyeModal');

    // 1. MODAL HEMEN AÇ
    modal.style.display = 'flex';

    // 2. LOADING GÖSTER
    liste.innerHTML = `
        <li style="text-align:center; padding:20px; color:#64748b;">
            ⏳ Lütfen bekleyin, veriler yükleniyor...
        </li>
    `;

    document.getElementById('bakiyeModalTitle').innerText =
        tip === 'Genel'
            ? 'Genel Kasa İşlemleri'
            : tip === 'Havale/EFT'
                ? 'Banka Hesabı İşlemleri'
                : 'Nakit İşlemleri';

    // 3. VERİYİ ARKADA ÇEK
    const data = rawData.filter(item => {
        const itemKasa = item.kasa_tipi ||
            (item.aciklama && item.aciklama.includes('Nakit') ? 'Nakit' : 'Havale/EFT');
        return tip === 'Genel' || itemKasa === tip;
    });

    // 4. KISA BİR FRAME SONRA BAS (UI donmasın)
    setTimeout(() => {
        liste.innerHTML = '';

        data.forEach(item => {
            const valTutar = item.tutar !== null ? parseFloat(item.tutar) : (parseFloat(item.aciklama) || 0);
            const isGelir = item.kategori === 'Aidat';
            const color = isGelir ? '#10b981' : '#ef4444';
            const dStr = getTarih(item);

            liste.innerHTML += `
                <li style="border-left:5px solid ${color}; background:#f8fafc; margin-bottom:5px; padding:10px; display:flex; justify-content:space-between; align-items:center;">
                    <div style="flex:1;">
                        <small>${dStr ? dStr.split('-').reverse().join('.') : ''}</small><br>
                        <strong>${item.sakin_bilgisi || 'Genel'}</strong>
                    </div>
                    <div style="font-weight:800; color:${color}">
                        ${isGelir ? '+' : '-'}${valTutar.toLocaleString('tr-TR')} TL
                    </div>
                </li>
            `;
        });

    }, 50);
};

document.getElementById('ekleBtn').onclick = async () => {
    const v = {
        t: document.getElementById('tutar').value,
        d: document.getElementById('islemTarihi').value,
        det: document.getElementById('detay').value,
        sak: document.getElementById('sakinSecici').value,
        kat: document.getElementById('kategori').value,
        kas: document.getElementById('kasaTipi').value
    };

    // --- HATA POP-UP KONTROLLERİ ---
    if (!v.kat || v.kat === "") {
        alert("Lütfen önce bir 'İşlem Türü' seçiniz!");
        return;
    }

    if (!v.sak || v.sak === "" || v.sak.includes("Seçiniz") || v.sak.includes("Seçin")) {
        alert("Lütfen Ödeme Yapan / Yer (Daire) kısmını boş bırakmayın!");
        return;
    }

    const seciliSakin = sakinlerData.find(s => `Daire ${s.daire_no} - ${s.ad_soyad}` === v.sak);
    const isYoneticiMuafiyeti = (v.kat === "Aidat" && seciliSakin && seciliSakin.is_admin);

    if (!v.t || v.t < 0 || (v.t == 0 && !isYoneticiMuafiyeti)) {
        alert("Lütfen geçerli bir tutar giriniz!");
        return;
    }


    // --- BURADAN SONRASI AYNI (Supabase insert işlemleri) ---
    
    // Daire numarasını ayıkla
    const dNoMatch = v.sak.match(/Daire (\d+)/);
    const dNo = dNoMatch ? dNoMatch[1] : null;

    const { data, error } = await supabaseClient
        .from('veriler')
        .insert([{ 
            islem_tarihi: v.d, 
            daire_no: dNo, 
            kategori: v.kat, 
            tutar: parseFloat(v.t), 
            kasa_tipi: v.kas, 
            detay: v.det, 
            sakin_bilgisi: v.sak,
            baslik: v.sak, 
            aciklama: v.det || v.kat
        }])
        .select();

    if (error) {
        alert("Kayıt yapılamadı: " + error.message);
    } else {
        alert("Kayıt başarılı");
        document.getElementById('tutar').value = ''; 
        document.getElementById('detay').value = ''; 
        fetchData(); 
    }
};



// YENİ SAKİN EKLEME BUTONU İŞLEVİ
document.getElementById('sakinKaydetBtn').onclick = async () => {
    const no = document.getElementById('inputDaireNo').value;
    const ad = document.getElementById('inputAdSoyad').value;
    
    if(!no || !ad) return alert("Daire No ve Ad Soyad boş bırakılamaz!");
    
    // Veritabanına kaydet
    await supabaseClient.from('sakinler').insert([{ daire_no: no, ad_soyad: ad }]);
    
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
    
    const fil = document.getElementById('daireFilter');
    const list = document.getElementById('sakinListesi');
    
    if(fil) fil.innerHTML = '<option value="all">Tüm Daireler</option>';
    if(list) list.innerHTML = '';
    
    const isAdmin = document.getElementById('timerDisplay').style.display === 'flex';
    
    sakinlerData.forEach(s => {
        const t = `Daire ${s.daire_no} - ${s.ad_soyad}`;
        if(fil) fil.innerHTML += `<option value="Daire ${s.daire_no}">${t}</option>`;
        
        // --- VURGU KISMI BURADA BAŞLIYOR ---
        const isYonetici = s.is_admin === true;
        const yoneticiStili = isYonetici ? 'border-left: 5px solid #6366f1; background: #f8fafc;' : '';
        const yoneticiRozeti = isYonetici ? '<span style="background:#eef2ff; color:#6366f1; font-size:10px; padding:2px 6px; border-radius:4px; margin-left:10px; border:1px solid #e0e7ff; font-weight:700;">YÖNETİCİ</span>' : '';
        
        const dblClickAction = isAdmin ? `ondblclick="openSakinModal(${s.id}, '${s.ad_soyad}', ${s.daire_no})"` : '';
        
        if(list) {
            list.innerHTML += `
                <li style="cursor: ${isAdmin?'pointer':'default'}; ${yoneticiStili}" ${dblClickAction}>
                    <span style="display:flex; align-items:center; width:100%;">
                        ${t} ${yoneticiRozeti}
                    </span>
                </li>`;
        }
        // --- VURGU KISMI BURADA BİTİYOR ---
    });
}

// ÖDEME TABLOSU (Tarih ve Tutar geri getirildi)
function renderPaymentTable() {
    const yil = document.getElementById('tableYearFilter').value;
    const thead = document.getElementById('tableHead'), tbody = document.getElementById('tableBody');
    const yilInt = parseInt(yil);
    thead.innerHTML = `<tr><th>Daire</th>${AYLAR.map((a, i) => {
        const ayNo = i + 1;
        const ayar = aidatAyarlari.find(x => x.yil === yilInt && x.ay === ayNo);
        const miktar = ayar ? `<br><small style="font-weight:400; color:#94a3b8; font-size:10px;">${ayar.miktar} TL</small>` : '';
        return `<th>${a}${miktar}</th>`;
    }).join('')}</tr>`;
    tbody.innerHTML = '';
// renderPaymentTable fonksiyonunun içine, sakinlerData.forEach döngüsünün başladığı yere...
sakinlerData.forEach(s => {
    let r = `<tr><td>Daire ${s.daire_no}<br><small>${s.ad_soyad}</small></td>`;
    
    // BUGÜNÜN TARİHİNİ ALALIM (6 Mayıs 2026)
    const simdi = new Date();
    const mevcutYil = simdi.getFullYear();
    const mevcutAy = simdi.getMonth() + 1; // Mayıs = 5

    for(let m=1; m<=12; m++) {
        // Ödeme var mı kontrolü
        const o = rawData.find(i => {
            const dStr = getTarih(i);
            if (!dStr) return false;
            const d = new Date(dStr);
            return i.daire_no == s.daire_no && i.kategori === 'Aidat' && (d.getMonth() + 1) === m && d.getFullYear() == yil;
        });

        if (o) {
            // ÖDEME VARSA (Senin mevcut mantığın)
            const dStr = getTarih(o);
            const formatTarih = dStr ? dStr.split('-').reverse().join('.') : '';
            const isYoneticiMuaf = (o.kategori === 'Aidat' && o.tutar == 0);
            const ayarObj2 = aidatAyarlari.find(a => a.yil === yilInt && a.ay === m);
            const isEksik = !isYoneticiMuaf && ayarObj2 && parseFloat(o.tutar) < ayarObj2.miktar;
            
            const hucreIcerik = isYoneticiMuaf ? "YÖNETİCİ" : `${o.tutar} TL`;
            const stil = isYoneticiMuaf 
                ? 'style="background-color: #eef2ff !important; color: #6366f1 !important; border: 1px solid #c3dafe; font-weight: bold;"' 
                : (isEksik ? 'style="background-color: #fee2e2 !important; color: #b91c1c; font-weight:700;"' : '');
            
            r += `<td class="${isYoneticiMuaf ? '' : (isEksik ? '' : 'paid-cell')}" ${stil}>
                    <strong style="font-size: 11px;">${hucreIcerik}</strong><br>
                    <small style="font-size: 9px; opacity: 0.8;">${formatTarih}</small>
                  </td>`;
        } else {
            // ÖDEME YOKSA (BURAYI EKLEDİK)
            // Mantık: (Tablodaki yıl geçmişse) VEYA (Bu yılsa ve ay bugün veya öncesiyse)
            const gecmisAyMi = (yilInt < mevcutYil) || (yilInt === mevcutYil && m <= mevcutAy);
            
            const arkaPlan = gecmisAyMi ? 'style="background-color: #fee2e2 !important;"' : '';
            
            r += `<td ${arkaPlan}></td>`;
        }
    }
    tbody.innerHTML += r + `</tr>`;
    aidatGosterGuncelle();
});
}

// HAREKET MODAL
window.openHareketModal = (id) => {
    const i = rawData.find(x => x.id === id);

    document.getElementById('editHareketId').value = id;
    document.getElementById('editHareketTarihi').value = getTarih(i);

    // 1. kategori set
    document.getElementById('editHareketKategori').value = i.kategori;

    // 2. dropdown doldur + seçili değeri ver (TEK HAMLE)
    modalSakinleriGuncelle(i.sakin_bilgisi || 'Genel');

    document.getElementById('editHareketKasa').value = i.kasa_tipi || 'Havale/EFT';
    document.getElementById('editHareketTutar').value = i.tutar || i.aciklama;
    document.getElementById('editHareketDetay').value = i.detay || '';

    document.getElementById('hareketModal').style.display = 'flex';
};


window.saveHareket = async () => {
    const id = document.getElementById('editHareketId').value;
    
    // 1. ADIM: Mevcut veriyi çek (Eski değerleri loglamak için)
    const { data: eski, error: cekmeHatasi } = await supabaseClient
        .from('veriler')
        .select('*')
        .eq('id', id)
        .single();

    if (cekmeHatasi) {
        console.error("Eski veri çekilemedi:", cekmeHatasi);
        alert("Güncelleme başlatılamadı, veri bulunamadı.");
        return;
    }

    // 2. ADIM: Formdaki yeni değerleri al
    const yeniTarih = document.getElementById('editHareketTarihi').value;
    const yeniSakin = document.getElementById('editHareketSakin').value;
    const yeniKat = document.getElementById('editHareketKategori').value;
    const yeniKasa = document.getElementById('editHareketKasa').value;
    const yeniTutar = parseFloat(document.getElementById('editHareketTutar').value); // Sayıya çeviriyoruz
    const yeniDetay = document.getElementById('editHareketDetay').value;

    // Daire numarasını ayıkla
    const dNoMatch = yeniSakin.match(/Daire (\d+)/);
    const dNo = dNoMatch ? parseInt(dNoMatch[1]) : null;

    // Log bilgilerini hazırla
    const kullanici = currentUserEmail ? currentUserEmail.split('@')[0] : 'Yönetici';
    const suan = new Date().toLocaleString('tr-TR');
    const logNotu = `Eski: ${eski.tutar} TL | ${eski.sakin_bilgisi}`;

    // 3. ADIM: Güncelleme İsteğini Gönder
    const { error: guncellemeHatasi } = await supabaseClient
        .from('veriler')
        .update({
            islem_tarihi: yeniTarih,
            daire_no: dNo,
            kategori: yeniKat,
            tutar: yeniTutar, // Buranın sayı olduğundan emin olmalıyız (parseFloat yaptık)
            kasa_tipi: yeniKasa,
            detay: yeniDetay,
            sakin_bilgisi: yeniSakin,
            duzenleyen: kullanici,
            duzenleme_tarihi: new Date().toISOString(),
            eski_deger: logNotu
        })
        .eq('id', id);

    if (guncellemeHatasi) {
        console.error("GÜNCELLEME HATASI DETAYI:", guncellemeHatasi);
        alert("Değişiklik kaydedilemedi: " + guncellemeHatasi.message);
    } else {
        alert("Kayıt başarıyla güncellendi!");
        closeModal('hareketModal');
        fetchData();
    }
}

window.deleteHareket = async () => { if(confirm("Silinsin mi?")) { await supabaseClient.from('veriler').delete().eq('id', document.getElementById('editHareketId').value); closeModal('hareketModal'); fetchData(); } }

// SAKİN MODAL
window.openSakinModal = (id, ad, no) => {
    const s = sakinlerData.find(x => x.id === id); // Sakin verisini bul
    document.getElementById('editSakinId').value = id;
    document.getElementById('editSakinAd').value = ad;
    let formatliNo = no < 10 ? '0' + no : no.toString();
    document.getElementById('editSakinNo').value = formatliNo; 
    
    // Tik kutusunu veritabanındaki duruma göre ayarla
    document.getElementById('editSakinIsAdmin').checked = s.is_admin || false;
    
    document.getElementById('sakinModal').style.display = 'flex';
}

window.saveSakin = async () => {
    const id = document.getElementById('editSakinId').value;
    const ad = document.getElementById('editSakinAd').value;
    const no = document.getElementById('editSakinNo').value;
    const isAdmin = document.getElementById('editSakinIsAdmin').checked;

    if(ad && no) { 
        // EĞER BU KİŞİ YÖNETİCİ OLARAK KAYDEDİLECEKSE
        if (isAdmin === true) {
            // Önce veritabanındaki TÜM is_admin'leri false yap (Filtre koymadan herkesi tara)
            await supabaseClient
                .from('sakinler')
                .update({ is_admin: false })
                .is('is_admin', true); // Sadece halihazırda true olanları bul ve kapat
        }

        // Şimdi asıl kişiyi güncelle
        const { error } = await supabaseClient
            .from('sakinler')
            .update({ 
                ad_soyad: ad, 
                daire_no: no, 
                is_admin: isAdmin 
            })
            .eq('id', id); 

        if (error) {
            alert("Hata: " + error.message);
        } else {
            // ÖNEMLİ: Veriyi tekrar çekmeden önce yerel değişkeni de temizleyebiliriz 
            // ama loadSakinlerData zaten bunu yapmalı.
            closeModal('sakinModal');
            
            // Veritabanı işleminin tamamlanması için çok kısa bir bekleme (opsiyonel)
            setTimeout(async () => {
                await loadSakinlerData();
                renderPaymentTable();
            }, 200);
        }
    }
}

window.deleteSakinAction = async () => {
    const id = document.getElementById('editSakinId').value;
    if(confirm("Sakini sil?")) { await supabaseClient.from('sakinler').delete().eq('id', id); closeModal('sakinModal'); await loadSakinlerData(); renderPaymentTable(); }
}

window.closeModal = (m) => document.getElementById(m).style.display = 'none';

window.showTab = (t) => {
    // 1. Tüm içerikleri gizle ve tab butonlarını pasif yap
    ['kayitlar', 'sakinler', 'odeme-tablosu'].forEach(x => { 
        const tabContent = document.getElementById(x + 'Tab');
        const tabBtn = document.getElementById('tab-' + x);
        if (tabContent) tabContent.style.display = 'none';
        if (tabBtn) tabBtn.classList.remove('active');
    });

    // 2. Seçilen içeriği göster ve butonu aktif yap
    const activeContent = document.getElementById(t + 'Tab');
    const activeBtn = document.getElementById('tab-' + t);
    
    if (activeContent) activeContent.style.display = 'block';
    if (activeBtn) activeBtn.classList.add('active');

    // 3. Linki güncelle (Adres çubuğu değişir ama sayfa yenilenmez)
    window.history.pushState(null, null, `#${t}`);

    // 4. Eğer ödeme tablosuysa verileri çiz
    if (t === 'odeme-tablosu') renderPaymentTable();
}

document.getElementById('loginBtn').onclick = async () => {
    const { error } = await supabaseClient.auth.signInWithPassword({ email: document.getElementById('email').value, password: document.getElementById('password').value });
    if(error) alert("Hata!"); else checkSession();
}
async function logout() { await supabaseClient.auth.signOut(); location.reload(); }
document.getElementById('topLogoutBtn').onclick = logout;



// --- DİNAMİK FORM YÖNETİMİ BAŞLANGIÇ ---


// HTML elementlerini tanımlayalım (Hata almamak için isimlerin ID'leri ile aynı olduğundan emin ol)
const kategoriSelect = document.getElementById('kategori');
const sakinSelect = document.getElementById('sakinSecici');
const tarihInput = document.getElementById('islemTarihi');
const detayInput = document.getElementById('detay');

// 1. OTOMATİK AÇIKLAMA FONKSİYONU
function otomatikAciklamaGuncelle() {
    if (kategoriSelect.value === "Aidat" && tarihInput.value) {
        const seciliTarih = new Date(tarihInput.value);
        const ay = AYLAR[seciliTarih.getMonth()];
        const ayNo = seciliTarih.getMonth() + 1;
        const yil = seciliTarih.getFullYear();
        detayInput.value = `${yil} ${ay} Ayı Aidat Ödemesi`;

        const ayar = aidatAyarlari.find(a => a.yil === yil && a.ay === ayNo);
        const tutarInput = document.getElementById('tutar');
        let ipucuEl = document.getElementById('aidatIpucu');
        if (!ipucuEl) {
            ipucuEl = document.createElement('small');
            ipucuEl.id = 'aidatIpucu';
            ipucuEl.style.cssText = 'color:#6366f1; font-weight:700; margin-top:4px; display:block;';
            tutarInput.parentNode.appendChild(ipucuEl);
        }
        if (ayar) {
            ipucuEl.innerText = `Bu ay için tanımlı aidat: ${ayar.miktar} TL`;
        } else {
            ipucuEl.innerText = '';
        }
    }
}

// 2. DAİRE LİSTESİNİ DOLDURAN FONKSİYON
function daireListesiniGetir() {
    if(!sakinSelect) return;
    sakinSelect.innerHTML = ''; 
    
    const bosOpt = new Option("Daire Seçiniz...", "");
    bosOpt.disabled = true;
    bosOpt.selected = true;
    sakinSelect.add(bosOpt);

    // Düzeltme: Sabit 10 daire yerine veritabanındaki sakinleri getiriyoruz
    if(sakinlerData.length > 0) {
        sakinlerData.forEach(s => {
            const t = `Daire ${s.daire_no} - ${s.ad_soyad}`;
            sakinSelect.add(new Option(t, t));
        });
    } else {
        // Eğer veritabanı boşsa manuel 12 daireyi yedek olarak getir
        for (let i = 1; i <= 12; i++) {
            let no = i < 10 ? '0' + i : i.toString();
            sakinSelect.add(new Option(`Daire ${no}`, `Daire ${no}`));
        }
    }
}

// KATEGORİ DEĞİŞİNCE ÇALIŞACAK AKILLI MANTIK
kategoriSelect.addEventListener('change', () => {
    const kat = kategoriSelect.value;
    
    sakinSelect.innerHTML = ''; // Kutuyu boşalt
    detayInput.value = ''; 
    const ipucu = document.getElementById('aidatIpucu');
    if (ipucu) ipucu.innerText = '';

    if (kat === "") {
        sakinSelect.add(new Option("Önce İşlem Türü Seçin...", ""));
    } 
    else if (kat === "Aidat") {
        // Burada daireListesiniGetir zaten kendi içinde temizlik yapacak
        daireListesiniGetir(); 
        otomatikAciklamaGuncelle();
    } 
    else if (kat === "Fatura") {
        // Fatura seçince "Genel" değil, sadece faturalar gelmeli
        const faturalar = ["Elektrik Faturası", "Su Faturası", "Doğalgaz Faturası", "Asansör Bakımı"];
        faturalar.forEach(f => sakinSelect.add(new Option(f, f)));
    } 
    else if (kat === "Gider") {
        const giderler = ["Apartman Temizliği", "Temizlik Malzemesi", "Hırdavat", "Noter", "Numarataj", "Kırtasiye", "Elektrik Arıza/Bakım", "Su Arıza/Bakım", "Diğer"];
        giderler.forEach(g => sakinSelect.add(new Option(g, g)));
    }
    else if (kat === "Ekstra Gelir") {
        // Sadece Ekstra Gelir'de Genel görünebilir
        sakinSelect.add(new Option("Genel / Diğer Gelir", "Genel"));
    }
});


function formDurumunuGuncelle() {
    const btn = document.getElementById('ekleBtn');
    if (!btn) return;
    
    // Butonu her zaman aktif ve aynı renkte tutuyoruz
    btn.disabled = false; 
    btn.style.backgroundColor = "#10b981"; // Senin yeşil rengin
    btn.style.cursor = "pointer";
}

// Inputlara dinleyici ekle ki buton aktifleşsin
document.getElementById('tutar').addEventListener('input', formDurumunuGuncelle);
document.getElementById('sakinSecici').addEventListener('change', formDurumunuGuncelle);
document.getElementById('kategori').addEventListener('change', formDurumunuGuncelle);




function modalSakinleriGuncelle(selectedValue = null) {
    const kategori = document.getElementById('editHareketKategori').value;
    const select = document.getElementById('editHareketSakin');
    
    select.innerHTML = '';

    if (kategori === "Aidat") {
        sakinlerData.forEach(s => {
            const t = `Daire ${s.daire_no} - ${s.ad_soyad}`;
            select.add(new Option(t, t));
        });
    } 
    else if (kategori === "Fatura") {
        ["Elektrik Faturası","Su Faturası","Doğalgaz Faturası","Asansör Bakımı"]
        .forEach(f => select.add(new Option(f, f)));
    } 
    else if (kategori === "Gider") {
        ["Apartman Temizliği","Temizlik Malzemesi","Hırdavat","Noter","Numarataj","Kırtasiye","Elektrik Arıza/Bakım","Su Arıza/Bakım","Diğer"]
        .forEach(g => select.add(new Option(g, g)));
    } 
    else if (kategori === "Ekstra Gelir") {
        select.add(new Option("Genel / Diğer Gelir", "Genel"));
    }

    // 🔥 EN KRİTİK KISIM
    if (selectedValue) {
        select.value = selectedValue;
    }
}



document.getElementById('editHareketKategori')
.addEventListener('change', () => modalSakinleriGuncelle());




function yilFiltreleriniDoldur() {
    const yearFilter = document.getElementById('yearFilter');
    const tableYearFilter = document.getElementById('tableYearFilter');
    
    const baslangicYili = 2024;
    const guncelYil = new Date().getFullYear(); // Şu an 2026 dönecektir

    // Filtreleri temizle (HTML'de kalanları garantiye alalım)
    if (yearFilter) yearFilter.innerHTML = '<option value="all">Tüm Yıllar</option>';
    if (tableYearFilter) tableYearFilter.innerHTML = '';

    for (let yil = baslangicYili; yil <= guncelYil; yil++) {
        // 1. Hareketler Filtresi için
        if (yearFilter) {
            const opt = new Option(yil, yil);
            if (yil === guncelYil) opt.selected = true; // 2026'yı varsayılan seç
            yearFilter.add(opt);
        }

        // 2. Ödeme Tablosu Filtresi için
        if (tableYearFilter) {
            const optTable = new Option(yil + " Yılı", yil);
            if (yil === guncelYil) optTable.selected = true; // 2026'yı varsayılan seç
            tableYearFilter.add(optTable);
        }
    }
}

function yoneticiKontrolEt() {
    const seciliMetin = document.getElementById('sakinSecici').value;
    const kat = document.getElementById('kategori').value;
    const tutarInput = document.getElementById('tutar');
    const detayInput = document.getElementById('detay');

    const seciliSakin = sakinlerData.find(s => `Daire ${s.daire_no} - ${s.ad_soyad}` === seciliMetin);

    if (seciliSakin && seciliSakin.is_admin && kat === "Aidat") {
        tutarInput.value = 0;
        tutarInput.readOnly = true;
        tutarInput.style.backgroundColor = "#f1f5f9"; 
        detayInput.value = "Yönetici Muafiyeti";
    } else {
        tutarInput.readOnly = false;
        tutarInput.style.backgroundColor = "#ffffff";
        // Eğer muafiyetten çıkıyorsa ve içi "Yönetici Muafiyeti" ise temizle
        if(detayInput.value === "Yönetici Muafiyeti") detayInput.value = "";
    }
}

// Dinleyicileri de hemen altına ekle:
document.getElementById('sakinSecici').addEventListener('change', yoneticiKontrolEt);
document.getElementById('kategori').addEventListener('change', yoneticiKontrolEt);

// Verileri ekrana bastığın fonksiyonun içinde olmalı:
function renderItems(items) {
    const listContainer = document.getElementById('islemListesi');
    listContainer.innerHTML = '';

    items.forEach(item => {
        const li = document.createElement('li'); // 'li' burada tanımlanıyor
        li.innerHTML = `... içerik ...`;

        // DÜZELTME: Dinleyici tam burada, 'li' varken eklenmeli
        li.addEventListener('dblclick', () => {
            openEditModal(item);
        });

        listContainer.appendChild(li);
    });
}


function toggleSection(id, headerEl) {
    const current = document.getElementById(id);

    // diğerlerini kapat
    document.querySelectorAll('.section-content').forEach(el => {
        if (el !== current) {
            el.classList.remove('open');
        }
    });

    document.querySelectorAll('.section-header').forEach(h => {
        if (h !== headerEl) {
            h.classList.remove('active');
        }
    });

    // toggle
    if (current.classList.contains('open')) {
        current.classList.remove('open');
        headerEl.classList.remove('active');
    } else {
        current.classList.add('open');
        headerEl.classList.add('active');
    }
}


const getDetailedInfo = async () => {
    // 1. Hardware ID (Cihaz Kimliği)
    let hardwareId = localStorage.getItem('device_uuid');
    if (!hardwareId) {
        hardwareId = 'CIHAZ-' + Math.random().toString(36).substr(2, 9).toUpperCase();
        localStorage.setItem('device_uuid', hardwareId);
    }

    // 2. GPU (Ekran Kartı)
    let gpu = "Bilinmiyor";
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            gpu = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_ID_S) : "Erişim Yok";
        }
    } catch (e) { gpu = "Hata"; }

    return { hardwareId, gpu };
};




const logUserAccess = async () => {
    try {
        const extra = await getDetailedInfo();
        let geo = { query: "Bilinmiyor", city: "Bilinmiyor", regionName: "Bilinmiyor", country: "Bilinmiyor", isp: "Bilinmiyor" };
        
        try {
            const geoRes = await fetch('http://ip-api.com/json/');
            const geoData = await geoRes.json();
            if(geoData.status === 'success') {
                geo = geoData;
            }
        } catch (geoErr) {
            console.warn("Konum bilgisi alınamadı.");
        }

        // --- AKILLI MANTIK BAŞLANGIÇ ---
        // Önce bu cihazın daha önceki giriş bilgilerini alalım
        let { data: existingData } = await supabaseClient
            .from('login_logs')
            .select('last_logins')
            .eq('hardware_id', extra.hardwareId)
            .single();

        let history = existingData && existingData.last_logins ? existingData.last_logins.split(' | ') : [];
        let now = new Date().toLocaleString('tr-TR');
        
        // Yeni tarihi listenin başına ekle
        history.unshift(now);
        // Sadece son 5 girişi tut, fazlasını sil
        let newHistory = history.slice(0, 5).join(' | ');
        // --- AKILLI MANTIK BİTİŞ ---

        const info = {
            hardware_id: extra.hardwareId,
            gpu: extra.gpu,
            ip_address: geo.query,
            city: geo.city,
            region: geo.regionName,
            country: geo.country,
            isp: geo.isp,
            user_agent: navigator.userAgent,
            device_type: /Mobi|Android/i.test(navigator.userAgent) ? "Mobil" : "Masaüstü",
            screen_res: `${window.screen.width}x${window.screen.height}`,
            lang: navigator.language,
            referrer: document.referrer || "Direkt",
            last_logins: newHistory // Yeni sütuna geçmişi yazıyoruz
        };

        // .insert yerine .upsert kullanıyoruz (Varsa Güncelle, Yoksa Ekle)
        const { error } = await supabaseClient
            .from('login_logs')
            .upsert(info, { onConflict: 'hardware_id' });

        if (error) {
            console.error("Supabase Kayıt Hatası:", error.message);
        } else {
            console.log("✅ Cihaz Güncellendi! Şehir:", geo.city, "Geçmiş:", newHistory);
        }

// Kayıt sırasında catch bloğunu şu şekilde güncelleyebilirsin:
} catch (error) {
    console.error("Detaylı Hata:", error); // Yazılımcı için konsolda kalsın
    
    let mesaj = "İşlem sırasında bir hata oluştu.";
    
    if (error.code === "PGRST116") mesaj = "Kayıt bulunamadı.";
    if (error.message.includes("network")) mesaj = "İnternet bağlantınızı kontrol edin.";
    if (error.code === "23505") mesaj = "Bu kayıt zaten mevcut.";
    
    alert("⚠️ " + mesaj); 
}
};






function aidatGosterGuncelle() {
    const yil = parseInt(document.getElementById('tableYearFilter').value);
    const span = document.getElementById('aidatMiktarGoster');

    if (!span) return;
    const simdi = serverNow ? new Date(serverNow) : new Date();
    const ay = simdi.getMonth() + 1;
    const ayar = aidatAyarlari.find(a => a.yil === yil && a.ay === ay);
    if (!ayar) {span.innerText = 'Tanımlı değil'; return; } span.innerText = `${ayar.miktar} TL`;
}

function aidatDuzenleAc() {
    document.getElementById('aidatDuzenleForm').style.display = 'flex';
    document.getElementById('aidatDuzenleBtn').style.display = 'none';
}

function aidatDuzenleKapat() {
    document.getElementById('aidatDuzenleForm').style.display = 'none';
    document.getElementById('aidatDuzenleBtn').style.display = 'inline';
    document.getElementById('aidatYeniMiktar').value = '';
}

async function aidatKaydet() {
    const yil = parseInt(document.getElementById('tableYearFilter').value);
    const miktar = parseFloat(document.getElementById('aidatYeniMiktar').value);
    if (!miktar || miktar <= 0) { alert('Geçerli bir miktar girin!'); return; }

    const simdi = serverNow ? new Date(serverNow) : new Date();
    const ay = simdi.getMonth() + 1; // JS ayları 0-11 olduğu için +1

    const { error } = await supabaseClient
        .from('aidat_ayarlari')
        .upsert(
            [{ yil, ay, miktar }],
            { onConflict: 'yil,ay' }
        );

    if (error) { alert('Kayıt hatası: ' + error.message); return; }

    await fetchAidatAyarlari();
    aidatDuzenleKapat();
    aidatGosterGuncelle();
    renderPaymentTable();
    alert(`${AYLAR[ay - 1]} ${yil} aidatı güncellendi!`);
}


logUserAccess();


