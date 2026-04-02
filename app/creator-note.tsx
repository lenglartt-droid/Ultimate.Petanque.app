import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import theme from '@/constants/theme';
import { useLanguage } from '@/hooks/useLanguage';

const CONTACT_EMAIL = 'ultimate.petanque.app@gmail.com';

export default function CreatorNoteScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const fr = language === 'fr';

  return (
    <SafeAreaView edges={['top']} style={st.container}>
      {/* Header */}
      <View style={st.header}>
        <Pressable style={st.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={st.headerTitle}>{fr ? 'Note du createur' : 'Creator note'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={st.scroll}
        contentContainerStyle={[st.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <LinearGradient
          colors={['#0F172A', '#1E3A5F']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={st.hero}
        >
          <View style={st.heroDecoCircle1} />
          <View style={st.heroDecoCircle2} />
          <View style={st.heroIconWrap}>
            <MaterialIcons name="favorite" size={32} color="#F87171" />
          </View>
          <Text style={st.heroTitle}>{fr ? 'Note du createur' : 'Creator note'}</Text>
          <View style={st.heroDivider} />
          <Text style={st.heroQuote}>
            {fr
              ? '"Juste le jeu, et la verite du terrain."'
              : '"Just the game, and the truth of the court."'}
          </Text>
        </LinearGradient>

        {/* Section 1: Identity */}
        <View style={st.card}>
          <Text style={st.bodyText}>
            {fr
              ? 'Je ne suis pas une entreprise.\nJe suis simplement un joueur de petanque, comme vous.'
              : 'I am not a company.\nI am simply a petanque player, just like you.'}
          </Text>
        </View>

        {/* Section 2: Story */}
        <View style={st.card}>
          <View style={st.sectionIcon}>
            <MaterialIcons name="auto-stories" size={20} color="#2563EB" />
          </View>
          <Text style={st.bodyText}>
            {fr
              ? "J'ai decouvert ce sport en 2021. Depuis, il ne m'a plus quitte. Comme beaucoup, j'ai appris sur le terrain, avec des amis, des inconnus, des conseils parfois justes... parfois biaises. Et tres vite, une idee s'est imposee : pourquoi n'existe-t-il pas un outil simple, accessible a tous, pour vraiment progresser et se situer ?"
              : "I discovered this sport in 2021. Since then, it has never left me. Like many, I learned on the court, with friends, strangers, advice sometimes accurate... sometimes biased. And very quickly, an idea took hold: why isn't there a simple tool, accessible to everyone, to truly improve and know where you stand?"}
          </Text>
        </View>

        {/* Section 3: Not a developer */}
        <View style={st.card}>
          <Text style={st.bodyText}>
            {fr
              ? "Je ne suis pas developpeur. Je ne travaille pas dans l'informatique.\nMais j'ai decide de creer cette application malgre tout, en y investissant personnellement, avec une seule ambition : offrir un outil gratuit a la communaute mondiale des joueurs de petanque."
              : "I am not a developer. I do not work in IT.\nBut I decided to create this application anyway, investing personally, with a single ambition: to offer a free tool to the global petanque community."}
          </Text>
        </View>

        {/* Section 4: Tool features */}
        <View style={st.card}>
          <View style={st.sectionIcon}>
            <MaterialIcons name="lightbulb" size={20} color="#F59E0B" />
          </View>
          <Text style={st.sectionLabel}>
            {fr ? 'Un outil qui permet :' : 'A tool that allows you to:'}
          </Text>
          <View style={st.bulletList}>
            <BulletItem
              icon="leaderboard"
              color="#2563EB"
              text={fr
                ? "d'avoir un classement juste, fiable et securise, au niveau local comme mondial"
                : "have a fair, reliable and secure ranking, both locally and globally"}
            />
            <BulletItem
              icon="bar-chart"
              color="#7C3AED"
              text={fr
                ? "de mieux comprendre son jeu grace a des statistiques avancees (type de terrain, boules, tirs, points, duree des matchs, etc.)"
                : "better understand your game through advanced statistics (terrain type, boules, shots, points, match duration, etc.)"}
            />
            <BulletItem
              icon="track-changes"
              color="#10B981"
              text={fr
                ? "d'identifier ses forces et ses axes d'amelioration"
                : "identify your strengths and areas for improvement"}
            />
            <BulletItem
              icon="psychology"
              color="#EA580C"
              text={fr
                ? "de recevoir des analyses et des conseils concrets, bases sur ses propres performances"
                : "receive analysis and concrete advice based on your own performance"}
            />
          </View>
          <View style={st.emphasisBlock}>
            <Text style={st.emphasisText}>
              {fr
                ? 'Mais surtout, un outil qui depasse le simple score.'
                : 'But above all, a tool that goes beyond the simple score.'}
            </Text>
          </View>
        </View>

        {/* Section 5: Community call */}
        <View style={[st.card, st.communityCard]}>
          <View style={st.sectionIcon}>
            <MaterialIcons name="people" size={20} color="#059669" />
          </View>
          <Text style={st.bodyText}>
            {fr
              ? 'Cette application ne peut exister que grace a vous.'
              : 'This application can only exist thanks to you.'}
          </Text>
          <Text style={[st.bodyText, { marginTop: 12 }]}>
            {fr
              ? "Si chacun partage ses terrains favoris, les clubs qu'il represente, les tournois auxquels il participe, alors nous creons ensemble bien plus qu'une application :"
              : "If everyone shares their favorite courts, the clubs they represent, the tournaments they participate in, then together we create much more than an application:"}
          </Text>
          <View style={[st.bulletList, { marginTop: 12 }]}>
            <BulletItem
              icon="public"
              color="#2563EB"
              text={fr ? 'un reseau mondial de joueurs' : 'a global network of players'}
            />
            <BulletItem
              icon="connect-without-contact"
              color="#7C3AED"
              text={fr
                ? "une facon plus simple de se rencontrer, chez soi comme a l'etranger"
                : 'a simpler way to meet, at home and abroad'}
            />
            <BulletItem
              icon="groups"
              color="#10B981"
              text={fr
                ? "une communaute ouverte, ou l'on joue, echange et progresse ensemble"
                : 'an open community, where we play, exchange and progress together'}
            />
          </View>
        </View>

        {/* Section 6: Motto */}
        <View style={st.mottoCard}>
          <LinearGradient
            colors={['#0F172A', '#1E293B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={st.mottoGradient}
          >
            <Text style={st.mottoLine}>{fr ? "Ici, pas de jugement." : "Here, no judgment."}</Text>
            <Text style={st.mottoLine}>{fr ? "Pas d'ego." : "No ego."}</Text>
            <Text style={st.mottoHighlight}>{fr ? "Juste le jeu, et la verite du terrain." : "Just the game, and the truth of the court."}</Text>
          </LinearGradient>
        </View>

        {/* Section 7: For everyone */}
        <View style={st.card}>
          <Text style={st.bodyText}>
            {fr
              ? "Que vous soyez debutant ou joueur confirme, cette application est faite pour vous.\nPour vous aider a progresser, a comprendre votre jeu... et a prendre encore plus de plaisir a jouer."
              : "Whether you are a beginner or an experienced player, this application is made for you.\nTo help you improve, understand your game... and enjoy playing even more."}
          </Text>
        </View>

        {/* Section 8: Free + support */}
        <View style={[st.card, st.supportCard]}>
          <View style={st.sectionIcon}>
            <MaterialIcons name="volunteer-activism" size={20} color="#F59E0B" />
          </View>
          <Text style={st.bodyText}>
            {fr
              ? "L'application restera gratuite pour tous."
              : "The application will remain free for everyone."}
          </Text>
          <Text style={[st.bodyText, { marginTop: 12 }]}>
            {fr
              ? "Pour celles et ceux qui souhaitent soutenir le projet et contribuer a le faire grandir, il est possible de le faire simplement en choisissant de retirer les publicites. C'est aujourd'hui la maniere la plus directe de participer a son developpement."
              : "For those who wish to support the project and help it grow, you can do so simply by choosing to remove ads. This is currently the most direct way to contribute to its development."}
          </Text>
          <Pressable
            style={({ pressed }) => [st.supportBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
            onPress={() => router.push('/remove-ads' as any)}
          >
            <MaterialIcons name="favorite" size={18} color="#FFF" />
            <Text style={st.supportBtnText}>
              {fr ? 'Soutenir le projet' : 'Support the project'}
            </Text>
          </Pressable>
        </View>

        {/* Section 9: Thank you */}
        <View style={st.thanksCard}>
          <MaterialIcons name="favorite" size={20} color="#F87171" />
          <Text style={st.thanksText}>
            {fr
              ? "Merci de faire partie de l'aventure."
              : "Thank you for being part of the adventure."}
          </Text>
        </View>

        {/* Contact */}
        <View style={st.contactCard}>
          <View style={st.contactIconWrap}>
            <MaterialIcons name="forum" size={24} color={theme.primary} />
          </View>
          <Text style={st.contactTitle}>
            {fr ? "Besoin d'aide ou une idee ?" : 'Need help or have an idea?'}
          </Text>
          <Text style={st.contactSub}>
            {fr ? 'Notre equipe repond sous 24h' : 'Our team responds within 24h'}
          </Text>
          <Pressable
            style={({ pressed }) => [st.contactBtn, pressed && { opacity: 0.85 }]}
            onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}?subject=Ultimate%20Petanque%20-%20Feedback`)}
          >
            <MaterialIcons name="email" size={18} color="#FFF" />
            <Text style={st.contactBtnText}>{CONTACT_EMAIL}</Text>
          </Pressable>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function BulletItem({ icon, color, text }: { icon: string; color: string; text: string }) {
  return (
    <View style={st.bulletRow}>
      <View style={[st.bulletIcon, { backgroundColor: color + '12' }]}>
        <MaterialIcons name={icon as any} size={15} color={color} />
      </View>
      <Text style={st.bulletText}>{text}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#0F172A' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16 },

  // Hero
  hero: { borderRadius: 22, padding: 32, alignItems: 'center', marginTop: 16, marginBottom: 20, overflow: 'hidden', position: 'relative' },
  heroDecoCircle1: { position: 'absolute', top: -30, right: -20, width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.04)' },
  heroDecoCircle2: { position: 'absolute', bottom: -20, left: -15, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.03)' },
  heroIconWrap: { width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(248,113,113,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 2, borderColor: 'rgba(248,113,113,0.2)' },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#FFF', textAlign: 'center', letterSpacing: -0.3 },
  heroDivider: { width: 40, height: 2, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 1, marginVertical: 16 },
  heroQuote: { fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', fontStyle: 'italic', lineHeight: 19 },

  // Cards
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  communityCard: { borderColor: '#10B98120', backgroundColor: '#F0FDF8' },
  supportCard: { borderColor: '#F59E0B20', backgroundColor: '#FFFBEB' },

  sectionIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  sectionLabel: { fontSize: 15, fontWeight: '600', color: '#0F172A', marginBottom: 12 },

  bodyText: { fontSize: 15, color: '#334155', lineHeight: 25 },

  // Bullet list
  bulletList: { gap: 10 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bulletIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  bulletText: { flex: 1, fontSize: 14, color: '#475569', lineHeight: 22 },

  // Emphasis
  emphasisBlock: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  emphasisText: { fontSize: 15, fontWeight: '700', color: '#0F172A', fontStyle: 'italic', textAlign: 'center' },

  // Motto
  mottoCard: { marginBottom: 12, borderRadius: 16, overflow: 'hidden' },
  mottoGradient: { padding: 28, alignItems: 'center', gap: 6 },
  mottoLine: { fontSize: 16, color: 'rgba(255,255,255,0.65)', fontWeight: '500', textAlign: 'center' },
  mottoHighlight: { fontSize: 17, color: '#FFF', fontWeight: '700', textAlign: 'center', marginTop: 6, fontStyle: 'italic' },

  // Support
  supportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, backgroundColor: '#F59E0B', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 14 },
  supportBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },

  // Thanks
  thanksCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 24, marginBottom: 12 },
  thanksText: { fontSize: 16, fontWeight: '700', color: '#0F172A', fontStyle: 'italic' },

  // Contact
  contactCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  contactIconWrap: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#2563EB10', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  contactTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
  contactSub: { fontSize: 13, color: '#94A3B8', marginBottom: 16 },
  contactBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#2563EB', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 },
  contactBtnText: { fontSize: 13, fontWeight: '600', color: '#FFF' },
});
