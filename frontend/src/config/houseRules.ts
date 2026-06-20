export interface HouseRule {
  id: string;
  category: 'keamanan' | 'kebersihan' | 'fasilitas' | 'pembayaran' | 'umum';
  title: string;
  description: string;
  details: string[];
}

export const houseRules: HouseRule[] = [
  {
    id: 'rule-1',
    category: 'keamanan',
    title: 'Akses & Jam Malam Gerbang Kos',
    description: 'Ketentuan mengenai jam operasional pintu gerbang utama demi keamanan seluruh penghuni kos.',
    details: [
      'Pintu gerbang utama akan dikunci pada pukul 23:00 WIB demi keamanan bersama.',
      'Setiap penghuni dibekali kunci gerbang masing-masing dan bertanggung jawab penuh atas kunci tersebut.',
      'Jika pulang di atas pukul 23:00 WIB, harap mengunci kembali pintu gerbang dengan rapat setelah masuk.',
      'Dilarang menduplikat kunci gerbang atau meminjamkannya kepada pihak luar tanpa izin pemilik.'
    ]
  },
  {
    id: 'rule-2',
    category: 'keamanan',
    title: 'Kebijakan Penerimaan Tamu & Menginap',
    description: 'Prosedur dan batasan untuk kunjungan tamu demi kenyamanan dan privasi seluruh penghuni.',
    details: [
      'Tamu diperbolehkan berkunjung maksimal hingga pukul 22:00 WIB di area ruang tamu bersama.',
      'Tamu lawan jenis dilarang keras masuk atau berada di dalam kamar hunian.',
      'Tamu yang berniat menginap wajib melaporkan diri kepada pemilik kos paling lambat 1x24 jam sebelum menginap.',
      'Setiap tamu yang menginap dikenakan biaya tambahan sebesar Rp 50.000 per malam (maksimal menginap 3 hari berturut-turut).'
    ]
  },
  {
    id: 'rule-3',
    category: 'kebersihan',
    title: 'Pengelolaan Sampah & Kebersihan Kamar',
    description: 'Kewajiban menjaga kebersihan kamar masing-masing dan tata cara pembuangan sampah.',
    details: [
      'Setiap penghuni wajib menyediakan tempat sampah tertutup di dalam kamar masing-masing.',
      'Sampah harus dibuang ke tempat pembuangan sampah utama (tempat sampah besar di luar) secara rutin setiap hari untuk menghindari bau dan serangga.',
      'Dilarang menimbun sampah di koridor depan kamar atau area jemuran.'
    ]
  },
  {
    id: 'rule-4',
    category: 'kebersihan',
    title: 'Penggunaan & Perawatan Dapur Bersama',
    description: 'Aturan wajib dalam menggunakan fasilitas dapur bersama agar tetap bersih dan higienis.',
    details: [
      'Setelah memasak, seluruh peralatan memasak (wajan, panci, piring, sendok) harus segera dicuci bersih dan dikembalikan ke tempatnya.',
      'Bersihkan sisa makanan atau minyak di kompor dan meja dapur setelah digunakan.',
      'Bahan makanan di kulkas bersama wajib diberi label nama pemilik dan tidak boleh mengambil barang milik orang lain tanpa izin.'
    ]
  },
  {
    id: 'rule-5',
    category: 'fasilitas',
    title: 'Penggunaan Listrik & Peralatan Elektronik',
    description: 'Ketentuan penghematan energi dan pembatasan penggunaan alat elektronik berdaya tinggi.',
    details: [
      'Matikan lampu, AC, kipas angin, dan kran air jika hendak bepergian keluar kamar.',
      'Penggunaan dispenser air panas, rice cooker, kulkas mini, microwave, atau televisi di dalam kamar wajib dilaporkan dan mendapat persetujuan pemilik.',
      'Dilarang melakukan modifikasi instalasi listrik di dalam kamar yang dapat memicu korsleting.'
    ]
  },
  {
    id: 'rule-6',
    category: 'fasilitas',
    title: 'Ketentuan Parkir Kendaraan',
    description: 'Tata cara memarkir kendaraan motor dan mobil di area parkir kos.',
    details: [
      'Kendaraan harus diparkir dengan rapi sesuai dengan batas garis parkir yang telah disediakan.',
      'Setiap kendaraan wajib dipasang kunci ganda atau kunci pengaman tambahan.',
      'Pemilik kos tidak bertanggung jawab atas segala kerusakan atau kehilangan kendaraan dan barang di dalamnya.'
    ]
  },
  {
    id: 'rule-7',
    category: 'pembayaran',
    title: 'Jatuh Tempo Pembayaran Sewa Kos',
    description: 'Prosedur pembayaran sewa bulanan dan ketentuan jatuh tempo pembayaran.',
    details: [
      'Pembayaran sewa bulanan harus dilakukan tepat waktu sebelum atau pada tanggal jatuh tempo yang tertera di kontrak.',
      'Bukti transfer pembayaran wajib diunggah ke portal aplikasi Lapor Kos untuk diverifikasi pemilik.',
      'Keterlambatan tanpa pemberitahuan minimal 3 hari sebelum jatuh tempo akan dikenakan sanksi.'
    ]
  },
  {
    id: 'rule-8',
    category: 'pembayaran',
    title: 'Sanksi Keterlambatan & Denda Kerusakan',
    description: 'Ketentuan denda administratif karena keterlambatan bayar sewa atau kerusakan fasilitas.',
    details: [
      'Keterlambatan pembayaran sewa dikenakan denda administratif sebesar Rp 20.000 per hari.',
      'Keterlambatan lebih dari 7 hari tanpa konfirmasi yang jelas dapat mengakibatkan pemutusan kontrak sepihak.',
      'Kerusakan fasilitas kamar atau area bersama yang disebabkan kelalaian penghuni menjadi tanggung jawab penghuni bersangkutan untuk biaya perbaikannya.'
    ]
  },
  {
    id: 'rule-9',
    category: 'umum',
    title: 'Ketertiban, Kebisingan & Etika Bersama',
    description: 'Etika bertingkah laku demi menjaga kedamaian dan kenyamanan bertetangga.',
    details: [
      'Penghuni wajib menghormati penghuni lain dan tetangga sekitar kos dengan menjaga ketertiban.',
      'Dilarang menyalakan musik atau bersuara keras yang dapat mengganggu ketenangan penghuni lain, khususnya pada pukul 22:00 WIB s.d. 06:00 WIB.',
      'Dilarang membawa binatang peliharaan ke dalam area kamar maupun lingkungan kos.'
    ]
  },
  {
    id: 'rule-10',
    category: 'umum',
    title: 'Larangan Barang Terlarang & Tindakan Ilegal',
    description: 'Aturan ketat mengenai barang-barang berbahaya dan tindakan melawan hukum.',
    details: [
      'Dilarang keras membawa, menyimpan, mengonsumsi, atau mengedarkan narkoba dan minuman keras di lingkungan kos.',
      'Dilarang menyimpan senjata tajam, senjata api, bahan peledak, atau bahan kimia berbahaya lainnya.',
      'Segala bentuk tindakan perjudian, pornografi, asusila, atau tindakan kriminal lainnya akan langsung dilaporkan ke pihak berwajib dan dikeluarkan secara tidak hormat.'
    ]
  }
];
