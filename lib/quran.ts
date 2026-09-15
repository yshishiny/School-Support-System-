/** Surah names (Arabic, transliteration, ayah count) and a fetch of exact Uthmani text from alquran.cloud. */
export const SURAHS: { n: number; ar: string; en: string; ayahs: number }[] = [
  [1,"الفاتحة","Al-Fatihah",7],[2,"البقرة","Al-Baqarah",286],[3,"آل عمران","Aal Imran",200],[4,"النساء","An-Nisa",176],[5,"المائدة","Al-Ma'idah",120],[6,"الأنعام","Al-An'am",165],[7,"الأعراف","Al-A'raf",206],[8,"الأنفال","Al-Anfal",75],[9,"التوبة","At-Tawbah",129],[10,"يونس","Yunus",109],
  [11,"هود","Hud",123],[12,"يوسف","Yusuf",111],[13,"الرعد","Ar-Ra'd",43],[14,"إبراهيم","Ibrahim",52],[15,"الحجر","Al-Hijr",99],[16,"النحل","An-Nahl",128],[17,"الإسراء","Al-Isra",111],[18,"الكهف","Al-Kahf",110],[19,"مريم","Maryam",98],[20,"طه","Ta-Ha",135],
  [21,"الأنبياء","Al-Anbiya",112],[22,"الحج","Al-Hajj",78],[23,"المؤمنون","Al-Mu'minun",118],[24,"النور","An-Nur",64],[25,"الفرقان","Al-Furqan",77],[26,"الشعراء","Ash-Shu'ara",227],[27,"النمل","An-Naml",93],[28,"القصص","Al-Qasas",88],[29,"العنكبوت","Al-Ankabut",69],[30,"الروم","Ar-Rum",60],
  [31,"لقمان","Luqman",34],[32,"السجدة","As-Sajdah",30],[33,"الأحزاب","Al-Ahzab",73],[34,"سبأ","Saba",54],[35,"فاطر","Fatir",45],[36,"يس","Ya-Sin",83],[37,"الصافات","As-Saffat",182],[38,"ص","Sad",88],[39,"الزمر","Az-Zumar",75],[40,"غافر","Ghafir",85],
  [41,"فصلت","Fussilat",54],[42,"الشورى","Ash-Shura",53],[43,"الزخرف","Az-Zukhruf",89],[44,"الدخان","Ad-Dukhan",59],[45,"الجاثية","Al-Jathiyah",37],[46,"الأحقاف","Al-Ahqaf",35],[47,"محمد","Muhammad",38],[48,"الفتح","Al-Fath",29],[49,"الحجرات","Al-Hujurat",18],[50,"ق","Qaf",45],
  [51,"الذاريات","Adh-Dhariyat",60],[52,"الطور","At-Tur",49],[53,"النجم","An-Najm",62],[54,"القمر","Al-Qamar",55],[55,"الرحمن","Ar-Rahman",78],[56,"الواقعة","Al-Waqi'ah",96],[57,"الحديد","Al-Hadid",29],[58,"المجادلة","Al-Mujadila",22],[59,"الحشر","Al-Hashr",24],[60,"الممتحنة","Al-Mumtahanah",13],
  [61,"الصف","As-Saff",14],[62,"الجمعة","Al-Jumu'ah",11],[63,"المنافقون","Al-Munafiqun",11],[64,"التغابن","At-Taghabun",18],[65,"الطلاق","At-Talaq",12],[66,"التحريم","At-Tahrim",12],[67,"الملك","Al-Mulk",30],[68,"القلم","Al-Qalam",52],[69,"الحاقة","Al-Haqqah",52],[70,"المعارج","Al-Ma'arij",44],
  [71,"نوح","Nuh",28],[72,"الجن","Al-Jinn",28],[73,"المزمل","Al-Muzzammil",20],[74,"المدثر","Al-Muddaththir",56],[75,"القيامة","Al-Qiyamah",40],[76,"الإنسان","Al-Insan",31],[77,"المرسلات","Al-Mursalat",50],[78,"النبأ","An-Naba",40],[79,"النازعات","An-Nazi'at",46],[80,"عبس","Abasa",42],
  [81,"التكوير","At-Takwir",29],[82,"الانفطار","Al-Infitar",19],[83,"المطففين","Al-Mutaffifin",36],[84,"الانشقاق","Al-Inshiqaq",25],[85,"البروج","Al-Buruj",22],[86,"الطارق","At-Tariq",17],[87,"الأعلى","Al-A'la",19],[88,"الغاشية","Al-Ghashiyah",26],[89,"الفجر","Al-Fajr",30],[90,"البلد","Al-Balad",20],
  [91,"الشمس","Ash-Shams",15],[92,"الليل","Al-Layl",21],[93,"الضحى","Ad-Duha",11],[94,"الشرح","Ash-Sharh",8],[95,"التين","At-Tin",8],[96,"العلق","Al-Alaq",19],[97,"القدر","Al-Qadr",5],[98,"البينة","Al-Bayyinah",8],[99,"الزلزلة","Az-Zalzalah",8],[100,"العاديات","Al-Adiyat",11],
  [101,"القارعة","Al-Qari'ah",11],[102,"التكاثر","At-Takathur",8],[103,"العصر","Al-Asr",3],[104,"الهمزة","Al-Humazah",9],[105,"الفيل","Al-Fil",5],[106,"قريش","Quraysh",4],[107,"الماعون","Al-Ma'un",7],[108,"الكوثر","Al-Kawthar",3],[109,"الكافرون","Al-Kafirun",6],[110,"النصر","An-Nasr",3],
  [111,"المسد","Al-Masad",5],[112,"الإخلاص","Al-Ikhlas",4],[113,"الفلق","Al-Falaq",5],[114,"الناس","An-Nas",6],
].map(([n, ar, en, ayahs]) => ({ n: n as number, ar: ar as string, en: en as string, ayahs: ayahs as number }));

export interface Ayah {
  ref: string; // "2:255"
  text: string;
  translation: string | null;
}

const toArabicDigits = (n: number) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);

/** Exact Quran text (Uthmani script) with Saheeh International translation, from api.alquran.cloud. */
export async function fetchAyahs(surah: number, from: number, to: number): Promise<{ title: string; reference: string; ayahs: Ayah[] }> {
  const info = SURAHS.find((s) => s.n === surah);
  if (!info) throw new Error("Unknown surah.");
  const a = Math.max(1, Math.min(info.ayahs, from));
  const b = Math.max(a, Math.min(info.ayahs, to));
  if (b - a > 40) throw new Error("Pick at most 40 ayahs at a time.");
  const res = await fetch(`https://api.alquran.cloud/v1/surah/${surah}/editions/quran-uthmani,en.sahih`, { signal: AbortSignal.timeout(15000), next: { revalidate: 86400 } });
  if (!res.ok) throw new Error(`Quran service returned ${res.status}.`);
  const json = (await res.json()) as { data: { ayahs: { numberInSurah: number; text: string }[] }[] };
  const ar = json.data[0]?.ayahs ?? [];
  const en = json.data[1]?.ayahs ?? [];
  const ayahs: Ayah[] = ar
    .filter((x) => x.numberInSurah >= a && x.numberInSurah <= b)
    .map((x) => ({ ref: `${surah}:${x.numberInSurah}`, text: x.text.trim(), translation: en.find((y) => y.numberInSurah === x.numberInSurah)?.text ?? null }));
  if (ayahs.length === 0) throw new Error("No ayahs returned.");
  const range = a === b ? toArabicDigits(a) : `${toArabicDigits(a)}–${toArabicDigits(b)}`;
  return { title: `سورة ${info.ar} ${range}`, reference: `${info.en} ${a}${a === b ? "" : `-${b}`}`, ayahs };
}
