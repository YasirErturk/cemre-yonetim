(function () {
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

supabaseClient.from('veriler').select('id').limit(1);

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

    if (isOk) {
        currentUserEmail = session.user.email;
        startTimer();
        setToday();
    }

    await fetchServerTime();
    await fetchAidatAyarlari();
    await loadSakinlerData();
    await fetchData();
    renderPaymentTable();

    const currentHash = window.location.hash.replace('#', '');
    if (['kayitlar', 'sakinler', 'odeme-tablosu'].includes(currentHash)) {
        showTab(currentHash);
    }
}

function daireSecicileriDoldur() {
    const inputs = [document.getElementById('inputDaireNo'), document.getElementById('editSakinNo')];
    inputs.forEach(select => {
        if (!select) return;
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
    // Ödeme tablosundaki ay hücreleriyle birlikte Supabase'den gelen borç sütununu da yenile.
    if (typeof renderPaymentTable === 'function') renderPaymentTable();
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
            (daire === 'all' || item.daire_no == daire.replace('Daire ', '')) &&
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
        if (isGelir) { if (isBanka) b += valTutar; else n += valTutar; }
        else { if (isBanka) b -= valTutar; else n -= valTutar; }
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
        <li style="border-left: 6px solid ${borderCol}; cursor: ${isAdmin ? 'pointer' : 'default'}" ${isAdmin ? `ondblclick="openHareketModal(${item.id})"` : ''}>
            <div style="flex:1;">
                <span class="date-badge islem-date">${dStr ? dStr.split('-').reverse().join('.') : ''}</span>
                ${duzenlemeRozeti}
                <br><strong style="color:${isGelir ? '#10b981' : '#ef4444'}">${valSakin} | ${item.kategori}</strong><br>
                <small><b>[${valKasa === 'Havale/EFT' ? 'Banka' : valKasa}]</b> - ${valDetay}</small>
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

    if (!v.t || v.t < 0) {
        alert("Lütfen geçerli bir tutar giriniz!");
        return;
    }

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
            const katVal = document.getElementById('kategori')?.value;
            const tutarVal = document.getElementById('tutar')?.value;
            const detayVal = document.getElementById('detay')?.value;
            const tarihVal = document.getElementById('islemTarihi')?.value || new Date().toLocaleDateString('tr-TR');
            
            const sakEl = document.getElementById('sakinSecici');
            const seciliSakinId = sakEl?.value;
            const seciliDaireMetni = sakEl?.options[sakEl?.selectedIndex]?.text || '';
    
            if (katVal === "Aidat" && seciliSakinId) {
                const sakinSonDurum = await sakinBorcDus(seciliSakinId, tutarVal);
    
                if (sakinSonDurum) {
                    const waOnay = confirm("Kayıt başarıyla eklendi!\n\nSakin için WhatsApp üzerinden bilgilendirme mesajı gönderilsin mi?");
    
                    if (waOnay) {
                        whatsappMesajGonder({
                            adSoyad: sakinSonDurum.ad_soyad,
                            daireNo: seciliDaireMetni,
                            tarih: tarihVal,
                            tutar: tutarVal,
                            detay: detayVal || "Aidat Ödemesi",
                            kalanBorc: sakinSonDurum.guncelBorc,
                            telefon: sakinSonDurum.telefon
                        });
                    }
                } else {
                    alert("Kayıt başarılı!");
                }
            } else {
                alert("Kayıt başarılı!");
            }
    
            // --- FORMU İLK HALİNE GETİR (SIRTINI TEMİZLE) ---
            document.getElementById('tutar').value = '';
            document.getElementById('detay').value = '';
            
            const katEl = document.getElementById('kategori');
            if (katEl) katEl.value = '';
    
            if (sakEl) {
                sakEl.innerHTML = '';
                sakEl.add(new Option("İşlem Seçiniz...", ""));
            }
    
            const ipucuEl = document.getElementById('aidatIpucu');
            if (ipucuEl) ipucuEl.innerText = '';
    
            fetchData();
    
            document.querySelectorAll('.section-content').forEach(el => el.classList.remove('open'));
            document.querySelectorAll('.section-header').forEach(el => el.classList.remove('active'));
        }
};



// YENİ SAKİN EKLEME BUTONU İŞLEVİ
document.getElementById('sakinKaydetBtn').onclick = async () => {
    const no = document.getElementById('inputDaireNo').value;
    const ad = document.getElementById('inputAdSoyad').value;

    if (!no || !ad) return alert("Daire No ve Ad Soyad boş bırakılamaz!");

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
    // --- const { data } = await supabaseClient.from('sakinler').select('*').order('daire_no');
    const { data } = await supabaseClient.from('sakinler').select('*').eq('is_active', true).order('daire_no');

    sakinlerData = data || [];

    const fil = document.getElementById('daireFilter');
    const list = document.getElementById('sakinListesi');

    if (fil) fil.innerHTML = '<option value="all">Tüm Daireler</option>';
    if (list) list.innerHTML = '';

    const isAdmin = document.getElementById('timerDisplay').style.display === 'flex';

    sakinlerData.forEach(s => {
        const t = `Daire ${s.daire_no} - ${s.ad_soyad}`;
        if (fil) fil.innerHTML += `<option value="Daire ${s.daire_no}">${t}</option>`;

        // --- VURGU KISMI BURADA BAŞLIYOR ---
        const isYonetici = s.is_admin === true;
        const yoneticiStili = isYonetici ? 'border-left: 5px solid #6366f1; background: #f8fafc;' : '';
        const yoneticiRozeti = isYonetici ? '<span style="background:#eef2ff; color:#6366f1; font-size:10px; padding:2px 6px; border-radius:4px; margin-left:10px; border:1px solid #e0e7ff; font-weight:700;">YÖNETİCİ</span>' : '';

        const dblClickAction = `ondblclick="openSakinModal(${s.id}, '${s.ad_soyad}', ${s.daire_no})"`;

        if (list) {
            list.innerHTML += `
                <li style="cursor: ${isAdmin ? 'pointer' : 'default'}; ${yoneticiStili}" ${dblClickAction}>
                    <span style="display:flex; align-items:center; width:100%;">
                        ${t} ${yoneticiRozeti}
                    </span>
                </li>`;
        }
        // --- VURGU KISMI BURADA BİTİYOR ---
    });
}

// ÖDEME TABLOSU (Tarih ve Tutar geri getirildi)


function calcKarliHavuz(daireNo, yilInt) {
    const baslangicYili = rawData.filter(i => getTarih(i)).reduce((min, i) => {
        const y = new Date(getTarih(i)).getFullYear();
        return y < min ? y : min;
    }, new Date().getFullYear());
    if (yilInt < baslangicYili) return 0;

    const prevKarli = calcKarliHavuz(daireNo, yilInt - 1);

    const odemeler = rawData.filter(i => {
        const dStr = getTarih(i);
        if (!dStr) return false;
        const d = new Date(dStr);
        return i.daire_no == daireNo && i.kategori === 'Aidat' && d.getFullYear() == yilInt;
    });

    let havuz = prevKarli + odemeler.reduce((sum, o) => sum + parseFloat(o.tutar || 0), 0);

    for (let m = 1; m <= 12; m++) {
        const ayarObj = aidatAyarlari.find(a => a.yil === yilInt && a.ay === m);
        if (!ayarObj) continue;

        const ayKaydiK = aidatAyarlari.find(a => a.yil === yilInt && a.ay === m);
        const sonYoneticiK = [...aidatAyarlari]
            .filter(a => a.yonetici_daire && (a.yil < yilInt || (a.yil === yilInt && a.ay <= m)))
            .sort((a, b) => a.yil !== b.yil ? b.yil - a.yil : b.ay - a.ay)[0];
        const buAyYoneticiK = ayKaydiK?.yonetici_daire || sonYoneticiK?.yonetici_daire || null;
        if (buAyYoneticiK && buAyYoneticiK == daireNo) continue;

        havuz = havuz >= ayarObj.miktar ? havuz - ayarObj.miktar : 0;
    }

    return havuz > 0 ? havuz : 0;
}


function bakiyeGosteriminiHazirla(borcDegeri) {
    const borc = Number(borcDegeri);
    const kalanBorc = Number.isFinite(borc) ? borc : 0;
    const bakiye = -kalanBorc;
    const mutlakTutar = Math.abs(bakiye).toLocaleString('tr-TR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });

    const isaretliTutar = bakiye > 0
        ? `(+)${mutlakTutar}`
        : bakiye < 0
            ? `(-)${mutlakTutar}`
            : '0';

    return { kalanBorc, bakiye, metin: `${isaretliTutar} TL` };
}

function renderPaymentTable() {
    const yil = document.getElementById('tableYearFilter').value;
    const thead = document.getElementById('tableHead'), tbody = document.getElementById('tableBody');
    const yilInt = parseInt(yil);
    const adminGirisYapmis = document.getElementById('timerDisplay')?.style.display === 'flex';
    thead.innerHTML = `<tr><th>Daire</th>${AYLAR.map((a, i) => {
        const ayNo = i + 1;
        const ayar = aidatAyarlari.find(x => x.yil === yilInt && x.ay === ayNo);
        const ekGiderBaslik = ayar?.ek_gider
            ? `<br><span style="color:#f59e0b; font-size:9px;">+${ayar.ek_gider} ₺ ek ödeme</span>`
            : '';
        const miktar = ayar
            ? `<div style="height:34px; display:flex; align-items:center; justify-content:center;">
                    <small style="font-weight:400; color:#94a3b8; font-size:10px; line-height:1.2;">
                        ${ayar.miktar} ₺${ekGiderBaslik}
                    </small>
               </div>`
            : '<div style="height:34px;"></div>';
        return `<th>${a}${miktar}</th>`;
    }).join('')}<th class="debt-header">Bakiye</th></tr>`;
    tbody.innerHTML = '';
    // renderPaymentTable fonksiyonunun içine, sakinlerData.forEach döngüsünün başladığı yere...
    sakinlerData.forEach(s => {
        let r = `<tr><td>Daire ${s.daire_no}<br><small>${s.ad_soyad}</small></td>`;

        // Tüm zamanların ödemelerini topla
        const tumOdemeler = rawData.filter(i => {
            const dStr = getTarih(i);
            if (!dStr) return false;
            return i.daire_no == s.daire_no && i.kategori === 'Aidat';
        }).sort((a, b) => new Date(getTarih(a)) - new Date(getTarih(b)));

        let havuz = tumOdemeler.reduce((sum, o) => sum + parseFloat(o.tutar || 0), 0);
        let odemeKalanlari = tumOdemeler.map(o => ({
            tarih: getTarih(o).split('-').reverse().join('.'),
            kalan: parseFloat(o.tutar || 0)
        }));

        function tarihleriBul(gereken) {
            let tarihler = [];
            for (let o of odemeKalanlari) {
                if (gereken <= 0) break;
                if (o.kalan <= 0) continue;
                const alinan = Math.min(o.kalan, gereken);
                o.kalan -= alinan;
                gereken -= alinan;
                if (!tarihler.includes(o.tarih)) tarihler.push(o.tarih);
            }
            return tarihler.map(t => `<span style="display:block; line-height:1.4;">${t}</span>`).join('');
        }

        // En eski yılı bul
        const enEskiYil = aidatAyarlari.length > 0
            ? Math.min(...aidatAyarlari.map(a => a.yil))
            : yilInt;

        let cells = [];

        for (let y = enEskiYil; y <= yilInt; y++) {
            const yilOdemeler = tumOdemeler.filter(o => new Date(getTarih(o)).getFullYear() == y);

            for (let m = 1; m <= 12; m++) {
                const ayarObj = aidatAyarlari.find(a => a.yil === y && a.ay === m);

                // Yönetici tespiti
                const sonYonetici = [...aidatAyarlari]
                    .filter(a => a.yonetici_daire && (a.yil < y || (a.yil === y && a.ay <= m)))
                    .sort((a, b) => a.yil !== b.yil ? b.yil - a.yil : b.ay - a.ay)[0];
                const buAyYoneticiDaire = ayarObj?.yonetici_daire || sonYonetici?.yonetici_daire || null;
                const ayBasladiMi = serverNow && (
                    serverNow.getFullYear() > y ||
                    (serverNow.getFullYear() == y && serverNow.getMonth() + 1 >= m)
                );
                const isYonetici = buAyYoneticiDaire && buAyYoneticiDaire == s.daire_no && ayBasladiMi;

                if (y === yilInt) {
                    if (isYonetici) {
                        const buAyOdeme = yilOdemeler.find(o => (new Date(getTarih(o)).getMonth() + 1) === m);
                        const odenenTutar = buAyOdeme ? parseFloat(buAyOdeme.tutar) : 0;
                        const tarih = buAyOdeme ? getTarih(buAyOdeme).split('-').reverse().join('.') : '';
                        if (buAyOdeme && odenenTutar > 0) {
                            tarihleriBul(odenenTutar);
                            havuz -= odenenTutar;
                        }
                        const ekGider = ayarObj?.ek_gider || null;
                        if (ekGider) {
                            if (odenenTutar >= ekGider) {
                                cells.push({ tip: 'yonetici-odedi', tutar: odenenTutar, tarih, ekGider });
                            } else if (odenenTutar > 0) {
                                cells.push({ tip: 'yonetici-eksik', tutar: odenenTutar, tarih, ekGider });
                            } else {
                                cells.push({ tip: ayBasladiMi ? 'yonetici-odemiyor' : 'yonetici', tarih, ekGider });
                            }
                        } else {
                            cells.push({ tip: 'yonetici', tarih, ekTutar: odenenTutar > 0 ? `<br>${odenenTutar} TL` : '' });
                        }
                        continue;
                    }
                    if (!ayarObj) {
                        cells.push({ tip: 'tanimsiz' });
                        continue;
                    }
                    const toplamBorcluAidat = ayarObj.miktar + (ayarObj.ek_gider || 0);

                    if (havuz >= toplamBorcluAidat) {
                        const tarihler = tarihleriBul(toplamBorcluAidat);
                        havuz -= toplamBorcluAidat;

                        cells.push({
                            tip: 'tam',
                            tutar: toplamBorcluAidat,
                            tarihler
                        });

                    } else if (havuz > 0) {

                        const eksik = havuz;
                        const tarihler = tarihleriBul(eksik);

                        havuz = 0;

                        cells.push({
                            tip: 'eksik',
                            tutar: eksik,
                            tarihler
                        });
                    }
                    else {
                        cells.push({ tip: ayBasladiMi ? 'bos-kirmizi' : 'bos' });
                    }
                } else {
                    if (isYonetici) {
                        const buAyOdeme = tumOdemeler.find(o => {
                            const d = new Date(getTarih(o));
                            return d.getFullYear() == y && (d.getMonth() + 1) === m && parseFloat(o.tutar) > 0;
                        });
                        if (buAyOdeme) {
                            tarihleriBul(parseFloat(buAyOdeme.tutar));
                            havuz -= parseFloat(buAyOdeme.tutar);
                        }
                        continue;
                    }
                    if (!ayarObj) continue;
                    const toplamBorcluAidat = ayarObj.miktar + (ayarObj.ek_gider || 0);

                    if (havuz >= toplamBorcluAidat) {

                        tarihleriBul(toplamBorcluAidat);
                        havuz -= toplamBorcluAidat;

                    } else if (havuz > 0) {

                        tarihleriBul(havuz);
                        havuz = 0;
                    }
                }
            }
        }

        // Fazlayı sadece mevcut yılda göster
        const mevcutYil = serverNow ? serverNow.getFullYear() : new Date().getFullYear();
        if (havuz > 0 && yilInt === mevcutYil) {
            const sonOdenen = [...cells].reverse().find(c => c.tip === 'tam' || c.tip === 'eksik');
            if (sonOdenen) {
                const kalanTarihler = odemeKalanlari.filter(o => o.kalan > 0).map(o => o.tarih)
                    .filter(t => !(sonOdenen.tarihler || '').includes(t))
                    .map(t => `<span style="display:block; line-height:1.4;">${t}</span>`).join('');
                sonOdenen.tutar += havuz;
                sonOdenen.tip = 'fazla';
                if (kalanTarihler) sonOdenen.tarihler += kalanTarihler;
            }
        }

        for (const c of cells) {
            if (c.tip === 'yonetici') {
                r += `<td style="background-color:#eef2ff !important; color:#6366f1 !important; border:1px solid #c3dafe; font-weight:bold;">
                        <strong style="font-size:11px;">YÖNETİCİ${c.ekTutar}</strong><br>
                        <small style="font-size:9px; opacity:0.8;">${c.tarih}</small>
                      </td>`;
            } else if (c.tip === 'tam') {
                r += `<td class="paid-cell">
                        <strong style="font-size:11px;">${c.tutar} TL</strong><br>
                        <small style="font-size:9px; opacity:0.8;">${c.tarihler}</small>
                      </td>`;
            } else if (c.tip === 'fazla') {
                r += `<td style="background-color:#bbf7d0 !important; color:#14532d; font-weight:800;">
                        <strong style="font-size:11px;">${c.tutar} TL</strong><br>
                        <small style="font-size:9px; opacity:0.8;">${c.tarihler}</small>
                      </td>`;
            } else if (c.tip === 'eksik') {
                r += `<td style="background-color:#fee2e2 !important; color:#b91c1c; font-weight:700;">
                        <strong style="font-size:11px;">${c.tutar} TL</strong><br>
                        <small style="font-size:9px; opacity:0.8;">${c.tarihler}</small>
                      </td>`;
            } else if (c.tip === 'bos-kirmizi') {
                r += `<td style="background-color:#fee2e2 !important;"></td>`;

            } else if (c.tip === 'yonetici-odedi') {
                r += `<td style="background-color:#eef2ff !important; color:#6366f1 !important; border:1px solid #c3dafe; font-weight:bold;">
                        <strong style="font-size:11px;">YÖNETİCİ<br>${c.tutar} ₺</strong><br>
                        <small style="font-size:9px; opacity:0.8; display:block; line-height:1.4;">${c.tarih}</small>
                      </td>`;
            } else if (c.tip === 'yonetici-eksik') {
                r += `<td style="background-color:#fee2e2 !important; color:#b91c1c; font-weight:700; border:1px solid #fca5a5;">
                                <strong style="font-size:11px;">YÖNETİCİ<br>${c.tutar}/${c.ekGider} TL</strong><br>
                                <small style="font-size:9px; opacity:0.8; display:block; line-height:1.4;">${c.tarih}</small>
                              </td>`;
            } else if (c.tip === 'yonetici-odemiyor') {
                r += `<td style="background-color:#fee2e2 !important; color:#b91c1c; border:1px solid #fca5a5;">
                        <strong style="font-size:11px;">YÖNETİCİ</strong>
                      </td>`;

            } else {
                r += `<td></td>`;
            }
        }

        // Borç bilgisi sakinler tablosundan (s.borc) okunur ve satırın en sonunda gösterilir.
        const borc = Number(s.borc);
        const kalanBorc = Number.isFinite(borc) ? borc : 0;
        // Supabase'de pozitif borc borcu, negatif borc fazla ödemeyi tutar.
        // Kullanıcı arayüzünde bakiye mantığıyla gösteriyoruz:
        // borç = (-), fazla ödeme/alacak = (+).
        const bakiyeBilgisi = bakiyeGosteriminiHazirla(kalanBorc);
        const bildirButonu = adminGirisYapmis
            ? `<button type="button" class="debt-notify-btn" onclick="event.stopPropagation(); whatsappBakiyeBildir(${s.id})">Bildir</button>`
            : '';
        const debtCellContentClass = adminGirisYapmis
            ? 'debt-cell-content'
            : 'debt-cell-content debt-cell-content-public';
        const borcHucre = kalanBorc > 0
            ? `<td class="debt-cell debt-cell-unpaid"><div class="${debtCellContentClass}"><strong>${bakiyeBilgisi.metin}</strong>${bildirButonu}</div></td>`
            : kalanBorc < 0
                ? `<td class="debt-cell debt-cell-credit"><div class="${debtCellContentClass}"><strong>${bakiyeBilgisi.metin}</strong>${bildirButonu}</div></td>`
                : `<td class="debt-cell debt-cell-paid"><div class="${debtCellContentClass}"><strong>0 TL</strong>${bildirButonu}</div></td>`;

        r += borcHucre;
        tbody.innerHTML += r + `</tr>`;
    });
    aidatGosterGuncelle();
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

window.deleteHareket = async () => { if (confirm("Silinsin mi?")) { await supabaseClient.from('veriler').delete().eq('id', document.getElementById('editHareketId').value); closeModal('hareketModal'); fetchData(); } }

// SAKİN MODAL
window.openSakinModal = async (id, ad, no) => {
    const s = sakinlerData.find(x => x.id === id);
    document.getElementById('editSakinId').value = id;
    document.getElementById('editSakinAd').value = ad;
    let formatliNo = no < 10 ? '0' + no : no.toString();
    document.getElementById('editSakinNo').value = formatliNo;

    if (s) {
        document.getElementById('editSakinIsAdmin').checked = s.is_admin || false;
        const telEl = document.getElementById('editSakinTel');
        if (telEl) telEl.value = s.telefon || '';
    }

    // 🔒 Supabase üzerinden oturum kontrolü
    const { data: { session } } = await supabaseClient.auth.getSession();
    const isLoggedIn = !!session; // Oturum varsa true, yoksa false döner

    const adminArea = document.getElementById('sakinAdminFormArea');
    const publicCloseBtn = document.getElementById('sakinKapatPublicBtn');

    if (isLoggedIn) {
        // Yönetici Giriş Yapmışsa: Düzenleme Formunu Göster
        if (adminArea) adminArea.style.display = 'block';
        if (publicCloseBtn) publicCloseBtn.style.display = 'none';
    } else {
        // Giriş Yapılmamışsa: Formu Gizle, Sadece Daire Geçmişini Göster
        if (adminArea) adminArea.style.display = 'none';
        if (publicCloseBtn) publicCloseBtn.style.display = 'inline-block';
    }

    document.getElementById('sakinModal').style.display = 'flex';

    // Geçmiş Sakinleri Çek
    daireGecmisiniGetir(no);
};

window.saveSakin = async () => {
    const id = document.getElementById('editSakinId').value;
    const ad = document.getElementById('editSakinAd').value;
    const no = document.getElementById('editSakinNo').value;
    const isAdmin = document.getElementById('editSakinIsAdmin').checked;
    const tel = document.getElementById('editSakinTel')?.value || '';

    if (ad && no) {
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
            is_admin: isAdmin,
            telefon: tel
        })
        .eq('id', id);

        if (error) {
            alert("Hata: " + error.message);
        } else {

            if (isAdmin === true && serverNow) {
                const ay = serverNow.getMonth() + 1;
                const yil = serverNow.getFullYear();
                const daireNoInt = parseInt(no);
                await supabaseClient
                    .from('aidat_ayarlari')
                    .upsert([{ yil, ay, yonetici_daire: daireNoInt }], { onConflict: 'yil,ay' });
                await fetchAidatAyarlari();
            }

            closeModal('sakinModal');

            setTimeout(async () => {
                await loadSakinlerData();
                renderPaymentTable();
            }, 200);
        }
    }
}

window.yeniSakinAction = async () => {
    const id = document.getElementById('editSakinId').value;
    const yeniAd = document.getElementById('editSakinAd').value.trim();
    const daireNo = document.getElementById('editSakinNo').value;
    const yeniTel = document.getElementById('editSakinTel').value.trim(); // Yeni sakinin telefonu

    if (!yeniAd) {
        alert("Lütfen yeni sakinin adını yazın!");
        return;
    }

    const mevcutSakin = sakinlerData.find(s => s.id == id);
    if (!mevcutSakin) {
        alert("Mevcut sakin kaydı bulunamadı!");
        return;
    }

    const onay = confirm(`Daire ${daireNo} için kiracı değişimi yapılacaktır.\n\nEski Sakin: "${mevcutSakin.ad_soyad}" (Geçmişe kopyalanacak)\nYeni Sakin: "${yeniAd}" (Aktif yapılacak)\n\nOnaylıyor musunuz?`);
    if (!onay) return;

    const bugun = new Date().toISOString().split('T')[0];

    // 1. Eski sakinin verilerini geçmişe kopyala (Telefon: mevcutSakin.telefon)
    const { error: insertError } = await supabaseClient
        .from('sakinler')
        .insert([{
            daire_no: daireNo,
            ad_soyad: mevcutSakin.ad_soyad,
            is_admin: false,
            is_active: false,
            telefon: mevcutSakin.telefon || null, // <-- DÜZELTİLDİ: Eski sakinin mevcut telefonu aktarılıyor
            giris_tarihi: mevcutSakin.giris_tarihi || null,
            cikis_tarihi: bugun
        }]);

    if (insertError) {
        alert("Eski sakin geçmişe kopyalanırken hata oluştu: " + insertError.message);
        return;
    }

    // 2. Mevcut ana satırı YENİ sakinin adıyla ve telefonuyla güncelle
    const { error: updateError } = await supabaseClient
        .from('sakinler')
        .update({
            ad_soyad: yeniAd,
            telefon: yeniTel, // <-- YENİ SAKİNİN TELEFONU
            is_active: true,
            giris_tarihi: bugun,
            cikis_tarihi: null
        })
        .eq('id', id);

    if (updateError) {
        alert("Yeni sakin güncellenirken hata oluştu: " + updateError.message);
        return;
    }

    alert("Yeni sakin başarıyla kaydedildi!");
    closeModal('sakinModal');

    await loadSakinlerData();
    if (typeof renderPaymentTable === 'function') renderPaymentTable();
};

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
    // Sayfa değişince filtre/form kapanıp sıfırlansın
    document.querySelectorAll('.section-content').forEach(el => {
        el.classList.remove('open');
    });

    document.querySelectorAll('.section-header').forEach(h => {
        h.classList.remove('active');
    });

    // 3. Linki güncelle (Adres çubuğu değişir ama sayfa yenilenmez)
    window.history.pushState(null, null, `#${t}`);

    // 4. Eğer ödeme tablosuysa verileri çiz
    if (t === 'odeme-tablosu') renderPaymentTable();

}



document.getElementById('loginBtn').onclick = async () => {
    const { error } = await supabaseClient.auth.signInWithPassword({ email: document.getElementById('email').value, password: document.getElementById('password').value });
    if (error) alert("Hata!"); else checkSession();
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
    if (!sakinSelect) return;
    sakinSelect.innerHTML = '';

    const bosOpt = new Option("Daire Seçiniz...", "");
    bosOpt.disabled = true;
    bosOpt.selected = true;
    sakinSelect.add(bosOpt);

    // Düzeltme: Sabit 10 daire yerine veritabanındaki sakinleri getiriyoruz
    if (sakinlerData.length > 0) {
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
tarihInput.addEventListener('change', otomatikAciklamaGuncelle);
tarihInput.addEventListener('input', otomatikAciklamaGuncelle);





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
        ["Elektrik Faturası", "Su Faturası", "Doğalgaz Faturası", "Asansör Bakımı"]
            .forEach(f => select.add(new Option(f, f)));
    }
    else if (kategori === "Gider") {
        ["Apartman Temizliği", "Temizlik Malzemesi", "Hırdavat", "Noter", "Numarataj", "Kırtasiye", "Elektrik Arıza/Bakım", "Su Arıza/Bakım", "Diğer"]
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



document.getElementById('editHareketKategori').addEventListener('change', () => modalSakinleriGuncelle());




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

    function yoneticiKontrolEt() {
        const tutarInput = document.getElementById('tutar');
        const detayInput = document.getElementById('detay');

        // HER ZAMAN NORMAL DAVRAN
        tutarInput.readOnly = false;
        tutarInput.style.backgroundColor = "#ffffff";

        // yönetici diye hiçbir şey yapma
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
            if (geoData.status === 'success') {
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



// --- AİDAT VE EK ÖDEME YÖNETİMİ ---

function aidatGosterGuncelle() {
    const aidatSpan = document.getElementById('aidatMiktarGoster');
    const ekOdemeSpan = document.getElementById('ekOdemeMiktarGoster');
    if (!aidatSpan) return;

    const yilSelect = document.getElementById('tableYearFilter');
    const yil = parseInt(yilSelect.value);
    const simdi = serverNow ? new Date(serverNow) : new Date();
    if (!serverNow) return;
    const ay = simdi.getMonth() + 1;

    if (!aidatAyarlari || aidatAyarlari.length === 0) {
        aidatSpan.innerText = 'Yükleniyor...';
        if (ekOdemeSpan) ekOdemeSpan.innerText = 'Yükleniyor...';
        return;
    }

    const ayar = (aidatAyarlari || []).find(a => a.yil === yil && a.ay === ay);

    if (!ayar) {
        aidatSpan.innerText = 'Tanımlı değil';
        if (ekOdemeSpan) ekOdemeSpan.innerText = '0 TL';
        return;
    }

    aidatSpan.innerText = `${ayar.miktar || 0} TL`;
    if (ekOdemeSpan) {
        ekOdemeSpan.innerText = ayar.ek_gider ? `${ayar.ek_gider} TL` : '0 TL';
    }
}

// --- AİDAT İŞLEMLERİ ---
function aidatDuzenleAc() {
    document.getElementById('aidatDuzenleForm').style.display = 'flex';
    document.getElementById('aidatDuzenleBtn').style.display = 'none';

    const yil = parseInt(document.getElementById('tableYearFilter').value);
    const simdi = serverNow ? new Date(serverNow) : new Date();
    const ay = simdi.getMonth() + 1;

    const ayar = aidatAyarlari.find(a => a.yil === yil && a.ay === ay);
    document.getElementById('aidatYeniMiktar').value = ayar ? ayar.miktar : '';
}

function aidatDuzenleKapat() {
    document.getElementById('aidatDuzenleForm').style.display = 'none';
    document.getElementById('aidatDuzenleBtn').style.display = 'inline';
    document.getElementById('aidatYeniMiktar').value = '';
}

async function aidatKaydet() {
    const yil = parseInt(document.getElementById('tableYearFilter').value);
    const miktar = parseFloat(document.getElementById('aidatYeniMiktar').value);
    if (isNaN(miktar) || miktar < 0) { alert('Geçerli bir miktar girin!'); return; }

    const simdi = serverNow ? new Date(serverNow) : new Date();
    if (!serverNow) return;
    const ay = simdi.getMonth() + 1;

    const { error } = await supabaseClient
        .from('aidat_ayarlari')
        .upsert(
            [{ yil, ay, miktar }],
            { onConflict: 'yil,ay' }
        );

    if (error) { alert('Kayıt hatası: ' + error.message); return; }

    // Yeni aidat atanırken yönetici daireye temel aidat borcu eklenmez.
    await fetchAidatAyarlari();
    await aktifSakinlereBorcEkle(miktar, yil, ay, true);
    aidatDuzenleKapat();
    aidatGosterGuncelle();
    renderPaymentTable();
    alert(`${AYLAR[ay - 1]} ${yil} aidatı güncellendi!`);
}

// --- EK ÖDEME İŞLEMLERİ (YENİ EKLENDİ) ---
function ekOdemeDuzenleAc() {
    document.getElementById('ekOdemeDuzenleForm').style.display = 'flex';
    document.getElementById('ekOdemeDuzenleBtn').style.display = 'none';

    const yil = parseInt(document.getElementById('tableYearFilter').value);
    const simdi = serverNow ? new Date(serverNow) : new Date();
    const ay = simdi.getMonth() + 1;

    const ayar = aidatAyarlari.find(a => a.yil === yil && a.ay === ay);
    document.getElementById('ekOdemeYeniMiktar').value = (ayar && ayar.ek_gider) ? ayar.ek_gider : '';
}

function ekOdemeDuzenleKapat() {
    document.getElementById('ekOdemeDuzenleForm').style.display = 'none';
    document.getElementById('ekOdemeDuzenleBtn').style.display = 'inline';
    document.getElementById('ekOdemeYeniMiktar').value = '';
}

async function ekOdemeKaydet() {
    const yil = parseInt(document.getElementById('tableYearFilter').value);
    const ekGiderMiktar = parseFloat(document.getElementById('ekOdemeYeniMiktar').value) || 0;

    const simdi = serverNow ? new Date(serverNow) : new Date();
    if (!serverNow) return;
    const ay = simdi.getMonth() + 1;

    // Mevcut ayın kaydı var mı kontrol edelim
    const ayar = aidatAyarlari.find(a => a.yil === yil && a.ay === ay);
    const mevcutMiktar = ayar ? ayar.miktar : 0;

    const { error } = await supabaseClient
        .from('aidat_ayarlari')
        .upsert(
            [{ yil, ay, miktar: mevcutMiktar, ek_gider: ekGiderMiktar }],
            { onConflict: 'yil,ay' }
        );

    if (error) { alert('Kayıt hatası: ' + error.message); return; }

    // Ek ödeme, mevcut mantıktaki gibi yönetici dahil sakinlere eklenir.
    await aktifSakinlereBorcEkle(ekGiderMiktar, yil, ay, false);
    await fetchAidatAyarlari();
    ekOdemeDuzenleKapat();
    aidatGosterGuncelle();
    renderPaymentTable();
    alert(`${AYLAR[ay - 1]} ${yil} ek ödemesi güncellendi!`);
}

// Daireye ait eski (pasif) sakinleri Supabase'den çekip listeleyen fonksiyon
async function daireGecmisiniGetir(daireNo) {
    const container = document.getElementById('daireGecmisiListesi');
    if (!container) return;

    container.innerHTML = '<span style="color:#94a3b8;">Yükleniyor...</span>';

    // Daire numarasını veritabanındaki formata (01, 02 vb.) uyduruyoruz
    const arananNo = Number(daireNo) < 10 ? '0' + Number(daireNo) : daireNo.toString();

    // Hem metin hem sayı ihtimaline karşı sorguluyoruz
    const { data, error } = await supabaseClient
        .from('sakinler')
        .select('*')
        .or(`daire_no.eq.${arananNo},daire_no.eq.${Number(daireNo)}`)
        .eq('is_active', false)
        .order('cikis_tarihi', { ascending: false });

    if (error || !data || data.length === 0) {
        container.innerHTML = '<div style="color:#94a3b8; text-align:center; padding:6px;">...</div>';
        return;
    }

    let html = '<ul style="list-style:none; padding:0; margin:0;">';
    
    data.forEach(s => {
        const giris = s.giris_tarihi ? new Date(s.giris_tarihi).toLocaleDateString('tr-TR') : '...';
        const cikis = s.cikis_tarihi ? new Date(s.cikis_tarihi).toLocaleDateString('tr-TR') : '...';
        const telefon = s.telefon || 'Telefon kayıtlı değil';

        html += `
            <li style="padding:7px 0; border-bottom:1px dashed #e2e8f0; display:flex; justify-content:space-between; align-items:center; gap:10px;">
                <span style="display:flex; flex-direction:column; gap:2px; min-width:0;">
                    <span style="font-weight:600; color:#334155;">${s.ad_soyad || '...'}</span>
                    <span style="color:#64748b; font-size:11px;">📞 ${telefon}</span>
                </span>
                <span style="color:#64748b; font-size:11px; text-align:right; white-space:nowrap;">📅 ${giris} — ${cikis}</span>
            </li>
        `;
    });

    html += '</ul>';
    container.innerHTML = html;
}
// --- SAYFA AÇILDIĞINDA İLK BURA ÇALIŞIR ---
document.addEventListener('DOMContentLoaded', () => {
    // Sayfa açılır açılmaz direkt Ödeme Tablosu sekmesine geç
    if (typeof showTab === 'function') {
        showTab('odeme-tablosu');
    }
    
    // Verileri yükle
    if (typeof fetchData === 'function') {
        fetchData();
    }
});

// Aktif tüm sakinlerin borcuna tutar ekler.
// Yalnızca temel aidat eklenirken yönetici daire muaf tutulur.
async function aktifSakinlereBorcEkle(eklenecekTutar, yil = null, ay = null, yoneticiMuaf = false) {
    if (!eklenecekTutar || eklenecekTutar <= 0) return;

    const { data: aktifSakinler, error: fetchErr } = await supabaseClient
        .from('sakinler')
        .select('id, borc, daire_no, is_admin')
        .eq('is_active', true);

    if (fetchErr) {
        console.error("Sakinler çekilemedi:", fetchErr.message);
        return;
    }

    let yoneticiDaire = null;
    if (yoneticiMuaf && yil !== null && ay !== null) {
        const yilNo = Number(yil);
        const ayNo = Number(ay);
        const sonYonetici = [...aidatAyarlari]
            .filter(a => a.yonetici_daire && (
                Number(a.yil) < yilNo ||
                (Number(a.yil) === yilNo && Number(a.ay) <= ayNo)
            ))
            .sort((a, b) => Number(a.yil) !== Number(b.yil)
                ? Number(b.yil) - Number(a.yil)
                : Number(b.ay) - Number(a.ay))[0];
        const yoneticiSakin = aktifSakinler.find(s => s.is_admin === true);
        yoneticiDaire = sonYonetici?.yonetici_daire ?? yoneticiSakin?.daire_no ?? null;
    }

    for (const sakin of aktifSakinler) {
        if (yoneticiDaire !== null && Number(sakin.daire_no) === Number(yoneticiDaire)) {
            continue;
        }

        const yeniBorc = Number(sakin.borc || 0) + Number(eklenecekTutar);
        const { error: updateErr } = await supabaseClient
            .from('sakinler')
            .update({ borc: yeniBorc })
            .eq('id', sakin.id);

        if (!updateErr) {
            const localSakin = sakinlerData.find(s => s.id === sakin.id);
            if (localSakin) localSakin.borc = yeniBorc;
        }
    }
}

// Telefon numarasını WhatsApp formatına uygun hale getirir (905XXXXXXXXX)
function telefonFormatla(tel) {
    if (!tel) return '';
    let temiz = tel.replace(/\D/g, ''); // Sadece rakamları al
    if (temiz.startsWith('0')) temiz = temiz.substring(1); // Baştaki 0'ı kaldır
    if (!temiz.startsWith('90')) temiz = '90' + temiz; // Ülke kodunu ekle
    return temiz;
}

// WhatsApp'ta satır içi kod biçiminde gösterilecek otomatik bilgilendirme notu.
const WHATSAPP_BILGILENDIRME_NOTU = '`Bilgilendirme mesajıdır; otomatik olarak gönderilmektedir. Oluşabilecek hesaplama veya veri hatalarından Cemre Apartmanı Yönetimi sorumlu değildir.`';

// WhatsApp yönlendirmesini açar (Bozulmayan Evrensel Emoji Kodlarıyla)
function whatsappMesajGonder({ adSoyad, daireNo, tarih, tutar, detay, kalanBorc, telefon }) {
    const temizTel = telefonFormatla(telefon);
    
    if (!temizTel) {
        alert("Bu sakine ait geçerli bir telefon numarası bulunamadı!");
        return;
    }

    // Daire bilgisini temizle (Sadece "Daire 03" kısmını alır)
    let temizDaire = (daireNo || '').split('-')[0].trim();

    // Ödeme sonrası borç durumu: borc pozitifse borç, negatifse fazla ödeme/alacak demektir.
    const borcSayisi = Number(kalanBorc || 0);
    const borcMutlakTutar = Math.abs(borcSayisi).toLocaleString('tr-TR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });

    // Saf ASCII kaçış kodları: \u2705 (Yeşil Onay), \uD83D\uDCCD (Pin İğne)
    const simge = borcSayisi > 0 ? '\uD83D\uDCCD' : '\u2705';
    const borcMetni = borcSayisi > 0
        ? `Güncel aidat borç bakiyeniz: *${borcMutlakTutar} TL*.`
        : borcSayisi < 0
            ? `Güncel aidat alacak bakiyeniz: *${borcMutlakTutar} TL*.`
            : 'Güncel aidat borç bakiyeniz: *0 TL*.';

    // Mesaj Metni
    const mesaj = `Sayın *${adSoyad}* (${temizDaire}),\n` +
                  `*${tarih}* tarihinde *${tutar} TL* tutarındaki ödemeniz alınmıştır.\n\n` +
                  `${simge} ${borcMetni}\n\n` +
                  `Teşekkür ederiz.\n` +
                  `Cemre Apartmanı Yönetimi\n\n` +
                  WHATSAPP_BILGILENDIRME_NOTU;

    const url = `https://api.whatsapp.com/send?phone=${temizTel}&text=${encodeURIComponent(mesaj)}`;
    window.open(url, '_blank');
}


// Ödeme tablosundaki Bakiye hücresinden WhatsApp ile güncel bakiyeyi bildirir.
window.whatsappBakiyeBildir = async (sakinId) => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        alert('Bu işlem için yönetici girişi gereklidir.');
        return;
    }

    const sakin = sakinlerData.find(s => s.id == sakinId);

    if (!sakin) {
        alert('Sakin bilgisi bulunamadı.');
        return;
    }

    const temizTel = telefonFormatla(sakin.telefon);
    if (!temizTel) {
        alert('Bu sakine ait geçerli bir telefon numarası bulunamadı!');
        return;
    }

    const bakiyeBilgisi = bakiyeGosteriminiHazirla(sakin.borc);
    const bakiyeMutlakTutar = Math.abs(bakiyeBilgisi.bakiye).toLocaleString('tr-TR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
    const bakiyeMesaji = bakiyeBilgisi.bakiye < 0
        ? `Güncel aidat borç bakiyeniz: *${bakiyeMutlakTutar} TL*.`
        : bakiyeBilgisi.bakiye > 0
            ? `Güncel aidat alacak bakiyeniz: *${bakiyeMutlakTutar} TL*.`
            : 'Güncel aidat borç bakiyeniz: *0 TL*.';
    const daire = `Daire ${sakin.daire_no}`;
    const mesaj = `Sayın *${sakin.ad_soyad}* (${daire}),\n\n` +
        `${bakiyeMesaji}\n\n` +
        `Cemre Apartmanı Yönetimi\n\n` +
        WHATSAPP_BILGILENDIRME_NOTU;

    const url = `https://api.whatsapp.com/send?phone=${temizTel}&text=${encodeURIComponent(mesaj)}`;
    window.open(url, '_blank');
};

// Sakin ödeme yaptığında borcundan düşer (Eksi borç / fazla ödeme destekli)
async function sakinBorcDus(sakinIdentifier, odenenTutar) {
    if (!sakinIdentifier) return null;

    let sakin = null;

    // 1. Sayısal ID ise doğrudan ID ile dene
    if (!isNaN(sakinIdentifier) && !isNaN(parseFloat(sakinIdentifier))) {
        const { data } = await supabaseClient
            .from('sakinler')
            .select('id, borc, telefon, ad_soyad, daire_no')
            .eq('id', sakinIdentifier)
            .maybeSingle();
        sakin = data;
    }

    // 2. Metin ise ad/daire eşleştir
    if (!sakin) {
        const { data: tumSakinler } = await supabaseClient
            .from('sakinler')
            .select('id, borc, telefon, ad_soyad, daire_no')
            .eq('is_active', true);

        if (tumSakinler) {
            sakin = tumSakinler.find(s => 
                (s.ad_soyad && sakinIdentifier.toLowerCase().includes(s.ad_soyad.toLowerCase())) ||
                (s.daire_no && sakinIdentifier.includes(String(s.daire_no)))
            );
        }
    }

    if (!sakin) {
        console.error("Sakin veritabanında bulunamadı:", sakinIdentifier);
        return null;
    }

    // Math.max kaldırıldı: Borç eksiye düşebilir (Alacaklı / Fazla ödeme)
    const guncelBorc = Number(sakin.borc || 0) - Number(odenenTutar);

    const { error: borcGuncellemeHatasi } = await supabaseClient
        .from('sakinler')
        .update({ borc: guncelBorc })
        .eq('id', sakin.id);

    if (borcGuncellemeHatasi) {
        console.error("Borç güncellenemedi:", borcGuncellemeHatasi.message);
        return null;
    }

    // Ödeme tablosu yenileme beklemeden yeni borç değerini de ekranda göster.
    const localSakin = sakinlerData.find(s => s.id === sakin.id);
    if (localSakin) localSakin.borc = guncelBorc;

    return { ...sakin, guncelBorc };
}


logUserAccess();


