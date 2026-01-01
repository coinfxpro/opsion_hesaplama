function opsiyonApp() {
  const todayIso = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const defaultForm = () => ({
    market: 'VIOP',
    underlying: 'USDTRY',
    underlying_type: 'FX',
    valuation_date: todayIso(),
    expiry_date: todayIso(),
    spot: 42.85,
    strike: 43,
    option_type: 'PUT',
    direction: 'SHORT',
    contracts: 1,
    contract_multiplier: 1000,
    premium_input: 410,
    interest_rate_percent: 37,
    settlement_type: 'CASH',
    settlement_price: null,
  });

  const defaultSettings = () => ({
    commission_per_mille: 5.0,
    bsmv_percent: 5.0,
    stopaj_percent: 17.5,
    fx_premium_scale: 0.001,
  });

  return {
    form: defaultForm(),
    settings: defaultSettings(),

    wizard: { open: false, step: 1 },
    settingsOpen: false,

    result: null,
    errorMessage: '',
    statusText: '',

    chart: null,

    init() {
      this.loadSettings();
      this.ensureMultiplier();
      this.statusText = 'Hazır';
      this.safeRenderChart();

      this.registerServiceWorker();
    },

    registerServiceWorker() {
      try {
        if (!('serviceWorker' in navigator)) return;
        // PWA için SW sadece HTTPS veya localhost üzerinde çalışır
        navigator.serviceWorker.register('/sw.js').catch((e) => {
          console.warn('serviceWorker register failed', e);
        });
      } catch (e) {
        console.warn('serviceWorker register error', e);
      }
    },

    fmt(v) {
      if (v === null || v === undefined || v === '') return '-';
      const n = Number(v);
      if (!Number.isFinite(n)) return String(v);
      return n.toLocaleString('tr-TR', { maximumFractionDigits: 4 });
    },

    money(v) {
      if (v === null || v === undefined) return '-';
      const n = Number(v);
      if (!Number.isFinite(n)) return '-';
      return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL';
    },

    pct(v) {
      if (v === null || v === undefined) return '-';
      const n = Number(v);
      if (!Number.isFinite(n)) return '-';
      return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %';
    },

    openWizard() {
      this.wizard.open = true;
      this.wizard.step = 1;
      this.errorMessage = '';
    },

    openSettings() {
      this.settingsOpen = true;
    },

    saveSettings() {
      localStorage.setItem('opsiyon_settings', JSON.stringify(this.settings));
    },

    loadSettings() {
      try {
        const raw = localStorage.getItem('opsiyon_settings');
        if (!raw) return;
        const parsed = JSON.parse(raw);
        this.settings = { ...defaultSettings(), ...parsed };
      } catch (_) {}
    },

    resetSettings() {
      this.settings = defaultSettings();
      this.saveSettings();
    },

    ensureMultiplier() {
      if (this.form.underlying_type === 'FX') {
        if (!this.form.contract_multiplier || this.form.contract_multiplier === 100) this.form.contract_multiplier = 1000;
      } else {
        if (!this.form.contract_multiplier || this.form.contract_multiplier === 1000) this.form.contract_multiplier = 100;
      }
    },

    optionNarrative() {
      const ot = this.form.option_type;
      const dir = this.form.direction;

      if (ot === 'CALL' && dir === 'LONG') {
        return [
          'CALL ALIŞ (LONG)',
          'Senaryo: Elimde dayanak yok; fiyatın yükseleceğini düşünüyorum.',
          'Beklenti: Uzlaşma/spot fiyat kullanım fiyatının ÜZERİNDE kalırsa değer kazanır.',
          'Nakit akışı: Prim ÖDERİM; vade sonunda kâr, içsel değere bağlıdır.',
          'Risk: Maksimum zarar ödediğin prim + komisyonlarla sınırlıdır.',
          'Not: Uzlaşma türü (fiziki/nakdi) ürüne göre değişir.',
        ].join('\n');
      }

      if (ot === 'CALL' && dir === 'SHORT') {
        return [
          'CALL SATIŞ (SHORT)',
          'Senaryo: Prim geliri hedeflerim; fiyatın yatay/ılımlı kalacağını varsayarım.',
          'Beklenti: Uzlaşma/spot fiyat kullanım fiyatının ALTINDA kalırsa prim bende kalır.',
          'Nakit akışı: Prim ALIRIM; vade sonunda aleyhe hareket olursa uzlaşma ödemesi doğabilir.',
          'Risk: Teoride sınırsız zarar riski vardır (fiyat yükseldikçe zarar artar).',
          'Teminat: Genelde teminat gerektirir (VIOP/OTC kurallarına göre).',
          'Not: Covered call (elde dayanak varsa) risk profilini değiştirir.',
        ].join('\n');
      }

      if (ot === 'PUT' && dir === 'LONG') {
        return [
          'PUT ALIŞ (LONG)',
          'Senaryo: Genelde elde dayanak varken düşüş riskine karşı korunma (hedge) amaçlıdır.',
          'Beklenti: Uzlaşma/spot fiyat kullanım fiyatının ALTINA düşerse koruma sağlar.',
          'Nakit akışı: Prim ÖDERİM; vade sonunda kâr, içsel değere bağlıdır.',
          'Risk: Maksimum zarar ödediğin prim + komisyonlarla sınırlıdır.',
          'Not: Hedge amaçlı kullanıldığında portföy volatilitesini düşürür.',
        ].join('\n');
      }

      return [
        'PUT SATIŞ (SHORT)',
        'Senaryo: Elimde dayanak yok; fiyatın yükselmesini veya en azından sert düşmemesini beklerim.',
        'Beklenti: Uzlaşma/spot fiyat kullanım fiyatının ÜZERİNDE kalırsa prim bende kalır.',
        'Nakit akışı: Prim ALIRIM; vade sonunda fiyat düşerse uzlaşma ödemesi/alıma zorlama oluşabilir.',
        'Risk: Zarar, fiyat düştükçe artar (en kötü senaryoda dayanağın sıfıra yaklaşması).',
        'Teminat: Genelde teminat gerektirir (VIOP/OTC kurallarına göre).',
        'Not: Bu strateji çoğunlukla “daha düşük maliyetle alım yapmak” niyetiyle kullanılır.',
      ].join('\n');
    },

    summaryBadge() {
      return `${this.form.option_type} ${this.form.direction}`;
    },

    wizardTitle() {
      const titles = {
        1: 'Piyasa Seçimi',
        2: 'Dayanak Varlık',
        3: 'Spot Fiyat',
        4: 'Vade',
        5: 'Opsiyon Türü',
        6: 'Strike & Kontrat',
        7: 'Prim & Faiz',
        8: 'Uzlaşma & Vade Sonu',
      };
      return titles[this.wizard.step] || 'Adım';
    },

    wizardHint() {
      const hints = {
        1: 'VIOP (Borsa) veya OTC (Tezgahüstü) seç.',
        2: 'Dayanak adı ve türü (Hisse/Döviz).',
        3: 'Mevcut spot fiyatı gir.',
        4: 'Değerleme tarihi ve vade tarihi.',
        5: 'CALL/PUT ve Alış(Long)/Satış(Short).',
        6: 'Kullanım fiyatı ve miktar bilgileri.',
        7: 'Ödenecek/Alınacak prim ve nakit faizi.',
        8: 'Uzlaşma yöntemi ve varsa vade sonu fiyatı.',
      };
      return hints[this.wizard.step] || '';
    },

    wizardBodyHtml() {
      const step = this.wizard.step;

      if (step === 1) {
        return `
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button class="rounded-2xl border border-white/10 bg-white/5 p-4 text-left hover:bg-white/10" @click="form.market='VIOP'">
              <div class="text-sm text-slate-300">Borsa</div>
              <div class="mt-1 text-lg font-semibold">VIOP</div>
            </button>
            <button class="rounded-2xl border border-white/10 bg-white/5 p-4 text-left hover:bg-white/10" @click="form.market='TEZGAHUSTU'">
              <div class="text-sm text-slate-300">Piyasa</div>
              <div class="mt-1 text-lg font-semibold">Tezgahüstü</div>
            </button>
          </div>
        `;
      }

      if (step === 2) {
        return `
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <div class="text-sm text-slate-300">Dayanak</div>
              <input list="underlyings" class="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm" x-model="form.underlying" placeholder="USDTRY, SAHOL, GARAN..." />
              <datalist id="underlyings">
                <option value="USDTRY"></option>
                <option value="EURTRY"></option>
                <option value="XU100"></option>
                <option value="SAHOL"></option>
                <option value="GARAN"></option>
                <option value="THYAO"></option>
              </datalist>
            </div>
            <div>
              <div class="text-sm text-slate-300">Dayanak Tipi</div>
              <select class="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm" x-model="form.underlying_type" @change="ensureMultiplier()">
                <option value="FX">Döviz (FX)</option>
                <option value="EQUITY">Hisse (Equity)</option>
              </select>
              <div class="mt-1 text-xs text-slate-400">FX=1000, Hisse=100 önerilir.</div>
            </div>
          </div>
        `;
      }

      if (step === 3) {
        return `
          <div>
            <div class="text-sm text-slate-300">Spot Fiyat</div>
            <input class="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm" type="number" step="0.0001" x-model.number="form.spot" />
          </div>
        `;
      }

      if (step === 4) {
        return `
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <div class="text-sm text-slate-300">Değerleme Tarihi</div>
              <input class="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm" type="date" x-model="form.valuation_date" />
            </div>
            <div>
              <div class="text-sm text-slate-300">Vade Tarihi</div>
              <input class="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm" type="date" x-model="form.expiry_date" />
            </div>
          </div>
        `;
      }

      if (step === 5) {
        return `
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <div class="text-sm text-slate-300">Opsiyon Tipi</div>
              <select class="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm" x-model="form.option_type">
                <option value="CALL">CALL</option>
                <option value="PUT">PUT</option>
              </select>
            </div>
            <div>
              <div class="text-sm text-slate-300">İşlem Yönü</div>
              <select class="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm" x-model="form.direction">
                <option value="LONG">LONG (Alış)</option>
                <option value="SHORT">SHORT (Satış)</option>
              </select>
            </div>
          </div>
        `;
      }

      if (step === 6) {
        return `
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <div class="text-sm text-slate-300">Strike (Kullanım Fiyatı)</div>
              <input class="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm" type="number" step="0.0001" x-model.number="form.strike" />
            </div>
            <div>
              <div class="text-sm text-slate-300">Kontrat Adedi</div>
              <input class="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm" type="number" step="1" min="1" x-model.number="form.contracts" />
            </div>
            <div class="md:col-span-2">
              <div class="text-sm text-slate-300">Kontrat Çarpanı</div>
              <input class="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm" type="number" step="1" min="1" x-model.number="form.contract_multiplier" />
              <div class="mt-1 text-xs text-slate-400">Hisse için genelde 100, USDTRY gibi FX için genelde 1000.</div>
            </div>
          </div>
        `;
      }

      if (step === 7) {
        return `
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <div class="text-sm text-slate-300">Prim (Fiyatlama Ekranı)</div>
              <input class="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm" type="number" step="0.0001" x-model.number="form.premium_input" />
              <div class="mt-1 text-xs text-slate-400" x-show="form.underlying_type==='FX'">FX için 59 ⇒ 0.59 TL olacak şekilde ölçeklenir.</div>
            </div>
            <div>
              <div class="text-sm text-slate-300">Nemalandırma Faizi (yıllık %)</div>
              <input class="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm" type="number" step="0.01" x-model.number="form.interest_rate_percent" />
            </div>
          </div>
        `;
      }

      return `
        <div>
          <div class="text-sm text-slate-300">Vade Sonu Fiyat (opsiyonel)</div>
          <input class="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm" type="number" step="0.0001" x-model.number="form.settlement_price" placeholder="Boş bırakabilirsin" />
          <div class="mt-1 text-xs text-slate-400">Girersen uzlaşma nakit akışı ve net kâr hesaplanır.</div>
        </div>
      `;
    },

    wizardPrev() {
      if (this.wizard.step > 1) this.wizard.step -= 1;
    },

    wizardNext() {
      if (this.wizard.step < 8) {
        if (this.wizard.step === 2) this.ensureMultiplier();
        this.wizard.step += 1;
        return;
      }
      this.wizard.open = false;
      this.calculate();
    },

    async calculate() {
      this.errorMessage = '';
      this.statusText = 'Hesaplanıyor...';
      try {
        const payload = {
          ...this.form,
          market: this.form.market === 'TEZGAHUSTU' ? 'OTC' : this.form.market,
          settlement_price: this.form.settlement_price ? Number(this.form.settlement_price) : null,
          settings: { ...this.settings },
        };

        const res = await fetch('/api/calc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || 'Hesaplama hatası');
        }

        this.result = await res.json();
        this.statusText = 'Tamam';
      } catch (e) {
        this.result = null;
        this.errorMessage = String(e?.message || e);
        this.statusText = 'Hata';
        return;
      }

      this.safeRenderChart();
    },

    safeRenderChart() {
      try {
        const ChartCtor = window.Chart;
        if (!ChartCtor) return;

        const canvas = document.getElementById('payoffChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const k = Number(this.form.strike || 0);
        const lot = Number(this.form.contracts || 0) * Number(this.form.contract_multiplier || 0);
        if (!(k > 0) || !(lot > 0)) return;

        const optionType = this.form.option_type;
        const direction = this.form.direction;

        const signs = direction === 'LONG' ? { intrinsic: +1 } : { intrinsic: -1 };

        const rangeLow = k * 0.85;
        const rangeHigh = k * 1.15;
        const steps = 40;

        const xs = [];
        const ys = [];
        for (let i = 0; i <= steps; i++) {
          const s = rangeLow + (i * (rangeHigh - rangeLow)) / steps;
          let intrinsic = 0;
          if (optionType === 'CALL') intrinsic = Math.max(s - k, 0);
          else intrinsic = Math.max(k - s, 0);

          const payoff = signs.intrinsic * intrinsic * lot;
          xs.push(s);
          ys.push(payoff);
        }

        if (this.chart) {
          if (!this.chart.data || !this.chart.data.datasets || !this.chart.data.datasets[0]) {
            try {
              this.chart.destroy();
            } catch (_) {}
            this.chart = null;
          }
        }

        if (this.chart) {
          this.chart.data.labels = xs.map((v) => v.toFixed(4));
          this.chart.data.datasets[0].data = ys;
          this.chart.update();
          return;
        }

        this.chart = new ChartCtor(ctx, {
          type: 'line',
          data: {
            labels: xs.map((v) => v.toFixed(4)),
            datasets: [
              {
                label: 'Uzlaşma Nakit Akışı (TL)',
                data: ys,
                borderColor: 'rgba(99,102,241,1)',
                backgroundColor: 'rgba(99,102,241,.12)',
                fill: false,
                tension: 0.25,
                pointRadius: 0,
              },
            ],
          },
          options: {
            responsive: true,
            animation: false,
            plugins: {
              legend: { display: true, labels: { color: 'rgba(226,232,240,0.9)' } },
            },
            scales: {
              x: { ticks: { color: 'rgba(148,163,184,0.9)', maxTicksLimit: 6 }, grid: { color: 'rgba(255,255,255,0.06)' } },
              y: { ticks: { color: 'rgba(148,163,184,0.9)' }, grid: { color: 'rgba(255,255,255,0.06)' } },
            },
          },
        });
      } catch (e) {
        console.error('payoffChart render error', e);
      }
    },
  };
}
