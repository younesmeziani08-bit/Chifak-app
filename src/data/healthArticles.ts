export type ArticleCategory = 'prevention' | 'chronic' | 'mother-child' | 'wellbeing';

export interface ArticleSection {
  heading: string;
  body: string;
}

export interface Article {
  id: string;
  category: ArticleCategory;
  title: string;
  titleAr: string;
  excerpt: string;
  excerptAr: string;
  readTime: number; // minutes
  sections: ArticleSection[];
  sectionsAr: ArticleSection[];
  keyPoints: string[];
  keyPointsAr: string[];
}

export const CATEGORY_LABELS: Record<ArticleCategory, { fr: string; ar: string }> = {
  prevention: { fr: 'Prévention', ar: 'الوقاية' },
  chronic: { fr: 'Maladies chroniques', ar: 'الأمراض المزمنة' },
  'mother-child': { fr: 'Mère & enfant', ar: 'الأم والطفل' },
  wellbeing: { fr: 'Bien-être', ar: 'الصحة والعافية' },
};

export const healthArticles: Article[] = [
  {
    id: 'hydratation-ete',
    category: 'prevention',
    title: "Bien s'hydrater, surtout en été",
    titleAr: 'الترطيب الجيد، خاصة في الصيف',
    excerpt: "L'eau représente près de 60 % de notre corps. En période de chaleur, bien boire protège les reins, le cœur et la concentration.",
    excerptAr: 'يشكّل الماء حوالي 60٪ من جسمنا. في فترات الحر، يحمي شربُ الماء الكافي الكلى والقلب والتركيز.',
    readTime: 4,
    sections: [
      { heading: 'Pourquoi c\'est vital', body: "Le corps perd de l'eau en continu par la respiration, la transpiration et les urines. Quand les pertes ne sont pas compensées, la déshydratation s'installe : fatigue, maux de tête, vertiges, crampes, et dans les cas graves, coup de chaleur. Les personnes âgées, les enfants et les malades chroniques y sont plus sensibles." },
      { heading: 'Combien boire', body: "En moyenne, 1,5 à 2 litres d'eau par jour pour un adulte, davantage lors de fortes chaleurs ou d'activité physique. N'attendez pas la sensation de soif : elle apparaît quand la déshydratation a déjà commencé. Buvez régulièrement, par petites quantités." },
      { heading: 'Les bons réflexes en cas de canicule', body: "Gardez une bouteille d'eau à portée de main, évitez les sorties aux heures les plus chaudes, privilégiez les pièces fraîches, portez des vêtements légers et clairs. Limitez le café et les boissons très sucrées qui augmentent les pertes d'eau. Les fruits et légumes riches en eau (pastèque, concombre, orange) complètent l'apport." },
    ],
    sectionsAr: [
      { heading: 'لماذا هو أمر حيوي', body: 'يفقد الجسم الماء باستمرار عبر التنفّس والتعرّق والبول. وعندما لا تُعوّض هذه الخسائر، يحدث الجفاف: تعب، صداع، دوخة، تشنّجات، وفي الحالات الخطيرة ضربة شمس. وكبار السنّ والأطفال والمصابون بأمراض مزمنة أكثر عرضة لذلك.' },
      { heading: 'كم يجب أن نشرب', body: 'في المتوسّط من 1.5 إلى 2 لتر من الماء يوميًا للبالغ، وأكثر عند اشتداد الحرّ أو النشاط البدني. لا تنتظر الشعور بالعطش، فهو يظهر بعد بدء الجفاف. اشرب بانتظام وبكميات صغيرة.' },
      { heading: 'تصرّفات صحيحة أثناء موجة الحر', body: 'احتفظ بقارورة ماء قريبة منك، وتجنّب الخروج في أشدّ ساعات الحرّ، وابقَ في غرف باردة، والبس ملابس خفيفة فاتحة اللون. قلّل من القهوة والمشروبات شديدة السكر التي تزيد فقدان الماء. الفواكه والخضر الغنية بالماء (البطيخ، الخيار، البرتقال) تكمّل الترطيب.' },
    ],
    keyPoints: [
      'Buvez 1,5 à 2 L d\'eau par jour, plus en cas de chaleur.',
      'N\'attendez pas d\'avoir soif pour boire.',
      'Surveillez de près les personnes âgées et les enfants.',
    ],
    keyPointsAr: [
      'اشرب من 1.5 إلى 2 لتر ماء يوميًا، وأكثر عند الحرّ.',
      'لا تنتظر العطش لتشرب.',
      'راقب عن قرب كبار السنّ والأطفال.',
    ],
  },
  {
    id: 'activite-physique',
    category: 'prevention',
    title: 'Bouger chaque jour : un médicament naturel',
    titleAr: 'الحركة كل يوم: دواء طبيعي',
    excerpt: "30 minutes d'activité par jour réduisent le risque de maladies du cœur, de diabète et de dépression. Pas besoin de salle de sport.",
    excerptAr: '30 دقيقة من النشاط يوميًا تقلّل خطر أمراض القلب والسكري والاكتئاب. لا حاجة إلى قاعة رياضة.',
    readTime: 4,
    sections: [
      { heading: 'Des bénéfices sur tout le corps', body: "L'activité physique renforce le cœur et les muscles, aide à contrôler le poids, la tension et la glycémie, améliore le sommeil et l'humeur. Elle réduit le risque de nombreuses maladies chroniques et de certains cancers. Ses effets sont visibles à tout âge." },
      { heading: 'Combien, comment', body: "L'objectif recommandé est d'environ 150 minutes par semaine d'activité modérée, soit 30 minutes cinq jours sur sept. La marche rapide, le vélo, la natation, le jardinage ou monter les escaliers comptent. L'important est la régularité, pas l'intensité extrême." },
      { heading: 'Commencer sans se blesser', body: "Augmentez progressivement la durée et l'intensité. Échauffez-vous, hydratez-vous, portez de bonnes chaussures. Si vous avez une maladie chronique ou reprenez après une longue pause, demandez conseil à votre médecin avant de commencer un programme intense." },
    ],
    sectionsAr: [
      { heading: 'فوائد للجسم كلّه', body: 'يقوّي النشاط البدني القلب والعضلات، ويساعد على ضبط الوزن والضغط وسكّر الدم، ويحسّن النوم والمزاج. كما يقلّل خطر كثير من الأمراض المزمنة وبعض السرطانات. وتظهر فوائده في كل الأعمار.' },
      { heading: 'كم وكيف', body: 'الهدف الموصى به نحو 150 دقيقة أسبوعيًا من النشاط المعتدل، أي 30 دقيقة خمسة أيام في الأسبوع. المشي السريع والدراجة والسباحة والبستنة وصعود الدرج كلّها تُحتسب. المهمّ الانتظام لا الشدّة القصوى.' },
      { heading: 'ابدأ دون إصابة', body: 'زد المدّة والشدّة تدريجيًا. قم بالإحماء، ورطّب جسمك، والبس حذاءً مناسبًا. إذا كنت مصابًا بمرض مزمن أو تعود بعد انقطاع طويل، فاستشر طبيبك قبل بدء برنامج مكثّف.' },
    ],
    keyPoints: [
      'Visez 30 minutes de marche ou d\'activité par jour.',
      'La régularité compte plus que l\'intensité.',
      'Demandez un avis médical avant un effort intense si besoin.',
    ],
    keyPointsAr: [
      'استهدف 30 دقيقة مشي أو نشاط يوميًا.',
      'الانتظام أهمّ من الشدّة.',
      'استشر الطبيب قبل مجهود مكثّف عند الحاجة.',
    ],
  },
  {
    id: 'hypertension',
    category: 'chronic',
    title: "L'hypertension, le tueur silencieux",
    titleAr: 'ارتفاع ضغط الدم، القاتل الصامت',
    excerpt: "Souvent sans symptôme, l'hypertension abîme le cœur, le cerveau et les reins. La dépister et la traiter tôt sauve des vies.",
    excerptAr: 'غالبًا دون أعراض، يُتلف ارتفاع الضغط القلب والدماغ والكلى. كشفه وعلاجه مبكرًا ينقذ الأرواح.',
    readTime: 5,
    sections: [
      { heading: 'Un danger discret', body: "La tension artérielle est la pression du sang sur les parois des artères. Quand elle reste trop élevée, elle fatigue le cœur et fragilise les vaisseaux, augmentant le risque d'infarctus, d'AVC et d'insuffisance rénale. Le problème : elle ne fait souvent aucun bruit pendant des années." },
      { heading: 'Se faire mesurer', body: "On parle d'hypertension au-delà de 140/90 mmHg mesurée à plusieurs reprises. La mesure est simple, rapide et indolore. À partir de 40 ans, ou plus tôt en cas d'antécédents familiaux, faites contrôler votre tension régulièrement, en pharmacie ou chez le médecin." },
      { heading: 'Réduire le risque', body: "Limitez le sel, mangez plus de fruits et légumes, bougez, maintenez un poids sain, réduisez l'alcool et arrêtez le tabac. Si un traitement est prescrit, prenez-le tous les jours, même sans symptôme : c'est ce qui protège vos organes sur le long terme." },
    ],
    sectionsAr: [
      { heading: 'خطر خفيّ', body: 'ضغط الدم هو ضغط الدم على جدران الشرايين. حين يبقى مرتفعًا جدًا، يُرهق القلب ويُضعف الأوعية، فيرتفع خطر الجلطة القلبية والدماغية والقصور الكلوي. والمشكلة أنّه غالبًا لا يُحدث أيّ أعراض لسنوات.' },
      { heading: 'قِس ضغطك', body: 'نتحدّث عن ارتفاع الضغط فوق 140/90 ملم زئبق عند القياس عدة مرات. القياس بسيط وسريع وغير مؤلم. ابتداءً من سنّ 40، أو أبكر عند وجود سوابق عائلية، افحص ضغطك بانتظام في الصيدلية أو عند الطبيب.' },
      { heading: 'قلّل الخطر', body: 'قلّل الملح، وأكثِر من الفواكه والخضر، وتحرّك، وحافظ على وزن صحّي، وقلّل الكحول وأقلع عن التدخين. وإذا وُصف لك دواء، فتناوله يوميًا حتى دون أعراض، فهذا ما يحمي أعضاءك على المدى الطويل.' },
    ],
    keyPoints: [
      'L\'hypertension est souvent sans symptôme : faites-la mesurer.',
      'Objectif général : sous 140/90 mmHg.',
      'Moins de sel, plus d\'activité, traitement pris chaque jour.',
    ],
    keyPointsAr: [
      'ارتفاع الضغط غالبًا دون أعراض: قِسه.',
      'الهدف العام: أقلّ من 140/90 ملم زئبق.',
      'ملح أقلّ، نشاط أكثر، والدواء كل يوم.',
    ],
  },
  {
    id: 'diabete-type-2',
    category: 'chronic',
    title: 'Comprendre et prévenir le diabète de type 2',
    titleAr: 'فهم السكري من النوع الثاني والوقاية منه',
    excerpt: "Le diabète de type 2 progresse lentement et peut être retardé, voire évité, par l'hygiène de vie. Voici l'essentiel.",
    excerptAr: 'يتطوّر السكري من النوع الثاني ببطء، ويمكن تأخيره بل تفاديه بنمط حياة صحّي. إليك الأساس.',
    readTime: 5,
    sections: [
      { heading: 'Ce qui se passe', body: "Dans le diabète de type 2, le corps utilise mal l'insuline et le sucre s'accumule dans le sang. Avec le temps, l'excès de sucre abîme les vaisseaux, les yeux, les reins et les nerfs. Les signes possibles : soif intense, envie fréquente d'uriner, fatigue, vision floue — mais la maladie peut rester silencieuse longtemps." },
      { heading: 'Qui est à risque', body: "Le surpoids, la sédentarité, une alimentation riche en sucres et graisses, les antécédents familiaux et l'âge augmentent le risque. Un simple dosage de la glycémie à jeun permet de dépister la maladie ou un pré-diabète, stade où l'on peut encore inverser la tendance." },
      { heading: 'Agir tôt', body: "Perdre un peu de poids, marcher chaque jour, réduire les sucres rapides et les boissons sucrées, privilégier légumes, légumineuses et céréales complètes : ces mesures réduisent fortement le risque. Chez les personnes déjà diabétiques, elles améliorent l'équilibre et limitent les complications." },
    ],
    sectionsAr: [
      { heading: 'ما الذي يحدث', body: 'في السكري من النوع الثاني، يستعمل الجسم الأنسولين بشكل سيّئ فيتراكم السكر في الدم. ومع الوقت يُتلف فائض السكر الأوعية والعينين والكلى والأعصاب. من العلامات المحتملة: عطش شديد، تبوّل متكرّر، تعب، تشوّش الرؤية — لكن المرض قد يبقى صامتًا طويلًا.' },
      { heading: 'من هم المعرّضون', body: 'الوزن الزائد والخمول والغذاء الغني بالسكر والدهون والسوابق العائلية والتقدّم في السنّ ترفع الخطر. تحليل بسيط لسكّر الدم على الريق يكشف المرض أو ما قبل السكري، وهي مرحلة يمكن فيها عكس المسار.' },
      { heading: 'تصرّف مبكرًا', body: 'إنقاص قليل من الوزن، والمشي يوميًا، وتقليل السكريات السريعة والمشروبات المحلّاة، وتفضيل الخضر والبقول والحبوب الكاملة: تدابير تخفّض الخطر بقوة. وعند المصابين تحسّن التوازن وتقلّل المضاعفات.' },
    ],
    keyPoints: [
      'Un test de glycémie à jeun permet un dépistage simple.',
      'Le pré-diabète est réversible par l\'hygiène de vie.',
      'Moins de sucres rapides, plus d\'activité et de fibres.',
    ],
    keyPointsAr: [
      'تحليل سكّر الدم على الريق يتيح كشفًا بسيطًا.',
      'ما قبل السكري قابل للعكس بنمط حياة صحّي.',
      'سكريات سريعة أقلّ، ونشاط وألياف أكثر.',
    ],
  },
  {
    id: 'vaccination-enfant',
    category: 'mother-child',
    title: "La vaccination de l'enfant : ce qu'il faut savoir",
    titleAr: 'تلقيح الطفل: ما يجب معرفته',
    excerpt: "Les vaccins protègent l'enfant contre des maladies graves et protègent aussi son entourage. Respecter le calendrier est essentiel.",
    excerptAr: 'تحمي اللقاحات الطفل من أمراض خطيرة وتحمي محيطه أيضًا. احترام الرزنامة أساسي.',
    readTime: 4,
    sections: [
      { heading: 'Comment ça marche', body: "Un vaccin entraîne le système immunitaire à reconnaître un microbe sans provoquer la maladie. Si l'enfant rencontre plus tard ce microbe, son corps sait se défendre rapidement. C'est l'un des moyens les plus efficaces et les plus sûrs de prévenir des maladies graves." },
      { heading: 'Respecter le calendrier', body: "Chaque vaccin est prévu à un âge précis pour offrir la meilleure protection. Retards et oublis laissent l'enfant vulnérable. Gardez le carnet de santé à jour et notez les rendez-vous. En cas de retard, il est généralement possible de rattraper : demandez conseil au médecin." },
      { heading: 'Effets et sécurité', body: "Les réactions sont le plus souvent bénignes : rougeur au point d'injection, légère fièvre, enfant grognon un jour ou deux. Ces signes disparaissent seuls. Les effets graves sont très rares. Le bénéfice de la protection dépasse largement ces désagréments passagers." },
    ],
    sectionsAr: [
      { heading: 'كيف تعمل', body: 'يدرّب اللقاح جهاز المناعة على التعرّف على الميكروب دون التسبّب في المرض. فإذا التقى الطفل لاحقًا بهذا الميكروب، عرف جسمه كيف يدافع بسرعة. وهي من أنجع وأأمن وسائل الوقاية من الأمراض الخطيرة.' },
      { heading: 'احترم الرزنامة', body: 'كل لقاح محدّد في سنّ معيّنة لتوفير أفضل حماية. التأخّر والنسيان يترك الطفل عرضة للخطر. حافظ على تحديث دفتر الصحة وسجّل المواعيد. وعند التأخّر يمكن غالبًا التدارك: استشر الطبيب.' },
      { heading: 'الآثار والأمان', body: 'ردود الفعل غالبًا خفيفة: احمرار مكان الحقن، حمّى بسيطة، انزعاج يوم أو يومين. تزول هذه العلامات وحدها. الآثار الخطيرة نادرة جدًا. وفائدة الحماية تفوق بكثير هذه المضايقات العابرة.' },
    ],
    keyPoints: [
      'Suivez le calendrier vaccinal et gardez le carnet à jour.',
      'En cas de retard, un rattrapage est souvent possible.',
      'Les réactions sont le plus souvent bénignes et passagères.',
    ],
    keyPointsAr: [
      'اتبع رزنامة التلقيح وحافظ على تحديث الدفتر.',
      'عند التأخّر، غالبًا يمكن التدارك.',
      'ردود الفعل غالبًا خفيفة وعابرة.',
    ],
  },
  {
    id: 'nutrition-enfant',
    category: 'mother-child',
    title: 'Bien nourrir son enfant de 0 à 5 ans',
    titleAr: 'تغذية الطفل من 0 إلى 5 سنوات',
    excerpt: "Les premières années façonnent la santé future. Allaitement, diversification et bons repas posent des bases solides.",
    excerptAr: 'تشكّل السنوات الأولى صحة المستقبل. الرضاعة والتنويع الغذائي والوجبات الجيدة تضع أساسًا متينًا.',
    readTime: 5,
    sections: [
      { heading: 'Les six premiers mois', body: "L'allaitement maternel exclusif est recommandé jusqu'à 6 mois : le lait maternel couvre tous les besoins et renforce l'immunité. Quand l'allaitement n'est pas possible, un lait infantile adapté est utilisé. L'eau et les autres aliments ne sont pas nécessaires avant 6 mois." },
      { heading: 'La diversification', body: "À partir de 6 mois, on introduit progressivement d'autres aliments (légumes, fruits, céréales, puis viandes et légumineuses) tout en poursuivant le lait. On propose de nouveaux goûts un à un, en petites quantités, sans forcer. On évite le sel et le sucre ajoutés chez le tout-petit." },
      { heading: 'De bonnes habitudes', body: "Des repas à heures régulières, de l'eau plutôt que des boissons sucrées, des portions adaptées à l'âge et des fruits en collation. Manger en famille et limiter les écrans pendant les repas favorisent une relation saine à la nourriture. Surveillez la courbe de croissance avec le médecin." },
    ],
    sectionsAr: [
      { heading: 'الأشهر الستة الأولى', body: 'يُنصح بالرضاعة الطبيعية الخالصة حتى 6 أشهر: حليب الأم يغطّي كل الاحتياجات ويقوّي المناعة. وحين تتعذّر الرضاعة يُستعمل حليب رضّع مناسب. لا حاجة للماء أو أطعمة أخرى قبل 6 أشهر.' },
      { heading: 'التنويع الغذائي', body: 'ابتداءً من 6 أشهر، تُدخَل تدريجيًا أطعمة أخرى (خضر، فواكه، حبوب، ثم لحوم وبقول) مع مواصلة الحليب. تُقدَّم نكهات جديدة واحدة تلو الأخرى بكميات صغيرة دون إجبار. ويُتجنّب الملح والسكر المضاف عند الصغير.' },
      { heading: 'عادات جيدة', body: 'وجبات في أوقات منتظمة، وماء بدل المشروبات المحلّاة، وحصص مناسبة للسنّ، وفواكه كوجبة خفيفة. الأكل مع العائلة وتقليل الشاشات أثناء الوجبات يعزّزان علاقة صحّية بالطعام. راقب منحنى النموّ مع الطبيب.' },
    ],
    keyPoints: [
      'Allaitement exclusif recommandé jusqu\'à 6 mois.',
      'Diversification progressive, sans sel ni sucre ajoutés.',
      'Eau plutôt que boissons sucrées, repas réguliers.',
    ],
    keyPointsAr: [
      'يُنصح بالرضاعة الخالصة حتى 6 أشهر.',
      'تنويع تدريجي دون ملح أو سكر مضاف.',
      'ماء بدل المشروبات المحلّاة، ووجبات منتظمة.',
    ],
  },
  {
    id: 'stress-anxiete',
    category: 'wellbeing',
    title: 'Gérer le stress et l\'anxiété au quotidien',
    titleAr: 'التعامل مع التوتر والقلق يوميًا',
    excerpt: "Le stress est normal, mais quand il s'installe il pèse sur le corps et l'esprit. Des gestes simples aident, et demander de l'aide n'est pas une faiblesse.",
    excerptAr: 'التوتر أمر طبيعي، لكنه حين يستمرّ يُثقل الجسد والعقل. تساعد تصرّفات بسيطة، وطلب المساعدة ليس ضعفًا.',
    readTime: 4,
    sections: [
      { heading: 'Reconnaître les signes', body: "Le stress prolongé peut se traduire par des troubles du sommeil, de l'irritabilité, des tensions musculaires, des maux de tête ou de ventre, des difficultés de concentration. L'anxiété ajoute une inquiétude persistante et parfois des palpitations. Repérer ces signes est la première étape." },
      { heading: 'Des gestes qui aident', body: "Respiration lente et profonde, activité physique régulière, sommeil suffisant, limitation du café et des écrans le soir, temps pour des activités qui font du bien et lien social. Parler de ce qu'on ressent à un proche de confiance soulage souvent la pression." },
      { heading: 'Quand consulter', body: "Si l'anxiété dure, gêne le travail, le sommeil ou les relations, ou s'accompagne de tristesse profonde, il faut en parler à un professionnel. Médecins et psychologues proposent des solutions efficaces. Demander de l'aide est un acte de santé, pas une faiblesse." },
    ],
    sectionsAr: [
      { heading: 'تعرّف على العلامات', body: 'قد يظهر التوتر المستمرّ في اضطراب النوم والانفعال وتشنّج العضلات وآلام الرأس أو البطن وصعوبة التركيز. ويضيف القلق قلقًا دائمًا وأحيانًا خفقانًا. ملاحظة هذه العلامات هي الخطوة الأولى.' },
      { heading: 'تصرّفات تساعد', body: 'تنفّس بطيء وعميق، نشاط بدني منتظم، نوم كافٍ، تقليل القهوة والشاشات مساءً، وقت لأنشطة مريحة، وتواصل اجتماعي. التحدّث عمّا تشعر به إلى شخص موثوق يخفّف الضغط غالبًا.' },
      { heading: 'متى تستشير', body: 'إذا استمرّ القلق وأعاق العمل أو النوم أو العلاقات، أو رافقه حزن عميق، فتحدّث إلى مختصّ. يقدّم الأطباء والنفسانيون حلولًا فعّالة. طلب المساعدة فعل صحّي لا ضعف.' },
    ],
    keyPoints: [
      'Sommeil, activité et respiration réduisent le stress.',
      'Parler à un proche soulage souvent.',
      'Une anxiété qui dure justifie un avis professionnel.',
    ],
    keyPointsAr: [
      'النوم والنشاط والتنفّس تقلّل التوتر.',
      'التحدّث إلى مقرّب يخفّف غالبًا.',
      'القلق المستمرّ يستدعي رأي مختصّ.',
    ],
  },
  {
    id: 'hygiene-dentaire',
    category: 'wellbeing',
    title: 'Une bonne hygiène bucco-dentaire à tout âge',
    titleAr: 'نظافة الفم والأسنان في كل عمر',
    excerpt: "Des dents saines, c'est aussi une meilleure santé générale. Le brossage et les contrôles réguliers évitent caries et douleurs.",
    excerptAr: 'الأسنان السليمة تعني صحة عامة أفضل. التنظيف والفحوص المنتظمة تجنّبك التسوّس والألم.',
    readTime: 3,
    sections: [
      { heading: 'Le geste de base', body: "Brossez-vous les dents deux fois par jour, matin et soir, pendant deux minutes, avec un dentifrice fluoré. Un brossage doux le long de la gencive élimine la plaque, cette pellicule qui provoque caries et inflammation des gencives. Changez de brosse tous les trois mois." },
      { heading: 'Alimentation et habitudes', body: "Le sucre nourrit les bactéries responsables des caries, surtout entre les repas et le soir. Limitez sodas, bonbons et grignotage sucré. Le brossage du soir est le plus important : après lui, on évite de manger. Le tabac abîme les gencives et les dents." },
      { heading: 'Voir le dentiste', body: "Un contrôle régulier, idéalement une fois par an, permet de détecter tôt une carie ou un problème de gencive, souvent indolores au début. N'attendez pas la douleur : plus une lésion est prise tôt, plus le soin est simple. Emmenez aussi les enfants dès leurs premières dents." },
    ],
    sectionsAr: [
      { heading: 'الإجراء الأساسي', body: 'نظّف أسنانك مرتين يوميًا صباحًا ومساءً لمدة دقيقتين بمعجون يحتوي على الفلور. التنظيف اللطيف على طول اللثة يزيل اللويحة، تلك الطبقة التي تسبّب التسوّس والتهاب اللثة. غيّر الفرشاة كل ثلاثة أشهر.' },
      { heading: 'الغذاء والعادات', body: 'يغذّي السكر البكتيريا المسبّبة للتسوّس، خاصة بين الوجبات ومساءً. قلّل المشروبات الغازية والحلويات والتسالي المحلّاة. تنظيف المساء هو الأهمّ: بعده يُفضَّل عدم الأكل. والتدخين يُتلف اللثة والأسنان.' },
      { heading: 'زر طبيب الأسنان', body: 'فحص منتظم، ويُفضَّل مرة في السنة، يتيح كشف التسوّس أو مشكلة اللثة مبكرًا وهي غالبًا غير مؤلمة في البداية. لا تنتظر الألم: كلّما اكتُشف الضرر مبكرًا كان العلاج أبسط. اصطحب الأطفال أيضًا منذ ظهور أسنانهم الأولى.' },
    ],
    keyPoints: [
      'Brossage deux fois par jour, deux minutes, dentifrice fluoré.',
      'Limitez le sucre, surtout le soir.',
      'Un contrôle dentaire par an, sans attendre la douleur.',
    ],
    keyPointsAr: [
      'تنظيف مرتين يوميًا، دقيقتين، بمعجون فلور.',
      'قلّل السكر، خاصة مساءً.',
      'فحص أسنان مرة في السنة دون انتظار الألم.',
    ],
  },
];
