export interface Commune {
  id: string;
  name: string;
  nameAr: string;
}

export interface Daira {
  id: string;
  name: string;
  nameAr: string;
  communes: Commune[];
}

export interface Wilaya {
  code: string;
  name: string;
  nameAr: string;
  dairas: Daira[];
}

export const algeriaData: Wilaya[] = [
  {
    code: '01',
    name: 'Adrar',
    nameAr: 'أدرار',
    dairas: [
      {
        id: '01-01',
        name: 'Adrar',
        nameAr: 'أدرار',
        communes: [
          { id: '01-01-01', name: 'Adrar', nameAr: 'أدرار' },
          { id: '01-01-02', name: 'Tamest', nameAr: 'تامست' },
          { id: '01-01-03', name: 'Ouled Ahmed Timmi', nameAr: 'أولاد أحمد تيمي' },
        ]
      },
      {
        id: '01-02',
        name: 'Reggane',
        nameAr: 'رقان',
        communes: [
          { id: '01-02-01', name: 'Reggane', nameAr: 'رقان' },
          { id: '01-02-02', name: 'Sali', nameAr: 'سالي' },
        ]
      },
      {
        id: '01-03',
        name: 'Timimoun',
        nameAr: 'تيميمون',
        communes: [
          { id: '01-03-01', name: 'Timimoun', nameAr: 'تيميمون' },
          { id: '01-03-02', name: 'Ouled Said', nameAr: 'أولاد سعيد' },
        ]
      }
    ]
  },
  {
    code: '02',
    name: 'Chlef',
    nameAr: 'الشلف',
    dairas: [
      {
        id: '02-01',
        name: 'Chlef',
        nameAr: 'الشلف',
        communes: [
          { id: '02-01-01', name: 'Chlef', nameAr: 'الشلف' },
          { id: '02-01-02', name: 'Oued Sly', nameAr: 'وادي سلي' },
          { id: '02-01-03', name: 'Sobha', nameAr: 'الصبحة' },
        ]
      },
      {
        id: '02-02',
        name: 'Ténès',
        nameAr: 'تنس',
        communes: [
          { id: '02-02-01', name: 'Ténès', nameAr: 'تنس' },
          { id: '02-02-02', name: 'Sidi Akkacha', nameAr: 'سيدي عكاشة' },
        ]
      }
    ]
  },
  {
    code: '03',
    name: 'Laghouat',
    nameAr: 'الأغواط',
    dairas: [
      {
        id: '03-01',
        name: 'Laghouat',
        nameAr: 'الأغواط',
        communes: [
          { id: '03-01-01', name: 'Laghouat', nameAr: 'الأغواط' },
          { id: '03-01-02', name: 'Ksar El Hirane', nameAr: 'قصر الحيران' },
        ]
      },
      {
        id: '03-02',
        name: 'Aflou',
        nameAr: 'أفلو',
        communes: [
          { id: '03-02-01', name: 'Aflou', nameAr: 'أفلو' },
          { id: '03-02-02', name: 'Brida', nameAr: 'بريدة' },
        ]
      }
    ]
  },
  {
    code: '04',
    name: 'Oum El Bouaghi',
    nameAr: 'أم البواقي',
    dairas: [
      {
        id: '04-01',
        name: 'Oum El Bouaghi',
        nameAr: 'أم البواقي',
        communes: [
          { id: '04-01-01', name: 'Oum El Bouaghi', nameAr: 'أم البواقي' },
          { id: '04-01-02', name: 'Ain Beida', nameAr: 'عين البيضاء' },
        ]
      },
      {
        id: '04-02',
        name: 'Ain Mlila',
        nameAr: 'عين مليلة',
        communes: [
          { id: '04-02-01', name: 'Ain Mlila', nameAr: 'عين مليلة' },
          { id: '04-02-02', name: 'Ouled Hamla', nameAr: 'أولاد حملة' },
        ]
      }
    ]
  },
  {
    code: '05',
    name: 'Batna',
    nameAr: 'باتنة',
    dairas: [
      {
        id: '05-01',
        name: 'Batna',
        nameAr: 'باتنة',
        communes: [
          { id: '05-01-01', name: 'Batna', nameAr: 'باتنة' },
          { id: '05-01-02', name: 'Fesdis', nameAr: 'فسديس' },
          { id: '05-01-03', name: 'Tazoult', nameAr: 'تازولت' },
        ]
      },
      {
        id: '05-02',
        name: 'Barika',
        nameAr: 'بريكة',
        communes: [
          { id: '05-02-01', name: 'Barika', nameAr: 'بريكة' },
          { id: '05-02-02', name: 'Djezzar', nameAr: 'جزار' },
        ]
      }
    ]
  },
  {
    code: '06',
    name: 'Béjaïa',
    nameAr: 'بجاية',
    dairas: [
      {
        id: '06-01',
        name: 'Béjaïa',
        nameAr: 'بجاية',
        communes: [
          { id: '06-01-01', name: 'Béjaïa', nameAr: 'بجاية' },
          { id: '06-01-02', name: 'Oued Ghir', nameAr: 'وادي غير' },
          { id: '06-01-03', name: 'Tala Hamza', nameAr: 'تالة حمزة' },
        ]
      },
      {
        id: '06-02',
        name: 'Akbou',
        nameAr: 'أقبو',
        communes: [
          { id: '06-02-01', name: 'Akbou', nameAr: 'أقبو' },
          { id: '06-02-02', name: 'Ighram', nameAr: 'إغرام' },
        ]
      },
      {
        id: '06-03',
        name: 'Seddouk',
        nameAr: 'صدوق',
        communes: [
          { id: '06-03-01', name: 'Seddouk', nameAr: 'صدوق' },
          { id: '06-03-02', name: 'Semaoun', nameAr: 'سمعون' },
        ]
      }
    ]
  },
  {
    code: '07',
    name: 'Biskra',
    nameAr: 'بسكرة',
    dairas: [
      {
        id: '07-01',
        name: 'Biskra',
        nameAr: 'بسكرة',
        communes: [
          { id: '07-01-01', name: 'Biskra', nameAr: 'بسكرة' },
          { id: '07-01-02', name: 'El Hadjeb', nameAr: 'الحاجب' },
        ]
      },
      {
        id: '07-02',
        name: 'Tolga',
        nameAr: 'طولقة',
        communes: [
          { id: '07-02-01', name: 'Tolga', nameAr: 'طولقة' },
          { id: '07-02-02', name: 'Lioua', nameAr: 'ليوة' },
        ]
      }
    ]
  },
  {
    code: '08',
    name: 'Béchar',
    nameAr: 'بشار',
    dairas: [
      {
        id: '08-01',
        name: 'Béchar',
        nameAr: 'بشار',
        communes: [
          { id: '08-01-01', name: 'Béchar', nameAr: 'بشار' },
          { id: '08-01-02', name: 'Ouled Khoudir', nameAr: 'أولاد خضير' },
        ]
      },
      {
        id: '08-02',
        name: 'Abadla',
        nameAr: 'العبادلة',
        communes: [
          { id: '08-02-01', name: 'Abadla', nameAr: 'العبادلة' },
          { id: '08-02-02', name: 'Meridja', nameAr: 'مريجة' },
        ]
      }
    ]
  },
  {
    code: '09',
    name: 'Blida',
    nameAr: 'البليدة',
    dairas: [
      {
        id: '09-01',
        name: 'Blida',
        nameAr: 'البليدة',
        communes: [
          { id: '09-01-01', name: 'Blida', nameAr: 'البليدة' },
          { id: '09-01-02', name: 'Ouled Yaïch', nameAr: 'أولاد يعيش' },
          { id: '09-01-03', name: 'Beni Mered', nameAr: 'بني مراد' },
        ]
      },
      {
        id: '09-02',
        name: 'Boufarik',
        nameAr: 'بوفاريك',
        communes: [
          { id: '09-02-01', name: 'Boufarik', nameAr: 'بوفاريك' },
          { id: '09-02-02', name: 'Soumaa', nameAr: 'الصومعة' },
        ]
      },
      {
        id: '09-03',
        name: 'Larbaâ',
        nameAr: 'الأربعاء',
        communes: [
          { id: '09-03-01', name: 'Larbaâ', nameAr: 'الأربعاء' },
          { id: '09-03-02', name: 'Meftah', nameAr: 'مفتاح' },
        ]
      }
    ]
  },
  {
    code: '10',
    name: 'Bouira',
    nameAr: 'البويرة',
    dairas: [
      {
        id: '10-01',
        name: 'Bouira',
        nameAr: 'البويرة',
        communes: [
          { id: '10-01-01', name: 'Bouira', nameAr: 'البويرة' },
          { id: '10-01-02', name: 'El Asnam', nameAr: 'الأصنام' },
        ]
      },
      {
        id: '10-02',
        name: 'Lakhdaria',
        nameAr: 'الأخضرية',
        communes: [
          { id: '10-02-01', name: 'Lakhdaria', nameAr: 'الأخضرية' },
          { id: '10-02-02', name: 'Maala', nameAr: 'معالة' },
        ]
      }
    ]
  },
  {
    code: '16',
    name: 'Alger',
    nameAr: 'الجزائر',
    dairas: [
      {
        id: '16-01',
        name: 'Sidi M\'Hamed',
        nameAr: 'سيدي امحمد',
        communes: [
          { id: '16-01-01', name: 'Sidi M\'Hamed', nameAr: 'سيدي امحمد' },
          { id: '16-01-02', name: 'El Madania', nameAr: 'المدنية' },
          { id: '16-01-03', name: 'Belouizdad', nameAr: 'بلوزداد' },
        ]
      },
      {
        id: '16-02',
        name: 'Bab El Oued',
        nameAr: 'باب الواد',
        communes: [
          { id: '16-02-01', name: 'Bab El Oued', nameAr: 'باب الواد' },
          { id: '16-02-02', name: 'Oued Koriche', nameAr: 'وادي قريش' },
          { id: '16-02-03', name: 'Bologhine', nameAr: 'بولوغين' },
        ]
      },
      {
        id: '16-03',
        name: 'Bir Mourad Raïs',
        nameAr: 'بئر مراد رايس',
        communes: [
          { id: '16-03-01', name: 'Bir Mourad Raïs', nameAr: 'بئر مراد رايس' },
          { id: '16-03-02', name: 'Birkhadem', nameAr: 'بئر خادم' },
          { id: '16-03-03', name: 'El Biar', nameAr: 'الأبيار' },
        ]
      },
      {
        id: '16-04',
        name: 'Dar El Beïda',
        nameAr: 'دار البيضاء',
        communes: [
          { id: '16-04-01', name: 'Dar El Beïda', nameAr: 'دار البيضاء' },
          { id: '16-04-02', name: 'Bouzaréah', nameAr: 'بوزريعة' },
        ]
      },
      {
        id: '16-05',
        name: 'Rouiba',
        nameAr: 'الرويبة',
        communes: [
          { id: '16-05-01', name: 'Rouiba', nameAr: 'الرويبة' },
          { id: '16-05-02', name: 'Reghaia', nameAr: 'رغاية' },
          { id: '16-05-03', name: 'Ain Taya', nameAr: 'عين طاية' },
        ]
      },
      {
        id: '16-06',
        name: 'Baraki',
        nameAr: 'براقي',
        communes: [
          { id: '16-06-01', name: 'Baraki', nameAr: 'براقي' },
          { id: '16-06-02', name: 'Oued Smar', nameAr: 'وادي السمار' },
        ]
      },
      {
        id: '16-07',
        name: 'Draria',
        nameAr: 'دراريا',
        communes: [
          { id: '16-07-01', name: 'Draria', nameAr: 'دراريا' },
          { id: '16-07-02', name: 'Cheraga', nameAr: 'الشراقة' },
          { id: '16-07-03', name: 'Douera', nameAr: 'الدويرة' },
        ]
      },
      {
        id: '16-08',
        name: 'Zéralda',
        nameAr: 'زرالدة',
        communes: [
          { id: '16-08-01', name: 'Zéralda', nameAr: 'زرالدة' },
          { id: '16-08-02', name: 'Staoueli', nameAr: 'سطاوالي' },
        ]
      }
    ]
  },
  {
    code: '31',
    name: 'Oran',
    nameAr: 'وهران',
    dairas: [
      {
        id: '31-01',
        name: 'Oran',
        nameAr: 'وهران',
        communes: [
          { id: '31-01-01', name: 'Oran', nameAr: 'وهران' },
          { id: '31-01-02', name: 'Bir El Djir', nameAr: 'بئر الجير' },
          { id: '31-01-03', name: 'Es Senia', nameAr: 'السانية' },
        ]
      },
      {
        id: '31-02',
        name: 'Arzew',
        nameAr: 'أرزيو',
        communes: [
          { id: '31-02-01', name: 'Arzew', nameAr: 'أرزيو' },
          { id: '31-02-02', name: 'Bethioua', nameAr: 'بطيوة' },
        ]
      },
      {
        id: '31-03',
        name: 'Aïn El Turk',
        nameAr: 'عين الترك',
        communes: [
          { id: '31-03-01', name: 'Aïn El Turk', nameAr: 'عين الترك' },
          { id: '31-03-02', name: 'Mers El Kébir', nameAr: 'المرسى الكبير' },
        ]
      }
    ]
  },
  {
    code: '25',
    name: 'Constantine',
    nameAr: 'قسنطينة',
    dairas: [
      {
        id: '25-01',
        name: 'Constantine',
        nameAr: 'قسنطينة',
        communes: [
          { id: '25-01-01', name: 'Constantine', nameAr: 'قسنطينة' },
          { id: '25-01-02', name: 'El Khroub', nameAr: 'الخروب' },
          { id: '25-01-03', name: 'Ain Smara', nameAr: 'عين السمارة' },
        ]
      },
      {
        id: '25-02',
        name: 'Hamma Bouziane',
        nameAr: 'حامة بوزيان',
        communes: [
          { id: '25-02-01', name: 'Hamma Bouziane', nameAr: 'حامة بوزيان' },
          { id: '25-02-02', name: 'Didouche Mourad', nameAr: 'ديدوش مراد' },
        ]
      },
      {
        id: '25-03',
        name: 'Zighoud Youcef',
        nameAr: 'زيغود يوسف',
        communes: [
          { id: '25-03-01', name: 'Zighoud Youcef', nameAr: 'زيغود يوسف' },
          { id: '25-03-02', name: 'Beni Hamiden', nameAr: 'بني حميدان' },
        ]
      }
    ]
  },
  {
    code: '15',
    name: 'Tizi Ouzou',
    nameAr: 'تيزي وزو',
    dairas: [
      {
        id: '15-01',
        name: 'Tizi Ouzou',
        nameAr: 'تيزي وزو',
        communes: [
          { id: '15-01-01', name: 'Tizi Ouzou', nameAr: 'تيزي وزو' },
          { id: '15-01-02', name: 'Tizi Rached', nameAr: 'تيزي راشد' },
        ]
      },
      {
        id: '15-02',
        name: 'Draa El Mizan',
        nameAr: 'ذراع الميزان',
        communes: [
          { id: '15-02-01', name: 'Draa El Mizan', nameAr: 'ذراع الميزان' },
          { id: '15-02-02', name: 'Ain El Hammam', nameAr: 'عين الحمام' },
        ]
      },
      {
        id: '15-03',
        name: 'Azazga',
        nameAr: 'عزازقة',
        communes: [
          { id: '15-03-01', name: 'Azazga', nameAr: 'عزازقة' },
          { id: '15-03-02', name: 'Iferhounene', nameAr: 'إفرحونن' },
        ]
      }
    ]
  },
  {
    code: '23',
    name: 'Annaba',
    nameAr: 'عنابة',
    dairas: [
      {
        id: '23-01',
        name: 'Annaba',
        nameAr: 'عنابة',
        communes: [
          { id: '23-01-01', name: 'Annaba', nameAr: 'عنابة' },
          { id: '23-01-02', name: 'El Bouni', nameAr: 'البوني' },
        ]
      },
      {
        id: '23-02',
        name: 'Berrahal',
        nameAr: 'برحال',
        communes: [
          { id: '23-02-01', name: 'Berrahal', nameAr: 'برحال' },
          { id: '23-02-02', name: 'Ain Berda', nameAr: 'عين برده' },
        ]
      }
    ]
  },
  {
    code: '13',
    name: 'Tlemcen',
    nameAr: 'تلمسان',
    dairas: [
      {
        id: '13-01',
        name: 'Tlemcen',
        nameAr: 'تلمسان',
        communes: [
          { id: '13-01-01', name: 'Tlemcen', nameAr: 'تلمسان' },
          { id: '13-01-02', name: 'Mansourah', nameAr: 'المنصورة' },
          { id: '13-01-03', name: 'Chetouane', nameAr: 'شتوان' },
        ]
      },
      {
        id: '13-02',
        name: 'Maghnia',
        nameAr: 'مغنية',
        communes: [
          { id: '13-02-01', name: 'Maghnia', nameAr: 'مغنية' },
          { id: '13-02-02', name: 'Hammam Boughrara', nameAr: 'حمام بوغرارة' },
        ]
      },
      {
        id: '13-03',
        name: 'Nedroma',
        nameAr: 'ندرومة',
        communes: [
          { id: '13-03-01', name: 'Nedroma', nameAr: 'ندرومة' },
          { id: '13-03-02', name: 'Ghazaouet', nameAr: 'الغزوات' },
        ]
      }
    ]
  }
];
