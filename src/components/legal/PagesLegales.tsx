import { useLanguage } from '../../contexts/LanguageContext';

/**
 * Conditions d'utilisation, politique de confidentialité, mentions légales.
 *
 * ── Pourquoi ces pages existent ──
 *
 * Il n'y en avait aucune. Le service collecte des motifs de consultation, des
 * numéros de téléphone et l'identité de mineurs — la catégorie de données la
 * plus sensible qui soit — et ne disait nulle part ce qu'il en faisait, ni
 * combien de temps, ni quels droits avaient les personnes concernées.
 *
 * ── Ce que ces textes sont, et ne sont pas ──
 *
 * Ce sont des textes de DÉPART, écrits à partir de ce que le code fait
 * réellement : chaque affirmation ci-dessous correspond à un comportement
 * qu'on peut vérifier dans le serveur. Ils ne sont pas rédigés par un juriste
 * et ne remplacent pas son avis. Deux choses restent à compléter par
 * l'exploitant, et elles sont signalées à l'écran : l'identité de l'éditeur, et
 * la déclaration auprès de l'ANPDP.
 *
 * Mieux vaut un texte exact et incomplet que pas de texte du tout — mais il
 * doit dire lui-même où il est incomplet, sinon il rassure à tort.
 */

type Page = 'conditions' | 'confidentialite' | 'mentions';

interface Props {
  page: Page;
  onRetour: () => void;
}

/** Marqueur visible : ce paragraphe attend une information de l'exploitant. */
function AComplete({ children }: { children: React.ReactNode }) {
  return (
    <p className="my-4 p-4 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-900 leading-relaxed">
      <strong className="font-bold">À compléter — </strong>{children}
    </p>
  );
}

function Titre({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-bold text-gray-900 mt-8 mb-3">{children}</h2>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] leading-relaxed text-gray-700 mb-3">{children}</p>;
}

function Liste({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc ms-5 space-y-2 text-[15px] leading-relaxed text-gray-700 mb-3">
      {items.map((t, i) => <li key={i}>{t}</li>)}
    </ul>
  );
}

const MAJ = '22 août 2026';

export default function PagesLegales({ page, onRetour }: Props) {
  const { language } = useLanguage();
  const isArabic = language === 'ar';

  const titres: Record<Page, { fr: string; ar: string }> = {
    conditions: { fr: 'Conditions d’utilisation', ar: 'شروط الاستخدام' },
    confidentialite: { fr: 'Politique de confidentialité', ar: 'سياسة الخصوصية' },
    mentions: { fr: 'Mentions légales', ar: 'معلومات قانونية' },
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-2)' }} dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="max-w-3xl mx-auto px-4 py-10">
        <button
          onClick={onRetour}
          className="mb-6 text-sm font-bold text-blue-600 hover:underline inline-flex items-center gap-1.5"
        >
          <span aria-hidden="true">{isArabic ? '→' : '←'}</span>
          {isArabic ? 'العودة' : 'Retour'}
        </button>

        <article className="bg-white rounded-3xl p-7 sm:p-10 shadow-sm">
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            {isArabic ? titres[page].ar : titres[page].fr}
          </h1>
          <p className="text-xs text-gray-400 mt-2 mb-2">
            {isArabic ? 'آخر تحديث : ' : 'Dernière mise à jour : '}{MAJ}
          </p>

          {isArabic ? (
            <P>
              هذه النسخة العربية ملخّص. النص الفرنسي هو المرجع في حال الاختلاف.
            </P>
          ) : null}

          {page === 'conditions' && <Conditions />}
          {page === 'confidentialite' && <Confidentialite />}
          {page === 'mentions' && <Mentions />}
        </article>
      </div>
    </div>
  );
}

function Conditions() {
  return (
    <>
      <Titre>Ce que fait chifak</Titre>
      <P>
        chifak met en relation des patients et des praticiens de santé en Algérie pour la prise
        de rendez-vous. Le service ne délivre aucun soin, ne pose aucun diagnostic et
        n’intervient pas dans la relation entre le patient et le praticien.
      </P>

      <Titre>L’assistant d’orientation n’est pas un médecin</Titre>
      <P>
        L’assistant propose une spécialité à partir de ce que vous décrivez. Il ne pose pas de
        diagnostic, ne prescrit rien, et peut se tromper. En cas de signe grave — douleur
        thoracique, difficulté à respirer, saignement abondant, perte de conscience, pensées
        suicidaires — appelez immédiatement la Protection civile (14 ou 1021) ou le SAMU (115).
        N’attendez pas un rendez-vous.
      </P>

      <Titre>Votre compte</Titre>
      <Liste items={[
        'Les informations que vous saisissez doivent être exactes : le praticien s’en sert pour savoir qui il reçoit et pour vous joindre.',
        'Un compte est personnel. Prendre rendez-vous pour un tiers majeur suppose son propre compte ; pour un enfant mineur, le rendez-vous reste rattaché au vôtre.',
        'Vous êtes responsable de votre mot de passe. Si vous pensez que quelqu’un y a accès, changez-le : toutes vos autres sessions sont alors fermées.',
      ]} />

      <Titre>Rendez-vous et annulation</Titre>
      <Liste items={[
        'Un rendez-vous confirmé engage votre présence. Si vous ne pouvez pas venir, annulez : le créneau repart aussitôt vers un autre patient.',
        'Vous pouvez annuler depuis votre compte, ou depuis le lien figurant dans l’e-mail de confirmation si vous avez réservé sans compte.',
        'Un praticien peut annuler un rendez-vous — indisponibilité, urgence. Vous en êtes averti par e-mail, avec le motif lorsqu’il en indique un.',
        'Les absences répétées sans annulation peuvent conduire à restreindre l’accès au service.',
      ]} />

      <Titre>Avis</Titre>
      <P>
        Vous pouvez évaluer un praticien après une consultation qui a réellement eu lieu. Les avis
        engagent leur auteur. Un praticien ne peut pas faire retirer un avis qui lui déplaît ;
        seuls les propos injurieux, diffamatoires ou sans rapport avec la consultation sont retirés.
      </P>

      <Titre>Praticiens</Titre>
      <P>
        L’inscription d’un praticien est soumise à examen par notre équipe. Aucun programme ne
        peut vérifier qu’une personne exerce réellement la spécialité qu’elle déclare : cet examen
        humain est la seule barrière, et il n’est pas infaillible. Signalez-nous toute fiche qui
        vous paraît douteuse.
      </P>

      <Titre>Interruptions</Titre>
      <P>
        Le service peut être indisponible — maintenance, panne, coupure réseau. chifak ne peut
        pas garantir une disponibilité permanente, et n’est pas responsable d’un rendez-vous
        manqué du fait d’une indisponibilité. En cas de doute sur un rendez-vous, appelez
        directement le cabinet.
      </P>

      <Titre>Modification de ces conditions</Titre>
      <P>
        Ces conditions peuvent évoluer. La date de mise à jour figure en haut de cette page ;
        une modification importante vous sera signalée dans l’application.
      </P>
    </>
  );
}

function Confidentialite() {
  return (
    <>
      <P>
        Cette page décrit ce que le service fait réellement de vos données. Chaque point
        correspond à un comportement du programme, pas à une intention.
      </P>

      <Titre>Ce que nous collectons</Titre>
      <Liste items={[
        <><strong>Votre compte</strong> : nom, adresse e-mail, téléphone, mot de passe (jamais conservé en clair — seule une empreinte irréversible l’est).</>,
        <><strong>Vos rendez-vous</strong> : praticien, date, heure, mode de consultation, et le motif si vous en indiquez un.</>,
        <><strong>Un enfant mineur</strong>, si vous réservez pour lui : prénom, nom et âge. Le rendez-vous reste rattaché à votre compte.</>,
        <><strong>Vos avis</strong> : note, commentaire, et votre prénom affiché publiquement.</>,
        <><strong>Connexion par Google ou Facebook</strong>, si vous l’utilisez : votre identifiant chez ce service, votre adresse et votre nom. Nous ne recevons rien d’autre, et jamais votre mot de passe.</>,
      ]} />
      <P>
        L’assistant d’orientation transmet vos messages à un fournisseur d’intelligence
        artificielle pour produire sa réponse. Ces échanges ne sont pas conservés par chifak et ne
        sont rattachés à aucun dossier. N’y écrivez pas d’informations dont vous ne voudriez pas
        qu’elles quittent l’application.
      </P>

      <Titre>Ce que nous ne collectons pas</Titre>
      <Liste items={[
        'Aucune donnée biométrique. La vérification d’identité des praticiens se fait dans leur navigateur : seul le résultat nous parvient, jamais l’image.',
        'Aucun traceur publicitaire, aucun profilage commercial.',
        'Aucune revente de données. Jamais.',
      ]} />

      <Titre>Qui voit quoi</Titre>
      <Liste items={[
        <><strong>Le praticien que vous consultez</strong> voit votre nom, votre téléphone, votre e-mail et le motif indiqué. Il peut ajouter des remarques qui lui sont propres : elles relèvent de son dossier et ne vous sont pas transmises par l’application.</>,
        <><strong>Le personnel du cabinet</strong> voit la liste des rendez-vous et les coordonnées associées, ce qui lui est nécessaire pour organiser l’accueil.</>,
        <><strong>Les autres patients</strong> ne voient rien de vous, sauf le prénom affiché sur un avis que vous publiez.</>,
        <><strong>Les autres praticiens</strong> n’ont accès à aucun de vos rendez-vous.</>,
      ]} />

      <Titre>Combien de temps</Titre>
      <Liste items={[
        'Votre compte : tant que vous le conservez.',
        'Vos rendez-vous : ils font aussi partie du dossier du praticien, qui a ses propres obligations de conservation. Ils subsistent après la suppression de votre compte, mais sans rien qui permette de vous identifier.',
        'Les codes de vérification : dix à quinze minutes, puis effacés automatiquement.',
      ]} />

      <Titre>Vos droits</Titre>
      <P>
        Depuis votre compte, onglet <em>Mes informations</em>, vous pouvez à tout moment :
      </P>
      <Liste items={[
        'Corriger votre nom et votre téléphone.',
        'Obtenir la totalité de vos données, dans un fichier lisible.',
        'Supprimer votre compte. Vos nom, adresse, téléphone et mot de passe sont alors effacés définitivement, vos rendez-vous à venir sont annulés, et vos rendez-vous passés deviennent anonymes.',
      ]} />
      <AComplete>
        Une adresse de contact doit figurer ici pour les demandes que l’application ne permet pas
        de faire seule (opposition à un traitement, réclamation).
      </AComplete>

      <Titre>Sécurité</Titre>
      <Liste items={[
        'Les échanges avec le service sont chiffrés.',
        'Les mots de passe sont conservés sous forme d’empreinte irréversible.',
        'Le personnel dispose d’une double authentification.',
        'Aucune mesure n’est absolue. Si nous constatons une atteinte à vos données, nous vous en informerons.',
      ]} />

      <Titre>Traitement des données de santé</Titre>
      <AComplete>
        Le traitement de données de santé en Algérie relève de la loi 18-07 relative à la
        protection des personnes physiques dans le traitement des données à caractère personnel.
        La déclaration ou l’autorisation auprès de l’Autorité nationale de protection des données
        personnelles (ANPDP) doit être effectuée par l’exploitant du service, et sa référence
        mentionnée ici. Faites relire cette page par un juriste avant l’ouverture au public.
      </AComplete>
    </>
  );
}

function Mentions() {
  return (
    <>
      <Titre>Éditeur du service</Titre>
      <AComplete>
        Doivent figurer ici : la dénomination sociale ou le nom de l’exploitant, la forme
        juridique, l’adresse du siège, le numéro d’identification (registre du commerce / NIF),
        le nom du directeur de la publication, ainsi qu’un e-mail et un téléphone de contact.
      </AComplete>

      <Titre>Hébergement</Titre>
      <P>
        L’application et sa base de données sont hébergées chez des prestataires tiers. Les
        données peuvent donc être stockées hors d’Algérie.
      </P>
      <AComplete>
        Nommez ici l’hébergeur retenu et le pays d’hébergement. Un transfert de données de santé
        hors du territoire national appelle une vérification juridique préalable.
      </AComplete>

      <Titre>Propriété</Titre>
      <P>
        La marque chifak, son identité visuelle et le contenu éditorial du service sont protégés.
        Les informations publiées par les praticiens restent les leurs.
      </P>

      <Titre>Signaler un problème</Titre>
      <P>
        Fiche de praticien inexacte, avis injurieux, comportement suspect, doute sur la sécurité
        de votre compte : écrivez-nous.
      </P>
      <AComplete>
        Indiquez ici l’adresse de signalement, et le délai sous lequel vous vous engagez à répondre.
      </AComplete>

      <Titre>Urgences</Titre>
      <P>
        chifak n’est pas un service d’urgence. Protection civile : 14 ou 1021. SAMU : 115.
      </P>
    </>
  );
}
