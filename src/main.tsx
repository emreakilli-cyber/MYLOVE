import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './styles/fonts.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/shell.css'
import './styles/placeholder.css'
import './styles/dashboard.css'
import './styles/takvim.css'
import './styles/form.css'
import './styles/dosya.css'
import './styles/rapor.css'
import './styles/asistan.css'
import './styles/ayarlar.css'
import './styles/kilit.css'
import './styles/arama.css'
import './styles/onboarding.css'
import './styles/tur.css'
import './styles/durum.css'
import './styles/dokunmatik.css'
import './styles/print.css'

import App from './App'
import { HataSiniri } from './components/HataSiniri'
import { gunlukHata } from './services/gunluk'

// İlk açılışta örnek veriyi yaz. Dexie'nin canlı sorguları veri gelince
// kendiliğinden yeniden yayın yaptığı için render'ı beklemeye gerek yok.
// Tohum modülü ayrı parçaya alındı: ömründe bir kez çalışan ~30 kB veri her
// açılışta ana pakette taşınmasın.
void import('./data/seed')
  .then((modul) => modul.tohumlaGerekiyorsa())
  .catch((hata) => {
    // gunluk zaten ana pakette (HataSiniri onu erken içe aktarır); dinamik
    // import ayrı parça oluşturmadığı gibi hata yolunu ikinci bir async
    // yüklemeye bağımlı kılıyordu. Doğrudan çağır.
    gunlukHata(hata, 'Örnek veri yazılamadı')
  })

const container = document.getElementById('root')
if (!container) throw new Error('#root bulunamadı')

createRoot(container).render(
  <StrictMode>
    <HataSiniri>
      <App />
    </HataSiniri>
  </StrictMode>,
)
