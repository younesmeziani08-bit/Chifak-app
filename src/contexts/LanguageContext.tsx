import { createContext, useContext, useState, ReactNode } from 'react';

type Language = 'fr' | 'ar';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const translations = {
  fr: {
    // Header
    'header.professional': 'Vous êtes un professionnel de santé ?',
    'header.login': 'Connexion',
    'header.logo': 'chifak',
    
    // Home Page
    'home.title': 'Prenez rendez-vous avec un professionnel de santé',
    'home.subtitle': 'Trouvez rapidement un praticien près de chez vous et réservez en ligne',
    'home.specialty': 'Spécialité, praticien ou établissement',
    'home.selectSpecialty': 'Sélectionnez une spécialité',
    'home.location': 'Où ?',
    'home.locationPlaceholder': 'Paris, Lyon, Marseille...',
    'home.search': 'Rechercher',
    'home.popularSearches': 'Recherches populaires :',
    'home.whyChoose': 'Pourquoi choisir chifak ?',
    'home.feature1Title': 'Réservation rapide',
    'home.feature1Desc': 'Trouvez et réservez en quelques clics, 24h/24',
    'home.feature2Title': 'Confirmation immédiate',
    'home.feature2Desc': 'Recevez une confirmation par email et SMS',
    'home.feature3Title': 'Large choix de praticiens',
    'home.feature3Desc': 'Des milliers de professionnels de santé disponibles',
    'home.stat1': 'Professionnels de santé',
    'home.stat2': 'Rendez-vous pris',
    'home.stat3': 'Spécialités médicales',
    
    // Specialties
    'specialty.generalDoctor': 'Médecin généraliste',
    'specialty.dentist': 'Dentiste',
    'specialty.ophthalmologist': 'Ophtalmologue',
    'specialty.dermatologist': 'Dermatologue',
    'specialty.cardiologist': 'Cardiologue',
    'specialty.pediatrician': 'Pédiatre',
    'specialty.gynecologist': 'Gynécologue',
    'specialty.ent': 'ORL',
    'specialty.physiotherapist': 'Kinésithérapeute',
    'specialty.psychologist': 'Psychologue',
    'specialty.osteopath': 'Ostéopathe',
    'specialty.midwife': 'Sage-femme',
    
    // Search Results
    'search.modifySearch': 'Modifier la recherche',
    'search.in': 'à',
    'search.available': 'professionnels disponibles',
    'search.filters.availability': 'Disponibilités',
    'search.filters.topRated': 'Les mieux notés',
    'search.filters.distance': 'Distance',
    'search.filters.vitaleCard': 'Accepte la carte vitale',
    'search.filters.teleconsultation': 'Téléconsultation',
    'search.reviews': 'avis',
    'search.nextAvailable': 'Prochaine disponibilité :',
    'search.bookAppointment': 'Prendre rendez-vous',
    'search.viewProfile': 'Voir le profil',
    'search.viewOnMap': 'Voir sur la carte',
    'search.today': "Aujourd'hui à",
    'search.tomorrow': 'Demain à',
    
    // Booking Page
    'booking.backToResults': 'Retour aux résultats',
    'booking.chooseDate': 'Choisissez une date',
    'booking.chooseTime': 'Choisissez un horaire',
    'booking.yourInfo': 'Vos informations',
    'booking.fullName': 'Nom complet',
    'booking.email': 'Email',
    'booking.phone': 'Téléphone',
    'booking.reason': 'Motif de consultation (optionnel)',
    'booking.reasonPlaceholder': 'Décrivez brièvement le motif de votre consultation...',
    'booking.confirm': 'Confirmer le rendez-vous',
    'booking.summary': 'Récapitulatif',
    'booking.practitioner': 'Praticien',
    'booking.date': 'Date',
    'booking.time': 'Heure',
    'booking.address': 'Adresse',
    'booking.reminder': 'Pensez à apporter votre carte vitale et votre carte de mutuelle',
    'booking.today': "Aujourd'hui",
    
    // Days of week
    'day.sun': 'Dim',
    'day.mon': 'Lun',
    'day.tue': 'Mar',
    'day.wed': 'Mer',
    'day.thu': 'Jeu',
    'day.fri': 'Ven',
    'day.sat': 'Sam',
    
    // Months
    'month.jan': 'Jan',
    'month.feb': 'Fév',
    'month.mar': 'Mar',
    'month.apr': 'Avr',
    'month.may': 'Mai',
    'month.jun': 'Juin',
    'month.jul': 'Juil',
    'month.aug': 'Aoû',
    'month.sep': 'Sep',
    'month.oct': 'Oct',
    'month.nov': 'Nov',
    'month.dec': 'Déc',
    
    // Confirmation Page
    'confirmation.title': 'Rendez-vous confirmé !',
    'confirmation.subtitle': 'Vous allez recevoir un email et un SMS de confirmation',
    'confirmation.details': 'Détails de votre rendez-vous',
    'confirmation.importantInfo': 'Informations importantes',
    'confirmation.tip1': 'Présentez-vous 10 minutes avant l\'heure du rendez-vous',
    'confirmation.tip2': 'N\'oubliez pas votre carte vitale et votre carte de mutuelle',
    'confirmation.tip3': 'En cas d\'empêchement, annulez votre rendez-vous au moins 24h à l\'avance',
    'confirmation.addToCalendar': 'Ajouter au calendrier',
    'confirmation.share': 'Partager',
    'confirmation.anotherAppointment': 'Prendre un autre rendez-vous',
    'confirmation.emailSent': 'Un email de confirmation a été envoyé à',
    'confirmation.needHelp': 'Besoin d\'aide ?',
    'confirmation.manageAppointments': 'Gérer mes rendez-vous',
    'confirmation.contact': 'Nous contacter',
    
    // Login Modal
    'login.title': 'Connexion',
    'login.signup': 'Créer un compte',
    'login.fullName': 'Nom complet',
    'login.email': 'Email',
    'login.password': 'Mot de passe',
    'login.confirmPassword': 'Confirmer le mot de passe',
    'login.rememberMe': 'Se souvenir de moi',
    'login.forgotPassword': 'Mot de passe oublié ?',
    'login.signIn': 'Se connecter',
    'login.createAccount': 'Créer mon compte',
    'login.orContinueWith': 'Ou continuer avec',
    'login.haveAccount': 'Vous avez déjà un compte ?',
    'login.noAccount': 'Vous n\'avez pas de compte ?',
    
    // Professional Modal
    /* Le bloc « pro.* » a été supprimé.

       Il portait des affirmations que rien ne soutient : « 300 K+
       professionnels », « 95 % de satisfaction », « −60 % d'absences »,
       « rejoignez des milliers de praticiens ». Ces nombres s'affichaient à
       des médecins qu'on invitait à s'inscrire sur cette foi. Un praticien
       qui découvre ensuite qu'il est le douzième ne revient pas, et il en
       parle à ses confrères.

       La fenêtre professionnelle porte désormais son texte en propre —
       description de ce que le service fait réellement, et sa gratuité, qui
       est vraie et se vérifie. Voir ProfessionalModal.tsx. */
    
    // Footer
    'footer.tagline': 'La plateforme de prise de rendez-vous médical en ligne',
    'footer.patients': 'Patients',
    'footer.findDoctor': 'Trouver un médecin',
    'footer.bookAppointment': 'Prendre rendez-vous',
    'footer.teleconsultation': 'Téléconsultation',
    'footer.professionals': 'Professionnels',
    'footer.register': 'S\'inscrire',
    'footer.login': 'Connexion',
    'footer.pricing': 'Tarifs',
    'footer.about': 'À propos',
    'footer.whoWeAre': 'Qui sommes-nous ?',
    'footer.contact': 'Contact',
    'footer.legal': 'Mentions légales',
    'footer.rights': 'Tous droits réservés.',
  },
  ar: {
    // Header
    'header.professional': 'هل أنت متخصص في الصحة؟',
    'header.login': 'تسجيل الدخول',
    'header.logo': 'شفاك',
    
    // Home Page
    'home.title': 'احجز موعدًا مع متخصص صحي',
    'home.subtitle': 'ابحث بسرعة عن طبيب بالقرب منك واحجز عبر الإنترنت',
    'home.specialty': 'التخصص أو الطبيب أو المنشأة',
    'home.selectSpecialty': 'اختر تخصصًا',
    'home.location': 'أين؟',
    'home.locationPlaceholder': 'باريس، ليون، مرسيليا...',
    'home.search': 'بحث',
    'home.popularSearches': 'البحث الشائع:',
    'home.whyChoose': 'لماذا تختار شفاك؟',
    'home.feature1Title': 'حجز سريع',
    'home.feature1Desc': 'ابحث واحجز في بضع نقرات، 24/7',
    'home.feature2Title': 'تأكيد فوري',
    'home.feature2Desc': 'استلم تأكيدًا عبر البريد الإلكتروني والرسائل النصية',
    'home.feature3Title': 'مجموعة واسعة من الأطباء',
    'home.feature3Desc': 'آلاف المتخصصين في الصحة متاحون',
    'home.stat1': 'متخصص في الصحة',
    'home.stat2': 'موعد محجوز',
    'home.stat3': 'تخصص طبي',
    
    // Specialties
    'specialty.generalDoctor': 'طبيب عام',
    'specialty.dentist': 'طبيب أسنان',
    'specialty.ophthalmologist': 'طبيب عيون',
    'specialty.dermatologist': 'طبيب جلدية',
    'specialty.cardiologist': 'طبيب قلب',
    'specialty.pediatrician': 'طبيب أطفال',
    'specialty.gynecologist': 'طبيب نساء',
    'specialty.ent': 'أنف وأذن وحنجرة',
    'specialty.physiotherapist': 'أخصائي علاج طبيعي',
    'specialty.psychologist': 'طبيب نفسي',
    'specialty.osteopath': 'أخصائي تقويم عظام',
    'specialty.midwife': 'قابلة',
    
    // Search Results
    'search.modifySearch': 'تعديل البحث',
    'search.in': 'في',
    'search.available': 'متخصص متاح',
    'search.filters.availability': 'التوافر',
    'search.filters.topRated': 'الأعلى تقييمًا',
    'search.filters.distance': 'المسافة',
    'search.filters.vitaleCard': 'يقبل البطاقة الصحية',
    'search.filters.teleconsultation': 'استشارة عن بعد',
    'search.reviews': 'تقييم',
    'search.nextAvailable': 'التوفر التالي:',
    'search.bookAppointment': 'احجز موعدًا',
    'search.viewProfile': 'عرض الملف الشخصي',
    'search.viewOnMap': 'عرض على الخريطة',
    'search.today': 'اليوم في',
    'search.tomorrow': 'غدًا في',
    
    // Booking Page
    'booking.backToResults': 'العودة إلى النتائج',
    'booking.chooseDate': 'اختر تاريخًا',
    'booking.chooseTime': 'اختر وقتًا',
    'booking.yourInfo': 'معلوماتك',
    'booking.fullName': 'الاسم الكامل',
    'booking.email': 'البريد الإلكتروني',
    'booking.phone': 'الهاتف',
    'booking.reason': 'سبب الاستشارة (اختياري)',
    'booking.reasonPlaceholder': 'صف بإيجاز سبب استشارتك...',
    'booking.confirm': 'تأكيد الموعد',
    'booking.summary': 'الملخص',
    'booking.practitioner': 'الطبيب',
    'booking.date': 'التاريخ',
    'booking.time': 'الوقت',
    'booking.address': 'العنوان',
    'booking.reminder': 'تذكر إحضار بطاقتك الصحية وبطاقة التأمين',
    'booking.today': 'اليوم',
    
    // Days of week
    'day.sun': 'الأحد',
    'day.mon': 'الاثنين',
    'day.tue': 'الثلاثاء',
    'day.wed': 'الأربعاء',
    'day.thu': 'الخميس',
    'day.fri': 'الجمعة',
    'day.sat': 'السبت',
    
    // Months
    'month.jan': 'يناير',
    'month.feb': 'فبراير',
    'month.mar': 'مارس',
    'month.apr': 'أبريل',
    'month.may': 'مايو',
    'month.jun': 'يونيو',
    'month.jul': 'يوليو',
    'month.aug': 'أغسطس',
    'month.sep': 'سبتمبر',
    'month.oct': 'أكتوبر',
    'month.nov': 'نوفمبر',
    'month.dec': 'ديسمبر',
    
    // Confirmation Page
    'confirmation.title': 'تم تأكيد الموعد!',
    'confirmation.subtitle': 'سوف تتلقى بريدًا إلكترونيًا ورسالة نصية للتأكيد',
    'confirmation.details': 'تفاصيل موعدك',
    'confirmation.importantInfo': 'معلومات مهمة',
    'confirmation.tip1': 'احضر قبل 10 دقائق من موعدك',
    'confirmation.tip2': 'لا تنس بطاقتك الصحية وبطاقة التأمين',
    'confirmation.tip3': 'في حالة عدم القدرة على الحضور، الغِ موعدك قبل 24 ساعة على الأقل',
    'confirmation.addToCalendar': 'إضافة إلى التقويم',
    'confirmation.share': 'مشاركة',
    'confirmation.anotherAppointment': 'احجز موعدًا آخر',
    'confirmation.emailSent': 'تم إرسال بريد إلكتروني للتأكيد إلى',
    'confirmation.needHelp': 'تحتاج مساعدة؟',
    'confirmation.manageAppointments': 'إدارة مواعيدي',
    'confirmation.contact': 'اتصل بنا',
    
    // Login Modal
    'login.title': 'تسجيل الدخول',
    'login.signup': 'إنشاء حساب',
    'login.fullName': 'الاسم الكامل',
    'login.email': 'البريد الإلكتروني',
    'login.password': 'كلمة المرور',
    'login.confirmPassword': 'تأكيد كلمة المرور',
    'login.rememberMe': 'تذكرني',
    'login.forgotPassword': 'هل نسيت كلمة المرور؟',
    'login.signIn': 'تسجيل الدخول',
    'login.createAccount': 'إنشاء حسابي',
    'login.orContinueWith': 'أو تابع مع',
    'login.haveAccount': 'هل لديك حساب؟',
    'login.noAccount': 'ليس لديك حساب؟',
    
    // Professional Modal
    
    // Footer
    'footer.tagline': 'منصة حجز المواعيد الطبية عبر الإنترنت',
    'footer.patients': 'المرضى',
    'footer.findDoctor': 'البحث عن طبيب',
    'footer.bookAppointment': 'احجز موعدًا',
    'footer.teleconsultation': 'استشارة عن بعد',
    'footer.professionals': 'المتخصصون',
    'footer.register': 'التسجيل',
    'footer.login': 'تسجيل الدخول',
    'footer.pricing': 'الأسعار',
    'footer.about': 'حول',
    'footer.whoWeAre': 'من نحن؟',
    'footer.contact': 'اتصل',
    'footer.legal': 'الإشعارات القانونية',
    'footer.rights': 'جميع الحقوق محفوظة.',
  },
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('fr');

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations.fr] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
