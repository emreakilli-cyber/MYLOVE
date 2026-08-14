import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Icon } from '../components/Icon'
import { Link } from '../router'
import { db } from '../data/db'
import { icsIndir, icsUret } from '../services/ics'

/*
 * Takvim senkronu. Sunucu olmadan yapılabilecek şey: standart bir .ics dosyası
 * indirip kullanıcının Google/Apple/Outlook'a içe aktarması. Canlı abonelik
 * (webcal) bir sunucu gerektirir; onu dürüstçe belirtiyoruz.
 */

const rehber: Array<{ ad: string; adimlar: string[] }> = [
  {
    ad: 'Apple Takvim (iPhone / Mac)',
    adimlar: [
      'İndirilen .ics dosyasına dokunun.',
      'Açılan pencerede takvimi seçip “Ekle”ye basın.',
      'Olaylar ve son tarihler takviminize eklenir.',
    ],
  },
  {
    ad: 'Google Takvim',
    adimlar: [
      'calendar.google.com → Ayarlar → İçe/Dışa Aktar.',
      'İndirdiğiniz .ics dosyasını seçin ve hedef takvimi belirleyin.',
      '“İçe aktar”a basın.',
    ],
  },
  {
    ad: 'Outlook',
    adimlar: [
      'Outlook → Dosya → Aç ve Dışa Aktar → İçe Aktar.',
      '“iCalendar (.ics) dosyası”nı seçin.',
      'İndirdiğiniz dosyayı açın ve içe aktarın.',
    ],
  },
]

export function TakvimSenkron() {
  const [durum, setDurum] = useState<string | null>(null)

  const veri = useLiveQuery(async () => {
    const [olaylar, sureler, dosyalar] = await Promise.all([
      db.olaylar.toArray(),
      db.sureler.where('durum').equals('acik').toArray(),
      db.dosyalar.toArray(),
    ])
    return {
      // Süre motorunun son-tarih olayları dışa aktarımdan çıkarılır: aynı son
      // gün zaten `sureler`'den bir VEVENT olarak yazılıyor, ikisi çift kayıt
      // üretirdi. (Eski kayıtlar için burada eleniyor.)
      olaylar: olaylar.filter((o) => o.kaynak !== 'sure-hesabi'),
      sureler,
      dosyaAdlari: new Map(dosyalar.map((d) => [d.id, d.baslik])),
    }
  }, [])

  const disaAktar = () => {
    if (!veri) return
    const ics = icsUret({ ...veri, simdi: new Date() })
    const damga = new Date().toISOString().slice(0, 10)
    icsIndir(ics, `juriscalendar-takvim-${damga}`)
    setDurum(
      `${veri.olaylar.length} olay ve ${veri.sureler.length} süre dışa aktarıldı.`,
    )
  }

  return (
    <>
      <Link to="/takvim" className="page-back">
        <Icon name="arrow-left" size={17} />
        Takvime dön
      </Link>

      <div className="form-head">
        <p className="t-label">Takvim</p>
        <h1 className="t-title">Takvimi dışa aktar</h1>
      </div>

      <section className="card form-card">
        <p className="field-hint">
          Duruşmalarınızı, işlemlerinizi ve hesaplanan hukuki süreleri standart
          bir takvim dosyası (.ics) olarak indirip Apple, Google veya Outlook
          takviminize ekleyebilirsiniz. Dosya cihazınızda üretilir ve
          cihazınızdan dışarı çıkmaz.
        </p>
        <button
          type="button"
          className="button-primary"
          disabled={!veri}
          onClick={disaAktar}
        >
          <Icon
            name="calendar"
            size={16}
            style={{ marginRight: 'var(--space-2)', verticalAlign: '-3px' }}
          />
          Takvim dosyasını indir (.ics)
        </button>
        {durum ? <p className="ayar-mesaj">{durum}</p> : null}
      </section>

      {rehber.map((r) => (
        <section key={r.ad} className="card section-card">
          <div className="section-head">
            <div>
              <p className="t-label section-eyebrow">Nasıl eklenir</p>
              <h2 className="t-title">{r.ad}</h2>
            </div>
          </div>
          <ol className="rehber-liste">
            {r.adimlar.map((adim, i) => (
              <li key={i}>
                <span className="rehber-no">{i + 1}</span>
                <span>{adim}</span>
              </li>
            ))}
          </ol>
        </section>
      ))}

      <section className="card form-card">
        <p className="ayar-baslik">Canlı abonelik</p>
        <p className="field-hint">
          Takvimin otomatik güncellenen bir bağlantıyla (webcal) sürekli senkron
          olması bir sunucu bağlantısı gerektirir. Bu özellik, sunucu katmanı
          eklendiğinde açılacaktır. Şu an dosya dışa aktarma çevrimdışı çalışır;
          değişiklik yaptığınızda dosyayı yeniden indirip aktarabilirsiniz.
        </p>
      </section>
    </>
  )
}
