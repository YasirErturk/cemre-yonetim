import imaplib
import email
from email.header import decode_header
import time
import re
import urllib.parse
from supabase import create_client, Client

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys

# --- 1. AYARLAR VE SİSTEM BİLGİLERİ ---
EMAIL_USER = "coskunerler07@gmail.com"
EMAIL_PASS = "ojki pgtd hwzz gltl"  # Gmail Uygulama Şifresi
IMAP_SERVER = "imap.gmail.com"

SUPABASE_URL = "https://daruffqlidfrhbwswopn.supabase.co"
SUPABASE_KEY = "sb_publishable_8CQ-97MUtgaTGkgOo2xFcg_3ZijKORD"

# Otomasyona özel bağımsız Chrome profil dizini
BOT_PROFILE_PATH = r"C:\Users\PRJ-2\AppData\Local\Google\Chrome\User Data\WhatsApp_Bot_Profile"

# Supabase İstemcisi
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# --- 2. YARDIMCI FONKSİYONLAR ---

def telefon_temizle(tel):
    """Telefon numarasını sadece rakamlara indirger ve +90 / 90 formatına getirir."""
    if not tel:
        return ""
    rakamlar = re.sub(r'\D', '', str(tel))
    if rakamlar.startswith('0'):
        rakamlar = rakamlar[1:]
    if not rakamlar.startswith('90') and len(rakamlar) == 10:
        rakamlar = '90' + rakamlar
    return rakamlar


def whatsapp_mesaj_gonder_selenium(telefon, mesaj):
    """WhatsApp Web üzerinden arka planda görünmez (Headless) olarak mesaj gönderir."""
    temiz_tel = telefon_temizle(telefon)
    if not temiz_tel:
        print("⚠️ Geçersiz telefon numarası, WhatsApp mesajı gönderilemedi.")
        return False

    encoded_mesaj = urllib.parse.quote(mesaj)
    url = f"https://web.whatsapp.com/send?phone={temiz_tel}&text={encoded_mesaj}"

    options = Options()
    options.add_argument(f"--user-data-dir={BOT_PROFILE_PATH}")
    options.add_argument("--headless=new")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")

    driver = None
    try:
        print(f"🤖 WhatsApp botu arka planda {temiz_tel} için çalıştırılıyor...")
        driver = webdriver.Chrome(options=options)
        driver.get(url)

        wait = WebDriverWait(driver, 30)
        msg_box = wait.until(
            EC.presence_of_element_located((By.XPATH, '//div[@contenteditable="true"][@data-tab="10"]'))
        )
        time.sleep(1)
        msg_box.send_keys(Keys.ENTER)
        print(f"✅ Mesaj arka planda başarıyla gönderildi -> {temiz_tel}")
        time.sleep(3)
        return True

    except Exception as e:
        print(f"❌ WhatsApp Gönderim Hatası: {e}")
        return False
    finally:
        if driver:
            driver.quit()


def mail_icerigini_al(msg):
    """E-postanın gövde metnini çözer."""
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition"))
            if content_type == "text/plain" and "attachment" not in content_disposition:
                try:
                    body = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                except Exception:
                    pass
    else:
        try:
            body = msg.get_payload(decode=True).decode('utf-8', errors='ignore')
        except Exception:
            pass
    return body


def tutar_ayikla(mail_icerigi):
    """Mail içeriğinden ödenen tutarı çekmeye çalışır (örn: 850₺, 1500 TL, 1.500,00 TL)."""
    # 850₺ veya 850 TL veya 850.00 TL benzeri kalıpları yakalar
    match = re.search(r'(\d+[\d\.,]*)\s*(?:₺|TL|TRY|tl)', mail_icerigi)
    if match:
        tutar_str = match.group(1).replace('.', '').replace(',', '.')
        try:
            return f"{float(tutar_str):,.0f} TL"
        except ValueError:
            return f"{match.group(1)} TL"
    return "aidat/ödeme"


def islem_yap(mail_icerigi):
    """Mail içeriğindeki sakini tespit eder ve WhatsApp mesajı gönderir."""
    print("🔎 Mail içeriği analiz ediliyor...")

    # Supabase'den sakin listesini çek (sadece isim ve telefon eşleştirmesi için)
    res = supabase.table("sakinler").select("*").execute()
    sakinler = res.data if res.data else []

    bulunan_sakin = None
    for sakin in sakinler:
        ad_soyad = sakin.get("ad_soyad", "")
        if ad_soyad and ad_soyad.lower() in mail_icerigi.lower():
            bulunan_sakin = sakin
            break

    if bulunan_sakin:
        print(f"🎯 Eşleşen Sakin Bulundu: {bulunan_sakin['ad_soyad']}")

        telefon = bulunan_sakin.get("telefon")
        if not telefon:
            print(f"⚠️ {bulunan_sakin['ad_soyad']} için telefon numarası eksik, mesaj gönderilemedi.")
            return

        # Mailden tutarı çek
        odenen_tutar_metni = tutar_ayikla(mail_icerigi)

        # WhatsApp Mesaj Metni
        mesaj = (
            f"Sayın {bulunan_sakin['ad_soyad']},\n\n"
            f"{odenen_tutar_metni} tutarındaki ödemeniz alınmıştır. Teşekkür ederiz.\n\n"
            f"Cemre Apt. Yönetimi"
        )

        # Selenium ile WhatsApp Bildirimi Gönder
        whatsapp_mesaj_gonder_selenium(telefon, mesaj)

    else:
        print("❓ Mail içeriğinde veritabanındaki sakin adlarıyla eşleşen bir isim bulunamadı.")


def banka_maillerini_kontrol_et():
    """Okunmamış banka/bildirim maillerini kontrol eder."""
    try:
        mail = imaplib.IMAP4_SSL(IMAP_SERVER)
        mail.login(EMAIL_USER, EMAIL_PASS)
        mail.select("inbox")

        # Sadece OKUNMAMIŞ (UNSEEN) mailleri arar
        status, response = mail.search(None, 'UNSEEN')
        mail_ids = response[0].split()

        if mail_ids:
            print(f"📩 {len(mail_ids)} adet yeni okunmamış mail bulundu!")
            for m_id in mail_ids:
                status, msg_data = mail.fetch(m_id, '(RFC822)')
                for response_part in msg_data:
                    if isinstance(response_part, tuple):
                        msg = email.message_from_bytes(response_part[1])
                        body = mail_icerigini_al(msg)

                        print(f"\n--- YENİ MAIL İÇERİĞİ ---\n{body}\n-------------------------")
                        islem_yap(body)

                        # Maili okundu olarak işaretle
                        mail.store(m_id, '+FLAGS', '\\Seen')
        else:
            print("💤 Yeni okunmamış mail yok. Bekleniyor...")

        mail.logout()
    except Exception as e:
        print(f"❌ Mail Kontrol Hatası: {e}")


# --- 3. DÖNGÜ ---
if __name__ == "__main__":
    print("🚀 Cemre Apt. Otomasyon Sistemi Başlatıldı.")
    print("📬 Banka mailleri 15 saniyede bir kontrol edilecek...\n")

    while True:
        banka_maillerini_kontrol_et()
        time.sleep(15)