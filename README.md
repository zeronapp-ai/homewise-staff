# Homewise Assistant

tasarım anlamında görseldekine birebir benzeyen bir mobile uygulama yap. tamamen türkçe olsun


PROJE BAĞLAMI

Homewise, ev temizlik hizmeti veren personellerin (temizlikçilerin) kullandığı bir mobil PWA uygulamasıdır. Bu panelde her personel: ne kadar kazandığını ve ne kadar komisyon ödemesi gerektiğini görür, randevularını yönetir, izin günlerini takvimden işaretler ve kendi profilini görüntüler.

Tema: LIGHT MODE (açık tema — bu uygulama sadece açık temada tasarlanacak, koyu tema versiyonu yok).

⚠️ EN ÖNEMLİ KURAL — REFERANS GÖRSELE BİREBİR UY

Bu promptla birlikte bir referans tasarım görseli ekleniyor. Aşağıdaki metinsel tasarım sistemi (renk kodları, font, spacing) sadece genel bir çerçeve/yedek — asıl otorite eklenen görsel. Görsel ile aşağıdaki metin arasında herhangi bir çelişki olursa GÖRSELDEKİ ESAS ALINACAK.

Şu noktalarda görsele birebir/pixel-perfect uyulacak:

Renk paleti: Görseldeki tüm renkler (zemin, kart, metin, vurgu rengi, buton renkleri) tam olarak görseldeki tonlarla eşleşecek — yaklaşık/benzer değil, aynı.

Font: Görseldeki yazı karakteri/ağırlığı (kalınlık, boyut oranları) taklit edilecek.

Hizalama ve boşluk (spacing): Elemanların konumu, aralarındaki boşluk, kenar boşlukları (padding/margin) görseldeki oranlarla birebir uyumlu olacak.

Kart/buton stili: Köşe yuvarlaklığı, gölge kullanımı (varsa), buton şekli görseldeki gibi olacak.

Genel layout mantığı: Elemanların dizilişi (üstte ne var, ortada ne var, hangi bilgi hangi sırada) görseldeki akışı takip edecek.

Aşağıdaki bölümler (ekran içerikleri, hangi bilgilerin gösterileceği) hâlâ geçerli — içerik/fonksiyon planı bu promptdan, görsel dil (renk/font/hizalama) referans görselden alınacak.

TASARIM SİSTEMİ (GÖRSEL İLE ÇELİŞMEDİĞİ SÜRECE GEÇERLİ YEDEK ÇERÇEVE)

Renk Paleti

RolHex KoduKullanımSayfa arka planı#FFFFFFGenel zeminKart yüzeyi#F5F5F5Kartlar, bölümlerKenarlık / ayraç#E0E0E0İnce çizgiler, kart çerçeveleriAna metin#000000Başlıklar, gövde metniİkincil metin#6B6B6BTarih, açıklama, ikincil bilgilerAna vurgu rengi#17A34A (yeşil)Butonlar, aktif durumlar, olumlu tutarlarUyarı/komisyon rengi#E24B4A (kırmızı)Ödenecek komisyon tutarı, "izinli" işaretiMikro-vurgu#E6BE00 (sarı-altın)Yıldız/puan gösterimi (varsa)

Sadece bu renkler kullanılacak. Gradient YOK, pastel/rastgele renk YOK, her şey düz (flat) renk.

Genel his: sade, temiz, güvenilir — bankacılık/finans uygulaması disiplini gibi düşün (para/komisyon gösterimi olduğu için netlik çok önemli).

Tipografi

Font ailesi: Montserrat (Google Fonts)

Başlıklar: Bold/SemiBold, gövde metni: Regular

Para/tutar gösterimlerinde büyük ve kalın rakamlar kullan (dikkat çekmesi için)

Genel Kurallar

Mobile-first, PWA — tasarımlar telefon ekranı boyutunda (375-414px genişlik referans)

Köşe yuvarlatma: küçük-orta ölçüde tutarlı (8-12px), aşırı yuvarlak köşe YOK

8px'in katları ile tutarlı boşluk sistemi (8/16/24/32px)

İllüstrasyon, maskot, karmaşık grafik YOK — ikonlar sade/çizgisel (line icon) olacak

Alt navigasyon çubuğu (bottom nav bar): sadece ikonlar, yazı etiketi yok, 4 sekme: Dashboard (ev/grafik ikonu), Randevularım (takvim/liste ikonu), Takvim (takvim ikonu), Profil (kişi ikonu)

EKRAN 1 — DASHBOARD (Gelir & Komisyon Özeti)

Amaç: Personel giriş yaptığında karşılaştığı ana ekran, kazancını net görsün.

İçerik (yukarıdan aşağıya):

Üstte kişisel karşılama: "Merhaba, [Personel Adı]" + küçük profil fotoğrafı (sağ üstte)

Dönem seçici: "Bu Hafta / Bu Ay" arasında geçiş yapan basit bir segment kontrol

3 büyük özet kart (üst üste veya yan yana, ekran genişliğine göre):

Toplam Gelir — büyük, nötr renkte (siyah) rakam, altında "Bu ay tamamlanan X randevudan" gibi açıklama

Ödenecek Komisyon — kırmızı (#E24B4A) renkte rakam, işletmeye ödenmesi gereken tutarı gösterir

Net Kalan Tutar — yeşil (#17A34A) renkte, kalın/büyük rakam — bu kart diğer ikisinden görsel olarak biraz daha vurgulu olmalı (örn. hafif dolgulu arka plan veya kalın kenarlık ile öne çıksın)

Altında küçük bir özet satırı: "Bu ay X randevu tamamladınız" gibi bir bilgi çipi

Örnek/mock veri ile doldur: Toplam Gelir ₺12.400, Ödenecek Komisyon ₺1.860, Net Kalan ₺10.540 gibi gerçekçi rakamlar kullan.

EKRAN 2 — RANDEVU YÖNETİMİ

Amaç: Personelin randevularını görüp durumlarını güncelleyebilmesi.

İçerik:

Üstte iki sekmeli (segmented control) geçiş: "Bekliyor" / "Tamamlandı"

"Bekliyor" sekmesi: Her randevu bir kart olarak listelenir — müşteri adı, tarih, saat, adres, ücret bilgisi + kartın altında/içinde belirgin bir "Tamamlandı Olarak İşaretle" butonu (yeşil, #17A34A)

"Tamamlandı" sekmesi: Aynı kart yapısı ama buton yerine sağ üstte küçük bir yeşil onay/check ikonu (✓) — bu sekmede aksiyon butonu yok, sadece görüntüleme

Randevu yoksa boş durum mesajı: "Şu an bekleyen randevunuz yok" gibi sade bir metin

EKRAN 3 — TAKVİM (İzin Günü Verme)

Amaç: Personelin müsait olmadığı günleri işaretleyebilmesi.

İçerik:

Aylık takvim görünümü (ay-yıl başlığı üstte, ok butonlarıyla ay değiştirme)

Takvimde üç tür gün görsel olarak ayrışmalı:

Normal/boş gün: nötr, tıklanabilir

Randevusu olan gün: küçük yeşil bir nokta/işaret ile belirtilir (dolu)

İzin verilmiş gün: kırmızımsı/soluk kırmızı arka plan + üzerinde "İzinli" küçük etiketi

Bir güne tıklandığında altta/pop-up olarak basit bir onay alanı açılır: "Bu gün için izin ver" metni + açma/kapama anahtarı (toggle switch) + "Kaydet" butonu

Zaten randevusu olan bir güne izin verilmeye çalışılırsa uyarı gösterilir: "Bu günde randevunuz var, önce iptal edilmesi gerekir" gibi

EKRAN 4 — PROFİL

Amaç: Personelin kendi bilgilerini görmesi ve çıkış yapabilmesi.

İçerik:

Üstte büyük, kare (1:1) profil fotoğrafı, ortalanmış

İsim-soyisim (kalın, büyük başlık)

Telefon numarası, çalıştığı bölge (konum)

Küçük istatistik özeti: toplam tamamlanan iş sayısı + ortalama puan (yıldız ile)

Alt kısımda basit liste satırları: "Bildirimler", "Yardım/Destek" gibi (tıklanabilir görünümde, fonksiyon şart değil, sadece görsel yer tutucu olabilir)

En altta belirgin bir "Çıkış Yap" butonu (kırmızı #E24B4A kenarlıklı veya dolgulu, dikkat çekici ama agresif olmayan bir tonda)

GENEL NOT 

Bu 4 ekranı tutarlı bir tasarım dili ile (aynı renk paleti, aynı font, aynı köşe yuvarlaklığı, aynı bottom nav bar) birbirine bağlı bir akış olarak tasarla. Genel his: temiz, güvenilir, finans/bankacılık uygulaması netliğinde, dikkat dağıtıcı öğelerden arındırılmış bir mobil PWA arayüzü.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b9b14724-0336-4cb3-9974-f95f1b968d0d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
